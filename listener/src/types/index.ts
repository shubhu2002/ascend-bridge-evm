import { ethers } from "ethers";

export type DepositStatus = 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED';

export type DepositRow = {
	id: string;
	tx_hash: string;
	log_index: number;
	block_number: number;
	from_address: string;
	to_address: string;
	amount: string;
	token_address: string;
	status: DepositStatus;
	processing: boolean;
	sweep_tx: string;
};

export type ERC20 = {
	transfer(
		to: string,
		amount: bigint | string,
	): Promise<ethers.TransactionResponse>;
	balanceOf(account: string): Promise<bigint>;
};

export type EventType = 'DEPOSIT' | 'WITHDRAW';