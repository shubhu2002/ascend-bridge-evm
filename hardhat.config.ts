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
					apiURL: 'https://rpc.buildbear.io/verify/etherscan/worried-wong-7a54908a',
					browserURL:
						'https://explorer.buildbear.io/worried-wong-7a54908a',
				},
			},
		],
	},
};

export default config;
