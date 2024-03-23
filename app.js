import express from 'express';
import bunyanMiddleware from 'bunyan-middleware';
import epipebomb from 'epipebomb';
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

/*
	Transaction Format:
	{
		amount: Number
		action: String (buy | sell)
		pair: [
			String,
			String
		],
		provider: String
	}
*/

const routeTransaction = async transaction => {
	// @TODO blah blah ccxt blah blah transaction blah blah exchange blah blah blah
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

const server = app.listen(6278, () =>
	log.info({ port: server.address().port }, 'server listening')
);
