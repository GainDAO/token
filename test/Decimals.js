const { expect } = require("chai");

const {
  MNEMONIC_KYCPROVIDER1,
  ADDRESS_KYCPROVIDER1,
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

const doExecuteTest = (theSettings, schema) => () => {
  // setup test account with sufficient balance
  let chainid;
  let paymenttoken;
  let distribution;
  let gaintoken;
  let deployer;
  let treasury;
  let pool;
  let user1;
  let user2;
  let user3;
  let rejecteduser;
  let user1kycproof;
  let validto;

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

    // console.log(
    //   "setup contracts decimals: payment %s vs gain %s",
    //   theSettings.paymentTokenDecimals,
    //   theSettings.gainTokenDecimals
    // );

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

  beforeEach(async () => {
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
    // user2kycproof = await createProof(
    //   MNEMONIC_KYCPROVIDER1,
    //   user2,
    //   validto,
    //   chainid,
    //   distribution.address
    // );
  });

  it("has the right rates at different points in the distribution", async () => {
    const divider = ethers.BigNumber.from(theSettings.cDistDividerRate);
    // let fulldist = await distribution.total_distribution_balance()
    for (step of schema) {
      // console.log("-----------------------------------------");
      // console.log("input:", step);

      const amountgainwei = ethers.utils.parseUnits(
        step.amountgain,
        theSettings.gainTokenDecimals
      );

      const actualrate = await distribution.currentRateUndivided(amountgainwei);
      const predictedrate = ethers.BigNumber.from(
        Math.round(step.startrate_gainperusd * divider, 0)
      );

      // console.log("actual %s vs predicted %s", actualrate, predictedrate);
      expect(actualrate).to.equal(predictedrate);

      const gainbalancebefore = await gaintoken.balanceOf(user1.address);
      const balanceERC20before = await paymenttoken.balanceOf(user1.address);

      // console.log(
      //   "before - gainbalance %s vs balanceERC20 %s",
      //   gainbalancebefore.toString(),
      //   balanceERC20before.toString()
      // );

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

      // console.log(
      //   "after - gainbalance %s vs balanceERC20 %s",
      //   gainbalanceafter.toString(),
      //   balanceERC20after.toString()
      // );

      expect(gainbalanceafter.sub(gainbalancebefore)).to.equal(amountgainwei);
      //   expect(balanceERC20before.sub(balanceERC20after)).to.equal(
      //     ethers.utils.parseEther(step.costusd)
      //   );
    }
  });
};

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
const cSchema = [
  //   createStep("0", "1", "1", "1"),
  createStep("0", "1", "6875000", "6875000"),
  createStep("6875000", "2.9", "6875000", "19937500"),
  createStep("13750000", "4.8", "6875000", "33000000"),
  createStep("20625000", "6.7", "6875000", "46062500"),
  createStep("27500000", "8.6", "6875000", "59125000"),
  createStep("34375000", "10.5", "6875000", "72187500"),
  createStep("41250000", "12.4", "6875000", "85250000"),
  createStep("48125000", "14.3", "6875000", "98312500"),
  createStep("55000000", "16.2", "6875000", "111375000"),
  createStep("61875000", "18.1", "6875000", "124437500"),
  createStep("68750000", "20", "0", "0"),
];

describe("ERC20Distribution UGAIN", doExecuteTest(cSettingsUGAIN, cSchema));
