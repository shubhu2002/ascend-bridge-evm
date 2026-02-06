import { ethers } from "hardhat";
import fs from "fs";
import path from "path";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const TEST_USER = process.env.TEST_USER_ADDRESS;
  if (!TEST_USER) throw new Error("TEST_USER_ADDRESS missing");

  const file = path.join(__dirname, "../deployments/addresses.json");
  const { usdt } = JSON.parse(fs.readFileSync(file, "utf-8"));

  const erc20 = await ethers.getContractAt("MockUSDT", usdt);

  const decimals = await erc20.decimals();
  const amount = ethers.parseUnits("1000000", decimals); // 1M USDT

  const balance = await erc20.balanceOf(TEST_USER);

  if (balance >= amount) {
    console.log("🪙 Test wallet already funded");
    return;
  }

  console.log("🚀 Airdropping USDT to test wallet...");
  const tx = await erc20.transfer(TEST_USER, amount);
  await tx.wait();

  console.log("✅ Test wallet funded:", TEST_USER);
}

main().catch(console.error);