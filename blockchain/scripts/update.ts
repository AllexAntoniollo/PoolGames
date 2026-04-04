import "@openzeppelin/hardhat-upgrades";

import { ethers, upgrades } from "hardhat";

async function main() {
  const TreasuryPool = await ethers.getContractFactory("TreasuryPool");
  const treasuryPool = await upgrades.upgradeProxy(
    "0x7eB556973D11866e12047441f9ef6A75b0148DB5",
    TreasuryPool,
    {},
  );
  await treasuryPool.waitForDeployment();
  console.log("TreasuryPool: ", await treasuryPool.getAddress());
  // const PoolGamesNft = await ethers.getContractFactory("PoolGamesNft");
  // const poolGamesNft = await upgrades.upgradeProxy(
  //   "0x5bc8bC2e6255aE8E3198BE0c2da31818Ba9C24b5",
  //   PoolGamesNft,
  //   {},
  // );
  // await poolGamesNft.waitForDeployment();
  // console.log("PoolGamesNft: ", await poolGamesNft.getAddress());
  // const GlobalPool = await ethers.getContractFactory("UserPoolGames");
  // const globalPool = await upgrades.upgradeProxy(
  //   "0x9f056AE5034912609c140C3Bb0b1D7B5a5e0710d",
  //   GlobalPool,
  //   {},
  // );
  // await globalPool.waitForDeployment();
  // console.log("UserPoolGames: ", await globalPool.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
