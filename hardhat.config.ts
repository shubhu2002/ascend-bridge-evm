import type { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

import * as dotenv from "dotenv";
dotenv.config();

const config: HardhatUserConfig = {
  solidity: "0.8.28",
  networks: {
    buildbear: {
      url: process.env.BUILDBEAR_HTTP_RPC as string,
      chainId: Number(process.env.CHAIN_ID!),
      accounts: {
        mnemonic: process.env.BUILDBEAR_MNEMONIC!
      },
    },
  },
};

export default config;
