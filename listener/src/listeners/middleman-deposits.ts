import { ethers, EventLog } from 'ethers';
import dotenv from 'dotenv';
dotenv.config();

import { supabase } from '@/supabase';

import { MIDDLEMAN_ERC20_ABI } from '@/utils/abis';
import { ensureAccountExists } from '@/utils/security';
import { claimRow, processDeposit } from '@/utils/middleman';
import {
	ethProvider,
	getMetadata,
	middlemanWallet,
	USDT_ADDRESS,
} from '@/utils';

let lastBlock = 0;
let sweeping = false;

const token = new ethers.Contract(
	USDT_ADDRESS,
	MIDDLEMAN_ERC20_ABI,
	ethProvider,
);

export async function StartMiddlemanListener() {
	lastBlock = await ethProvider.getBlockNumber();

	console.log('🛰 Middleman listener started from block', lastBlock);

	setInterval(async () => {
		try {
			const latest = await ethProvider.getBlockNumber();

			// query to check txs , filter it and insert in db as PENDING
			if (latest > lastBlock) {
				const events = await token.queryFilter(
					token.filters.Transfer(null, middlemanWallet.address),
					lastBlock + 1,
					latest,
				);

				for (const ev of events) {
					if (!(ev instanceof EventLog)) continue;
					console.log('📥 Deposit detected:', ev.transactionHash);
					try {
						const { from, to, value } = ev.args;

						// Check if user(from_address) belongs to "ascend-accounts"
						const exists = await ensureAccountExists(from, false);
						if (!exists) {
							console.log('🚫 Ignoring unknown depositor:', from);
							return;
						}

						const metadata = await getMetadata(
							ethProvider,
							USDT_ADDRESS,
						);

						const { data, error } = await supabase
							.from('evm_bridge_middleman_deposits')
							.insert({
								tx_hash: ev.transactionHash,
								log_index: ev.index,
								block_number: ev.blockNumber,
								from_address: from,
								to_address: to,
								amount: value.toString(),
								token_address: ev.address,
								status: 'PENDING',
								metadata,
								processing: false,
							})
							.select()
							.single();

						if (error && error?.code === '23505') {
							console.log(
								'⚠ Duplicate tx skipped:',
								ev.transactionHash,
							);
							return;
						}

						if (error) {
							console.error('❌ Supabase insert error:', error);
							throw error;
						}

						console.log('✅ ERC_20 external event stored:', data.tx_hash);
					} catch (error) {
						console.log('Inserting Pending Error: ', error);
					}
				}

				lastBlock = latest;
			}

			// process PENDING txs , locked it and process deposits to contract
			if (sweeping) return;
			sweeping = true;
			try {
				const { data } = await supabase
					.from('evm_bridge_middleman_deposits')
					.select('*')
					.in('status', ['PENDING', 'FAILED'])
					.order('block_number', { ascending: true })
					.limit(5);

				if (!data?.length) return;

				for (const row of data) {
					// change status to "processing" to lock the tx to overwrite
					const locked = await claimRow(row.id);
					if (!locked) continue;
					await processDeposit(row);
				}
			} catch (error) {
				console.log('Processing Queue Error: ', error);
			} finally {
				sweeping = false;
			}
		} catch (error) {
			console.error('Middleman Listener Error:', error);
		}
	}, 10000);
}
