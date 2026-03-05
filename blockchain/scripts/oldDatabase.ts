import { ethers } from "ethers";
import abi from "./user.abi.json";
const fs = require("fs");
const path = require("path");
import dotenv from "dotenv";

dotenv.config();
const BATCH_SIZE = 50;
const DEFAULT_SPONSOR = "0xd0F6c4e09686F413885DCbB9Da152DB12cC21171";

async function main() {
  const contractAddress = "0x9f056AE5034912609c140C3Bb0b1D7B5a5e0710d";
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const signer = new ethers.Wallet(process.env.SECRET!, provider);

  const contract = new ethers.Contract(contractAddress, abi, signer);

  const filePath = path.join(__dirname, "./teste.csv");
  const fileContent = fs.readFileSync(filePath, "utf8");

  const lines = fileContent
    .split("\n")
    .map((l: any) => l.trim())
    .filter((l: any) => l.length > 0);

  // Remove header se existir
  if (lines[0].toLowerCase().includes("user")) {
    lines.shift();
  }

  let users = [];
  let sponsors = [];
  let values = [];

  let batchCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const [user, sponsorRaw, valueRaw] = lines[i].split(",");

    if (!user || !valueRaw) continue;

    let sponsor =
      sponsorRaw && sponsorRaw.trim() !== ""
        ? sponsorRaw.trim()
        : DEFAULT_SPONSOR;

    users.push(user.trim());
    sponsors.push(sponsor);
    values.push(BigInt(valueRaw.trim()));

    if (users.length === BATCH_SIZE) {
      batchCount++;
      console.log(`🚀 Enviando batch ${batchCount}...`);

      try {
        const tx = await contract.createUserByOwner(users, sponsors, values);
        await tx.wait();
      } catch (error: any) {
        const msg = error?.message || "";

        if (msg.includes("Already Registered")) {
          console.log("⚠️ Usuário já registrado, continuando...");
          console.log(users, sponsors, values);
          break;
        } else {
          console.error("❌ Erro inesperado:", msg);
          console.log(users, sponsors, values);

          break;
        }
      }
      console.log(`✅ Batch ${batchCount} confirmado`);

      users = [];
      sponsors = [];
      values = [];
    }
  }

  // Último batch se sobrar
  if (users.length > 0) {
    batchCount++;
    console.log(`🚀 Enviando último batch ${batchCount}...`);

    const tx = await contract.createUserByOwner(users, sponsors, values);

    await tx.wait();
    console.log(`✅ Último batch confirmado`);
  }

  console.log("🎉 Importação finalizada!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
