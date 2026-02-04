import { ethers } from "hardhat";
import { loadAddresses } from "./utils";

const { vault: VAULT, token: ERC20 } = loadAddresses();

async function printEthBalances(label: string, addresses: any[]) {
  console.log(`\n====== ${label} ETH BALANCES ======`);
  for (const addr of addresses) {
    const bal = await ethers.provider.getBalance(addr.address);
    console.log(addr.address, ":", ethers.formatEther(bal), "ETH");
  }
}

async function printTokenBalances(label: string, tokenAddr: string, addresses: any[]) {
  const token = await ethers.getContractAt(
    ["function balanceOf(address) view returns(uint256)"],
    tokenAddr
  );

  console.log(`\n====== ${label} TOKEN BALANCES ======`);
  for (const addr of addresses) {
    const bal = await token.balanceOf(addr.address);
    console.log(addr.address, ":", ethers.formatUnits(bal, 18), "TOKENS");
  }
}

async function main() {
  const [owner, user, attacker] = await ethers.getSigners();
  console.log("======= IMPORTANT =======");
  console.log("OWNER ADDRESS:", owner.address);
  console.log("USER ADDRESS:", user.address);
  console.log("Attacket ADDRESS:", attacker.address);
  console.log("SEND FAUCET TOKENS HERE ↑");
  console.log("=========================\n");

    // INITIAL BALANCES
  await printEthBalances("INITIAL", [owner, user, attacker]);
  await printTokenBalances("INITIAL", ERC20, [owner, user, attacker]);
  
  const vault = await ethers.getContractAt("OwnerWithdrawVault", VAULT);

  // ---------------- ETH DEPOSIT ----------------
  console.log("\n--- ETH Deposit ---");
  await user.sendTransaction({
    to: VAULT,
    value: ethers.parseEther("0.2"),
  });
  console.log("User deposited 0.2 ETH");

  // ---------------- ETH WITHDRAW ----------------
  console.log("\n--- ETH Withdraw by owner ---");
  await vault.connect(owner).withdrawETH(owner.address, ethers.parseEther("0.1"));
  console.log("Owner withdrew 0.1 ETH");

  // ---------------- FAIL: NON OWNER ----------------
  console.log("\n--- FAIL: Non owner withdraw ---");
  try {
    await vault.connect(attacker).withdrawETH(attacker.address, ethers.parseEther("0.01"));
  } catch (e) {
    console.log("Correctly failed: NOT_OWNER");
  }

  // ---------------- FAIL: INSUFFICIENT ----------------
  console.log("\n--- FAIL: Insufficient withdraw ---");
  try {
    await vault.connect(owner).withdrawETH(owner.address, ethers.parseEther("999"));
  } catch (e) {
    console.log("Correctly failed: INSUFFICIENT_BALANCE");
  }

  // ---------------- ERC20 ----------------
  const token = await ethers.getContractAt(
    ["function approve(address,uint256) external returns(bool)",
     "function balanceOf(address) view returns(uint256)"],
    ERC20,
    user
  );

  console.log("\n--- ERC20 Deposit ---");
  await token.approve(VAULT, ethers.parseUnits("100", 18));
 
  await vault.connect(user).depositERC20(ERC20, ethers.parseUnits("100", 18));

  console.log("\n--- ERC20 Withdraw ---");
  await vault.connect(owner).withdrawERC20(ERC20, owner.address, ethers.parseUnits("40", 18));
  console.log("Owner withdrew 40 tokens");

  console.log("\n--- FAIL ERC20 insufficient ---");
  try {
    await vault.connect(owner).withdrawERC20(ERC20, owner.address, ethers.parseUnits("99999", 18));
  } catch {
    console.log("Correctly failed ERC20 insufficient");
  }

  console.log("\n🎉 ALL TESTS COMPLETED");
}

main().catch(console.error);