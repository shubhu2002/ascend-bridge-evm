import type { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';

import * as dotenv from 'dotenv';
dotenv.config();

const config: HardhatUserConfig = {
	solidity: '0.8.28',
	networks: {
		buildbear: {
			url: process.env.BUILDBEAR_HTTP_RPC as string,
			chainId: Number(process.env.CHAIN_ID!),
			accounts: [process.env.TREASURY_OWNER_PK!]
		},
	},
	etherscan: {
		enabled: true,
		apiKey: {
			buildbear: 'verifyContract',
		},
		customChains: [
			{
				network: 'buildbear',
				chainId: Number(process.env.CHAIN_ID!),
				urls: {
					apiURL: `https://rpc.buildbear.io/verify/etherscan/${process.env.BUILDBEAR_NAME! as string}`,
					browserURL:
						`https://explorer.buildbear.io/${process.env.BUILDBEAR_NAME! as string}`,
				},
			},
		],
	},
};

export default config;
