import 'dotenv/config';
import { ethers, EventLog } from 'ethers';
import { ABI } from './abi';
import { saveEvent } from './db';
import path from 'path';
import fs from 'fs';
import { getMetadata } from './tokenMetadata';
import { syncAccountToken } from './updateAccountTokens';

const file = path.join(__dirname, '../../deployments/addresses.json');
export const { vault: CONTRACT_ADDRESS } = JSON.parse(
	fs.readFileSync(file, 'utf-8'),
);

const provider = new ethers.JsonRpcProvider(process.env.BUILDBEAR_HTTP_RPC!);
const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

let lastProcessedBlock = 0;

async function handleEvent(
	type: 'DEPOSIT' | 'WITHDRAW',
	token: string | null,
	from: string,
	to: string,
	amount: bigint,
	ev: EventLog,
) {
	const metadata = await getMetadata(provider, from, token ?? undefined);
	console.log({ metadata });
	await saveEvent({
		type,
		txHash: ev.transactionHash,
		from,
		to,
		token,
		amount: amount.toString(),
		blockNumber: ev.blockNumber,
		contract: CONTRACT_ADDRESS,
		metadata,
	});

	console.log(`Saved ${type}`, metadata.symbol, amount.toString());

	await syncAccountToken(from, metadata, provider, token || null);
}

export async function startListener() {
	lastProcessedBlock = await provider.getBlockNumber();
	let latestBlock = 0;
	setInterval(async () => {
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

startListener();
