import { ethers } from 'hardhat';
import { saveAddresses } from './utils';
// deploy contract
async function main() {
	const [deployer] = await ethers.getSigners();

	console.log('Deploying from:', deployer.address);

	const Vault = await ethers.getContractFactory('OwnerWithdrawVault');
	const vault = await Vault.deploy(deployer.address);

	await vault.waitForDeployment();

	const addr = await vault.getAddress();
	console.log('Vault deployed (CONTRACT_ADDRESS):', addr);

	saveAddresses({ vault: addr });
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
