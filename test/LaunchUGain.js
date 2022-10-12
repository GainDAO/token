/* eslint-disable */
const { expect } = require("chai");

const {
  MNEMONIC_KYCPROVIDER1,
  ADDRESS_KYCPROVIDER1,
  MNEMONIC_KYCPROVIDER2,
  ADDRESS_KYCPROVIDER2,
  cMaxTestDuration,
  gainTokenname,
  gainTokensymbol,
  cDistVolume,
  cDistVolumeWei,
  cDistStartRate,
  cDistEndRate,
  cDistDividerRate,
  cUSDCVolume
} = require('./Settings.js');

const { 
  setupSimUSDToken,
  setupGainDAOToken,
  setupERC20Distribution,
  waitForTxToComplete,
  // displayStatus,
  // userSpendsEther,
  // createProof
} = require('./Library.js');

describe("Launch UGAIN", () => {
  let simusdtoken;
  let token;
  let distribution;
  let deployer;
  let treasury;
  let user1;
  let user2;
  let user3;
  let rejecteduser;
  
  const setupContracts = async () => {
    [dummy, dummy, dummy, deployer, treasury, pool, user1, user2, user3, rejecteduser] = await ethers.getSigners();

    try {
      simusdtoken = await setupSimUSDToken(deployer, user1, user2, user3, rejecteduser, cUSDCVolume)
      token = await setupGainDAOToken(deployer, gainTokenname, gainTokensymbol, cDistVolumeWei)
      distribution = await setupERC20Distribution(
        deployer,
        simusdtoken.address,
        token.address,
        pool.address, // beneficiary account
        cDistStartRate,
        cDistEndRate,
        cDistDividerRate,
        cDistVolumeWei)
    } catch(ex) {
      console.log(ex);
    }
    
    // await distribution.changeKYCApprover(ADDRESS_KYCPROVIDER1);
  }
  
  it("launches the GainDAO", async ()=>{
    await setupContracts();
  }).timeout(cMaxTestDuration);
});
