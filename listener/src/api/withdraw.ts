import { Request, Response } from 'express';
import { ethers } from 'ethers';

import { supabase } from '@/supabase';

import logger from '@/utils/logger';
import { CONTRACTS_ABI } from '@/utils/abis';
import { CONTRACT_ADDRESS, ownerWallet } from '@/utils';
import { acquireWithdrawLock, releaseWithdrawLock } from '@/utils/security';

export const vaultContract = new ethers.Contract(
	CONTRACT_ADDRESS,
	CONTRACTS_ABI,
	ownerWallet,
);

export async function withdraw(req: Request, res: Response) {
	const { address, token, amount, message, signature } = req.body;

	if (!address || !amount || !message || !signature)
		return res.status(400).json({ error: 'missing params' });

	if (!acquireWithdrawLock(address)) {
		return res.status(429).json({
			error: 'Withdraw Already Processing',
		});
	}
	try {
		const { data, error } = await supabase
			.from('ascend-accounts')
			.select('tokens, balance')
			.eq('address', address)
			.single();

		if (error || !data)
			return res.status(404).json({ error: 'Account Not Found' });

		const signer = ethers.verifyMessage(message, signature);

		if (signer.toLowerCase() !== address.toLowerCase())
			return res.status(401).json({ error: 'Invalid Signature' });

		console.log('✅ Withdraw requested by:', signer);

		const tokenKey = token ?? 'ETH';
		const availableBalance = BigInt(
			data.tokens?.[tokenKey]?.available_balance ?? data.balance ?? '0',
		);
		const requestedBalance = BigInt(amount);

		if (availableBalance < requestedBalance)
			return res.status(400).json({ error: 'Insufficient Balance' });

		let tx;

		if (!token) {
			// ETH
			tx = await vaultContract.withdrawETH(signer, requestedBalance);
			logger.info('🚀 Sending ETH withdraw...', {
				address,
				token,
				amount,
			});
		} else {
			// ERC20
			tx = await vaultContract.withdrawERC20(
				token,
				signer,
				requestedBalance,
			);
			logger.info('🚀 Sending USDT withdraw...', {
				address,
				token,
				amount,
			});
		}

		logger.info('⛓ Sending tx:', tx.hash);

		return res.json({
			success: true,
			txHash: tx.hash,
		});
	} catch (error: any) {
		console.log(error);
		return res.status(500).json({ success: false, error });
	} finally {
		// always release lock
		releaseWithdrawLock(address);
	}
}
