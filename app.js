import express from 'express';
import bunyanMiddleware from 'bunyan-middleware';
import epipebomb from 'epipebomb';
import { createLogger } from 'bunyan';
import ccxt from 'ccxt';

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

const allowedProviders = ['coinbase'];

const padArray = (array, length, fill) =>
	length > array.length ? array.concat(Array(length - array.length).fill(fill)) : array;

/**
 * @description Routes a transaction
 * @param {Object} transaction
 * @param {number} transaction.amount
 * @param {('buy'|'sell')} transaction.action
 * @param {[string, string]} transaction.pair
 * @param {('coinbase')} transaction.provider
 * @param {string} transaction.auth
 */
const routeTransaction = async ({ action, pair, provider, auth }) => {
	if (!allowedProviders.includes(provider))
		throw new Error(`provider ${provider} is not in allowed provider list`);

	const [key, secret, id, password] = padArray(auth.split(':'), 4, null);
	// eslint-disable-next-line no-param-reassign
	auth = {
		apiKey: key.replace(/\\n/, '\n'),
		secret: secret.replace(/\\n/, '\n'),
		uid: id,
		password
	};

	const exchange = new ccxt[provider](auth);
	exchange.checkRequiredCredentials();

	if (action === 'buy') await exchange.createMarketBuyOrder(pair.reverse().join('/'));
	else await exchange.createMarketBuyOrder(pair.join('/'), action);
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

const server = app.listen(process.argv[2] || 0, () =>
	log.info({ port: server.address().port }, 'server listening')
);
