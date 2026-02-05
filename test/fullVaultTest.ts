import { ethers } from 'hardhat';
import { loadAddresses } from '../scripts/utils';

const { vault: VAULT, token: ERC20 } = loadAddresses();

const divider = () => console.log('\n' + '─'.repeat(65));

function title(text: string) {
	divider();
	console.log(`\n🔷 ${text.toUpperCase()}`);
	divider();
}

function success(text: string) {
	console.log(`✔ ${text}`);
}

function fail(text: string) {
	console.log(`✖ ${text}`);
}

function info(text: string) {
	console.log(`➜ ${text}`);
}

async function printEthBalances(label: string, addresses: any[]) {
	console.log(`\n💰 ${label}`);
	for (const addr of addresses) {
		const bal = await ethers.provider.getBalance(addr.address);
		console.log(
			`   ${addr.address.slice(0, 8)}... : ${ethers.formatEther(bal)} ETH`,
		);
	}
}

async function printTokenBalances(
	label: string,
	tokenAddr: string,
	addresses: any[],
) {
	const token = await ethers.getContractAt(
		['function balanceOf(address) view returns(uint256)'],
		tokenAddr,
	);

	console.log(`\n🪙 ${label}`);
	for (const addr of addresses) {
		const bal = await token.balanceOf(addr.address);
		console.log(
			`   ${addr.address.slice(0, 8)}... : ${ethers.formatUnits(bal, 18)} TOK`,
		);
	}
}

async function printVaultBalances(tokenAddr?: string) {
	const eth = await ethers.provider.getBalance(VAULT);

	console.log(`\n🏦 VAULT STATE`);
	console.log(`   ETH   : ${ethers.formatEther(eth)}`);

	if (tokenAddr) {
		const token = await ethers.getContractAt(
			['function balanceOf(address) view returns(uint256)'],
			tokenAddr,
		);
		const bal = await token.balanceOf(VAULT);
		console.log(`   TOKEN : ${ethers.formatUnits(bal, 18)}`);
	}
}

async function attempt(label: string, fn: () => Promise<any>) {
	info(label);
	try {
		const tx = await fn();
		if (tx?.wait) await tx.wait();
		success('Transaction succeeded');
	} catch (e: any) {
		fail('Transaction reverted');
	}
}

async function main() {
	const [owner, user, attacker] = await ethers.getSigners();
	console.log('======= IMPORTANT =======');
	console.log('OWNER ADDRESS:', owner.address);
	console.log('USER ADDRESS:', user.address);
	console.log('Attacket ADDRESS:', attacker.address);
	console.log('SEND FAUCET TOKENS HERE ↑');
	console.log('=========================\n');

	// INITIAL BALANCES
	await printEthBalances('Accounts ETH', [owner, user, attacker]);
	await printTokenBalances('Accounts Token', ERC20, [owner, user, attacker]);
	await printVaultBalances(ERC20);

	const vault = await ethers.getContractAt('OwnerWithdrawVault', VAULT);

	// ---------------- ETH DEPOSIT ----------------
	title('User deposits 10000 ETH');
	await attempt('Sending ETH to vault', () =>
		user.sendTransaction({ to: VAULT, value: ethers.parseEther('10000') }),
	);

	await printEthBalances('After Deposit', [owner, user, attacker]);
	await printVaultBalances(ERC20);

	// ---------------- ETH WITHDRAW ----------------
	title('Owner withdraws 50 ETH');
	await attempt('Owner withdraw', () =>
		vault
			.connect(owner)
			.withdrawETH(owner.address, ethers.parseEther('50')),
	);
	await printEthBalances('After Withdraw', [owner, user, attacker]);
	await printVaultBalances(ERC20);

	// ---------------- FAIL: NON OWNER ----------------
	title('Attacker tries to withdraw');
	await attempt('Unauthorized withdraw', () =>
		vault
			.connect(attacker)
			.withdrawETH(attacker.address, ethers.parseEther('100')),
	);
	await printEthBalances('AFTER FAILED ATTACK', [owner, user, attacker]);
	await printVaultBalances(ERC20);

	// ---------------- FAIL: INSUFFICIENT ----------------
	title('Insufficient withdraw ---');
	await attempt('Insufficient bal withdraw', () =>
		vault
			.connect(owner)
			.withdrawETH(
				owner.address,
				ethers.parseEther('9999999999999999999'),
			),
	);
	await printEthBalances('AFTER FAILED LARGE WITHDRAW', [
		owner,
		user,
		attacker,
	]);
	await printVaultBalances(ERC20);

	// ---------------- ERC20 ----------------
	const token = await ethers.getContractAt(
		[
			'function approve(address,uint256) external returns(bool)',
			'function balanceOf(address) view returns(uint256)',
		],
		ERC20,
		user,
	);

	title('User deposits 1000 tokens');
	await attempt('Approve', () =>
		token.approve(VAULT, ethers.parseUnits('1000', 18)),
	);

	await attempt('Deposit ERC20', () =>
		vault.connect(user).depositERC20(ERC20, ethers.parseUnits('1000', 18)),
	);

	await printTokenBalances('After Token Deposit', ERC20, [owner, user]);
	await printVaultBalances(ERC20);

	title('owner Withdraw 500 tokens ---');
	await vault
		.connect(owner)
		.withdrawERC20(ERC20, owner.address, ethers.parseUnits('500', 18));
	await printTokenBalances('AFTER 500 TOKEN WITHDRAW', ERC20, [
		owner,
		user,
		attacker,
	]);

	console.log('\n🎉 ALL TESTS COMPLETED');
	await printEthBalances('Accounts ETH', [owner, user, attacker]);
	await printTokenBalances('Final', ERC20, [owner, user, attacker]);
	await printVaultBalances(ERC20);
}

main().catch(console.error);
