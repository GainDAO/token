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
  displayStatus,
  userBuysGainTokens,
  createProof
} = require('./Library.js');

const {
  calculateRateEther,
  getBuyCyclesByCount,
  getBuyCyclesByEther
} = require('./BuyCycles.js')

describe("ERC20Distribution", () => {
  let simusdtoken;
  let token;
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
  
  const setupContracts = async (doInit=true) => {
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
      console.error("setupContracts - error ", ex.message);
    }
    
    if(doInit) {
      
    }

    await token.grantRole(await token.DEFAULT_ADMIN_ROLE(), treasury.address);
    await token.grantRole(await token.PAUSER_ROLE(), treasury.address);
    await token.grantRole(await token.MINTER_ROLE(), treasury.address);
    await token.grantRole(await token.BURNER_ROLE(), treasury.address);
    
    await distribution.grantRole(await distribution.DEFAULT_ADMIN_ROLE(), treasury.address);
    await distribution.grantRole(await distribution.KYCMANAGER_ROLE(), treasury.address);
    
    // await token.connect(treasury).revokeRole(token.PAUSER_ROLE(), deployer.address);
    // await token.connect(treasury).revokeRole(token.MINTER_ROLE(), deployer.address);
    // await token.connect(treasury).revokeRole(token.BURNER_ROLE(), deployer.address);
    // await token.connect(treasury).revokeRole(token.DEFAULT_ADMIN_ROLE(), deployer.address);
    //
    // await distribution.connect(treasury).revokeRole(distribution.KYCMANAGER_ROLE(), deployer.address);
    // await distribution.connect(treasury).revokeRole(distribution.DEFAULT_ADMIN_ROLE(), deployer.address);
    
    const tx1 = await token.connect(deployer).mint(distribution.address, cDistVolumeWei);
    await waitForTxToComplete(tx1)
    
    const tx2 = await distribution.connect(deployer).startDistribution();
    await waitForTxToComplete(tx2)
    
    const tx3 = await distribution.changeKYCApprover(ADDRESS_KYCPROVIDER1);
    await waitForTxToComplete(tx3)
  }

  before(async () => {
  })

  beforeEach(async () => {
    await setupContracts();

    const currentblock = await ethers.provider.getBlockNumber()
    validto = currentblock + 1000;
    user1kycproof = await createProof(MNEMONIC_KYCPROVIDER1, user1, validto);
    user2kycproof = await createProof(MNEMONIC_KYCPROVIDER1, user2, validto);
  })
  
  // context("start distribution", async () => {
  //   it("can receive tokens for distribution", async () => {
  //     let totalSupply = await token.totalSupply();
  //     console.log("mint %s tokens to distribution", ethers.utils.formatEther(cDistVolume))
  //     await token.connect(deployer).mint(distribution.address, cDistVolume);
  //   })
  // 
  //   it("has received the correct amount of tokens", async () => {
  //     let balance = await token.balanceOf(distribution.address);
  //     expect(balance).to.equal(cDistVolume);
  //     console.log("distribution now has %s tokens", ethers.utils.formatEther(balance))
  //   })
  // 
  //   it("distribution can be started", async () => {
  //     // Transfer initial token amount to the distribution contract
  //     await distribution.startDistribution();
  // 
  //     expect(await distribution.paused()).to.equal(false);
  //   })
  // });
  
  const distVolume = ethers.utils.formatEther(cDistVolumeWei)
  const faction = distVolume/2999

  let testcasebase = []
  const testcases = [];
  for(i=0;i<12;i++) { testcasebase.push(2**i) }
  
  let idx=0;
  while ((2**idx-1)*faction<distVolume) {
    const offset = ((2**idx-1)*faction);
    let gain = ((2**idx)*faction);
    if(offset+gain>distVolume) {
      gain = distVolume-offset;
    }

    testcases.push({offset:offset.toString(), gain: gain.toString()});
    
    idx++;
  }
  
  context("ratios",  async ()=>{
    // for(const testcase of cases) {
    testcases.forEach(testcase => {
      it("tests ratio case " + testcase.offset + "/" + testcase.gain, async ()=>{
        const currentdistvolume = await distribution.current_distributed_balance();
        const offsetwei = ethers.utils.parseEther(testcase.offset);
        if(currentdistvolume<offsetwei) {
          // buy tokens using user1 account to create offset
          const deltawei = offsetwei.sub(currentdistvolume)
        
          await userBuysGainTokens(simusdtoken, distribution, deltawei, undefined, user1, user1kycproof, validto);
        
          expect(await token.balanceOf(user1.address), "user 1 bought enough ugain").to.equal(deltawei)
          expect(await distribution.current_distributed_balance(), "distribution at correct offset").to.equal(offsetwei)
        
          // clear offset balance from distribution contract
          const usdcbalance2 = await simusdtoken.balanceOf(distribution.address);
          const tx2 = await distribution.connect(pool).claimFiatToken();
          await waitForTxToComplete(tx2);
          expect(await simusdtoken.balanceOf(pool.address), "pool claims usdc offset").to.equal(usdcbalance2)
          expect(await simusdtoken.balanceOf(distribution.address), "distribution has no balance after claim").to.equal(0)
        }
        
        const divider = await distribution.dividerrate_distribution();
        const currentrate = await distribution.currentRateUndivided(ethers.utils.parseEther(testcase.gain));
        
        // console.log('ratio - offset %s - gain %s - ratio ', testcase.offset, testcase.gain, currentrate.toString())
        
        const gainwei = ethers.utils.parseEther(testcase.gain);
        await userBuysGainTokens(simusdtoken, distribution, gainwei, undefined, user2, user2kycproof, validto, true);
        
        expect(await token.balanceOf(user2.address), "user 2 bought enough ugain").to.equal(gainwei)
        const newdistvolume = await distribution.current_distributed_balance();
        
        // claim usdc tokens to the treasury
        const usdcclaim = await simusdtoken.balanceOf(distribution.address);
        const poolbalance = await simusdtoken.balanceOf(pool.address);
        // console.log("dist usdc claim is %s", ethers.utils.formatEther(usdcclaim))
        const tx = await distribution.connect(pool).claimFiatToken();
        await waitForTxToComplete(tx);

        expect(await simusdtoken.balanceOf(pool.address), "pool claims usdc").to.equal(usdcclaim.add(poolbalance))
        expect(await simusdtoken.balanceOf(distribution.address), "no usdc left in distribution").to.equal(0)
        
        // await displayStatus(token, simusdtoken, distribution, treasury, `case ${testcase.offset}/${testcase.gain}`, user2)
        // expect(await distribution.current_distributed_balance(), "distribution at correct offset").to.equal()
      })
    }).timeout(60*1000);
    
  //   false && it("checks purchasing", async ()=> {
  //     let idx = 0;
  //     let divider = 1;
  //     let currentrate = 0;
  //     let newrate = 0;
  //     let balance = 0;
  //     let gaintokenswei = ethers.utils.parseEther("0");
  // 
  //     gaintokenswei = ethers.utils.parseEther("100");
  //     balance = await token.balanceOf(distribution.address);
  //     divider = await distribution.dividerrate_distribution();
  //     currentrate = await distribution.currentRateUndivided(gaintokenswei);
  //     console.log()
  //     await userBuysGainTokens(simusdtoken, distribution,gaintokenswei, undefined, user1, user1kycproof, validto);
  //     console.log("%s user balance: %s usdc - %s gain [%s/%s]", 
  //       (idx+1), 
  //       ethers.utils.formatEther(await simusdtoken.balanceOf(user1.address)),
  //       ethers.utils.formatEther(await token.balanceOf(user1.address)),
  //       currentrate.toString(), divider.toString());
  //     idx++;
  // 
  //     // balance = await token.balanceOf(distribution.address);
  //     // gaintokenswei = "100";
  //     // currentrate = await distribution.currentRateUndivided(ethers.utils.parseEther(gaintokens));
  //     // await userBuysGainTokens(simusdtoken, distribution,ethers.utils.parseEther(gaintokens), undefined, user1, user1kycproof, validto);
  //     // console.log("%s user balance: %s usdc - %s gain [%s]", 
  //     //   (idx+1), 
  //     //   ethers.utils.formatEther(await simusdtoken.balanceOf(user1.address)),
  //     //   ethers.utils.formatEther(await token.balanceOf(user1.address)),
  //     //   currentrate.toString());
  //     // idx++;
  //   }).timeout(60*1000)
  });
});
