import {
  loadFixture,
  time,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { PoolGamesNft } from "../typechain-types";

describe("Treasury", function () {
  this.timeout(60000000);
  async function deployFixture() {
    const [owner, otherAccount, another] = await ethers.getSigners();

    const USDT = await ethers.getContractFactory("USDC");
    const usdt = await USDT.deploy();
    const usdtAddress = await usdt.getAddress();

    const TreasuryPool = await ethers.getContractFactory("TreasuryPool");
    const contract = await TreasuryPool.deploy(usdtAddress);
    const contractAddress = await contract.getAddress();

    const FeeManager = await ethers.getContractFactory("FeeManager");

    const feeManager = await FeeManager.deploy();

    const feeManagerAddress = await feeManager.getAddress();
    await feeManager.addToken(usdtAddress, "USDC");

    const PoolGamesNft = await ethers.getContractFactory("PoolGamesNft");
    const poolGamesNft = await upgrades.deployProxy(PoolGamesNft, [
      usdtAddress,
    ]);

    const poolGames = PoolGamesNft.attach(
      await poolGamesNft.getAddress(),
    ) as PoolGamesNft;
    const poolGamesAddress = await poolGames.getAddress();
    await usdt.mint(ethers.parseUnits("1000000", 6));
    await usdt.approve(poolGamesAddress, ethers.parseUnits("1000000", 6));
    await poolGames.setBatchProcessing(60);
    return {
      owner,
      otherAccount,
      another,
      usdt,
      contract,
      contractAddress,
      poolGamesAddress,
      poolGames,
    };
  }

  it("should distribute to 1000", async function () {
    const {
      owner,
      otherAccount,
      another,
      usdt,
      contract,
      contractAddress,
      poolGamesAddress,
      poolGames,
    } = await loadFixture(deployFixture);
    for (let index = 0; index < 100; index++) {
      await poolGames.buy(100);
    }
    expect(await poolGames.totalWeightNftToReceivePayment()).to.equal(10000);
    await poolGames.addValueToDistribute(ethers.parseUnits("1000", 6));
    expect(await poolGames.valueToDistribute()).to.equal(
      ethers.parseUnits("1000", 6),
    );
    const balance = await usdt.balanceOf(owner.address);
    while (true) {
      try {
        await poolGames.processPayments();
      } catch (error) {
        break;
      }
    }

    expect(await usdt.balanceOf(owner.address)).to.be.equal(
      balance + ethers.parseUnits("1000", 6),
    );
    expect(await poolGames.valueToDistribute()).to.equal(0);
  });
  it("should process pending IDs", async function () {
    const {
      owner,
      otherAccount,
      another,
      usdt,
      contract,
      contractAddress,
      poolGamesAddress,
      poolGames,
    } = await loadFixture(deployFixture);
    for (let index = 0; index < 100; index++) {
      await poolGames.buy(100);
    }
    await poolGames.addValueToDistribute(ethers.parseUnits("1000", 6));

    const balance = await usdt.balanceOf(owner.address);
    await poolGames.processPayments();

    await poolGames.buy(100);
    expect(await poolGames.totalWeightNftToReceivePaymentPending()).to.be.equal(
      100,
    );

    while (true) {
      try {
        await poolGames.processPayments();
      } catch (error) {
        break;
      }
    }
    expect(await usdt.balanceOf(owner.address)).to.be.equal(balance);
    expect(await poolGames.valueToDistribute()).to.equal(0);
    expect(await poolGames.totalWeightNftToReceivePayment()).to.equal(10100);
    console.log(await poolGames.users(owner.address));
  });
});
