import { ethers } from "ethers";
const fs = require("fs");
const path = require("path");
import dotenv from "dotenv";

dotenv.config();

async function main() {
  const filePath = path.join(__dirname, "./teste.csv");
  const fileContent = fs.readFileSync(filePath, "utf8");

  const lines = fileContent
    .split("\n")
    .map((l: string) => l.trim())
    .filter((l: string) => l.length > 0);

  if (lines[0].toLowerCase().includes("user")) {
    lines.shift();
  }

  const userCount: Record<string, number> = {};

  for (const line of lines) {
    let [userRaw] = line.split(",");

    if (!userRaw) continue;

    userRaw = userRaw.trim().toLowerCase();

    if (!ethers.isAddress(userRaw)) continue;

    if (!userCount[userRaw]) {
      userCount[userRaw] = 1;
    } else {
      userCount[userRaw]++;
    }
  }

  const duplicates = Object.entries(userCount).filter(
    ([_, count]) => count > 1,
  );

  console.log("----- RESULTADO -----");

  if (duplicates.length === 0) {
    console.log("✅ Nenhuma carteira duplicada encontrada");
    return;
  }

  console.log(`⚠️ ${duplicates.length} carteiras duplicadas encontradas:\n`);

  for (const [address, count] of duplicates) {
    console.log(`${address} → ${count} vezes`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
