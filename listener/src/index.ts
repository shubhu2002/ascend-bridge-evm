import { ethers, EventLog } from 'ethers';
import path from 'path';
import fs from 'fs';
import {
	applyAccountDelta,
	ensureAccountExists,
	getMetadata,
	supabase,
} from '../utils';

import * as dotenv from 'dotenv';
dotenv.config();

const file = path.join(__dirname, '../../deployments/addresses.json');
export const { vault: CONTRACT_ADDRESS, usdt: tokenAddress } = JSON.parse(
	fs.readFileSync(file, 'utf-8'),
);

let airdropDone = false;

// ========== CONFIGURATION ============
export const ABI = [
	'event DepositETH(address indexed from, uint256 amount)',
	'event WithdrawETH(address indexed to, uint256 amount)',
	'event DepositERC20(address indexed token, address indexed from, uint256 amount)',
	'event WithdrawERC20(address indexed token, address indexed to, uint256 amount)',
];

let lastProcessedBlock = 0;

const provider = new ethers.JsonRpcProvider(process.env.BUILDBEAR_HTTP_RPC!);
const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

async function handleEvent(
	type: 'DEPOSIT' | 'WITHDRAW',
	token: string | null,
	from: string,
	to: string,
	amount: bigint,
	ev: EventLog,
) {
	const metadata = await getMetadata(provider, token ?? undefined);
	const account = type === 'DEPOSIT' ? from : to;

	await ensureAccountExists(account);

	try {
		const { data, error } = await supabase
			.from('evm_birdge_events')
			.insert({
				contract_address: CONTRACT_ADDRESS,
				account_address: account, // NEW FK SAFE
				tx_hash: ev.transactionHash,
				log_index: ev.index,
				event_type: type,
				from_address: from,
				to_address: to,
				token: token, // NULL for native ETH
				amount: amount.toString(),
				block_number: ev.blockNumber,
				metadata: metadata,
			})
			.select();

		if (error?.code === '23505') {
			console.log('⚠ Duplicate tx skipped:', ev.transactionHash);
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

	await applyAccountDelta(
		type === 'DEPOSIT' ? from : to,
		token,
		amount,
		type,
		provider,
	);
}

export async function startListener() {
	lastProcessedBlock = await provider.getBlockNumber();
	console.log('lastProcessedBlock - ', lastProcessedBlock);

	let latestBlock = 0;
	setInterval(async () => {
		latestBlock = await provider.getBlockNumber();
		console.log('⛏ polling...');
		try {
			latestBlock = await provider.getBlockNumber();
			if (latestBlock <= lastProcessedBlock) return;

			console.log(`Scanning ${lastProcessedBlock + 1} → ${latestBlock}`);

			// -------- ETH DEPOSIT --------
			const ethDeposits = await contract.queryFilter(
				contract.filters.DepositETH(),
				lastProcessedBlock + 1,
				latestBlock,
			);

			for (const ev of ethDeposits) {
				if (!(ev instanceof EventLog)) continue;
				const [from, amount] = ev.args;

				try {
					await handleEvent(
						'DEPOSIT',
						null,
						from,
						CONTRACT_ADDRESS,
						amount,
						ev,
					);
				} catch (e) {
					console.log(
						'⚠ Event failed but continuing:',
						ev.transactionHash,
					);
				}
			}

			// -------- ETH WITHDRAW --------
			const ethWithdraws = await contract.queryFilter(
				contract.filters.WithdrawETH(),
				lastProcessedBlock + 1,
				latestBlock,
			);

			for (const ev of ethWithdraws) {
				if (!(ev instanceof EventLog)) continue;
				const [to, amount] = ev.args;

				try {
					await handleEvent(
						'WITHDRAW',
						null,
						CONTRACT_ADDRESS,
						to,
						amount,
						ev,
					);
				} catch (e) {
					console.log(
						'⚠ Event failed but continuing:',
						ev.transactionHash,
					);
				}
			}

			// -------- ERC20 DEPOSIT --------
			const erc20Deposits = await contract.queryFilter(
				contract.filters.DepositERC20(),
				lastProcessedBlock + 1,
				latestBlock,
			);

			for (const ev of erc20Deposits) {
				if (!(ev instanceof EventLog)) continue;
				const [token, from, amount] = ev.args;
				await handleEvent(
					'DEPOSIT',
					token,
					from,
					CONTRACT_ADDRESS,
					amount,
					ev,
				);
			}

			// -------- ERC20 WITHDRAW --------
			const erc20Withdraws = await contract.queryFilter(
				contract.filters.WithdrawERC20(),
				lastProcessedBlock + 1,
				latestBlock,
			);

			for (const ev of erc20Withdraws) {
				if (!(ev instanceof EventLog)) continue;
				const [token, to, amount] = ev.args;
				await handleEvent(
					'WITHDRAW',
					token,
					CONTRACT_ADDRESS,
					to,
					amount,
					ev,
				);
			}
		} catch (err) {
			console.error('🔥 Listener error:', err);
		} finally {
			lastProcessedBlock = latestBlock;
		}
	}, 10000);
}

startListener().catch((error) => {
	console.log(error);
});
