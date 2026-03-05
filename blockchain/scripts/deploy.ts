import { ethers, upgrades } from "hardhat";
import { exec } from "child_process";
import { PoolGamesNft, TreasuryPool, UserPoolGames } from "../typechain-types";

async function main() {
  const PoolGamesNft = await ethers.getContractFactory("UserPoolGames");
  const poolGamesNft = await upgrades.deployProxy(PoolGamesNft, [
    "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  ]);
  await poolGamesNft.waitForDeployment();
  const poolGames = PoolGamesNft.attach(
    await poolGamesNft.getAddress(),
  ) as UserPoolGames;
  const poolGamesAddress = await poolGames.getAddress();
  console.log(poolGamesAddress);
  // await (
  //   await poolGames.setManager("0xF325E181a663545314935f91e724A94C8737B545")
  // ).wait();
  // await (
  //   await poolGames.setTreasuryPool(
  //     "0x7eB556973D11866e12047441f9ef6A75b0148DB5",
  //   )
  // ).wait();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

function runCommand(address: string, params: any[]) {
  const formattedParams = params
    .map((param) => (typeof param === "string" ? `"${param}"` : param))
    .join(" ");

  const command = `npx hardhat verify --network mumbai ${address} ${formattedParams}`;

  setTimeout(() => {
    const process = exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`exec error: ${error}`);
        return;
      }
      console.log(`stdout: ${stdout}`);
      if (stderr) {
        console.error(`stderr: ${stderr}`);
      }
    });
  }, 10000);
}
