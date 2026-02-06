import { ethers } from 'hardhat';
import { saveAddresses } from './utils';
// deploy contract
async function main() {
	const [deployer] = await ethers.getSigners();

	const OWNER = process.env.TREASURY_OWNER_ADDRESS!;
	if (!OWNER) throw new Error('TREASURY_ADDRESS missing');

	console.log('Deploying from:', deployer.address);
	console.log('Vault owner:', OWNER);

	const Vault = await ethers.getContractFactory('OwnerWithdrawVault');

	// 👇 owner is backend wallet, not deployer
	const vault = await Vault.deploy(OWNER);

	await vault.waitForDeployment();

	const vaultAddr = await vault.getAddress();
	console.log('Vault deployed:', vaultAddr);

	// verify owner
	const owner = await vault.owner();
	console.log('Owner set in contract:', owner);

	saveAddresses({ vault: vaultAddr, owner: owner });
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
