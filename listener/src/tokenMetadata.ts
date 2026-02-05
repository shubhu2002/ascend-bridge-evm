	import { ethers } from 'ethers';

	const cache = new Map<string, any>();

	export async function getMetadata(
		provider: ethers.Provider,
		address: string,
		token?: string,
	) {
		// Native ETH
		if (!token) {
			let balance = 0n;
			try {
				balance = await provider.getBalance(address);
			} catch {
				console.log('⚠ Could not fetch ETH balance:', address);
			}

			return {
				symbol: 'ETH',
				decimals: 18,
				contract_type: 'ETH',
				available_balance: balance.toString(),
			};
		}
		// ERC_20
		let baseMeta = cache.get(token);

		if (!baseMeta) {
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

			baseMeta = {
				symbol,
				decimals: Number(decimals),
				contract_type: 'ERC_20',
			};

			cache.set(token, baseMeta);
		}
		// fetch user's token balance (NOT cached)
		let balance = 0n;

		try {
			const erc20 = new ethers.Contract(
				token,
				['function balanceOf(address) view returns(uint256)'],
				provider,
			);

			balance = await erc20.balanceOf(address);
		} catch {
			console.log('⚠ Could not fetch user token balance:', token, address);
		}

		return {
			...baseMeta,
			available_balance: balance.toString(),
		};
	}
