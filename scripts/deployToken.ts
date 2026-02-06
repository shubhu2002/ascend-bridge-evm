import { ethers } from 'hardhat';
import { saveAddresses } from './utils';

async function main() {
	const [deployer] = await ethers.getSigners();

	console.log("Deploying USDT from:", deployer.address);

	const Token = await ethers.getContractFactory("MockUSDT");
	const token = await Token.deploy(deployer.address);
	await token.waitForDeployment();

	const tokenAddr = await token.getAddress();
	 console.log("USDT deployed:", tokenAddr);

	saveAddresses({ usdt: tokenAddr });
}

main().catch(console.error);
