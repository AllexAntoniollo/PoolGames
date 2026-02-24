import { ethers } from "hardhat";
import { exec } from "child_process";

async function main() {
  const USDC = await ethers.getContractFactory("USDC");
  const usdc = await USDC.deploy();
  await usdc.waitForDeployment();
  const usdcAddress = await usdc.getAddress();
  console.log(`usdcAddress deployed to ${usdcAddress}`);
  await runCommand(usdcAddress, []);
  const FeeManager = await ethers.getContractFactory("FeeManager");
  const feeManager = await FeeManager.deploy();
  await feeManager.waitForDeployment();
  const feeManagerAddress = await feeManager.getAddress();
  console.log(`feeManagerAddress deployed to ${feeManagerAddress}`);
  await runCommand(feeManagerAddress, []);
  await (await feeManager.addToken(usdcAddress, "USDC")).wait();
  const UserPoolGames = await ethers.getContractFactory("UserPoolGames");
  const userContract = await UserPoolGames.deploy(usdcAddress);
  await userContract.waitForDeployment();
  const userContractAddress = await userContract.getAddress();
  console.log(`userContractAddress deployed to ${userContractAddress}`);
  await runCommand(userContractAddress, [usdcAddress]);
  await (await userContract.setManager(feeManagerAddress)).wait();
  const TreasuryPool = await ethers.getContractFactory("TreasuryPool");
  const TreasuryPoolContract = await TreasuryPool.deploy(usdcAddress);
  await TreasuryPoolContract.waitForDeployment();
  const TreasuryPoolAddress = await TreasuryPoolContract.getAddress();
  console.log(`TreasuryPoolAddress deployed to ${TreasuryPoolAddress}`);
  await runCommand(TreasuryPoolAddress, [usdcAddress]);
  await (await TreasuryPoolContract.setManager(feeManagerAddress)).wait();
  await (await TreasuryPoolContract.setUser(userContractAddress)).wait();
  await (await userContract.setTreasuryPool(TreasuryPoolAddress)).wait();
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
