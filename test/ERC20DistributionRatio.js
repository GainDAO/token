const { expect } = require("chai");

const {
  MNEMONIC_KYCPROVIDER1,
  ADDRESS_KYCPROVIDER1,
  // MNEMONIC_KYCPROVIDER2,
  // ADDRESS_KYCPROVIDER2,
  // cMaxTestDuration,
  cSettingsUGAIN,
} = require('./Settings.js');

const {
  setupPaymentToken,
  setupGainDAOToken,
  setupERC20Distribution,
  waitForTxToComplete,
  // displayStatus,
  userBuysGainTokens,
  createProof
} = require('./Library.js');

// const {
//   calculateRateEther
// } = require('./BuyCycles.js')

const executesRatiosTest = (theSettings) => () => {
  let paymenttoken;
  let gaintoken;
  let distribution;
  let deployer;
  let treasury;
  let user1;
  let user2;
  let user3;
  let rejecteduser;
  let user1kycproof;
  let user2kycproof;
  let user3kycproof;
  let rejecteduserkycproof;

  const setupContracts = async (settings, doInit = true) => {
    [dummy, dummy, dummy, deployer, treasury, pool, user1, user2, user3, rejecteduser] = await ethers.getSigners();


    // console.log("setup contracts for " + settings.gainTokenname)

    try {
      paymenttoken = await setupPaymentToken(deployer, user1, user2, user3, rejecteduser, settings.paymentTokenVolume, settings.paymentTokenName)
      gaintoken = await setupGainDAOToken(deployer, settings.gainTokenname, settings.gainTokensymbol, settings.cDistVolumeWei)
      await gaintoken.deployed();

      distribution = await setupERC20Distribution(
        deployer, 
        paymenttoken.address,
        gaintoken.address,
        pool.address, // beneficiary account
        settings.cDistStartRate,
        settings.cDistEndRate,
        settings.cDistDividerRate,
        settings.cDistVolumeWei)
    } catch (ex) {
      console.error("setupContracts - error ", ex.message);
    }


    if (doInit) {

    }

    await gaintoken.grantRole(await gaintoken.DEFAULT_ADMIN_ROLE(), treasury.address);
    await gaintoken.grantRole(await gaintoken.MINTER_ROLE(), treasury.address);

    await distribution.grantRole(await distribution.DEFAULT_ADMIN_ROLE(), treasury.address);
    await distribution.grantRole(await distribution.KYCMANAGER_ROLE(), treasury.address);

    // await gaintoken.connect(treasury).revokeRole(gaintoken.MINTER_ROLE(), deployer.address);
    // await gaintoken.connect(treasury).revokeRole(gaintoken.DEFAULT_ADMIN_ROLE(), deployer.address);
    //
    // await distribution.connect(treasury).revokeRole(distribution.KYCMANAGER_ROLE(), deployer.address);
    // await distribution.connect(treasury).revokeRole(distribution.DEFAULT_ADMIN_ROLE(), deployer.address);

    const tx1 = await gaintoken.connect(deployer).mint(distribution.address, settings.cDistVolumeWei);
    await waitForTxToComplete(tx1)

    const tx2 = await distribution.connect(deployer).startDistribution();
    await waitForTxToComplete(tx2)

    const tx3 = await distribution.changeKYCApprover(ADDRESS_KYCPROVIDER1);
    await waitForTxToComplete(tx3)
  }

  before(async () => {
  })

  beforeEach(async () => {
    await setupContracts(theSettings);

    const currentblock = await ethers.provider.getBlockNumber()
    validto = currentblock + 1000;
    user1kycproof = await createProof(MNEMONIC_KYCPROVIDER1, user1, validto);
    user2kycproof = await createProof(MNEMONIC_KYCPROVIDER1, user2, validto);
  })

  const distVolume = ethers.utils.formatEther(theSettings.cDistVolumeWei)
  const steps = 20;
  const offsetVolume = Math.round(distVolume / steps, 0);
  const purchaseVolume = 1;
  const rateOffset = 1;

  let idx = 0;
  let testcases = [];
  for (i = 0; i < steps; i++) {
    const offset = i * offsetVolume;
    let gain = 1; // purchaseVolume
    if (offset + purchaseVolume > distVolume) {
      gain = distVolume - purchaseVolume;
    }

    testcases.push({ offset: offset.toString(), gain: gain.toString(), rateOffset });

    idx++;
  }

  testcases.push({ offset: (distVolume - purchaseVolume).toString(), gain: purchaseVolume.toString(), rateOffset });


  context("ratios", async () => {
    // for(const testcase of cases) {
    testcases.forEach(testcase => {
      it("tests ratio case " + testcase.offset + "/" + testcase.gain, async () => {
        const currentdistvolume = await distribution.current_distributed_balance();
        const offsetwei = ethers.utils.parseEther(testcase.offset);
        if (currentdistvolume < offsetwei) {
          // buy tokens using user1 account to create offset
          const deltawei = offsetwei.sub(currentdistvolume)

          let currentrateundivided = ethers.BigNumber.from(await distribution.currentRateUndivided(deltawei))

          await userBuysGainTokens(paymenttoken, distribution, deltawei, currentrateundivided, user1, user1kycproof, validto);

          expect(await gaintoken.balanceOf(user1.address), "user 1 bought enough ugain").to.equal(deltawei)
          expect(await distribution.current_distributed_balance(), "distribution at correct offset").to.equal(offsetwei)

          // clear offset balance from distribution contract
          const usdcbalance2 = await paymenttoken.balanceOf(distribution.address);
          const tx2 = await distribution.connect(pool).claimFiatToken();
          await waitForTxToComplete(tx2);
          expect(await paymenttoken.balanceOf(pool.address), "pool claims payment token offset").to.equal(usdcbalance2)
          expect(await paymenttoken.balanceOf(distribution.address), "distribution has no balance after claim").to.equal(0)
        }

        const currentrate = await distribution.currentRateUndivided(ethers.utils.parseEther(testcase.gain));
        const limitrate = currentrate.add(testcase.rateOffset)

        const actualratio = currentrate / await distribution.dividerrate_distribution();

        // console.log(`actual rate undivided: ${currentrate} - limit rate undivided ${limitrate} [fiat tokens / distributed token]`);
        // console.log('volume sold %s - gain to purchase %s - Tokens / WBTC %s - WBTC / Token %s',
        //   testcase.offset,
        //   testcase.gain,
        //   (1 / actualratio).toString(),
        //   actualratio.toExponential().toString());

        const gainwei = ethers.utils.parseEther(testcase.gain);
        await userBuysGainTokens(paymenttoken, distribution, gainwei, limitrate, user2, user2kycproof, validto);

        expect(await gaintoken.balanceOf(user2.address), "user 2 bought enough ugain").to.equal(gainwei)
        const newdistvolume = await distribution.current_distributed_balance();

        // claim payment token tokens to the treasury
        const usdcclaim = await paymenttoken.balanceOf(distribution.address);
        const poolbalance = await paymenttoken.balanceOf(pool.address);
        // console.log("dist payment token claim is %s", ethers.utils.formatEther(usdcclaim))
        const tx = await distribution.connect(pool).claimFiatToken();
        await waitForTxToComplete(tx);

        expect(await paymenttoken.balanceOf(pool.address), "pool claims payment token").to.equal(usdcclaim.add(poolbalance))
        expect(await paymenttoken.balanceOf(distribution.address), "no payment token left in distribution").to.equal(0)

        // await displayStatus(token, paymenttoken, distribution, treasury, `case ${testcase.offset}/${testcase.gain}`, user2)
        // expect(await distribution.current_distributed_balance(), "distribution at correct offset").to.equal()
      })
    }).timeout(60 * 1000);
  });
}

describe("ERC20DistributionRatio - UGAIN", executesRatiosTest(cSettingsUGAIN));
