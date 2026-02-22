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
    await usdt.transfer(contractAddress, ethers.parseUnits("10000", 6));
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
    await contract.claimContribution(0);
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
    await expect(contract.claimContribution(0)).to.be.revertedWith(
      "Claim allowed only after 30 days or at plan end",
    );

    await time.increase(72 * 60 * 60);

    expect(
      await contract.calculateDaysElapsedToClaim(owner.address, 0),
    ).to.be.equal(5);
    await contract.claimContribution(0);
  });
  it("should contribute 10 day", async function () {
    const { owner, otherAccount, another, usdt, contract, contractAddress } =
      await loadFixture(deployFixture);
    await usdt.approve(contractAddress, ethers.parseUnits("100", 6));
    await contract.contribute(ethers.parseUnits("100", 6), 2);

    expect(
      await contract.calculateDaysElapsedToClaim(owner.address, 0),
    ).to.be.equal(0);
    expect(
      await contract.timeUntilNextWithdrawal(owner.address, 0),
    ).to.be.equal(24 * 10 * 60 * 60);
    await time.increase(72 * 60 * 60);

    expect(
      await contract.calculateDaysElapsedToClaim(owner.address, 0),
    ).to.be.equal(3);
    await expect(contract.claimContribution(0)).to.be.revertedWith(
      "Claim allowed only after 30 days or at plan end",
    );

    await time.increase(24 * 7 * 60 * 60);

    expect(
      await contract.calculateDaysElapsedToClaim(owner.address, 0),
    ).to.be.equal(10);

    await contract.claimContribution(0);
  });
  it("should contribute 20 day", async function () {
    const { owner, otherAccount, another, usdt, contract, contractAddress } =
      await loadFixture(deployFixture);
    await usdt.approve(contractAddress, ethers.parseUnits("100", 6));
    await contract.contribute(ethers.parseUnits("100", 6), 3);

    expect(
      await contract.calculateDaysElapsedToClaim(owner.address, 0),
    ).to.be.equal(0);
    expect(
      await contract.timeUntilNextWithdrawal(owner.address, 0),
    ).to.be.equal(24 * 20 * 60 * 60);
    await time.increase(72 * 60 * 60);

    expect(
      await contract.calculateDaysElapsedToClaim(owner.address, 0),
    ).to.be.equal(3);
    await expect(contract.claimContribution(0)).to.be.revertedWith(
      "Claim allowed only after 30 days or at plan end",
    );

    await time.increase(24 * 17 * 60 * 60);

    expect(
      await contract.calculateDaysElapsedToClaim(owner.address, 0),
    ).to.be.equal(20);

    await contract.claimContribution(0);
  });
  it("should contribute 90 day", async function () {
    const { owner, otherAccount, another, usdt, contract, contractAddress } =
      await loadFixture(deployFixture);
    await usdt.approve(contractAddress, ethers.parseUnits("100", 6));
    await contract.contribute(ethers.parseUnits("100", 6), 4);

    expect(
      await contract.calculateDaysElapsedToClaim(owner.address, 0),
    ).to.be.equal(0);
    expect(
      await contract.timeUntilNextWithdrawal(owner.address, 0),
    ).to.be.equal(24 * 30 * 60 * 60);
    await time.increase(72 * 60 * 60);

    expect(
      await contract.calculateDaysElapsedToClaim(owner.address, 0),
    ).to.be.equal(3);
    await expect(contract.claimContribution(0)).to.be.revertedWith(
      "Claim allowed only after 30 days or at plan end",
    );

    await time.increase(24 * 30 * 60 * 60);

    expect(
      await contract.calculateDaysElapsedToClaim(owner.address, 0),
    ).to.be.equal(33);

    await contract.claimContribution(0);
    await time.increase(24 * 30 * 60 * 60);

    expect(
      await contract.calculateDaysElapsedToClaim(owner.address, 0),
    ).to.be.equal(33);

    await contract.claimContribution(0);
    await time.increase(24 * 30 * 60 * 60);

    expect(
      await contract.calculateDaysElapsedToClaim(owner.address, 0),
    ).to.be.equal(30);

    await contract.claimContribution(0);
    await time.increase(24 * 30 * 60 * 60);

    await expect(contract.claimContribution(0)).to.be.revertedWith(
      "Already claimed",
    );
  });
  it("should contribute 360 day", async function () {
    const { owner, otherAccount, another, usdt, contract, contractAddress } =
      await loadFixture(deployFixture);
    await usdt.approve(contractAddress, ethers.parseUnits("100", 6));
    await contract.contribute(ethers.parseUnits("100", 6), 5);

    expect(
      await contract.calculateDaysElapsedToClaim(owner.address, 0),
    ).to.be.equal(0);
    expect(
      await contract.timeUntilNextWithdrawal(owner.address, 0),
    ).to.be.equal(24 * 30 * 60 * 60);
    await time.increase(72 * 60 * 60);

    expect(
      await contract.calculateDaysElapsedToClaim(owner.address, 0),
    ).to.be.equal(3);
    await expect(contract.claimContribution(0)).to.be.revertedWith(
      "Claim allowed only after 30 days or at plan end",
    );

    for (let index = 0; index < 12; index++) {
      await time.increase(24 * 30 * 60 * 60);

      await contract.claimContribution(0);
    }

    await expect(contract.claimContribution(0)).to.be.revertedWith(
      "Already claimed",
    );
  });
});
