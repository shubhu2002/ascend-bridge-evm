import { createClient } from '@supabase/supabase-js';

import * as dotenv from 'dotenv';
dotenv.config();

export const supabase = createClient(
	process.env.SUPABASE_URL!,
	process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function saveEvent(e: any) {
	try {
		const { data, error } = await supabase
			.from('evm_birdge_events')
			.insert({
				contract_address: e.contract,
				tx_hash: e.txHash,
				event_type: e.type,
				from_address: e.from,
				to_address: e.to,
				token: e.token, // NULL for native ETH
				amount: e.amount,
				block_number: e.blockNumber,
			})
			.select();

		if (error) {
			console.error('❌ Supabase insert error:', error);
			throw error;
		}
		console.log('✅ Supabase insert success:', data);
	} catch (error) {
		console.log(error);
	}
}
