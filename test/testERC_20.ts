import { ethers } from 'hardhat';
import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
	const provider = ethers.provider;

	/* ---------------- OWNER WALLET (treasury) ---------------- */
	const owner = new ethers.Wallet(process.env.TREASURY_OWNER_PK!, provider);
	console.log('Owner:', owner.address);

	/* ---------------- USER WALLET (real user) ---------------- */
	const user = new ethers.Wallet(process.env.TEST_USER_PK!, provider);
	console.log('Test User:', user.address);

	
	/* ---------------- LOAD CONTRACT ADDRESSES ---------------- */
	const file = path.join(__dirname, '../deployments/addresses.json');
	const { vault, usdt: usdtAddress } = JSON.parse(
		fs.readFileSync(file, 'utf-8'),
	);

	const vaultAbi = [
		'function depositERC20(address token, uint256 amount)',
		'function withdrawERC20(address token, address to, uint256 amount)',
	];

	const erc20Abi = [
		'function name() view returns(string)',
		'function symbol() view returns(string)',
		'function decimals() view returns(uint8)',
		'function approve(address spender, uint256 amount) returns(bool)',
		'function transfer(address to, uint256 amount) returns(bool)',
		'function balanceOf(address owner) view returns(uint256)',
	];

	const vaultOwner = new ethers.Contract(vault, vaultAbi, owner);
	const vaultUser = new ethers.Contract(vault, vaultAbi, user);
	const tokenUser = new ethers.Contract(usdtAddress, erc20Abi, user);

	const decimals = await tokenUser.decimals();

	/* ---------------- SHOW EXISTING BALANCE ---------------- */
	const existing = await tokenUser.balanceOf(user.address);
	console.log('\nExisting USDT:', ethers.formatUnits(existing, decimals));

	/* ---------------- APPROVE ---------------- */
	console.log('\nApproving vault...');
	await (
		await tokenUser.approve(vault, ethers.parseUnits('10', decimals))
	).wait();

	/* ---------------- DEPOSIT ---------------- */
	console.log('\n--- USER DEPOSITING 10 USDT ---');
	await (
		await vaultUser.depositERC20(
			usdtAddress,
			ethers.parseUnits('10', decimals),
		)
	).wait();

	/* ---------------- WITHDRAW ---------------- */
	console.log('\n--- OWNER WITHDRAWING 4 USDT ---');
	await (
		await vaultOwner.withdrawERC20(
			usdtAddress,
			user.address,
			ethers.parseUnits('4', decimals),
		)
	).wait();

	const finalBalance = await tokenUser.balanceOf(user.address);
	console.log(
		'\nFinal Wallet USDT:',
		ethers.formatUnits(finalBalance, decimals),
	);

	console.log('\n✅ Deterministic ERC20 test complete');
}

main().catch(console.error);
