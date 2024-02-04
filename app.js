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
			const data = JSON.parse(chunk);
	
			const tokens = {
				base: new Token(chainId, data.tokens.base.address, data.tokens.base.decimals),
				mod: new Token(chainId, data.tokens.mod.address, data.tokens.mod.decimals)
			}
	
			const amount = CurrencyAmount.fromRawAmount(
				tokens.base,
				data.amount
			);
	
			router.route(
				amount,
				tokens.mod,
				data.action === 'sell' ? TradeType.EXACT_OUTPUT : TradeType.EXACT_INPUT,
				{
					recipient: data.address,
					slippageTolerance: new Percent(20, 10000), // 0.2%
					deadline: Math.floor(Date.now() / 1000) + 60 * 10,
					type: SwapType.SWAP_ROUTER_02
				}
			).then(({ methodParameters: { calldata, value } }) => callback(null, `${calldata}:${value}`));
		} catch (error) {
			console.error(error);
			callback(null, null);
		}
	}
})


pipeline(
	process.stdin,
	transformStream,
	process.stdout,
	err => err && console.error(err)
)
