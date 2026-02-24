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
    const UserContract = await ethers.getContractFactory("UserPoolGames");

    const contractUser = await UserContract.deploy(usdtAddress);

    const contractUserAddress = await contractUser.getAddress();

    await contract.setUser(contractUserAddress);
    await contractUser.setManager(feeManagerAddress);
    await contractUser.setTreasuryPool(contractAddress);

    await usdt.mint(ethers.parseUnits("1000000", 6));
    await usdt.transfer(contractAddress, ethers.parseUnits("10000", 6));
    await contract.setManager(feeManagerAddress);
    return {
      owner,
      otherAccount,
      another,
      usdt,
      contract,
      contractAddress,
      contractUser,
      contractUserAddress,
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
    await contract.claimContribution(owner.address, 0);
  });
  it("should not contribute not registered", async function () {
    const { owner, otherAccount, another, usdt, contract, contractAddress } =
      await loadFixture(deployFixture);
    await expect(
      contract.connect(otherAccount).contribute(ethers.parseUnits("100", 6), 0),
    ).to.be.revertedWith("Not registered");
  });
  it("should not contribute invalid value", async function () {
    const { owner, otherAccount, another, usdt, contract, contractAddress } =
      await loadFixture(deployFixture);
    await expect(
      contract.contribute(ethers.parseUnits("1", 6), 0),
    ).to.be.revertedWith("Min 10 USDC / Max 10.000 USDC");
    await expect(
      contract.contribute(ethers.parseUnits("10001", 6), 0),
    ).to.be.revertedWith("Min 10 USDC / Max 10.000 USDC");
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
    await expect(
      contract.claimContribution(owner.address, 0),
    ).to.be.revertedWith("Claim allowed only after 30 days or at plan end");

    await time.increase(72 * 60 * 60);

    expect(
      await contract.calculateDaysElapsedToClaim(owner.address, 0),
    ).to.be.equal(5);
    await contract.claimContribution(owner.address, 0);
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
    await expect(
      contract.claimContribution(owner.address, 0),
    ).to.be.revertedWith("Claim allowed only after 30 days or at plan end");

    await time.increase(24 * 7 * 60 * 60);

    expect(
      await contract.calculateDaysElapsedToClaim(owner.address, 0),
    ).to.be.equal(10);

    await contract.claimContribution(owner.address, 0);
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
    await expect(
      contract.claimContribution(owner.address, 0),
    ).to.be.revertedWith("Claim allowed only after 30 days or at plan end");

    await time.increase(24 * 17 * 60 * 60);

    expect(
      await contract.calculateDaysElapsedToClaim(owner.address, 0),
    ).to.be.equal(20);

    await contract.claimContribution(owner.address, 0);
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
    await expect(
      contract.claimContribution(owner.address, 0),
    ).to.be.revertedWith("Claim allowed only after 30 days or at plan end");

    await time.increase(24 * 30 * 60 * 60);
    expect(
      await contract.timeUntilNextWithdrawal(owner.address, 0),
    ).to.be.equal(0);

    expect(
      await contract.calculateDaysElapsedToClaim(owner.address, 0),
    ).to.be.equal(33);

    await contract.claimContribution(owner.address, 0);
    await time.increase(24 * 30 * 60 * 60);

    expect(
      await contract.calculateDaysElapsedToClaim(owner.address, 0),
    ).to.be.equal(33);

    await contract.claimContribution(owner.address, 0);
    await time.increase(24 * 30 * 60 * 60);

    expect(
      await contract.calculateDaysElapsedToClaim(owner.address, 0),
    ).to.be.equal(30);

    await contract.claimContribution(owner.address, 0);
    await time.increase(24 * 30 * 60 * 60);

    await expect(
      contract.claimContribution(owner.address, 0),
    ).to.be.revertedWith("Already claimed");
    expect(
      await contract.timeUntilNextWithdrawal(owner.address, 0),
    ).to.be.equal(0);
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
    await expect(
      contract.claimContribution(owner.address, 0),
    ).to.be.revertedWith("Claim allowed only after 30 days or at plan end");

    for (let index = 0; index < 12; index++) {
      await time.increase(24 * 30 * 60 * 60);

      await contract.claimContribution(owner.address, 0);
    }

    await expect(
      contract.claimContribution(owner.address, 0),
    ).to.be.revertedWith("Already claimed");
  });
  it("should test unilevel", async function () {
    const {
      owner,
      otherAccount,
      another,
      usdt,
      contract,
      contractAddress,
      contractUser,
    } = await loadFixture(deployFixture);
    const wallets: any[] = [owner];

    for (let index = 0; index < 20; index++) {
      const wallet = ethers.Wallet.createRandom().connect(ethers.provider);
      wallets.push(wallet);

      await owner.sendTransaction({
        to: wallet.address,
        value: ethers.parseEther("1"),
      });

      await contractUser.connect(wallet).createUser(wallets[index].address);
      await usdt.mint(ethers.parseUnits("2000", 6));
      await usdt.transfer(wallet.address, ethers.parseUnits("2000", 6));
      await usdt
        .connect(wallet)
        .approve(contractAddress, ethers.parseUnits("2000", 6));
      await contract
        .connect(wallet)
        .contribute(ethers.parseUnits("2000", 6), 0);
    }
    await contractUser.setTreasuryPool(owner.address);
    for (let index = 0; index < wallets.length; index++) {
      for (let j = 0; j < 19; j++) {
        await contractUser.increaseDirectMember(wallets[index].address);
      }
    }
    await contractUser.setTreasuryPool(contractAddress);
    await usdt.approve(contractAddress, ethers.parseUnits("2000", 6));
    await contract.contribute(ethers.parseUnits("2000", 6), 0);
    await usdt.mint(ethers.parseUnits("2000", 6));
    await usdt.transfer(
      wallets[wallets.length - 1].address,
      ethers.parseUnits("2000", 6),
    );
    await usdt
      .connect(wallets[wallets.length - 1])
      .approve(contractAddress, ethers.parseUnits("2000", 6));

    await contract
      .connect(wallets[wallets.length - 1])
      .contribute(ethers.parseUnits("1000", 6), 0);

    await time.increase(24 * 60 * 60);
    await contract.claimContribution(owner.address, 0);
  });
  it("should test unilevel", async function () {
    const {
      owner,
      otherAccount,
      another,
      usdt,
      contract,
      contractAddress,
      contractUser,
    } = await loadFixture(deployFixture);

    const wallet = ethers.Wallet.createRandom().connect(ethers.provider);

    await owner.sendTransaction({
      to: wallet.address,
      value: ethers.parseEther("1"),
    });

    await contractUser.connect(wallet).createUser(owner.address);
    await usdt.mint(ethers.parseUnits("2000", 6));
    await usdt.transfer(wallet.address, ethers.parseUnits("2000", 6));
    await usdt
      .connect(wallet)
      .approve(contractAddress, ethers.parseUnits("2000", 6));

    await usdt.approve(contractAddress, ethers.parseUnits("200", 6));
    await contract.contribute(ethers.parseUnits("100", 6), 0);

    await contract.connect(wallet).contribute(ethers.parseUnits("2000", 6), 0);

    await contract.contribute(ethers.parseUnits("10", 6), 0);

    await time.increase(24 * 60 * 60);

    await contract.claimContribution(owner.address, 0);
  });
  it("should test active and inactive contributions", async function () {
    const { owner, otherAccount, another, usdt, contract, contractAddress } =
      await loadFixture(deployFixture);
    await usdt.approve(contractAddress, ethers.parseUnits("100000", 6));

    for (let index = 0; index < 60; index++) {
      await contract.contribute(ethers.parseUnits("10", 6), 0);
    }
    expect(
      (await contract.getActiveContributions(owner.address, 0)).length,
    ).to.be.equal(50);
    expect(
      (await contract.getActiveContributions(owner.address, 50)).length,
    ).to.be.equal(10);

    await time.increase(24 * 60 * 60);
    for (let index = 0; index < 60; index++) {
      await contract.claimContribution(owner.address, index);
    }
    expect(
      (await contract.getActiveContributions(owner.address, 0)).length,
    ).to.be.equal(0);
  });
  it("should test cancel", async function () {
    const { owner, otherAccount, another, usdt, contract, contractAddress } =
      await loadFixture(deployFixture);
    await usdt.approve(contractAddress, ethers.parseUnits("100000", 6));

    await contract.contribute(ethers.parseUnits("10", 6), 0);
    await contract.contribute(ethers.parseUnits("10", 6), 0);

    const balance = await usdt.balanceOf(owner.address);
    await contract.cancelContribution(0);
    expect(await usdt.balanceOf(owner.address)).to.be.equal(
      balance + ethers.parseUnits("5", 6),
    );
    await expect(contract.cancelContribution(0)).to.be.revertedWith(
      "Contribution already finished",
    );
    await time.increase(24 * 60 * 60);
    await contract.claimContribution(owner.address, 1);
    await expect(contract.cancelContribution(1)).to.be.revertedWith(
      "Contribution already finished",
    );
  });
  it("should test cancel 360 days", async function () {
    const { owner, otherAccount, another, usdt, contract, contractAddress } =
      await loadFixture(deployFixture);
    await usdt.approve(contractAddress, ethers.parseUnits("100000", 6));

    await contract.contribute(ethers.parseUnits("10", 6), 5);
    await contract.contribute(ethers.parseUnits("10", 6), 5);

    await time.increase(24 * 60 * 60 * 60);
    await contract.claimContribution(owner.address, 0);
    await contract.claimContribution(owner.address, 0);
    const balance = await usdt.balanceOf(owner.address);
    await contract.cancelContribution(0);

    expect((await usdt.balanceOf(owner.address)) - balance).to.be.equal(
      ethers.parseUnits("1", 6),
    );
    await time.increase(24 * 30 * 60 * 60);
    await contract.claimContribution(owner.address, 1);
    await contract.claimContribution(owner.address, 1);
    await contract.claimContribution(owner.address, 1);
    const balance2 = await usdt.balanceOf(owner.address);
    await contract.cancelContribution(1);
    expect(balance2).to.be.equal(await usdt.balanceOf(owner.address));
  });
});
