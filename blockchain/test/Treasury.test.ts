import {
  loadFixture,
  time,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import path from "path";
import fs from "fs";
import { UserPoolGames } from "../typechain-types";
describe("Treasury", function () {
  this.timeout(60000000);
  async function deployFixture() {
    const [owner, otherAccount, another] = await ethers.getSigners();

    const USDT = await ethers.getContractFactory("USDC");
    const usdt = await USDT.deploy();
    const usdtAddress = await usdt.getAddress();

    const PoolGamesNft = await ethers.getContractFactory("UserPoolGames");
    const poolGamesNft = await upgrades.deployProxy(PoolGamesNft, [
      usdtAddress,
    ]);

    const contractUser = PoolGamesNft.attach(
      await poolGamesNft.getAddress(),
    ) as UserPoolGames;
    const contractUserAddress = await contractUser.getAddress();
    return {
      owner,
      otherAccount,
      another,
      usdt,

      contractUser,
      contractUserAddress,
    };
  }

  it("migrate", async function () {
    const {
      owner,
      otherAccount,
      another,
      usdt,

      contractUser,
      contractUserAddress,
    } = await loadFixture(deployFixture);

    const filePath = path.join(__dirname, "../scripts/oldDatabase.csv");
    const fileContent = fs.readFileSync(filePath, "utf8");
    let gasTotal = 0;

    const lines = fileContent
      .split("\n")
      .map((l: any) => l.trim())
      .filter((l: any) => l.length > 0);

    if (lines[0].toLowerCase().includes("user")) {
      lines.shift();
    }

    let users = [];
    let sponsors = [];
    let values = [];

    let batchCount = 0;
    for (let i = 0; i < lines.length; i++) {
      const [userRaw, sponsorRaw, valueRaw] = lines[i].split(",");

      if (!userRaw || userRaw.trim() === "") continue;

      const user = userRaw.trim();

      const sponsor =
        sponsorRaw && sponsorRaw.trim() !== ""
          ? sponsorRaw.trim()
          : owner.address;

      const value =
        valueRaw && valueRaw.trim() !== "" ? BigInt(valueRaw.trim()) : 0n;

      users.push(user);
      sponsors.push(sponsor);
      values.push(value);

      if (users.length === 25) {
        batchCount++;
        console.log(`🚀 Enviando batch ${batchCount}...`);

        const tx: any = await contractUser.createUserByOwner(
          users,
          sponsors,
          values,
        );

        const receipt = await tx.wait();

        gasTotal += Number(receipt.gasUsed);
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

      const tx: any = await contractUser.createUserByOwner(
        users,
        sponsors,
        values,
      );
      const receipt = await tx.wait();
      gasTotal += Number(receipt.gasUsed);
      console.log(`✅ Último batch confirmado`);
      console.log(`gas total: ${gasTotal}`);
    }
    console.log(
      await contractUser.getUser("0xD6950754DEcb967f7B07F0d321D4D153f05dE17b"),
    );
  });
});
