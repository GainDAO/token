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
  calculateRateUndivided,
  userBuysGainTokens,
  createProof,
  getChainId,
} = require("./Library.js");

const {
  // calculateRateEther,
  getBuyCyclesByCount,
  formatBuyCycles,
} = require("./BuyCycles.js");

const fastmode = false;

const doBuyCycles = true;

const doExecuteTest = (theSettings) => () => {
  let chainid;
  let paymenttoken;
  let gaintoken;
  let distribution;

  let deployer;
  let treasury;
  let pool;
  let user1;
  let user2;
  let user3;
  let rejecteduser;

  const setupContracts = async (settings, startdistribution = false) => {
    chainid = await getChainId();
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
        theSettings.paymentTokenName,
        theSettings.paymentTokenDecimals
      );
      gaintoken = await setupGainDAOToken(
        deployer,
        theSettings.gainTokenname,
        theSettings.gainTokensymbol,
        theSettings.cDistVolumeWei,
        theSettings.gainTokenDecimals
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
        await distribution.connect(deployer).startDistribution();

        await distribution.changeKYCApprover(ADDRESS_KYCPROVIDER1);
      }
    } catch (ex) {
      console.error("setupContracts - error ", ex.message);
    }

    // await distribution.changeKYCApprover(ADDRESS_KYCPROVIDER1);
  };

  const executeBuyCycles = async (name, buyCycles) => {
    it(`Received valid buycycles`, async () => {
      expect(buyCycles, "Buycycles are valid").not.to.equal(false);
    });

    for (let idx = 0; idx < buyCycles.length; idx++) {
      const cycle = buyCycles[idx];

      let balance;
      let currentrateundivided;
      let currentblock;
      let validto;
      let user1kycproof;
      let user2kycproof;
      let expired;
      let user1expiredproof;
      let user;
      let proof;

      before(async () => {
        currentblock = await ethers.provider.getBlockNumber();
        validto = currentblock + 100000;
        user1kycproof = await createProof(
          MNEMONIC_KYCPROVIDER1,
          user1,
          validto,
          chainid,
          distribution.address
        );
        user2kycproof = await createProof(
          MNEMONIC_KYCPROVIDER1,
          user2,
          validto,
          chainid,
          distribution.address
        );

        expired = currentblock - 1;
        user1expiredproof = await createProof(
          MNEMONIC_KYCPROVIDER1,
          user1,
          expired,
          chainid,
          distribution.address
        );

        user = idx % 2 === 0 ? user1 : user2;
        proof = idx % 2 === 0 ? user1kycproof : user2kycproof;
      });

      it(`${name} - startbalance and current rate are correct`, async () => {
        let tokens = ethers.utils.formatEther(cycle.tokens_wei);

        const balance = await gaintoken.balanceOf(distribution.address);
        currentrateundivided = await distribution.currentRateUndivided(
          cycle.tokens_wei
        );

        // console.log("*** cycle", cycle);
        // console.log("*** balance", balance, cycle.tokenbalance_start_wei);
        // console.log("*** rate", currentrateundivided, cycle.rateundivided);

        expect(balance, "startbalance not correct").to.equal(
          cycle.tokenbalance_start_wei
        );
        expect(currentrateundivided, "rate not correct").to.equal(
          cycle.rateundivided.toString()
        );
      });

      it(`${name} - is unable to buy above current rate`, async () => {
        // buying > currentrateundivided should fail
        try {
          const rateundivided = await distribution.currentRateUndivided(
            cycle.tokens_wei
          );
          const tokens = ethers.utils.formatEther(cycle.tokens_wei);
          const result = await userBuysGainTokens(
            paymenttoken,
            distribution,
            cycle.tokens_wei,
            rateundivided.sub("1"),
            user,
            proof,
            validto
          );
          await expect(result).to.equal(false);
        } catch (ex) {
          console.error("is unable to buy above current rate - %s", ex.message);
        }
      });

      it(`${name} - is able to buy at or above current rate`, async () => {
        const rateundivided = await distribution.currentRateUndivided(
          cycle.tokens_wei
        );
        let ratewithslippage =
          idx % 2 === 0 ? rateundivided : rateundivided.add(1);
        const result = await userBuysGainTokens(
          paymenttoken,
          distribution,
          cycle.tokens_wei,
          ratewithslippage,
          user,
          proof,
          validto
        );
        await expect(result).to.equal(true);
      });

      it(`${name} - end token balance is correct`, async () => {
        let balance2 = await gaintoken.balanceOf(distribution.address);
        expect(balance2).to.equal(cycle.tokenbalance_end_wei);
      });

      it(`${name} - end ERC20 balance is correct`, async () => {
        let paymenttokenbalance = await paymenttoken.balanceOf(
          distribution.address
        );
        expect(paymenttokenbalance).to.equal(cycle.pool_balance_end_wei);
      });

      it(`${name} - transaction with invalid KYC proof fails`, async () => {
        const result = await userBuysGainTokens(
          paymenttoken,
          distribution,
          cycle.tokens_wei,
          cycle.rateundivided,
          user3,
          user1kycproof,
          validto
        );
        expect(result).to.equal(false);
      });

      it(`${name} - transaction with expired KYC proof fails`, async () => {
        const result = await userBuysGainTokens(
          paymenttoken,
          distribution,
          cycle.tokens_wei,
          cycle.rateundivided,
          user1,
          user1expiredproof,
          expired
        );
        expect(result).to.equal(false);
      });

      // let info = ` ${ethers.utils.formatEther(cycle.tokens_wei)} tokens @${cycle.rateundivided/theSettings.cDistDividerRate} t/e for ${ethers.utils.formatEther(cycle.cost_wei)} [${ethers.utils.formatEther(cycle.tokenbalance_end_wei)} tokens remaining]`;
      // console.log(info);
    } // for

    it(`${name} - non pool user is not able to claim all ERC20 from the distribution contract`, async () => {
      let result = distribution.connect(user1).claimFiatToken();
      await expect(
        result,
        "non pool user is not able to claim fiat tokens from the contract"
      ).to.be.revertedWithCustomError(distribution, "Unauthorized");
    });
    it(`${name} - it is able to claim all ERC20 from the distribution contract`, async () => {
      try {
        dist_start = await paymenttoken.balanceOf(distribution.address);
        pool_start = await paymenttoken.balanceOf(pool.address);
        await distribution.connect(pool).claimFiatToken();
        dist_end = await paymenttoken.balanceOf(distribution.address);
        pool_end = await paymenttoken.balanceOf(pool.address);
        pool_delta = pool_end.sub(pool_start);
        dist_delta = dist_end.sub(dist_start);

        // console.log("claimERC20 - dist", dist_start, dist_end, dist_delta);
        // console.log("claimERC20 - pool", pool_start, pool_end, pool_delta);

        expect(pool_delta).to.be.gt(0);
        expect(dist_delta).to.be.lt(0);
        expect(pool_delta.add(dist_delta)).to.equal(0);
      } catch (ex) {
        console.error(
          "it is able to claim all ERC20 from the distribution contract - error",
          ex.message
        );
      }
    });
    // });
  }; // executeBuyCycles

  describe("ERC20Distribution - Various tests related to distribution contract creation", () => {
    let paymenttoken;
    let token;
    let deployer;
    let treasury;
    let pool;
    let user1;
    let user2;
    let user3;
    let rejecteduser;

    beforeEach(async () => {
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

      paymenttoken = await setupPaymentToken(
        deployer,
        user1,
        user2,
        user3,
        rejecteduser,
        theSettings.paymentTokenVolume,
        theSettings.paymentTokenName,
        theSettings.paymentTokenDecimals
      );

      gaintoken = await setupGainDAOToken(
        deployer,
        theSettings.gainTokenname,
        theSettings.gainTokensymbol,
        theSettings.cDistVolumeWei,
        theSettings.gainTokenDecimals
      );
    });

    it("cannot use zero address as benificiary", async () => {
      // deploy distribution contract
      const ERC20Distribution = await ethers.getContractFactory(
        "ERC20Distribution"
      );
      let distribution1 = ERC20Distribution.connect(deployer).deploy(
        paymenttoken.address,
        gaintoken.address,
        ethers.constants.AddressZero,
        theSettings.cDistStartRate,
        theSettings.cDistEndRate,
        theSettings.cDistDividerRate,
        theSettings.cDistVolumeWei
      );

      await expect(
        distribution1,
        "zero address cannot be used as beneficiary"
      ).to.be.revertedWithCustomError(ERC20Distribution, "InvalidBeneficiary");
    });

    it("distribution start rate cannot be zero or less", async () => {
      // deploy distribution contract
      const ERC20Distribution = await ethers.getContractFactory(
        "ERC20Distribution"
      );
      let distribution1 = ERC20Distribution.connect(deployer).deploy(
        paymenttoken.address,
        gaintoken.address,
        pool.address,
        ethers.BigNumber.from("0"),
        theSettings.cDistEndRate,
        theSettings.cDistDividerRate,
        theSettings.cDistVolumeWei
      );

      await expect(
        distribution1,
        "distribution start rate cannot be zero or less"
      ).to.be.revertedWithCustomError(ERC20Distribution, "InvalidRate");
    });

    it("distribution divider rate tests", async () => {
      // deploy distribution contract
      const ERC20Distribution = await ethers.getContractFactory(
        "ERC20Distribution"
      );
      let distribution1 = ERC20Distribution.connect(deployer).deploy(
        paymenttoken.address,
        gaintoken.address,
        pool.address,
        theSettings.cDistStartRate,
        theSettings.cDistEndRate,
        ethers.BigNumber.from("0"),
        theSettings.cDistVolumeWei
      );

      await expect(
        distribution1,
        "distribution rate divider cannot be zero or less"
      ).to.be.revertedWithCustomError(ERC20Distribution, "InvalidDividerRate");
    });

    it("distribution end rate conditions", async () => {
      // deploy distribution contract
      const ERC20Distribution = await ethers.getContractFactory(
        "ERC20Distribution"
      );

      let distribution1 = ERC20Distribution.connect(deployer).deploy(
        paymenttoken.address,
        gaintoken.address,
        pool.address,
        theSettings.cDistStartRate,
        ethers.BigNumber.from("0"),
        theSettings.cDistDividerRate,
        theSettings.cDistVolumeWei
      );

      await expect(
        distribution1,
        "distribution start rate cannot be zero or less"
      ).to.be.revertedWithCustomError(ERC20Distribution, "InvalidRate");

      let distribution2 = ERC20Distribution.connect(deployer).deploy(
        paymenttoken.address,
        gaintoken.address,
        pool.address,
        theSettings.cDistEndRate,
        theSettings.cDistStartRate,
        theSettings.cDistDividerRate,
        theSettings.cDistVolumeWei
      );

      await expect(
        distribution2,
        "distribution start rate cannot be less than end rate"
      ).to.be.revertedWithCustomError(ERC20Distribution, "InvalidRate");
    });

    it("edge cases", async () => {
      // added to achieve 100% code coverage
      const ERC20Distribution = await ethers.getContractFactory(
        "ERC20Distribution"
      );
      let distribution1 = await ERC20Distribution.connect(deployer).deploy(
        paymenttoken.address,
        gaintoken.address,
        pool.address,
        theSettings.cDistStartRate,
        theSettings.cDistEndRate,
        theSettings.cDistDividerRate,
        theSettings.cDistVolumeWei
      );

      await distribution1.deployed();

      let result = distribution1.connect(rejecteduser).claimFiatToken();
      await expect(
        result,
        "rejected pool user is not able to claim fiat tokens from the contract"
      ).to.be.revertedWithCustomError(ERC20Distribution, "Unauthorized");

      // added to achieve 100% code coverage
      expect(await paymenttoken.decimals()).to.be.equal(
        theSettings.paymentTokenDecimals
      );
    });
  });

  describe("ERC20Distribution - Various tests related to distribution start", () => {
    beforeEach(async () => {
      await setupContracts(theSettings, false);
    });

    it("detects distribution start correctly", async () => {
      expect(await distribution.distributionStarted()).to.equal(
        false,
        "distribution not started in pause mode"
      );

      const txmint = await token
        .connect(deployer)
        .mint(distribution.address, theSettings.cDistVolumeWei);
      await waitForTxToComplete(txmint);

      // normal user cannot start distribution
      const txstart1 = distribution.connect(user1).startDistribution();
      expect(txstart1).to.be.revertedWithCustomError(
        distribution,
        "Unauthorized"
      );

      // admin user can start distribution
      const txstart2 = await distribution.connect(deployer).startDistribution();
      await waitForTxToComplete(txstart2);

      expect(await distribution.distributionStarted()).to.equal(
        true,
        "start distribution should fail for admin user"
      );

      const result = distribution.connect(deployer).startDistribution();
      await expect(result, "cannot start distribution twice").to.be.rejected;
    });

    it("has expected exchange rate before distribution start", async () => {
      expect(
        await distribution.currentRateUndivided(
          ethers.utils.parseUnits("0", await paymenttoken.decimals())
        ),
        "invalid exchange rate before distribution"
      ).to.equal(theSettings.cDistStartRate);
    });
  });

  describe("ERC20Distribution - Various tests related to distribution end", () => {
    beforeEach(async () => {
      await setupContracts(theSettings, true);
    });

    it("has expected exchange rate after distribution end", async () => {
      const ntokenstobuy = theSettings.cDistVolumeWei;
      const divider = await distribution.dividerrate_distribution();
      const zero = ethers.BigNumber.from("0");
      const one = ethers.BigNumber.from("1");
      const two = ethers.BigNumber.from("2");

      const value1 = distribution.currentRateUndivided(ntokenstobuy); // Gain / SimUSD
      await expect(value1, "Can get rate for full distribution at once").not.to
        .be.reverted;

      let value2 = distribution.currentRateUndivided(ntokenstobuy.add(one));
      await expect(
        value2,
        "Cannot get rate for more than full distribution at once"
      ).to.be.revertedWithCustomError(distribution, "DistributionOutOfRange");

      const buyratecalculated = theSettings.cDistStartRate;
      const buyrateundivided = await distribution.currentRateUndivided(
        ntokenstobuy
      );
      expect(
        buyrateundivided,
        "purchase rate must be correct for full distribution"
      ).to.equal(buyratecalculated);

      // const buyratecalculated = theSettings.cDistStartRate.add(
      //   theSettings.cDistEndRate.sub(theSettings.cDistStartRate).div(two)
      // );
      // const buyrateundivided = await distribution.currentRateUndivided(
      //   ntokenstobuy
      // ); // Gain / SimUSD
      expect(
        buyrateundivided,
        "purchase rate must be correct for full distribution"
      ).to.equal(buyratecalculated);

      const fiat_value = ntokenstobuy.mul(buyrateundivided).div(divider);
      const txapprove = await paymenttoken
        .connect(user1)
        .approve(distribution.address, fiat_value);
      await waitForTxToComplete(txapprove);

      const currentblock = await ethers.provider.getBlockNumber();
      const validto = currentblock + 100000;
      const user1kycproof = await createProof(
        MNEMONIC_KYCPROVIDER1,
        user1,
        validto,
        chainid,
        distribution.address
      );
      const txpurchase = await distribution
        .connect(user1)
        .purchaseTokens(ntokenstobuy, buyrateundivided, user1kycproof, validto);
      await waitForTxToComplete(txpurchase);

      let value5 = distribution.currentRateUndivided(zero);
      await expect(
        value5,
        "Can get rate at distribution end (purchase 0 tokens)"
      ).not.to.be.reverted;

      let value6 = distribution.currentRateUndivided(one);
      await expect(
        value6,
        "Cannot get rate at distribution end (purchase > 0 tokens)"
      ).to.be.revertedWithCustomError(distribution, "DistributionOutOfRange");
    });
  });

  describe("ERC20Distribution - Various tests related to ether handling", () => {
    beforeEach(async () => {
      try {
        await setupContracts(theSettings, true);
      } catch (ex) {
        console.error(ex);
      }
    });

    it("cannot receive ether", async () => {
      const txsend = user1.sendTransaction({
        to: distribution.address,
        value: ethers.utils.parseUnits("0.1", await paymenttoken.decimals()),
      });
      await expect(txsend, "contract should not accept ether").to.be.reverted;
    });
  });

  describe("ERC20Distribution - Distribute SIMUSD", () => {
    beforeEach(async () => {
      await setupContracts(theSettings, false);
    });

    it("has funded the test accounts with USD", async () => {
      const decimals = await paymenttoken.decimals();

      expect(await paymenttoken.balanceOf(user1.address)).to.equal(
        ethers.utils.parseUnits("42000000001", decimals),
        "user 1 funding failed: " +
          ethers.utils.parseUnits("42000000001", decimals)
      );
      expect(await paymenttoken.balanceOf(user2.address)).to.equal(
        ethers.utils.parseUnits("42000000002", decimals),
        "user 2 funding failed"
      );
      expect(await paymenttoken.balanceOf(user3.address)).to.equal(
        ethers.utils.parseUnits("42000000003", decimals),
        "user 3 funding failed"
      );
    });
  });

  describe("ERC20Distribution - Purchase " + theSettings.gainTokenname, () => {
    let validto;
    let user1kycproof;
    let rejecteduserkycproof;

    beforeEach(async () => {
      try {
        await setupContracts(theSettings, false);

        const txmint = await gaintoken
          .connect(deployer)
          .mint(distribution.address, theSettings.cDistVolumeWei);
        await waitForTxToComplete(txmint);

        const txstart = await distribution
          .connect(deployer)
          .startDistribution();
        await waitForTxToComplete(txstart);

        const txapprover = await distribution.changeKYCApprover(
          ADDRESS_KYCPROVIDER1
        );
        await waitForTxToComplete(txapprover);

        const currentblock = await ethers.provider.getBlockNumber();
        validto = currentblock + 1000;
        user1kycproof = await createProof(
          MNEMONIC_KYCPROVIDER1,
          user1,
          validto,
          chainid,
          distribution.address
        );
        rejecteduserkycproof = await createProof(
          MNEMONIC_KYCPROVIDER1,
          rejecteduser,
          validto,
          chainid,
          distribution.address
        );
      } catch (ex) {
        console.error(
          `ERC20Distribution - Purchase ${theSettings.gainTokenname} - beforeEach - error ${ex.message}`
        );
      }
    });

    it("user 1 can purchase " + theSettings.gainTokenname, async () => {
      const amount_tokens_str = "1500000"; // buy 150000 ugain

      const ntokenstobuy = ethers.utils.parseUnits(
        amount_tokens_str,
        await paymenttoken.decimals()
      );
      const divider = await distribution.dividerrate_distribution();
      const buyrateundivided = await distribution.currentRateUndivided(
        ntokenstobuy
      ); // Gain / SimUSD

      // console.log("cdb:", ethers.utils.formatEther(await distribution.current_distributed_balance()));
      // console.log("tdb:", ethers.utils.formatEther(await distribution.total_distribution_balance()));
      // console.log("got buyrate %s/%s", buyrateundivided, divider);

      expect(buyrateundivided, "unable to calculate current rate").to.be.gt(0);

      // set insufficient allowance
      const fiat_value_insufficient = ntokenstobuy
        .sub(1)
        .mul(buyrateundivided)
        .div(divider);

      const tx1 = await paymenttoken
        .connect(user1)
        .approve(distribution.address, fiat_value_insufficient);
      await waitForTxToComplete(tx1);
      expect(
        await distribution.connect(user1).fiattoken_allowance(),
        "user 1 set fiat allowance failed"
      ).to.equal(fiat_value_insufficient);
      await expect(
        distribution
          .connect(user1)
          .purchaseTokens(
            ntokenstobuy,
            buyrateundivided,
            user1kycproof,
            validto
          ),
        "must have sufficient allowance"
      ).to.be.rejected;

      // set sufficient allowance
      const fiat_value = ntokenstobuy.mul(buyrateundivided).div(divider);

      // console.log("buy %s gain for %s simusd @ %s/%s",
      //   ethers.utils.formatEther(ntokenstobuy),
      //   ethers.utils.formatEther(fiat_value),
      //   buyrateundivided, divider);

      const tx2 = await paymenttoken
        .connect(user1)
        .approve(distribution.address, fiat_value);
      await waitForTxToComplete(tx2);
      expect(
        await distribution.connect(user1).fiattoken_allowance(),
        "user 1 set fiat allowance failed"
      ).to.equal(fiat_value);

      await expect(
        distribution
          .connect(user1)
          .purchaseTokens(
            ntokenstobuy,
            buyrateundivided,
            user1kycproof,
            validto
          ),
        "usd amount does not match expected value"
      ).to.changeTokenBalance(paymenttoken, user1, fiat_value.mul(-1));
      expect(
        await token.balanceOf(user1.address),
        "user 1 purchase tokens failed"
      ).to.equal(ntokenstobuy);

      const user1_balance_token = await paymenttoken.balanceOf(user1.address);
      const user1_balance_contract = await distribution
        .connect(user1)
        .user_fiattoken_balance();
      expect(
        user1_balance_token,
        "contract reports same balance as token for user balance"
      ).to.be.equal(user1_balance_contract);

      const dist_balance_token = await paymenttoken.balanceOf(
        distribution.address
      );
      const dist_balance_contract = await distribution
        .connect(user1)
        .fiattoken_contractbalance();
      expect(
        dist_balance_token,
        "contract reports same balance as token for contract balance"
      ).to.be.equal(dist_balance_contract);
    }).timeout(cMaxTestDuration); // it

    it("rejected user cannot purchase uGAIN", async () => {
      const amount_tokens_str = "1500000"; // buy 150000 ugain

      const ntokenstobuy = ethers.utils.parseUnits(
        amount_tokens_str,
        await paymenttoken.decimals()
      );
      const divider = await distribution.dividerrate_distribution();
      const buyrateundivided = await distribution.currentRateUndivided(
        ntokenstobuy
      ); // Gain / SimUSD

      // console.log("cdb:", ethers.utils.formatEther(await distribution.current_distributed_balance()));
      // console.log("tdb:", ethers.utils.formatEther(await distribution.total_distribution_balance()));
      // console.log("got buyrate %s/%s", buyrateundivided, divider);

      expect(buyrateundivided, "unable to calculate current rate").to.be.gt(0);

      const fiat_value = ntokenstobuy.mul(buyrateundivided).div(divider);

      // console.log("buy %s gain for %s simusd @ %s/%s",
      //   ethers.utils.formatEther(ntokenstobuy),
      //   ethers.utils.formatEther(fiat_value),
      //   buyrateundivided, divider);

      const tx1 = await paymenttoken
        .connect(rejecteduser)
        .approve(distribution.address, fiat_value);
      await waitForTxToComplete(tx1);
      expect(
        await distribution.connect(rejecteduser).fiattoken_allowance(),
        "rejected user set fiat allowance failed"
      ).to.equal(fiat_value);

      await expect(
        distribution
          .connect(rejecteduser)
          .purchaseTokens(
            ntokenstobuy,
            buyrateundivided,
            rejecteduserkycproof,
            validto
          ),
        "rejected user should not be able to purchase tokens"
      ).to.be.rejected;
    }).timeout(cMaxTestDuration); // it
  }).timeout(cMaxTestDuration);

  describe("ERC20Distribution - Assign Roles to Treasury", () => {
    beforeEach(async () => {
      await setupContracts(theSettings, true);
    });

    const testAssignRole = async (contract, role, address, username) => {
      const therole = await contract[role]();
      expect(
        await contract.hasRole(therole, address),
        `${username} does not have ${role}`
      ).to.equal(false);
      const tx = await contract.connect(deployer).grantRole(therole, address);
      await waitForTxToComplete(tx);
      expect(
        await contract.hasRole(therole, address),
        `${username} has been assigned ${role}`
      ).to.equal(true);
    };

    it(`grants DEFAULT_ADMIN_ROLE to treasury (token)`, async () =>
      testAssignRole(
        token,
        "DEFAULT_ADMIN_ROLE",
        treasury.address,
        "treasury"
      ));

    it(`grants MINTER_ROLE to treasury (token)`, async () =>
      testAssignRole(token, "MINTER_ROLE", treasury.address, "treasury"));

    it(`grants DEFAULT_ADMIN_ROLE to treasury (distribution)`, async () =>
      testAssignRole(
        distribution,
        "DEFAULT_ADMIN_ROLE",
        treasury.address,
        "treasury"
      ));

    it(`grants KYCMANAGER_ROLE to treasury (distribution)`, async () =>
      testAssignRole(
        distribution,
        "KYCMANAGER_ROLE",
        treasury.address,
        "treasury"
      ));
  });

  describe("ERC20Distribution - Remove roles from deployer", () => {
    beforeEach(async () => {
      await setupContracts(theSettings, true);
    });

    const testRevokeRole = async (contract, role, address, username) => {
      const therole = await contract[role]();
      expect(
        await contract.hasRole(therole, address),
        `${username} has been assigned ${role}`
      ).to.equal(true);
      const tx = await contract.connect(deployer).revokeRole(therole, address);
      await waitForTxToComplete(tx);
      expect(
        await contract.hasRole(therole, address),
        `${username} does not have ${role}`
      ).to.equal(false);
    };

    it(`removes DEFAULT_ADMIN_ROLE from deployer (token)`, async () => {
      await testRevokeRole(
        token,
        "DEFAULT_ADMIN_ROLE",
        deployer.address,
        "deployer"
      );

      let allowed = token.grantRole(
        await token.DEFAULT_ADMIN_ROLE(),
        deployer.address
      );

      await expect(
        allowed,
        "deployer not allowed to grant admin role after being demoted"
      ).to.be.reverted;
      // .to.be.revertedWith("AccessControl: sender must be an admin to grant");
    });

    it(`removes MINTER_ROLE from deployer (token)`, async () =>
      testRevokeRole(token, "MINTER_ROLE", deployer.address, "deployer"));

    it(`removes DEFAULT_ADMIN_ROLE from deployer (distribution)`, async () =>
      testRevokeRole(
        distribution,
        "DEFAULT_ADMIN_ROLE",
        deployer.address,
        "deployer"
      ));

    it(`removes KYCMANAGER_ROLE from deployer (distribution)`, async () =>
      testRevokeRole(
        distribution,
        "KYCMANAGER_ROLE",
        deployer.address,
        "deployer"
      ));
  });

  describe("ERC20Distribution - KYC", () => {
    beforeEach(async () => {
      await setupContracts(theSettings, false);
    });

    it("must calculate correct proof", async () => {
      let coder = new ethers.utils.AbiCoder();

      let datahex1 = coder.encode(
        ["address", "uint256", "uint256", "address"],
        [user1.address, 345, chainid, distribution.address]
      );
      let hashcalculated1 = ethers.utils.keccak256(datahex1);
      let hashcontract1 = await distribution.hashForKYC(user1.address, 345);
      expect(hashcontract1, "calculates correct proof #1").to.equal(
        hashcalculated1
      );

      let datahex2 = coder.encode(
        ["address", "uint256", "uint256", "address"],
        [user2.address, 678, chainid, distribution.address]
      );
      let hashcalculated2 = ethers.utils.keccak256(datahex2);
      let hashcontract2 = await distribution.hashForKYC(user2.address, 678);
      expect(hashcontract2, "calculates correct proof #2").to.equal(
        hashcalculated2
      );

      let datahex3 = coder.encode(
        ["address", "uint256", "uint256", "address"],
        [user2.address, 678, chainid + 1, distribution.address]
      );
      let hashcalculated3 = ethers.utils.keccak256(datahex3);
      let hashcontract3 = await distribution.hashForKYC(user2.address, 678);
      expect(hashcontract3, "calculates incorrect proof #1").not.to.equal(
        hashcalculated3
      );

      let datahex4 = coder.encode(
        ["address", "uint256", "uint256", "address"],
        [user2.address, 678, chainid, token.address]
      );
      let hashcalculated4 = ethers.utils.keccak256(datahex4);
      let hashcontract4 = await distribution.hashForKYC(user2.address, 678);
      expect(hashcontract4, "calculates incorrect proof #2").not.to.equal(
        hashcalculated4
      );
    });

    it("contract owner can buy tokens with no approver set", async () => {
      // check that no approver is set
      expect(await distribution._kyc_approver()).to.equal(
        ethers.constants.AddressZero
      );
      const tx = await token
        .connect(deployer)
        .mint(distribution.address, theSettings.cDistVolumeWei);
      await waitForTxToComplete(tx);

      await distribution.connect(deployer).startDistribution();

      let dummyproof =
        "0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";

      // can buy with no kyc approver set
      let buyamount = "3007";
      let buyamountwei = ethers.utils.parseUnits(
        buyamount,
        await paymenttoken.decimals()
      );
      let currentrateundivided = await distribution.currentRateUndivided(
        buyamountwei
      );

      await userBuysGainTokens(
        paymenttoken,
        distribution,
        buyamountwei,
        undefined,
        deployer,
        dummyproof,
        0
      );
      expect(await token.balanceOf(deployer.address)).to.equal(buyamountwei);

      // set kyc approver
      await distribution.changeKYCApprover(ADDRESS_KYCPROVIDER1);
      expect(await distribution._kyc_approver()).to.equal(ADDRESS_KYCPROVIDER1);

      buyamount = "5999";
      buyamountwei = ethers.utils.parseUnits(
        buyamount,
        await paymenttoken.decimals()
      );
      let totalamount = "9006"; // 3007 + 5999
      let totalamountwei = ethers.utils.parseUnits(
        totalamount,
        await paymenttoken.decimals()
      );
      currentrateundivided = await distribution.currentRateUndivided(
        buyamountwei
      );

      // // can buy with kyc approver set
      await userBuysGainTokens(
        paymenttoken,
        distribution,
        buyamountwei,
        undefined,
        deployer,
        dummyproof,
        0
      );
      expect(await token.balanceOf(deployer.address)).to.equal(totalamountwei);
    });

    it("is able to set and update kyc approver from deployer account", async () => {
      expect(
        await distribution._kyc_approver(),
        "default should be zero address"
      ).to.equal(ethers.constants.AddressZero);

      const tx1 = await distribution
        .connect(deployer)
        .changeKYCApprover(ADDRESS_KYCPROVIDER2);
      await waitForTxToComplete(tx1);
      expect(
        await distribution._kyc_approver(),
        "able to set to new address"
      ).to.equal(ADDRESS_KYCPROVIDER2);

      const tx2 = await distribution
        .connect(deployer)
        .changeKYCApprover(ethers.constants.AddressZero);
      await waitForTxToComplete(tx2);
      expect(
        await distribution._kyc_approver(),
        "able to update to zero address"
      ).to.equal(ethers.constants.AddressZero);

      const tx3 = await distribution
        .connect(deployer)
        .changeKYCApprover(ADDRESS_KYCPROVIDER1);
      await waitForTxToComplete(tx3);
      expect(
        await distribution._kyc_approver(),
        "able to update to new address"
      ).to.equal(ADDRESS_KYCPROVIDER1);
    });

    it("is able add the treasury as kyc manager and update kyc approver from treasury account", async () => {
      expect(
        await distribution._kyc_approver(),
        "default should be zero address"
      ).to.equal(ethers.constants.AddressZero);

      expect(
        await distribution.hasRole(
          distribution.KYCMANAGER_ROLE(),
          treasury.address
        ),
        "treasury starts without manager role"
      ).to.equal(false);

      const tx1 = await distribution.grantRole(
        await distribution.KYCMANAGER_ROLE(),
        treasury.address
      );
      await waitForTxToComplete(tx1);

      expect(
        await distribution.hasRole(
          distribution.KYCMANAGER_ROLE(),
          treasury.address
        ),
        "treasury has gotten manager role"
      ).to.equal(true);

      const tx2 = await distribution
        .connect(treasury)
        .changeKYCApprover(ADDRESS_KYCPROVIDER2);
      await waitForTxToComplete(tx2);

      expect(
        await distribution._kyc_approver(),
        "able to set to new address"
      ).to.equal(ADDRESS_KYCPROVIDER2);

      const tx3 = await distribution
        .connect(treasury)
        .changeKYCApprover(ethers.constants.AddressZero);
      await waitForTxToComplete(tx3);

      expect(
        await distribution._kyc_approver(),
        "able to update to zero address"
      ).to.equal(ethers.constants.AddressZero);

      const tx4 = await distribution
        .connect(treasury)
        .changeKYCApprover(ADDRESS_KYCPROVIDER1);
      await waitForTxToComplete(tx4);

      expect(
        await distribution._kyc_approver(),
        "able to update to new address"
      ).to.equal(ADDRESS_KYCPROVIDER1);

      const tx5 = await distribution.revokeRole(
        await distribution.KYCMANAGER_ROLE(),
        treasury.address
      );
      await waitForTxToComplete(tx5);
      expect(
        await distribution.hasRole(
          distribution.KYCMANAGER_ROLE(),
          treasury.address
        ),
        "treasury has lost manager role"
      ).to.equal(false);

      let allowed = distribution
        .connect(treasury)
        .changeKYCApprover(ADDRESS_KYCPROVIDER1);
      await expect(
        allowed,
        "treasury not allowed to change kyc after role is revoked"
      ).to.be.revertedWithCustomError(distribution, "Unauthorized");

      const tx6 = await distribution.revokeRole(
        await distribution.KYCMANAGER_ROLE(),
        deployer.address
      );
      await waitForTxToComplete(tx6);

      expect(
        await distribution.hasRole(
          distribution.KYCMANAGER_ROLE(),
          deployer.address
        ),
        "deployer has lost manager role"
      ).to.equal(false);

      let allowed2 = distribution.changeKYCApprover(ADDRESS_KYCPROVIDER1);
      await expect(
        allowed2,
        "treasury not allowed to change kyc after role is revoked"
      ).to.be.revertedWithCustomError(distribution, "Unauthorized");
    });

    it("is not allowed to buy with no kyc approver set", async () => {
      // default should be zero address
      expect(await distribution._kyc_approver()).to.equal(
        ethers.constants.AddressZero
      );

      const currentblock = await ethers.provider.getBlockNumber();
      const futureblock = currentblock + 30;

      const validproof = await createProof(
        MNEMONIC_KYCPROVIDER1,
        user1,
        futureblock,
        chainid,
        distribution.address
      );

      await distribution.connect(deployer).startDistribution();

      let allowed = distribution
        .connect(user1)
        .purchaseAllowed(validproof, user1.address, futureblock); // payload,
      await expect(
        allowed,
        "no token purchase if no kyc approver set"
      ).to.be.revertedWithCustomError(distribution, "KYCNotSet");
    });

    it("is able to create and use proof with kyc approver set", async () => {
      await distribution.changeKYCApprover(ADDRESS_KYCPROVIDER1);
      expect(
        await distribution._kyc_approver(),
        "kyc approver set correctly"
      ).to.equal(ADDRESS_KYCPROVIDER1);

      const currentblock = await ethers.provider.getBlockNumber();
      const futureblock = currentblock + 30;
      const expiredblock = currentblock - 1;

      const validproof = await createProof(
        MNEMONIC_KYCPROVIDER1,
        user1,
        futureblock,
        chainid,
        distribution.address
      );
      const expiredproof = await createProof(
        MNEMONIC_KYCPROVIDER1,
        user1,
        expiredblock,
        chainid,
        distribution.address
      );

      await distribution.connect(deployer).startDistribution();

      let allowed1 = await distribution
        .connect(user1)
        .purchaseAllowed(validproof, user1.address, futureblock); // payload,
      expect(allowed1, "allowed to purchase with valid proof").to.equal(true);

      let allowed2 = distribution
        .connect(user2)
        .purchaseAllowed(validproof, user2.address, futureblock); // payload,
      await expect(
        allowed2,
        "not allowed to purchase with wrong user"
      ).to.be.revertedWithCustomError(distribution, "InvalidKYCToken");

      let allowed3 = distribution
        .connect(user1)
        .purchaseAllowed(validproof, user1.address, futureblock + 1); // payload,
      await expect(
        allowed3,
        "not allowed to purchase with wrong blocknumber"
      ).to.be.revertedWithCustomError(distribution, "InvalidKYCToken");
      let allowed4 = distribution
        .connect(user1)
        .purchaseAllowed(expiredproof, user1.address, expiredblock); // payload,
      await expect(
        allowed4,
        "not allowed to purchase with expired token #1"
      ).to.be.revertedWithCustomError(distribution, "KYCTokenExpired");

      let currentnr = 0;
      while (currentnr <= futureblock) {
        currentnr = await ethers.provider.getBlockNumber();
        await ethers.provider.send("evm_mine");
      }

      let allowed5 = distribution
        .connect(user1)
        .purchaseAllowed(validproof, user1.address, futureblock); // payload,
      await expect(
        allowed5,
        "not allowed to purchase with expired token #2"
      ).to.be.revertedWithCustomError(distribution, "KYCTokenExpired");

      await distribution.changeKYCApprover(ADDRESS_KYCPROVIDER2);

      const futureblock2 = (await ethers.provider.getBlockNumber()) + 30;
      const wrongapproverproof = await createProof(
        MNEMONIC_KYCPROVIDER1,
        user1,
        futureblock2,
        chainid,
        distribution.address
      );
      const rightapproverproof = await createProof(
        MNEMONIC_KYCPROVIDER2,
        user1,
        futureblock2,
        chainid,
        distribution.address
      );

      let allowed6 = distribution
        .connect(user1)
        .purchaseAllowed(wrongapproverproof, user1.address, futureblock2); // payload,
      await expect(
        allowed6,
        "not able to purchase with wrong kyc approver signature"
      ).to.be.revertedWithCustomError(distribution, "InvalidKYCToken");

      let allowed7 = await distribution
        .connect(user1)
        .purchaseAllowed(rightapproverproof, user1.address, futureblock2); // payload,
      expect(
        allowed7,
        "able to purchase with right kyc approver signature"
      ).to.equal(true);
    });
  });

  describe("ERC20Distribution - Token distribution", () => {
    let validto;
    let user1kycproof;
    let user2kycproof;

    before(async () => {
      await setupContracts(theSettings, false);

      it("is able to set approver", async () => {
        expect(
          await distribution._kyc_approver(),
          "default kyc approver is zero address"
        ).to.equal(ethers.constants.AddressZero);
        await distribution.changeKYCApprover(ADDRESS_KYCPROVIDER1);
        expect(
          await distribution._kyc_approver(),
          "able to set kyc approver"
        ).to.equal(ADDRESS_KYCPROVIDER1);

        const currentblock = await ethers.provider.getBlockNumber();
        validto = currentblock + 1000;
        user1kycproof = await createProof(
          MNEMONIC_KYCPROVIDER1,
          user1,
          validto,
          chainid,
          distribution.address
        );
        user2kycproof = await createProof(
          MNEMONIC_KYCPROVIDER1,
          user2,
          validto,
          chainid,
          distribution.address
        );
      });
    });

    it("initialization - has correct beneficiary", async () => {
      expect(await distribution.beneficiary()).to.equal(pool.address);
    });

    it("initialization - has correct start rate", async () => {
      expect(await distribution.startrate_distribution()).to.equal(
        theSettings.cDistStartRate
      );
    });

    it("initialization - has correct end rate", async () => {
      expect(await distribution.endrate_distribution()).to.equal(
        theSettings.cDistEndRate
      );
    });

    it("initialization - has correct rate divider", async () => {
      expect(await distribution.dividerrate_distribution()).to.equal(
        theSettings.cDistDividerRate
      );
    });

    it("initialization - has correct total distribution volume", async () => {
      expect(await distribution.total_distribution_balance()).to.equal(
        theSettings.cDistVolumeWei
      );
    });

    it("initialization - has correct start distribution volume", async () => {
      expect(await distribution.current_distributed_balance()).to.equal("0");
    });

    it("initialization - is paused after creation", async () => {
      expect(await distribution.paused()).to.equal(true);
    });

    it("start distribution - it can receive tokens for distribution", async () => {
      let totalSupply = await gaintoken.totalSupply();
      // console.log("mint %s tokens to distribution", theSettings.cDistVolumeWei)
      await gaintoken
        .connect(deployer)
        .mint(distribution.address, theSettings.cDistVolumeWei);
    });

    it("start distribution - it has received the correct amount of tokens", async () => {
      let balance = await gaintoken.balanceOf(distribution.address);
      expect(balance).to.equal(theSettings.cDistVolumeWei);
    });

    it("start distribution - it cannot purchase tokens while paused", async () => {
      let buyamount = "1";
      let buyamountwei = ethers.utils.parseUnits(
        buyamount,
        await paymenttoken.decimals()
      );

      const result = await userBuysGainTokens(
        paymenttoken,
        distribution,
        buyamountwei,
        undefined,
        user1,
        user1kycproof,
        validto
      );
      expect(result).to.equal(false);
    });

    it("start distribution - distribution can be started", async () => {
      // Transfer initial token amount to the distribution contract
      await distribution.connect(deployer).startDistribution();

      expect(await distribution.paused()).to.equal(false);
    });

    it("start distribution - accepts correct KYC approver", async () => {
      await distribution.changeKYCApprover(ADDRESS_KYCPROVIDER1);
      expect(await distribution._kyc_approver()).to.equal(ADDRESS_KYCPROVIDER1);
    });
  });

  describe("ERC20Distribution - Correct Distribution Curve", () => {
    beforeEach(async () => {
      await setupContracts(theSettings, true);

      const currentblock = await ethers.provider.getBlockNumber();
      validto = currentblock + 1000;
      user1kycproof = await createProof(
        MNEMONIC_KYCPROVIDER1,
        user1,
        validto,
        chainid,
        distribution.address
      );
      user2kycproof = await createProof(
        MNEMONIC_KYCPROVIDER1,
        user2,
        validto,
        chainid,
        distribution.address
      );
    });

    const createStep = (
      distributed_amountgain_start,
      startrate_gainperusd,
      amountgain,
      costusd
    ) => {
      return {
        distributed_amountgain_start,
        startrate_gainperusd,
        amountgain,
        costusd,
      };
    };
    const schema = [
      createStep("0", "1", "6875000", "6875000"),
      createStep("6875000", "2.9", "6875000", "19937500."),
      createStep("13750000", "4.8", "6875000", "33000000."),
      createStep("20625000", "6.7", "6875000", "46062500"),
      createStep("27500000", "8.6", "6875000", "59125000."),
      createStep("34375000", "10.5", "6875000", "72187500"),
      createStep("41250000", "12.4", "6875000", "85250000"),
      createStep("48125000", "14.3", "6875000", "98312500"),
      createStep("55000000", "16.2", "6875000", "111375000."),
      createStep("61875000", "18.1", "6875000", "124437500."),
      createStep("68750000", "20", "0", "0"),
    ];

    it("has the right rates at different points in the distribution", async () => {
      const divider = ethers.BigNumber.from(theSettings.cDistDividerRate);
      let fulldist = await distribution.total_distribution_balance();
      for (step of schema) {
        const amountgainwei = ethers.utils.parseUnits(
          step.amountgain,
          await paymenttoken.decimals()
        );

        const actualrate = await distribution.currentRateUndivided(
          amountgainwei
        );
        const predictedrate = ethers.BigNumber.from(
          Math.round(step.startrate_gainperusd * divider, 0)
        );
        expect(actualrate).to.equal(predictedrate);

        const gainbalancebefore = await gaintoken.balanceOf(user1.address);
        const balanceERC20before = await paymenttoken.balanceOf(user1.address);

        await userBuysGainTokens(
          paymenttoken,
          distribution,
          amountgainwei,
          undefined,
          user1,
          user1kycproof,
          validto
        );

        const gainbalanceafter = await gaintoken.balanceOf(user1.address);
        const balanceERC20after = await paymenttoken.balanceOf(user1.address);
        expect(gainbalanceafter.sub(gainbalancebefore)).to.equal(amountgainwei);
        expect(balanceERC20before.sub(balanceERC20after)).to.equal(
          ethers.utils.parseUnits(step.costusd, await paymenttoken.decimals())
        );
      }
    });
  });

  describe("ERC20Distribution - Slippage", () => {
    let validto;
    let user1kycproof;
    let user2kycproof;

    beforeEach(async () => {
      await setupContracts(theSettings, true);

      const currentblock = await ethers.provider.getBlockNumber();
      validto = currentblock + 1000;
      user1kycproof = await createProof(
        MNEMONIC_KYCPROVIDER1,
        user1,
        validto,
        chainid,
        distribution.address
      );
      user2kycproof = await createProof(
        MNEMONIC_KYCPROVIDER1,
        user2,
        validto,
        chainid,
        distribution.address
      );
    });

    it("it is possible to buy at the current rate", async () => {
      let buyamount = "3002";
      let buyamountwei = ethers.utils.parseUnits(
        buyamount,
        await paymenttoken.decimals()
      );

      await userBuysGainTokens(
        paymenttoken,
        distribution,
        buyamountwei,
        undefined,
        user1,
        user1kycproof,
        validto
      );
      let balanceafter = await gaintoken.balanceOf(user1.address);
      expect(balanceafter).to.equal(buyamountwei);
    });

    it("calculates its own rate", async () => {
      const singletest = async (offset, amount) => {
        const r = calculateRateUndivided(
          theSettings,
          ethers.utils.parseUnits(offset).toString(),
          await paymenttoken.decimals()
        );
        // console.log(`${offset}/${amount} - %s [%s/%s]`, r/theSettings.cDistDividerRate, r, theSettings.cDistDividerRate, );
      };
      await singletest("500000", "0");
      await singletest("500000", "1000");
      await singletest("500000", "5000");
      await singletest("150000", "1000");
    });

    it("it is possible to buy at a worse rate than current rate (<= 10% slippage)", async () => {
      // set dist offset to 150000
      let startvolumewei = ethers.utils.parseUnits(
        "150000",
        await paymenttoken.decimals()
      );
      await userBuysGainTokens(
        paymenttoken,
        distribution,
        startvolumewei,
        undefined,
        user1,
        user1kycproof,
        validto
      );

      expect(
        await gaintoken.balanceOf(user1.address),
        "Initial purchase must succeed"
      ).to.equal(
        ethers.utils.parseUnits("150000", await paymenttoken.decimals())
      );

      // calculate actual rate
      let nextamount = "1000";
      let nextamountwei = ethers.utils.parseUnits(
        nextamount,
        await paymenttoken.decimals()
      );
      let nextrateundivided = await distribution.currentRateUndivided(
        nextamountwei
      );
      let predictednextrate = calculateRateUndivided(
        theSettings,
        ethers.utils
          .parseUnits("150000", await paymenttoken.decimals())
          .toString()
      );
      expect(
        nextrateundivided,
        "Mismatch between predicted and calculated next rate after inial purchase"
      ).to.equal(predictednextrate);

      // calculate a 10% worse rate
      let worserate = nextrateundivided.mul("110").div(100);
      await userBuysGainTokens(
        paymenttoken,
        distribution,
        nextamountwei,
        worserate,
        user1,
        user1kycproof,
        validto
      );

      nextrateundivided = await distribution.currentRateUndivided(
        nextamountwei
      );
      predictednextrate = calculateRateUndivided(
        theSettings,
        ethers.utils
          .parseUnits("151000", await paymenttoken.decimals())
          .toString()
      );
      expect(nextrateundivided).to.equal(
        predictednextrate,
        "predected rate after purchase does not match expected rate"
      );

      let balance = await gaintoken.balanceOf(user1.address);
      expect(
        balance,
        "Purchase at worse rate (<= 10% slippage) must succeed"
      ).to.equal(startvolumewei.add(nextamountwei));
    });

    it("it is not possible to buy at a worse rate then current rate with > 10% slippage", async () => {
      // set dist offset to 150000
      let startvolumewei = ethers.utils.parseUnits(
        "150000",
        await paymenttoken.decimals()
      );
      let currentrateundivided = await distribution.currentRateUndivided(
        startvolumewei
      );
      const tx = await userBuysGainTokens(
        paymenttoken,
        distribution,
        startvolumewei,
        undefined,
        user1,
        user1kycproof,
        validto
      );

      expect(
        await gaintoken.balanceOf(user1.address),
        "Initial purchase must succeed"
      ).to.equal(
        ethers.utils.parseUnits("150000", await paymenttoken.decimals())
      );

      // calculate actual rate
      let nextamount = "1000";
      let nextamountwei = ethers.utils.parseUnits(
        nextamount,
        await paymenttoken.decimals()
      );
      let nextrateundivided = await distribution.currentRateUndivided(
        nextamountwei
      );
      let predictednextrate = calculateRateUndivided(
        theSettings,
        ethers.utils
          .parseUnits("150000", await paymenttoken.decimals())
          .toString()
      );
      expect(
        nextrateundivided,
        "Mismatch between predicted and calculated next rate after inial purchase"
      ).to.equal(predictednextrate);

      // calculate a 10% worse rate
      let worserate = nextrateundivided.mul("110").div(100).add(1);
      const result = await userBuysGainTokens(
        paymenttoken,
        distribution,
        nextamountwei,
        worserate,
        user1,
        user1kycproof,
        validto
      );
      expect(result).to.equal(false);
    });

    it("it is not possible to buy when the rate has worsened", async () => {
      // set dist offset to 150000
      let startvolumewei = ethers.utils.parseUnits(
        "150000",
        await paymenttoken.decimals()
      );

      await userBuysGainTokens(
        paymenttoken,
        distribution,
        startvolumewei,
        undefined,
        user1,
        user1kycproof,
        validto
      );

      // calculate actual rate
      let nextamount = "1000";
      let nextamountwei = ethers.utils.parseUnits(
        nextamount,
        await paymenttoken.decimals()
      );
      let nextrateundivided = await distribution.currentRateUndivided(
        nextamountwei
      );
      expect(nextrateundivided).to.equal(
        calculateRateUndivided(
          theSettings,
          ethers.utils.parseUnits("150000", await paymenttoken.decimals())
        )
      );

      // someone buys tokens / changes rate before buy transaction is completed
      let dummyvolumewei = ethers.utils.parseUnits(
        "15000",
        await paymenttoken.decimals()
      );
      await userBuysGainTokens(
        paymenttoken,
        distribution,
        dummyvolumewei,
        undefined,
        user2,
        user2kycproof,
        validto
      );

      // attempt to buy at original rate
      const result = await userBuysGainTokens(
        paymenttoken,
        distribution,
        nextamountwei,
        nextrateundivided,
        user1,
        user1kycproof,
        validto
      );
      expect(result).to.equal(false);
    });
  });

  describe("ERC20Distribution - TokensSold Event", () => {
    let validto, user1kycproof;
    before(async () => {
      await setupContracts(theSettings, true);
      currentblock = await ethers.provider.getBlockNumber();
      validto = currentblock + 100000;
      user1kycproof = await createProof(
        MNEMONIC_KYCPROVIDER1,
        user1,
        validto,
        chainid,
        distribution.address
      );
    });

    it("it emits correct TokensSold event", async () => {
      const amountgainwei = ethers.utils.parseUnits(
        "2998",
        await paymenttoken.decimals()
      );

      const divider = await distribution.dividerrate_distribution();
      const rateundivided = await distribution.currentRateUndivided(
        amountgainwei
      );
      const valuepaymenttoken = amountgainwei.mul(rateundivided).div(divider);

      const tx1 = await paymenttoken
        .connect(user1)
        .approve(distribution.address, valuepaymenttoken);
      await waitForTxToComplete(tx1);

      const tx2 = await expect(
        distribution
          .connect(user1)
          .purchaseTokens(amountgainwei, rateundivided, user1kycproof, validto)
      )
        .to.emit(
          distribution,
          "TokensSold",
          "address",
          "uint256",
          "uint256",
          "uint256"
        )
        .withArgs(
          user1.address,
          valuepaymenttoken,
          amountgainwei,
          rateundivided
        );
    });

    it("it emits correct TokensSold event (extra payment token included)", async () => {
      const amountgainwei = ethers.utils.parseUnits(
        "2998",
        await paymenttoken.decimals()
      );
      const extrapaymenttokenwei = ethers.utils.parseUnits(
        "0.05",
        await paymenttoken.decimals()
      );

      const divider = await distribution.dividerrate_distribution();
      const rateundivided = await distribution.currentRateUndivided(
        amountgainwei
      );
      const valuepaymenttoken = amountgainwei.mul(rateundivided).div(divider);
      const valuepaymenttokenwithextraeth =
        valuepaymenttoken.add(extrapaymenttokenwei);

      const tx1 = await paymenttoken
        .connect(user1)
        .approve(distribution.address, valuepaymenttokenwithextraeth);
      await waitForTxToComplete(tx1);

      const tx2 = await expect(
        distribution
          .connect(user1)
          .purchaseTokens(amountgainwei, rateundivided, user1kycproof, validto)
      )
        .to.emit(
          distribution,
          "TokensSold",
          "address",
          "uint256",
          "uint256",
          "uint256"
        )
        .withArgs(
          user1.address,
          valuepaymenttoken, // extra fiat token is not claimed
          amountgainwei,
          rateundivided
        );
    });

    it("it emits correct TokensSold event (slippage)", async () => {
      const amountgainwei = ethers.utils.parseUnits(
        "2998",
        await paymenttoken.decimals()
      );

      const divider = await distribution.dividerrate_distribution();
      const rateundivided = await distribution.currentRateUndivided(
        amountgainwei
      );
      const worserateundivided = rateundivided.add(
        ethers.BigNumber.from("100")
      );
      const valuepaymenttoken = amountgainwei.mul(rateundivided).div(divider);

      const tx1 = await paymenttoken
        .connect(user1)
        .approve(distribution.address, valuepaymenttoken);
      await waitForTxToComplete(tx1);

      const tx2 = await expect(
        distribution
          .connect(user1)
          .purchaseTokens(
            amountgainwei,
            worserateundivided,
            user1kycproof,
            validto
          )
      )
        .to.emit(
          distribution,
          "TokensSold",
          "address",
          "uint256",
          "uint256",
          "uint256"
        )
        .withArgs(
          user1.address,
          valuepaymenttoken, // extra fiat token is not claimed
          amountgainwei,
          rateundivided // actual rate is used
        );
    });
  });

  describe("ERC20Distribution - kycApproverChanged Event", () => {
    before(async () => {
      await setupContracts(theSettings, true);
    });

    it("it emits correct kycApproverChanged event", async () => {
      const tx = await expect(
        distribution.connect(deployer).changeKYCApprover(user2.address)
      )
        .to.emit(distribution, "kycApproverChanged", "address")
        .withArgs(user2.address);
    });
  });

  describe("ERC20Distribution buycycles - small amounts at the start of distribution (fixed token amount)", async () => {
    if (doBuyCycles === false) {
      console.log("buycycle testing disabled");
      return;
    }

    before(async () => {
      await setupContracts(theSettings, true);
    });

    const cBatchsize = 1000;
    let tokencounts = [];
    let total = 0;
    while (total < 10000) {
      //
      total += cBatchsize;
      tokencounts.push(cBatchsize);
    }
    const buyCycles = getBuyCyclesByCount(theSettings, tokencounts);
    // console.log(formatBuyCycles(buyCycles));
    await executeBuyCycles("small amounts/start", buyCycles);
  }).timeout(cMaxTestDuration); // it

  describe("ERC20Distribution buycycles - small amounts at the tail of distribution (fixed token amount)", async () => {
    if (doBuyCycles === false) {
      console.log("buycycle testing disabled");
      return;
    }

    before(async () => {
      await setupContracts(theSettings, true);
    });

    const cBatchsize = fastmode ? 100000 : 1000;
    let tokencounts = [41900000];
    let total = tokencounts[0];
    while (total < ethers.utils.formatEther(theSettings.cDistVolumeWei)) {
      total += cBatchsize;
      tokencounts.push(cBatchsize);
    }

    const buyCycles = getBuyCyclesByCount(theSettings, tokencounts);
    await executeBuyCycles("small amounts/end", buyCycles);
  }).timeout(cMaxTestDuration); // describe

  describe("ERC20Distribution buycycles - medium amounts across the entire distribution (fixed token amount)", async () => {
    if (doBuyCycles === false) {
      console.log("buycycle testing disabled");
      return;
    }

    before(async () => {
      await setupContracts(theSettings, true);
    });

    const cBatchsize = fastmode ? 2000000 : 18000;
    let tokencounts = [];
    let total = 0;
    while (total < ethers.utils.formatEther(theSettings.cDistVolumeWei)) {
      total += cBatchsize;
      tokencounts.push(cBatchsize);
    }

    const buyCycles = getBuyCyclesByCount(theSettings, tokencounts);
    await executeBuyCycles("medium amounts/full", buyCycles);
  }).timeout(cMaxTestDuration); // describe

  describe("ERC20Distribution buycycles - random amounts across the entire distribution", async () => {
    if (doBuyCycles === false) {
      console.log("buycycle testing disabled");
      return;
    }

    before(async () => {
      await setupContracts(theSettings, true);
    });

    const cBatchsize = fastmode ? 2000000 : 500000;
    let tokencounts = [];
    let total = 0;
    const factor = 1000 * 1000;
    while (total < ethers.utils.formatEther(theSettings.cDistVolumeWei)) {
      let buyamount = Math.round(
        (cBatchsize * Math.random() * factor) / factor
      );
      if (buyamount > 0) {
        total += cBatchsize;
        tokencounts.push(buyamount);
      }
    }

    const buyCycles = getBuyCyclesByCount(theSettings, tokencounts);
    await executeBuyCycles("random amounts/full", buyCycles);
  }).timeout(cMaxTestDuration); // describe
};

describe("ERC20Distribution UGAIN", doExecuteTest(cSettingsUGAIN));

// describe("ERC20Distribution WGAIN", doExecuteTest(cSettingsWGAIN));
