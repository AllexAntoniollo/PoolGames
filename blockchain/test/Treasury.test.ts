import {
  loadFixture,
  time,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("Treasury", function () {
  this.timeout(60000000);
  async function deployFixture() {
    const [owner, otherAccount, another] = await ethers.getSigners();

    const USDT = await ethers.getContractFactory("USDT");
    const usdt = await USDT.deploy();
    const usdtAddress = await usdt.getAddress();

    const TreasuryPool = await ethers.getContractFactory("TreasuryPool");
    const contract = await TreasuryPool.deploy(usdtAddress);
    const contractAddress = await contract.getAddress();
    await usdt.mint(ethers.parseUnits("1000000", 6));

    return {
      owner,
      otherAccount,
      another,
      usdt,
      contract,
      contractAddress,
    };
  }

  it("should contribute 1 day", async function () {
    const { owner, otherAccount, another, usdt, contract, contractAddress } =
      await loadFixture(deployFixture);
    await usdt.approve(contractAddress, ethers.parseUnits("100", 6));
    await contract.contribute(ethers.parseUnits("100", 6), 0);
    expect(await contract.valueInPool(owner.address)).to.be.equal(
      ethers.parseUnits("100", 6),
    );
    expect(
      await contract.calculateDaysElapsedToClaim(owner.address, 0),
    ).to.be.equal(0);
    expect(
      await contract.timeUntilNextWithdrawal(owner.address, 0),
    ).to.be.equal(24 * 60 * 60);
    await time.increase(72 * 60 * 60);
    expect(
      await contract.calculateDaysElapsedToClaim(owner.address, 0),
    ).to.be.equal(1);
  });
  it("should contribute 5 day", async function () {
    const { owner, otherAccount, another, usdt, contract, contractAddress } =
      await loadFixture(deployFixture);
    await usdt.approve(contractAddress, ethers.parseUnits("100", 6));
    await contract.contribute(ethers.parseUnits("100", 6), 1);

    expect(
      await contract.calculateDaysElapsedToClaim(owner.address, 0),
    ).to.be.equal(0);
    expect(
      await contract.timeUntilNextWithdrawal(owner.address, 0),
    ).to.be.equal(24 * 5 * 60 * 60);
    await time.increase(72 * 60 * 60);

    expect(
      await contract.calculateDaysElapsedToClaim(owner.address, 0),
    ).to.be.equal(3);
    await time.increase(72 * 60 * 60);
    expect(
      await contract.calculateDaysElapsedToClaim(owner.address, 0),
    ).to.be.equal(5);
  });
});
