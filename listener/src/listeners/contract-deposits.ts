import { ethers, EventLog } from 'ethers';

import { ethProvider, CONTRACT_ADDRESS } from '@/utils';
import { CONTRACTS_ABI } from '@/utils/abis';
import { saveEvent } from '@/supabase';

const contract = new ethers.Contract(
	CONTRACT_ADDRESS,
	CONTRACTS_ABI,
	ethProvider,
);

let lastProcessedBlock = 0;

export async function startListener() {
	lastProcessedBlock = await ethProvider.getBlockNumber();
	console.log('lastProcessedBlock - ', lastProcessedBlock);

	let latestBlock = 0;
	setInterval(async () => {
		latestBlock = await ethProvider.getBlockNumber();
		console.log('⛏ polling...');
		try {
			latestBlock = await ethProvider.getBlockNumber();
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
					await saveEvent(
						'DEPOSIT',
						null,
						from,
						CONTRACT_ADDRESS,
						amount,
						ev.transactionHash,
						ev.index,
						ev.blockNumber,
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
					await saveEvent(
						'WITHDRAW',
						null,
						CONTRACT_ADDRESS,
						to,
						amount,
						ev.transactionHash,
						ev.index,
						ev.blockNumber,
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
				console.log('listnere', ev);
				await saveEvent(
					'DEPOSIT',
					token,
					from,
					CONTRACT_ADDRESS,
					amount,
					ev.transactionHash,
					ev.index,
					ev.blockNumber,
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
				await saveEvent(
					'WITHDRAW',
					token,
					CONTRACT_ADDRESS,
					to,
					amount,
					ev.transactionHash,
					ev.index,
					ev.blockNumber,
				);
			}
		} catch (err) {
			console.error('🔥 Listener error:', err);
		} finally {
			lastProcessedBlock = latestBlock;
		}
	}, 10000);
}
