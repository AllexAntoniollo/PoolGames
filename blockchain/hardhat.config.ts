import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import dotenv from "dotenv";
import "@nomicfoundation/hardhat-ethers";
require("@openzeppelin/hardhat-upgrades");
dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      evmVersion: "cancun", // Add this line
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    mumbai: {
      url: process.env.RPC_URL,
      chainId: parseInt(`${process.env.CHAIN_ID}`),
      accounts: [process.env.SECRET!],
    },
  },
  etherscan: {
    apiKey: process.env.API_KEY,
  },
};

export default config;
