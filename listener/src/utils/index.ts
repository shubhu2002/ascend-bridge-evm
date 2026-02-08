import { ethers, formatUnits } from 'ethers';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const file = path.join(__dirname, '../../../deployments/addresses.json');
export const { vault: CONTRACT_ADDRESS, usdt: USDT_ADDRESS } = JSON.parse(
	fs.readFileSync(file, 'utf-8'),
);

// ======== Wallets & Provier
export const ethProvider = new ethers.JsonRpcProvider(process.env.BUILDBEAR_HTTP_RPC!);
export const ownerWallet = new ethers.Wallet(process.env.TREASURY_OWNER_PK!, ethProvider);
export const middlemanWallet = new ethers.Wallet(process.env.MIDDLEMAN_PK!, ethProvider,);

const cache = new Map<string, any>();

export function formatTokenAmount(
	amount: bigint,
	decimals: number,
	symbol: string,
) {
	return `${formatUnits(amount, decimals)} ${symbol}`;
}

export async function getMetadata(provider: ethers.Provider, token?: string) {
	// Native ETH
	if (!token) {
		return {
			symbol: 'ETH',
			decimals: 18,
			contract_type: 'ETH',
		};
	}

	let meta = cache.get(token);
	if (meta) return meta;

	const erc20 = new ethers.Contract(
		token,
		[
			'function symbol() view returns(string)',
			'function decimals() view returns(uint8)',
		],
		provider,
	);

	let symbol = 'TOKEN';
	let decimals = 18;

	try {
		symbol = await erc20.symbol();
		decimals = await erc20.decimals();
	} catch {
		console.log('⚠ Could not fetch token metadata:', token);
	}

	meta = {
		symbol,
		decimals: Number(decimals),
		contract_type: 'ERC_20',
	};

	cache.set(token, meta);
	return meta;
}
