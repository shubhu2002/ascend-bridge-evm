import { ethers } from 'hardhat';
import { saveAddresses } from './utils';
async function main() {
	const [owner, user] = await ethers.getSigners();

	console.log('Owner:', owner.address);
	console.log('User :', user.address);

	const Token = await ethers.getContractFactory('TestToken');
	const token = await Token.deploy(user.address); // 👈 mint to user
	await token.waitForDeployment();

	const addr = await token.getAddress();
	console.log('Token deployed:', addr);

	saveAddresses({ token: addr });
}

main().catch(console.error);
