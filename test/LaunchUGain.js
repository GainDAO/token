/* eslint-disable */
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
  // userSpendsEther,
  // createProof
} = require("./Library.js");

describe("Launch UGAIN", () => {
  let paymenttoken;
  let token;
  let distribution;
  let deployer;
  let treasury;
  let user1;
  let user2;
  let user3;
  let rejecteduser;

  const setupContracts = async (settings) => {
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
        settings.paymentTokenVolume,
        settings.paymentTokenName
      );
      gaintoken = await setupGainDAOToken(
        deployer,
        settings.gainTokenname,
        settings.gainTokensymbol,
        settings.cDistVolumeWei
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
    } catch (ex) {
      console.log(ex);
    }

    // await distribution.changeKYCApprover(ADDRESS_KYCPROVIDER1);
  };

  it("launches UGAIN", async () => {
    await setupContracts(cSettingsUGAIN);
  }).timeout(cMaxTestDuration);

  it("launches WGAIN", async () => {
    await setupContracts(cSettingsWGAIN);
  }).timeout(cMaxTestDuration);
});
