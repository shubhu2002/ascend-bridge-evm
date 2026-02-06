import { run } from "hardhat";

async function main() {
  console.log("\n🧱 Compiling contracts...");
  await run("compile");

  console.log("\n🪙 Deploying USDT...");
  await run("run", { script: "scripts/deployToken.ts" });

  console.log("\n🏦 Deploying Vault...");
  await run("run", { script: "scripts/deployVault.ts" });

  console.log("\n🎁 Funding test wallet...");
  await run("run", { script: "scripts/airdropUSDT.ts" });

  console.log("\n✅ Setup complete!");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});