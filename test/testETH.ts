import { ethers } from "hardhat";
import fs from "fs";
import path from "path";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const provider = ethers.provider;

  /* -------------------------------------------------------------------------- */
  /*                               OWNER WALLET                                 */
  /* -------------------------------------------------------------------------- */

  const owner = new ethers.Wallet(process.env.TREASURY_OWNER_PK!, provider);
  console.log("Owner:", owner.address);

  /* -------------------------------------------------------------------------- */
  /*                                USER WALLET                                 */
  /* -------------------------------------------------------------------------- */

  const user = new ethers.Wallet(process.env.TEST_USER_PK!, provider);
	console.log('Test User:', user.address);

  // fund user from owner
  // console.log("\nFunding user...");
  // const fundTx = await owner.sendTransaction({
  //   to: user.address,
  //   value: ethers.parseEther("2"),
  // });
  // await fundTx.wait();

  /* -------------------------------------------------------------------------- */
  /*                               LOAD CONTRACT                                */
  /* -------------------------------------------------------------------------- */

  const file = path.join(__dirname, "../deployments/addresses.json");
  const { vault } = JSON.parse(fs.readFileSync(file, "utf-8"));

  const abi = [
    "function depositETH() payable",
    "function withdrawETH(address to, uint256 amount)",
  ];

  const vaultOwner = new ethers.Contract(vault, abi, owner);

  /* -------------------------------------------------------------------------- */
  /*                                 DEPOSIT TEST                               */
  /* -------------------------------------------------------------------------- */

  const depositAmount = ethers.parseEther("1");

  console.log("\n--- USER DEPOSITING 1 ETH ---");

  const depositTx = await user.sendTransaction({
    to: vault,
    value: depositAmount,
  });

  await depositTx.wait();

  console.log("Deposit tx:", depositTx.hash);

  let vaultBalance = await provider.getBalance(vault);
  console.log("Vault balance after deposit:", ethers.formatEther(vaultBalance));

  let userBal = await provider.getBalance(user.address);
  console.log("User balance after deposit:", ethers.formatEther(userBal));

  /* -------------------------------------------------------------------------- */
  /*                                WITHDRAW TEST                               */
  /* -------------------------------------------------------------------------- */

  const withdrawAmount = ethers.parseEther("0.4");

  console.log("\n--- OWNER WITHDRAWING 0.4 ETH TO USER ---");

  const withdrawTx = await vaultOwner.withdrawETH(user.address, withdrawAmount);
  await withdrawTx.wait();

  console.log("Withdraw tx:", withdrawTx.hash);

  vaultBalance = await provider.getBalance(vault);
  const userBalance = await provider.getBalance(user.address);

  console.log("Vault balance after withdraw:", ethers.formatEther(vaultBalance));
  console.log("User balance after withdraw:", ethers.formatEther(userBalance));

  console.log("\n✅ Full flow test complete");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});