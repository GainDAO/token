// SPDX-License-Identifier: MIT
const { ethers } = require("hardhat");
const { expect } = require("chai");

describe("PaymentToken", function () {
  let paymentToken;
  let owner;
  let receiver;
  let rejectedAddress;

  const initialSupply = ethers.utils.parseEther("1000");
  const name = "SimUSD";
  const symbol = "SIM";
  const cDecimals6 = 6;
  const cDecimals18 = 18;

  beforeEach(async function () {
    [owner, receiver, rejectedAddress] = await ethers.getSigners();

    const PaymentToken = await ethers.getContractFactory("PaymentToken");
    paymentToken = await PaymentToken.deploy(
      initialSupply,
      name,
      symbol,
      rejectedAddress.address,
      cDecimals6
    );
    await paymentToken.deployed();
  });

  describe("Deployment", function () {
    it("Should set the correct initial supply", async function () {
      const totalSupply = await paymentToken.totalSupply();
      expect(totalSupply).to.equal(initialSupply);
    });

    it("Should set the correct name and symbol", async function () {
      const tokenName = await paymentToken.name();
      const tokenSymbol = await paymentToken.symbol();
      expect(tokenName).to.equal(name);
      expect(tokenSymbol).to.equal(symbol);
    });

    it("Should set the correct decimals", async function () {
      const decimals = await paymentToken.decimals();
      expect(decimals).to.equal(cDecimals6);
    });
  });

  describe("Transfer", function () {
    it("Should transfer tokens between two non-rejected addresses", async function () {
      const initialBalance = await paymentToken.balanceOf(owner.address);
      const transferAmount = ethers.utils.parseEther("10");

      await paymentToken.transfer(receiver.address, transferAmount);

      const finalBalanceOwner = await paymentToken.balanceOf(owner.address);
      const finalBalanceReceiver = await paymentToken.balanceOf(
        receiver.address
      );

      expect(finalBalanceOwner).to.equal(initialBalance.sub(transferAmount));
      expect(finalBalanceReceiver).to.equal(transferAmount);
    });

    it("Should fail to transfer tokens involving the rejected address", async function () {
      const initialBalanceOwner = await paymentToken.balanceOf(owner.address);
      const initialBalanceReceiver = await paymentToken.balanceOf(
        receiver.address
      );
      const transferAmount = ethers.utils.parseEther("10");

      // these are not rejected, but do fail!
      await paymentToken.transfer(rejectedAddress.address, transferAmount);
      await paymentToken
        .connect(rejectedAddress)
        .transfer(receiver.address, transferAmount);

      const finalBalanceOwner = await paymentToken.balanceOf(owner.address);
      const finalBalanceReceiver = await paymentToken.balanceOf(
        receiver.address
      );

      expect(finalBalanceOwner).to.equal(initialBalanceOwner);
      expect(finalBalanceReceiver).to.equal(initialBalanceReceiver);
    });
  });

  describe("Decimals", function () {
    if (
      ("Should set the correct decimals",
      async function () {
        [owner, receiver, rejectedAddress] = await ethers.getSigners();
        const PaymentToken = await ethers.getContractFactory("PaymentToken");

        const paymentToken1 = await PaymentToken.deploy(
          initialSupply,
          name,
          symbol,
          rejectedAddress.address,
          cDecimals6
        );
        await paymentToken1.deployed();

        const decimals1 = await paymentToken1.decimals();
        expect(decimals1).to.equal(cDecimals6);

        const paymentToken2 = await PaymentToken.deploy(
          initialSupply,
          name,
          symbol,
          rejectedAddress.address,
          cDecimals18
        );
        await paymentToken2.deployed();

        const decimals2 = await paymentToken2.decimals();
        expect(decimals2).to.equal(cDecimals18);
      })
    );
  });

  describe("TransferFrom", function () {
    it("Should transfer tokens from an approved address to a non-rejected address", async function () {
      const initialBalanceOwner = await paymentToken.balanceOf(owner.address);
      const initialBalanceReceiver = await paymentToken.balanceOf(
        receiver.address
      );
      const transferAmount = ethers.utils.parseEther("10");

      await paymentToken.approve(owner.address, transferAmount);
      await paymentToken
        .connect(owner)
        .transferFrom(owner.address, receiver.address, transferAmount);

      const finalBalanceOwner = await paymentToken.balanceOf(owner.address);
      const finalBalanceReceiver = await paymentToken.balanceOf(
        receiver.address
      );

      expect(finalBalanceOwner).to.equal(
        initialBalanceOwner.sub(transferAmount)
      );
      expect(finalBalanceReceiver).to.equal(
        initialBalanceReceiver.add(transferAmount)
      );
    });

    it("Should fail to transfer tokens from an approved address involving the rejected address", async function () {
      const initialBalanceOwner = await paymentToken.balanceOf(owner.address);
      const initialBalanceReceiver = await paymentToken.balanceOf(
        receiver.address
      );

      const transferAmount = ethers.utils.parseEther("10");
      await paymentToken.approve(owner.address, transferAmount);

      // these are not rejected, but do fail!
      await paymentToken.transferFrom(
        owner.address,
        rejectedAddress.address,
        transferAmount
      );

      await paymentToken.approve(
        rejectedAddress.address,
        transferAmount.mul(2)
      );
      await paymentToken
        .connect(rejectedAddress)
        .transferFrom(
          rejectedAddress.address,
          receiver.address,
          transferAmount
        );

      const finalBalanceOwner = await paymentToken.balanceOf(owner.address);
      const finalBalanceReceiver = await paymentToken.balanceOf(
        receiver.address
      );

      expect(finalBalanceOwner).to.equal(initialBalanceOwner);
      expect(finalBalanceReceiver).to.equal(initialBalanceReceiver);
    });
  });
});
