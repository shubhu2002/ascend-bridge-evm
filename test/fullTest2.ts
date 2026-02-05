import { ethers } from "hardhat";
import fs from "fs";
import path from "path";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const provider = ethers.provider;

  /* ---------------- OWNER WALLET (treasury) ---------------- */
  const owner = new ethers.Wallet(process.env.TREASURY_OWNER_PK!, provider);
  console.log("Owner:", owner.address);

  /* ---------------- USER WALLET (real user) ---------------- */
  const user = ethers.Wallet.createRandom().connect(provider);
  console.log("User :", user.address);

  // fund user with ETH for gas
  await (await owner.sendTransaction({
    to: user.address,
    value: ethers.parseEther("2"),
  })).wait();

  /* ---------------- LOAD CONTRACT ADDRESSES ---------------- */
  const file = path.join(__dirname, "../deployments/addresses.json");
  const { vault, token } = JSON.parse(fs.readFileSync(file, "utf-8"));

  const vaultAbi = [
    "function depositERC20(address token, uint256 amount)",
    "function withdrawERC20(address token, address to, uint256 amount)"
  ];

  const erc20Abi = [
    "function approve(address spender, uint256 amount) returns(bool)",
    "function transfer(address to, uint256 amount) returns(bool)",
    "function balanceOf(address owner) view returns(uint256)"
  ];

  const vaultOwner = new ethers.Contract(vault, vaultAbi, owner);
  const vaultUser  = new ethers.Contract(vault, vaultAbi, user);
  const tokenOwner = new ethers.Contract(token, erc20Abi, owner);
  const tokenUser  = new ethers.Contract(token, erc20Abi, user);

  /* ---------------- GIVE USER TOKENS ---------------- */
  // token was minted to deployer signer earlier
  // transfer some to our random test user
  console.log("\nTransferring tokens to user...");
  await (await tokenOwner.transfer(user.address, ethers.parseUnits("100", 18))).wait();

  console.log("User token balance:",
    ethers.formatUnits(await tokenUser.balanceOf(user.address), 18)
  );

  /* ---------------- APPROVE ---------------- */
  console.log("\nUser approving vault...");
  await (await tokenUser.approve(vault, ethers.parseUnits("10", 18))).wait();

  /* ---------------- DEPOSIT ---------------- */
  console.log("\n--- USER DEPOSITING 10 TOKENS ---");
  await (await vaultUser.depositERC20(token, ethers.parseUnits("10", 18))).wait();

  console.log("Vault token balance:",
    ethers.formatUnits(await tokenUser.balanceOf(vault), 18)
  );

  /* ---------------- WITHDRAW ---------------- */
  console.log("\n--- OWNER WITHDRAWING 4 TOKENS ---");
  await (await vaultOwner.withdrawERC20(
    token,
    user.address,
    ethers.parseUnits("4", 18)
  )).wait();

  console.log("User token balance after withdraw:",
    ethers.formatUnits(await tokenUser.balanceOf(user.address), 18)
  );

  console.log("\n✅ ERC20 flow test complete");
}

main().catch(console.error);