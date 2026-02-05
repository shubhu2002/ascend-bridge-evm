import { ethers } from 'ethers';

const cache = new Map<string, any>();

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
