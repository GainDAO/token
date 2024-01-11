const { expect } = require("chai");

const {
  MNEMONIC_KYCPROVIDER1,
  ADDRESS_KYCPROVIDER1,
  MNEMONIC_KYCPROVIDER2,
  ADDRESS_KYCPROVIDER2,
  cMaxTestDuration,
  cSettingsUGAIN,
} = require("./Settings.js");

const {
  setupPaymentToken,
  setupGainDAOToken,
  setupERC20Distribution,
  waitForTxToComplete,
  // displayStatus,
  createProof,
  getChainId,
} = require("./Library.js");

const {
  // calculateRateEther,
  getBuyCyclesByCount,
  formatBuyCycles,
} = require("./BuyCycles.js");

const fastmode = true;

const doExecuteTest = (theSettings) => () => {
  let paymenttoken;
  let gaintoken;
  let deployer;
  let treasury;
  let pool;
  let user1;
  let user2;
  let user3;
  let rejecteduser;

  const setupContracts = async (settings, startdistribution = false) => {
    [
      dummy,
      dummy,
      dummy,
      deployer,
      treasury,
      pool,
      user1,
      user2,
      user3,
      rejecteduser,
    ] = await ethers.getSigners();

    try {
      paymenttoken = await setupPaymentToken(
        deployer,
        user1,
        user2,
        user3,
        rejecteduser,
        theSettings.paymentTokenVolume,
        theSettings.paymentTokenName
      );
      gaintoken = await setupGainDAOToken(
        deployer,
        theSettings.gainTokenname,
        theSettings.gainTokensymbol,
        theSettings.cDistVolumeWei
      );
      distribution = await setupERC20Distribution(
        deployer,
        paymenttoken.address,
        gaintoken.address,
        pool.address, // beneficiary account
        settings.cDistStartRate,
        settings.cDistEndRate,
        settings.cDistDividerRate,
        settings.cDistVolumeWei
      );

      if (startdistribution) {
        await gaintoken
          .connect(deployer)
          .mint(distribution.address, settings.cDistVolumeWei);
        await distribution.startDistribution();

        await distribution.changeKYCApprover(ADDRESS_KYCPROVIDER1);
      }
    } catch (ex) {
      console.error("setupContracts - error ", ex.message);
    }

    // await distribution.changeKYCApprover(ADDRESS_KYCPROVIDER1);
  };

  const logStartConditions = async () => {
    console.log(
      "**************************************************************"
    );
    console.log("*** Settings");
    /* show initial conditions */
    console.log(
      "start rate %s (ERC20/ugain)",
      (await distribution.startrate_distribution()) /
        (await distribution.dividerrate_distribution())
    );
    console.log(
      "end rate %s (ERC20/ugain)",
      (await distribution.endrate_distribution()) /
        (await distribution.dividerrate_distribution())
    );
  };

  const logUser = async (username, user, amountgainwei) => {
    console.log(
      `${username} ERC20 amount`,
      ethers.utils.formatEther(await paymenttoken.balanceOf(user.address)),
      "gain amount",
      ethers.utils.formatEther(await gaintoken.balanceOf(user.address)),
      "exchange rate",
      (await distribution.currentRateUndivided(amountgainwei)) /
        (await distribution.dividerrate_distribution()),
      "ERC20/ugain",
      "ether balance",
      ethers.utils.formatEther(await ethers.provider.getBalance(user.address))
    );
  };

  const logUserTable = async (
    title,
    amountgainwei1,
    amountgainwei2,
    amountgainwei3
  ) => {
    console.log(
      "**************************************************************"
    );
    console.log("*** ", title);
    console.log(
      "distributed volume",
      ethers.utils.formatEther(await distribution.current_distributed_balance())
    );

    await logUser("user 1", user1, amountgainwei1);
    await logUser("user 2", user2, amountgainwei2);
    await logUser("user 3", user3, amountgainwei3);

    console.log(
      "**************************************************************"
    );
  };

  describe("ERC20DistributionConcurrent - Competing transactions / Changing distribution rate", () => {
    let validto, user1kycproof, user2kycproof, user3kycproof;

    before(async () => {
      const chainid = await getChainId()
      // Enable automining
      network.provider.send("evm_setAutomine", [true]);

      await setupContracts(theSettings, true);
      currentblock = await ethers.provider.getBlockNumber();
      validto = currentblock + 100000;
      user1kycproof = await createProof(MNEMONIC_KYCPROVIDER1, user1, validto, chainid, distribution.address);
      user2kycproof = await createProof(MNEMONIC_KYCPROVIDER1, user2, validto, chainid, distribution.address);
      user3kycproof = await createProof(MNEMONIC_KYCPROVIDER1, user3, validto, chainid, distribution.address);

      const deployerProof = await createProof(
        MNEMONIC_KYCPROVIDER1,
        deployer,
        validto, 
        chainid, 
        distribution.address
      );

      const initialAmount = ethers.utils.parseEther("1000000");
      await paymenttoken
        .connect(deployer)
        .approve(distribution.address, initialAmount);
      let purchaseRate = await distribution.currentRateUndivided(initialAmount);
      const tx1 = await distribution
        .connect(deployer)
        .purchaseTokens(initialAmount, purchaseRate, deployerProof, validto);

      // Disable automining
      network.provider.send("evm_setAutomine", [true]);
    });

    it("it changes the exchange rate within a block", async () => {
      await logStartConditions();

      // approve sufficient amount of tokens for all users
      const amountapprove = ethers.utils.parseEther("100000");
      const txa1 = await paymenttoken
        .connect(user1)
        .approve(distribution.address, amountapprove);
      const txa2 = await paymenttoken
        .connect(user2)
        .approve(distribution.address, amountapprove);
      const txa3 = await paymenttoken
        .connect(user3)
        .approve(distribution.address, amountapprove);

      // mine the next block
      await network.provider.send("evm_mine");

      await txa1.wait();
      await txa2.wait();
      await txa3.wait();

      // simulate multiple transactions in a single block without slippage
      const amountgainwei1 = ethers.utils.parseEther("9000");
      const amountgainwei2 = ethers.utils.parseEther("11000");
      const amountgainwei3 = ethers.utils.parseEther("14000");

      await logUserTable(
        "start",
        amountgainwei1,
        amountgainwei2,
        amountgainwei3
      );

      // mine the next block
      await network.provider.send("evm_mine");

      let slippage = "100"; // ratio -> 100 = 0 % slippage, 110 = 10% slippage

      let purchaseRate1 = (
        await distribution.currentRateUndivided(amountgainwei1)
      )
        .mul(slippage)
        .div("100");
      let purchaseRate2 = (
        await distribution.currentRateUndivided(amountgainwei2)
      )
        .mul(slippage)
        .div("100");
      let purchaseRate3 = (
        await distribution.currentRateUndivided(amountgainwei3)
      )
        .mul(slippage)
        .div("100");

      // send transactions
      await expect(
        distribution
          .connect(user1)
          .purchaseTokens(amountgainwei1, purchaseRate1, user1kycproof, validto)
      ).not.to.be.reverted;
      await expect(
        distribution
          .connect(user2)
          .purchaseTokens(amountgainwei2, purchaseRate2, user2kycproof, validto)
      ).to.be.reverted;
      await expect(
        distribution
          .connect(user3)
          .purchaseTokens(amountgainwei3, purchaseRate3, user3kycproof, validto)
      ).to.be.reverted;

      // mine the next block
      await network.provider.send("evm_mine");

      await logUserTable(
        "two should have reverted",
        amountgainwei1,
        amountgainwei2,
        amountgainwei3
      );

      // each user should have received the given amount of tokens
      expect(await gaintoken.balanceOf(user1.address)).to.equal(
        ethers.utils.parseEther("9000")
      );
      expect(await gaintoken.balanceOf(user2.address)).to.equal(
        ethers.utils.parseEther("0")
      );
      expect(await gaintoken.balanceOf(user3.address)).to.equal(
        ethers.utils.parseEther("0")
      );

      // each user wants to buy at current rate + 10% slippage
      slippage = "110"; // ratio -> 100 = 0 % slippage, 110 = 10% slippage

      purchaseRate1 = (await distribution.currentRateUndivided(amountgainwei1))
        .mul(slippage)
        .div("100");
      purchaseRate2 = (await distribution.currentRateUndivided(amountgainwei2))
        .mul(slippage)
        .div("100");
      purchaseRate3 = (await distribution.currentRateUndivided(amountgainwei3))
        .mul(slippage)
        .div("100");

      // send transactions
      await expect(
        distribution
          .connect(user1)
          .purchaseTokens(amountgainwei1, purchaseRate1, user1kycproof, validto)
      ).not.to.be.reverted;
      await expect(
        distribution
          .connect(user2)
          .purchaseTokens(amountgainwei2, purchaseRate2, user2kycproof, validto)
      ).not.to.be.reverted;
      await expect(
        distribution
          .connect(user3)
          .purchaseTokens(amountgainwei3, purchaseRate3, user3kycproof, validto)
      ).not.to.be.reverted;

      // mine the next block
      await network.provider.send("evm_mine");

      // each user should have received the given amount of tokens
      expect(await gaintoken.balanceOf(user1.address)).to.equal(
        ethers.utils.parseEther("18000")
      );
      expect(await gaintoken.balanceOf(user2.address)).to.equal(
        ethers.utils.parseEther("11000")
      );
      expect(await gaintoken.balanceOf(user3.address)).to.equal(
        ethers.utils.parseEther("14000")
      );

      await logUserTable("end", amountgainwei1, amountgainwei2, amountgainwei3);
    });
  });
};

describe("ERC20DistributionConcurrent UGAIN", doExecuteTest(cSettingsUGAIN));

// describe('ERC20DistributionConcurrent WGAIN', doExecuteTest(cSettingsWGAIN));
