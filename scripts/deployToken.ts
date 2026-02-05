import { ethers } from 'hardhat';
import fs from 'fs';
import { saveAddresses } from './utils';

async function main() {
	const [deployer] = await ethers.getSigners();

	console.log('Deploying token from:', deployer.address);

	const Token = await ethers.getContractFactory('TestToken');
	const token = await Token.deploy(deployer.address);
	await token.waitForDeployment();

	const tokenAddr = await token.getAddress();
	console.log('Token deployed:', tokenAddr);

	saveAddresses({ token: tokenAddr });
}

main().catch(console.error);
