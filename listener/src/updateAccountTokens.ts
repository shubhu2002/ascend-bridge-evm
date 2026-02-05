import { ethers } from 'ethers';
import { supabase } from './db';
import { getMetadata } from './tokenMetadata';

export async function syncAccountToken(
	address: string,
	metadata: any,
	provider: ethers.Provider,
	token?: string | null,
) {
	const { data, error } = await supabase
		.from('ascend-accounts')
		.select('tokens')
		.eq('address', address)
		.single();

	if (error) throw error;

	const portfolioTokens = data?.tokens ?? {};

	// ---------- TOKEN UPDATE ----------
	if (token) {
		portfolioTokens[token] = {
			available_balance: metadata.available_balance,
			symbol: metadata.symbol,
			decimals: metadata.decimals,
			contract_type: metadata.contract_type,
		};

		console.log(
			'🪙 Synced token:',
			address,
			metadata.symbol,
			metadata.available_balance,
		);
	}

	// ---------- ETH UPDATE (ALWAYS) ----------
	let ethMetadata;
	try {
		ethMetadata = await getMetadata(provider, address); // no token = native
	} catch {
		console.log('⚠ ETH refresh failed');
	}

	const { error: updateError } = await supabase
		.from('ascend-accounts')
		.update({
			tokens: portfolioTokens,
			balance: ethMetadata?.available_balance,
		})
		.eq('address', address);

	if (updateError) throw updateError;

	console.log('💰 Synced ETH:', address, ethMetadata?.available_balance);
}
