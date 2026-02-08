import { ethers } from 'ethers';
import { createClient } from '@supabase/supabase-js';

import dotenv from 'dotenv';
dotenv.config();

import { EventType } from '@/types';
import {
	CONTRACT_ADDRESS,
	ethProvider,
	formatTokenAmount,
	getMetadata,
} from '@/utils';
import { ensureAccountExists } from '@/utils/security';

export const supabase = createClient(
	process.env.SUPABASE_URL!,
	process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function saveEvent(
	type: 'DEPOSIT' | 'WITHDRAW',
	token: string | null,
	from: string,
	to: string,
	amount: bigint,
	tx_hash: string,
	log_index: number,
	block_number: number,
) {
	const metadata = await getMetadata(ethProvider, token ?? undefined);
	const account = type === 'DEPOSIT' ? from : to;

	await ensureAccountExists(account, true);

	try {
		const { data, error } = await supabase
			.from('evm_birdge_events')
			.insert({
				contract_address: CONTRACT_ADDRESS,
				account_address: account, // NEW FK SAFE
				tx_hash,
				log_index,
				event_type: type,
				from_address: from,
				to_address: to,
				token: token, // NULL for native ETH
				amount: amount.toString(),
				block_number,
				metadata: metadata,
			})
			.select();

		if (error?.code === '23505') {
			console.log('⚠ Duplicate tx skipped:', tx_hash);
			return;
		}

		if (error) {
			console.error('❌ Supabase insert error:', error);
			throw error;
		}
		console.log('✅ Event stored:', data);
	} catch (error) {
		console.log(error);
		return;
	}

	await udpateAscendAccountDelta(
		type === 'DEPOSIT' ? from : to,
		token,
		amount,
		type,
		ethProvider,
	);
}

async function udpateAscendAccountDelta(
	address: string,
	token: string | null,
	amount: bigint,
	type: EventType,
	provider?: ethers.Provider,
) {
	const isToken = token !== null;
	const tokenKey = token ?? 'ETH';
	const delta = type === 'DEPOSIT' ? amount : -amount;

	const { data, error } = await supabase
		.from('ascend-accounts')
		.select('tokens, balance')
		.eq('address', address)
		.single();

	if (error) throw error;

	const tokens = data?.tokens ?? {};

	if (
		!tokens[tokenKey] ||
		!tokens[tokenKey].symbol ||
		tokens[tokenKey].decimals === undefined
	) {
		console.log('metadata fetch');
		const meta = await getMetadata(provider!, token ?? undefined);
		console.log({ meta });
		tokens[tokenKey] = {
			symbol: meta.symbol,
			decimals: meta.decimals,
			contract_type: meta.contract_type,
			available_balance: tokens[tokenKey]?.available_balance ?? '0',
		};
		console.log({ tokens });
		console.log('🛠 Migrated token metadata:', tokenKey, meta.symbol);
	}

	const current = BigInt(tokens[tokenKey]?.available_balance ?? '0');
	const newBalance = current + delta;

	if (newBalance < 0n) {
		throw new Error(`Negative balance detected for ${address}`);
	}

	tokens[tokenKey].available_balance = newBalance.toString();
	console.log({ tokens });

	const updatePayload: any = { tokens };

	if (isToken) {
		updatePayload.balance = Number(newBalance);
	}

	const { error: updateError } = await supabase
		.from('ascend-accounts')
		.update(updatePayload)
		.eq('address', address);

	if (updateError) throw updateError;

	const symbol = tokens[tokenKey].symbol;
	const decimals = tokens[tokenKey].decimals;

	console.log(
		`💰 ${type} ${symbol}:`,
		address,
		formatTokenAmount(current, decimals, symbol),
		'→',
		formatTokenAmount(newBalance, decimals, symbol),
	);
}
