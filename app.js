import express from 'express';
import bunyanMiddleware from 'bunyan-middleware';
import epipebomb from 'epipebomb';
import { AlphaRouter, CurrencyAmount, SwapType } from '@uniswap/smart-order-router';
import { JsonRpcProvider } from '@ethersproject/providers';
import { Percent, Token, TradeType } from '@uniswap/sdk-core';
import { createLogger } from 'bunyan';

epipebomb();

const log = createLogger({
	name: 'transaction-router',
	streams: [
		{
			level: 'trace',
			stream: process.stdout
		},
		{
			level: 'trace',
			path: 'transaction-router.log'
		}
	]
});

const provider = new JsonRpcProvider(process.argv[2]);
const chainId = Number(process.argv[3]);

const router = new AlphaRouter({
	chainId,
	provider
});

log.info({ chainId, providerUrl: process.argv[2] }, 'initialized router');

/*
	Transaction Format:
	{
		amount: Number
		action: String (buy | sell)
		pair: [
			{
				address: String,
				decimals: Number
			},
			{
				address: String,
				decimals: Number
			}
		]
	}
*/

const routeTransaction = async transaction => {
	const tokens = {
		base: new Token(chainId, transaction.pair[0].address, transaction.pair[0].decimals),
		mod: new Token(chainId, transaction.pair[1].address, transaction.pair[1].decimals)
	};

	const amount = CurrencyAmount.fromRawAmount(tokens.base, transaction.amount);

	const route = await router.route(
		amount,
		tokens.mod,
		transaction.action === 'sell' ? TradeType.EXACT_OUTPUT : TradeType.EXACT_INPUT,
		{
			recipient: transaction.address,
			slippageTolerance: new Percent(20, 10000), // 0.2%
			deadline: Math.floor(Date.now() / 1000) + 60 * 10,
			type: SwapType.SWAP_ROUTER_02
		}
	);
	if (!route) throw new Error('No Route');
	const {
		methodParameters: { calldata, value }
	} = route;
	return `${calldata}:${value}`;
};

const app = express();
app.use(express.json());
app.use(
	bunyanMiddleware({
		logger: log,
		headerName: 'X-Request-Id',
		propertyName: 'reqId',
		logName: 'reqId'
	})
);

app.get('/ping', (req, res) => res.status(200).send('pong'));

app.post('/route', async (req, res) => {
	if (!req.body) return res.status(400).send('No Body');

	try {
		req.log.info({ transaction: req.body }, 'routing transaction');
		const route = await routeTransaction(req.body);
		req.log.info({ route }, 'routed transaction');
		res.status(200).send(route);
	} catch (err) {
		req.log.error({ error: err }, 'error routing');
		res.status(500).send(err.toString());
	}
});

const port = 6278;
app.listen(port, () => log.info({ port }, 'server listening'));
