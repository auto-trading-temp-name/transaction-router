import { Transform, pipeline } from 'node:stream';
import { AlphaRouter, CurrencyAmount, SwapType } from '@uniswap/smart-order-router';
import { JsonRpcProvider } from '@ethersproject/providers';
import { Percent, Token, TradeType } from '@uniswap/sdk-core';

const provider = new JsonRpcProvider(process.argv[2]);
const chainId = Number(process.argv[3]);

const router = new AlphaRouter({
	chainId,
	provider
});

/*
	Chunk Format:
	{
		amount: Number
		action: String (buy | sell)
		tokens: {
			base: {
				address: String,
				decimals: Number
			},
			mod: {
				address: String,
				decimals: Number
			}
		}
	}
*/

const transformStream = new Transform({
	transform(chunk, encoding, callback) {
		try {
			const data = String(chunk).split(':');
			const transaction = JSON.parse(data.slice(0, -1).join(':'));
			const keyId = data[data.length - 1];
	
			const tokens = {
				base: new Token(chainId, transaction.pair[0].address, transaction.pair[0].decimals),
				mod: new Token(chainId, transaction.pair[1].address, transaction.pair[1].decimals)
			}
	
			const amount = CurrencyAmount.fromRawAmount(
				tokens.base,
				transaction.amount
			);
	
			router.route(
				amount,
				tokens.mod,
				transaction.action === 'sell' ? TradeType.EXACT_OUTPUT : TradeType.EXACT_INPUT,
				{
					recipient: transaction.address,
					slippageTolerance: new Percent(20, 10000), // 0.2%
					deadline: Math.floor(Date.now() / 1000) + 60 * 10,
					type: SwapType.SWAP_ROUTER_02
				}
			).then(route => {
				if (!route) throw new Error("no route");
				const { methodParameters: { calldata, value } } = route;
				callback(null, `${calldata}:${value}:${keyId}`);
			});
		} catch (error) {
			console.error(error);
			callback(null, null);
		}
	}
});

pipeline(
	process.stdin,
	transformStream,
	process.stdout,
	err => err && console.error(err)
);

process.stdout.on('error', err => err.code === 'EPIPE' ? process.exit(0) : null);

