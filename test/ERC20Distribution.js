const { expect } = require("chai");

const {
  MNEMONIC_KYCPROVIDER1,
  ADDRESS_KYCPROVIDER1,
  MNEMONIC_KYCPROVIDER2,
  ADDRESS_KYCPROVIDER2,
  cMaxTestDuration,
  cSettingsUGAIN,
  cSettingsWGAIN,
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
          validto
        );
        user2kycproof = await createProof(
          MNEMONIC_KYCPROVIDER1,
          user2,
          validto
        );

        expired = currentblock - 1;
        user1expiredproof = await createProof(
          MNEMONIC_KYCPROVIDER1,
          user1,
          expired
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
        // expect(errorresult).to.be.revertedWith("KYC: invalid token");
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
        // expect(errorresult).to.be.revertedWith("KYC: token expired");
      });

      // let info = ` ${ethers.utils.formatEther(cycle.tokens_wei)} tokens @${cycle.rateundivided/theSettings.cDistDividerRate} t/e for ${ethers.utils.formatEther(cycle.cost_wei)} [${ethers.utils.formatEther(cycle.tokenbalance_end_wei)} tokens remaining]`;
      // console.log(info);
    } // for

    it(`${name} - non pool user is not able to claim all ERC20 from the distribution contract`, async () => {
      let result = distribution.connect(user1).claimFiatToken();
      await expect(
        result,
        "non pool user is not able to claim fiat tokens from the contract"
      ).to.be.reverted;
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
        theSettings.paymentTokenName
      );

      gaintoken = await setupGainDAOToken(
        deployer,
        theSettings.gainTokenname,
        theSettings.gainTokensymbol,
        theSettings.cDistVolumeWei
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

      await expect(distribution1, "zero address cannot be used as beneficiary")
        .to.be.reverted;
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
      ).to.be.reverted;
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
      ).to.be.reverted;
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
      ).to.be.reverted;

      let distribution2 = ERC20Distribution.connect(deployer).deploy(
        paymenttoken.address,
        gaintoken.address,
        pool.address,
        theSettings.cDistStartRate,
        theSettings.cDistStartRate,
        theSettings.cDistDividerRate,
        theSettings.cDistVolumeWei
      );

      await expect(
        distribution2,
        "distribution start rate cannot be equal to end rate"
      ).to.be.reverted;

      let distribution3 = ERC20Distribution.connect(deployer).deploy(
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
      ).to.be.reverted;
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
      ).to.be.reverted;

      // added to achieve 100% code coverage
      expect(await paymenttoken.decimals()).to.be.equal(18);

      // detect invalid distribution volume
      let distribution2 = await ERC20Distribution.connect(deployer).deploy(
        paymenttoken.address,
        gaintoken.address,
        pool.address,
        theSettings.cDistStartRate,
        theSettings.cDistEndRate,
        theSettings.cDistDividerRate,
        theSettings.cDistVolumeWei
      );

      await distribution2.deployed();

      let result2 = distribution2.startDistribution();
      await expect(
        result2,
        "Cannot start distribution with invalid distribution balance"
      ).to.be.rejected;
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
      const txstart = await distribution.startDistribution();
      await waitForTxToComplete(txstart);

      expect(await distribution.distributionStarted()).to.equal(
        true,
        "distribution started after start call"
      );

      const result = distribution.startDistribution();
      await expect(result, "cannot start distribution twice").to.be.rejected;
    });

    it("has expected exchange rate before distribution start", async () => {
      expect(
        await distribution.currentRateUndivided(ethers.utils.parseEther("0")),
        "invalid exchange rate before distribution"
      ).to.equal(theSettings.cDistStartRate);
    });
  });

  describe("ERC20Distribution - Various tests related to distribution end", () => {
    beforeEach(async () => {
      await setupContracts(theSettings, true);
    });

    it("has expected exchange rate after distribution end", async () => {
      const amount_tokens_str = theSettings.cDistVolumeWei.toString();

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
      ).to.be.reverted;

      const buyratecalculated = theSettings.cDistStartRate.add(
        theSettings.cDistEndRate.sub(theSettings.cDistStartRate).div(two)
      );
      const buyrateundivided = await distribution.currentRateUndivided(
        ntokenstobuy
      ); // Gain / SimUSD
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
        validto
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
      ).to.be.revertedWith("Currentrate: out of range");
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
        value: ethers.utils.parseEther("0.1"),
      });
      await expect(txsend, "contract should not accept ether").to.be.reverted;
    });
  });

  describe("ERC20Distribution - Distribute SIMUSD", () => {
    beforeEach(async () => {
      await setupContracts(theSettings, false);
    });

    it("has funded the test accounts with USD", async () => {
      expect(await paymenttoken.balanceOf(user1.address)).to.equal(
        ethers.utils.parseEther("42000000001"),
        "user 1 funding failed"
      );
      expect(await paymenttoken.balanceOf(user2.address)).to.equal(
        ethers.utils.parseEther("42000000002"),
        "user 2 funding failed"
      );
      expect(await paymenttoken.balanceOf(user3.address)).to.equal(
        ethers.utils.parseEther("42000000003"),
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

        const txstart = await distribution.startDistribution();
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
          validto
        );
        rejecteduserkycproof = await createProof(
          MNEMONIC_KYCPROVIDER1,
          rejecteduser,
          validto
        );
      } catch (ex) {
        console.error(
          `ERC20Distribution - Purchase ${theSettings.gainTokenname} - beforeEach - error ${ex.message}`
        );
      }
    });

    it("user 1 can purchase " + theSettings.gainTokenname, async () => {
      const amount_tokens_str = "1500000"; // buy 150000 ugain

      const ntokenstobuy = ethers.utils.parseEther(amount_tokens_str);
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

      const ntokenstobuy = ethers.utils.parseEther(amount_tokens_str);
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

    it(`grants PAUSER_ROLE to treasury (token)`, async () =>
      testAssignRole(token, "PAUSER_ROLE", treasury.address, "treasury"));

    it(`grants MINTER_ROLE to treasury (token)`, async () =>
      testAssignRole(token, "MINTER_ROLE", treasury.address, "treasury"));

    it(`grants BURNER_ROLE to treasury (token)`, async () =>
      testAssignRole(token, "BURNER_ROLE", treasury.address, "treasury"));

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

    it(`removes PAUSER_ROLE from deployer (token)`, async () =>
      testRevokeRole(token, "PAUSER_ROLE", deployer.address, "deployer"));

    it(`removes MINTER_ROLE from deployer (token)`, async () =>
      testRevokeRole(token, "MINTER_ROLE", deployer.address, "deployer"));

    it(`removes BURNER_ROLE from deployer (token)`, async () =>
      testRevokeRole(token, "BURNER_ROLE", deployer.address, "deployer"));

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

      let datahex1 = coder.encode(["address", "uint256"], [user1.address, 345]);
      let hashcalculated1 = ethers.utils.keccak256(datahex1);
      let hashcontract1 = await distribution.hashForKYC(user1.address, 345);
      expect(hashcontract1, "calculates correct proof #1").to.equal(
        hashcalculated1
      );

      let datahex2 = coder.encode(["address", "uint256"], [user2.address, 678]);
      let hashcalculated2 = ethers.utils.keccak256(datahex2);
      let hashcontract2 = await distribution.hashForKYC(user2.address, 678);
      expect(hashcontract2, "calculates correct proof #2").to.equal(
        hashcalculated2
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
      let buyamountwei = ethers.utils.parseEther(buyamount);
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
      buyamountwei = ethers.utils.parseEther(buyamount);
      let totalamount = "9006"; // 3007 + 5999
      let totalamountwei = ethers.utils.parseEther(totalamount);
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
      ).to.be.revertedWith(
        "KYC: _msgSender() does not have the KYC manager role"
      );

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
      ).to.be.revertedWith(
        "KYC: _msgSender() does not have the KYC manager role"
      );
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
        futureblock
      );

      // contract must be unpaused (ie distribution must be started) for the purchase to succeed
      const tx = await gaintoken
        .connect(deployer)
        .mint(distribution.address, theSettings.cDistVolumeWei);
      await waitForTxToComplete(tx);

      await distribution.connect(deployer).startDistribution();

      let allowed = distribution
        .connect(user1)
        .purchaseAllowed(validproof, user1.address, futureblock); // payload,
      await expect(
        allowed,
        "no token purchase if no kyc approver set"
      ).to.be.revertedWith("No KYC approver set: unable to validate buyer");
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
        futureblock
      );
      const expiredproof = await createProof(
        MNEMONIC_KYCPROVIDER1,
        user1,
        expiredblock
      );

      // contract must be unpaused (ie distribution must be started) for the purchase to succeed
      const tx = await gaintoken
        .connect(deployer)
        .mint(distribution.address, theSettings.cDistVolumeWei);
      await waitForTxToComplete(tx);

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
      ).to.be.revertedWith("KYC: invalid token");

      let allowed3 = distribution
        .connect(user1)
        .purchaseAllowed(validproof, user1.address, futureblock + 1); // payload,
      await expect(
        allowed3,
        "not allowed to purchase with wrong blocknumber"
      ).to.be.revertedWith("KYC: invalid token");
      let allowed4 = distribution
        .connect(user1)
        .purchaseAllowed(expiredproof, user1.address, expiredblock); // payload,
      await expect(
        allowed4,
        "not allowed to purchase with expired token #1"
      ).to.be.revertedWith("KYC: token expired");

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
      ).to.be.revertedWith("KYC: token expired");

      await distribution.changeKYCApprover(ADDRESS_KYCPROVIDER2);

      const futureblock2 = (await ethers.provider.getBlockNumber()) + 30;
      const wrongapproverproof = await createProof(
        MNEMONIC_KYCPROVIDER1,
        user1,
        futureblock2
      );
      const rightapproverproof = await createProof(
        MNEMONIC_KYCPROVIDER2,
        user1,
        futureblock2
      );

      let allowed6 = distribution
        .connect(user1)
        .purchaseAllowed(wrongapproverproof, user1.address, futureblock2); // payload,
      await expect(
        allowed6,
        "not able to purchase with wrong kyc approver signature"
      ).to.be.revertedWith("KYC: invalid token");

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
          validto
        );
        user2kycproof = await createProof(
          MNEMONIC_KYCPROVIDER1,
          user2,
          validto
        );
      });
    });

    it("initialization - has correct beneficiary", async () => {
      expect(await distribution._beneficiary()).to.equal(pool.address);
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
      let buyamountwei = ethers.utils.parseEther(buyamount);

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
      await distribution.startDistribution();

      expect(await distribution.paused()).to.equal(false);
    });

    it("start distribution - accepts correct KYC approver", async () => {
      await distribution.changeKYCApprover(ADDRESS_KYCPROVIDER1);
      expect(await distribution._kyc_approver()).to.equal(ADDRESS_KYCPROVIDER1);
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
      user1kycproof = await createProof(MNEMONIC_KYCPROVIDER1, user1, validto);
      user2kycproof = await createProof(MNEMONIC_KYCPROVIDER1, user2, validto);
    });

    false &&
      it("it is possible to buy at the current rate", async () => {
        let buyamount = "3002";
        let buyamountwei = ethers.utils.parseEther(buyamount);
        let currentrateundivided = await distribution.currentRateUndivided(
          buyamountwei
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

    false &&
      it("calculates its own rate", () => {
        const singletest = (offset, amount) => {
          const r = calculateRateUndivided(theSettings, offset, amount);
          // console.log(`${offset}/${amount} - %s [%s/%s]`, r/theSettings.cDistDividerRate, r, theSettings.cDistDividerRate, );
        };
        singletest("500000", "0");
        singletest("500000", "1000");
        singletest("500000", "5000");
        singletest("150000", "1000");
      });

    it("it is possible to buy at a worse rate than current rate", async () => {
      // set dist offset to 150000
      let startvolumewei = ethers.utils.parseEther("150000");
      let currentrateundivided = await distribution.currentRateUndivided(
        startvolumewei
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
      let nextamountwei = ethers.utils.parseEther(nextamount);
      let nextrateundivided = await distribution.currentRateUndivided(
        nextamountwei
      );
      let predictednextrate = calculateRateUndivided(
        theSettings,
        "150000",
        nextamount
      );
      expect(nextrateundivided).to.equal(predictednextrate);

      // calculate a worse rate
      let worserate = nextrateundivided.add("10000");
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
        "151000",
        nextamount
      );
      expect(nextrateundivided).to.equal(predictednextrate);

      let balance = await gaintoken.balanceOf(user1.address);
      expect(balance).to.equal(startvolumewei.add(nextamountwei));
    });

    it("it is not possible to buy when the rate has worsened", async () => {
      // set dist offset to 150000
      let startvolumewei = ethers.utils.parseEther("150000");
      let currentrateundivided = await distribution.currentRateUndivided(
        startvolumewei
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
      let nextamountwei = ethers.utils.parseEther(nextamount);
      let nextrateundivided = await distribution.currentRateUndivided(
        nextamountwei
      );
      expect(nextrateundivided).to.equal(
        calculateRateUndivided(theSettings, "150000", nextamount)
      );

      // someone buys tokens / changes rate before buy transaction is completed
      let dummyvolumewei = ethers.utils.parseEther("15000");
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

  describe("ERC20Distribution buycycles - small amounts at the start of distribution (fixed token amount)", async () => {
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

// describe("ERC20Distribution UGAIN", doExecuteTest(cSettingsUGAIN));

describe("ERC20Distribution WGAIN", doExecuteTest(cSettingsWGAIN));
