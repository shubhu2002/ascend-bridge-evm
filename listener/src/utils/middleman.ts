import { ethers, EventLog, NonceManager } from 'ethers';
import dotenv from 'dotenv';

import { USDT_ADDRESS, CONTRACT_ADDRESS, ethProvider } from '@/utils';
import { MIDDLEMAN_ERC20_ABI } from '@/utils/abis';
import { DepositRow, ERC20 } from '@/types';
import { saveEvent, supabase } from '@/supabase';

dotenv.config();

const middleman = new ethers.Wallet(process.env.MIDDLEMAN_PK!, ethProvider);
const token = new ethers.Contract(USDT_ADDRESS, MIDDLEMAN_ERC20_ABI, ethProvider);

const signer = new NonceManager(middleman);
const tokenWithSigner = token.connect(signer) as unknown as ERC20;

async function alreadySwept(row: DepositRow): Promise<string | null> {
	const fromBlock = row.block_number;
	const toBlock = await ethProvider.getBlockNumber();

	const transferFilter = token.filters.Transfer(
		middleman.address,
		CONTRACT_ADDRESS,
	);

	const logs = await token.queryFilter(transferFilter, fromBlock, toBlock);

	for (const log of logs) {
		if (!(log instanceof EventLog)) continue;

		const { value } = log.args;

		if (BigInt(value) === BigInt(row.amount)) {
			console.log('🔎 Found matching sweep:', log.transactionHash);
			return log.transactionHash;
		}
	}

	return null;
}

export async function claimRow(id: string): Promise<boolean> {
	const { data, error } = await supabase
		.from('evm_bridge_middleman_deposits')
		.update({ processing: true, status: 'PROCESSING' })
		.eq('id', id)
		.eq('processing', false)
		.in('status', ['PENDING', 'FAILED'])
		.select('id')
		.maybeSingle();

	if (error) {
		console.error('claim error', error);
		return false;
	}

	return !!data; // true only if WE locked it
}

async function finalizeDeposit(row: DepositRow, hash: string) {
	await saveEvent(
		'DEPOSIT',
		row.token_address,
		row.from_address,
		row.to_address,
		BigInt(row.amount),
		hash,
		row.log_index,
		row.block_number,
	);

	await supabase
		.from('evm_bridge_middleman_deposits')
		.update({ status: 'SUCCESS', processing: false })
		.eq('id', row.id);
}

export async function processDeposit(row: DepositRow) {
	try {
		console.log('Sweeping:', row.from_address, row.amount);

		if (row.sweep_tx) {
			const receipt = await ethProvider.getTransactionReceipt(row.sweep_tx);
			if (receipt && receipt.status === 1) {
				console.log('🔁 Recovered mined tx:', row.sweep_tx);
				await finalizeDeposit(row, row.sweep_tx);
				return;
			}
		}

		const recovered = await alreadySwept(row);

		// Detect if already swept (RPC crash recovery)
		if (recovered) {
			console.log('🧠 Recovered confirmed sweep:', recovered);
			await finalizeDeposit(row, recovered);
			return;
		}

		const tx = await tokenWithSigner.transfer(CONTRACT_ADDRESS, row.amount);

		await supabase
			.from('evm_bridge_middleman_deposits')
			.update({ sweep_tx: tx.hash })
			.eq('id', row.id);

		const receipt = await tx.wait();
		if (!receipt) {
			console.log('Receipt not exists ');
			return;
		}
		await finalizeDeposit(row, receipt.hash);
	} catch (err) {
		console.error('❌ Sweep failed:', err);

		await supabase
			.from('evm_bridge_middleman_deposits')
			.update({ status: 'FAILED', processing: false })
			.eq('id', row.id);
	}
}
