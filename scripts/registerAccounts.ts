import { ethers } from "hardhat";

import dotenv from "dotenv";

dotenv.config()
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const [owner, user, attacker] = await ethers.getSigners();

  const addresses = [
    owner.address,
    user.address,
    attacker.address,
    "0xF37DA4260891042bEF41e9434e1c1dEf811b5412"
  ];

  console.log("Registering accounts...");

  for (const addr of addresses) {
    const balanceWei = await ethers.provider.getBalance(addr);
    const balanceEth = Number(ethers.formatEther(balanceWei)).toFixed(4);
    console.log({balanceEth});
    const { error } = await supabase
      .from("ascend-accounts")
      .upsert(
        {
          address: addr,
          balance: balanceEth,
        },
      );

    if (error) {
      console.error("Failed:", addr, error);
    } else {
      console.log("Inserted:", addr);
    }
  }

  console.log("Done.");
}

main().catch(console.error);