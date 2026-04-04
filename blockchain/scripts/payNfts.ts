import { ethers } from "ethers";
import abi from "./user.abi.json";

import dotenv from "dotenv";

dotenv.config();

async function main() {
  const contractAddress = "0x5bc8bC2e6255aE8E3198BE0c2da31818Ba9C24b5";
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const signer = new ethers.Wallet(process.env.SECRET!, provider);

  const contract = new ethers.Contract(contractAddress, abi, signer);

  while (true) {
    try {
      const tx = await contract.processPayments();
      await tx.wait();
      console.log("Processado");
    } catch (error: any) {
      console.log(error);
      break;
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
