const { expect } = require("chai");

const MNEMONIC_KYCPROVIDER1 = "invite grit junior buzz expose horn weird letter mountain worth carpet author";
const ADDRESS_KYCPROVIDER1 = "0x7A0aE71e1De58A0804F17dcFfcF395aDcaE1D946"
const MNEMONIC_KYCPROVIDER2 = "october shell good pair success finish roof arena equip bargain logic escape";
const ADDRESS_KYCPROVIDER2 = "0x8edC5f9b83F4eB246Ab70719B5f583C1E4EEC4e9"

const cMaxTestDuration = 15 * 60*1000;

const displayStatus = async (message = '',user=undefined) => {
  console.log("=== %s ==================================================================", message)
  console.log("  pool balance %s tokens", ethers.utils.formatEther(await token.balanceOf(distribution.address)))
  console.log("  distribution rate: %s", await distribution.currentRate())
  if(user) {
    console.log("  user %s", user.address)
    console.log("  balance %s tokens", ethers.utils.formatEther(await token.balanceOf(user.address)));
    console.log("  balance %s eth", ethers.utils.formatEther(await user.getBalance()) )
  }
}

const userBuysTokens = async (amountstr, buyrate, user, proof, validto, verbose = false ) => {
  const ntokenstobuy=ethers.utils.parseEther(amountstr);
  const value = ntokenstobuy.div(buyrate);
  await distribution.connect(user).purchaseTokens(buyrate, proof, validto, { value });
  verbose && console.log("%s buys %s tokens for %s eth", user.address, ethers.utils.formatEther(ntokenstobuy), ethers.utils.formatEther(value))
}

const userSpendsEther = async (valueeth, limitrate, user, proof, validto, verbose = false ) => {
  const valuewei=ethers.utils.parseEther(valueeth);
  await distribution.connect(user).purchaseTokens(limitrate, proof, validto, { value: valuewei });
  verbose&& console.log("%s buys tokens for %s eth", user.address, valueeth)
}

const createProof = async (mnemonic, usertowhitelist, validto) => {
  const kycwallet = ethers.Wallet.fromMnemonic(mnemonic);
  const coder = new ethers.utils.AbiCoder()
  const datahex = coder.encode(["address", "uint256"], [usertowhitelist.address, validto]);
  const hash = ethers.utils.keccak256(datahex);
  
  return kycwallet.signMessage(ethers.utils.arrayify(hash));
}

const startvolume_wei = ethers.utils.parseEther("42000000");
const calculateRateEther = volume_wei => {
  try {
    let startrate = ethers.BigNumber.from(3000*1000*1000);
    let deltarate = ethers.BigNumber.from(2999*1000*1000);
    let rate_full = startrate.sub(deltarate.mul(volume_wei).div(startvolume_wei)).div(1000*1000);
    let rate = Math.floor(rate_full.toNumber());
    
    // console.log("calc rate: v: %s r: %s", rate_full.toString(), rate);
    return rate;
  } catch(ex) {
    console.error(ex.message);
    return 0;
  }
}

// const calculateRateLowRes = volume => Math.floor((3000*1000*1000  - (2999*1000*1000 * volume) / 42000000)/(1000*1000));

const getBuyCyclesByCount = (tokencounts, verbose = false) => {

  let dist_volume_wei = ethers.BigNumber.from(0);
  let tokenbalance_start_wei = startvolume_wei;
  let pool_balance_end_wei = ethers.BigNumber.from(0);

  let buyCycles = [];
  for(let i=0;i<tokencounts.length;i++) {
    let tokens_per_step_wei = ethers.utils.parseEther(tokencounts[i].toString());
    let rate = calculateRateEther(dist_volume_wei)
    let cost_wei = tokens_per_step_wei.div(rate).add(1);
    let tokens_wei = cost_wei.mul(rate);
    if(!tokens_wei.gte(tokens_per_step_wei)) {
      verbose && console.log("negative mismatch between actual token count and desired token count")
    }
    if(tokens_wei.gt(tokenbalance_start_wei)) {
      verbose && console.log("clip last purchase to available tokens")
      tokens_wei = tokenbalance_start_wei;
      cost_wei = tokens_wei.mul(rate);
    }
    let tokenbalance_end_wei = tokenbalance_start_wei.sub(tokens_wei);
    pool_balance_end_wei = pool_balance_end_wei.add(cost_wei);
    
    let cycle = { tokenbalance_start_wei, tokens_wei, rate, cost_wei, tokenbalance_end_wei, dist_volume_wei, pool_balance_end_wei }

    buyCycles.push(cycle);
    
    let cyclestr = {
      tokenbalance_start_wei: ethers.utils.formatEther(tokenbalance_start_wei.toString()),
      tokens_wei: ethers.utils.formatEther(tokens_wei.toString()),
      rate,
      cost_wei: ethers.utils.formatEther(cost_wei.toString()),
      tokenbalance_end_wei: ethers.utils.formatEther(tokenbalance_end_wei.toString()),
      dist_volume_wei: ethers.utils.formatEther(dist_volume_wei.toString()),
      pool_balance_end_wei: ethers.utils.formatEther(pool_balance_end_wei.toString()),
    }
    
    verbose && console.log(JSON.stringify(cyclestr,0,2))
    
    dist_volume_wei = dist_volume_wei.add(tokens_wei);
    tokenbalance_start_wei = tokenbalance_end_wei;
  }

  return buyCycles
}

const getBuyCyclesByEther = (ethervalues, verbose = false) => {
  let dist_volume_wei = ethers.BigNumber.from(0);
  let tokenbalance_start_wei = startvolume_wei;
  let tokenbalance_end_wei = startvolume_wei;
  let pool_balance_end_wei = ethers.BigNumber.from(0);
  
  let buyCycles = [];

  for(let i=0; i<ethervalues.length;i++) {
    try {
      let rate = calculateRateEther(dist_volume_wei)
      let cost_wei = ethers.utils.parseEther(ethervalues[i].toString());
      let tokens_wei = cost_wei.mul(rate);
      if(tokens_wei.gt(tokenbalance_start_wei)) {
        verbose && console.log("getBuyCyclesByEther - clip last purchase to available tokens")
        tokens_wei = tokenbalance_start_wei;
        cost_wei = tokens_wei.mul(rate);
      }
      
      let tokenbalance_end_wei = tokenbalance_start_wei.sub(tokens_wei);
      pool_balance_end_wei = pool_balance_end_wei.add(cost_wei);
      
      let cycle = {
        tokenbalance_start_wei,
        tokens_wei,
        rate,
        cost_wei,
        tokenbalance_end_wei,
        dist_volume_wei,
        pool_balance_end_wei
      }

      if(!tokens_wei.isZero()) {
        buyCycles.push(cycle);

        let cyclestr = {
          tokenbalance_start_wei: ethers.utils.formatEther(tokenbalance_start_wei.toString()),
          tokens_wei: ethers.utils.formatEther(tokens_wei.toString()),
          rate,
          cost_wei: ethers.utils.formatEther(cost_wei.toString()),
          tokenbalance_end_wei: ethers.utils.formatEther(tokenbalance_end_wei.toString()),
          dist_volume_wei: ethers.utils.formatEther(dist_volume_wei.toString()),
          pool_balance_end_wei: ethers.utils.formatEther(pool_balance_end_wei.toString()),
        }
        
        verbose && console.log(JSON.stringify(cyclestr,0,2))
      } else {
        verbose && console.log("getBuyCyclesByEther - ignore buycycle when distribution is done")
      }
      
      dist_volume_wei = dist_volume_wei.add(tokens_wei);
      tokenbalance_start_wei = tokenbalance_end_wei
    } catch(ex) {
      console.error("getBuyCyclesByEther failed in cycle #%s (%s) []", i, ethervalues[i], ex.message);
      return false;
    }
  }

  return buyCycles;
}

const cDistVolume = ethers.utils.parseEther("42000000");
const cDistStartRate = ethers.BigNumber.from(3000);
const cDistEndRate = ethers.BigNumber.from(1);

describe("ERC20Distribution", () => {
  let token;
  let deployer;
  let treasury;
  let user1;
  let user2;
  let user3;
  
  const setupContracts = async () => {
    [deployer, treasury, user1, user2, user3] = await ethers.getSigners();

    // deloy gainDAO token contract
    const GainDAOToken = await ethers.getContractFactory("GainDAOToken");
    token = await GainDAOToken.deploy();
    
    await token.deployed();
    await token.unpause();
    
    let distBeneficiary = treasury.address;
    
    // deploy distribution contract
    const ERC20Distribution = await ethers.getContractFactory("ERC20Distribution");
    distribution = await ERC20Distribution.deploy(
      token.address,
      distBeneficiary,
      cDistStartRate,
      cDistEndRate,
      cDistVolume);
    
    await distribution.deployed();
    
    // await distribution.changeKYCApprover(ADDRESS_KYCPROVIDER1);
  }
  
  describe("ERC20Distribution - KYC", ()=>{
    beforeEach(async ()=> {
      await setupContracts();
    })
  
    it("must calculate correct proof", async () => {
      let coder = new ethers.utils.AbiCoder()

      let datahex1 = coder.encode(["address", "uint256"], [user1.address, 345]);
      let hashcalculated1 = ethers.utils.keccak256(datahex1);
      let hashcontract1 = await distribution.hashForKYC(user1.address, 345);
      expect(hashcontract1, 'calculates correct proof #1').to.equal(hashcalculated1);

      let datahex2 = coder.encode(["address", "uint256"], [user2.address, 678]);
      let hashcalculated2 = ethers.utils.keccak256(datahex2);
      let hashcontract2 = await distribution.hashForKYC(user2.address, 678);
      expect(hashcontract2, 'calculates correct proof #2').to.equal(hashcalculated2);
    })
  
    it("contract owner can buy tokens with no approver set", async () => {
      // check that no approver is set
      expect(await distribution._kyc_approver()).to.equal(ethers.constants.AddressZero);
      await token.connect(deployer).mint(distribution.address, cDistVolume);
      await distribution.startDistribution();

      let dummyproof = "0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"

      // can buy with no kyc approver set
      let currentrate = await distribution.currentRate();
      await userBuysTokens("3000", currentrate, deployer, dummyproof, 0);
      // console.log("new balance 1 %s tokens", ethers.utils.formatEther(await token.balanceOf(deployer.address)));
      expect(await token.balanceOf(deployer.address)).to.equal(ethers.utils.parseEther("3000"));

      // set kyc approver
      await distribution.changeKYCApprover(ADDRESS_KYCPROVIDER1);
      expect(await distribution._kyc_approver()).to.equal(ADDRESS_KYCPROVIDER1);

      // can buy with kyc approver set
      currentrate = await distribution.currentRate();
      await userSpendsEther("1", currentrate, deployer, dummyproof, 0);
      expect(await token.balanceOf(deployer.address)).to.equal(ethers.utils.parseEther("5999"));
    });
  
    it("is able to set and update kyc approver", async () => {
      expect(await distribution._kyc_approver(), 'default should be zero address')
        .to.equal(ethers.constants.AddressZero);

      await distribution.changeKYCApprover(ADDRESS_KYCPROVIDER2);
      expect(await distribution._kyc_approver(), 'able to set to new address')
        .to.equal(ADDRESS_KYCPROVIDER2);

      await distribution.changeKYCApprover(ethers.constants.AddressZero);
      expect(await distribution._kyc_approver(), 'able to update to zero address')
        .to.equal(ethers.constants.AddressZero);

      await distribution.changeKYCApprover(ADDRESS_KYCPROVIDER1);
      expect(await distribution._kyc_approver(), 'able to update to new address')
        .to.equal(ADDRESS_KYCPROVIDER1);
    });
  
    it("is not allowed to buy with no kyc approver set", async () => {
      // default should be zero address
      expect(await distribution._kyc_approver()).to.equal(ethers.constants.AddressZero);

      const currentblock = await ethers.provider.getBlockNumber()
      const futureblock = currentblock + 30

      const validproof = await createProof(MNEMONIC_KYCPROVIDER1, user1, futureblock);

      let allowed =
        distribution.connect(user1)
          .purchaseAllowed(validproof, user1.address, futureblock); // payload,
      await expect(allowed, 'no token purchase if no kyc approver set')
        .to.be.revertedWith("No KYC approver set: unable to validate buyer");
    })
  
    it("is able to create and use proof with kyc approver set", async () => {
      await distribution.changeKYCApprover(ADDRESS_KYCPROVIDER1);
      expect(await distribution._kyc_approver(), 'kyc approver set correctly').to.equal(ADDRESS_KYCPROVIDER1);

      const currentblock = await ethers.provider.getBlockNumber()
      const futureblock = currentblock + 30
      const expiredblock = currentblock - 1;

      const validproof = await createProof(MNEMONIC_KYCPROVIDER1, user1, futureblock);
      const expiredproof = await createProof(MNEMONIC_KYCPROVIDER1, user1, expiredblock);

      let allowed1 =
        await distribution.connect(user1)
          .purchaseAllowed(validproof, user1.address, futureblock); // payload,
      expect(allowed1, 'allowed to purchase with valid proof').to.equal(true);

      let allowed2 =
        distribution.connect(user2)
          .purchaseAllowed(validproof, user2.address, futureblock); // payload,
      await expect(allowed2, 'not allowed to purchase with wrong user').to.be.revertedWith('KYC: invalid token');

      let allowed3 =
        distribution.connect(user1)
          .purchaseAllowed(validproof, user1.address, futureblock + 1); // payload,
      await expect(allowed3, 'not allowed to purchase with wrong blocknumber').to.be.revertedWith('KYC: invalid token');
      let allowed4 =
        distribution.connect(user1)
          .purchaseAllowed(expiredproof, user1.address, expiredblock); // payload,
      await expect(allowed4, 'not allowed to purchase with expired token #1').to.be.revertedWith('KYC: token expired');

      let currentnr = 0
      while(currentnr<=futureblock) {
        currentnr = await ethers.provider.getBlockNumber()
        await ethers.provider.send('evm_mine');
      }

      let allowed5 = distribution.connect(user1)
          .purchaseAllowed(validproof, user1.address, futureblock); // payload,
      await expect(allowed5, 'not allowed to purchase with expired token #2').to.be.revertedWith('KYC: token expired');

      await distribution.changeKYCApprover(ADDRESS_KYCPROVIDER2);

      const futureblock2 = await ethers.provider.getBlockNumber() + 30;
      const wrongapproverproof = await createProof(MNEMONIC_KYCPROVIDER1, user1, futureblock2);
      const rightapproverproof = await createProof(MNEMONIC_KYCPROVIDER2, user1, futureblock2);

      let allowed6 =
        distribution.connect(user1)
          .purchaseAllowed(wrongapproverproof, user1.address, futureblock2); // payload,
      await expect(allowed6, 'not able to purchase with wrong kyc approver signature').to.be.revertedWith('KYC: invalid token');

      let allowed7 =
        await distribution.connect(user1)
          .purchaseAllowed(rightapproverproof, user1.address, futureblock2); // payload,
      expect(allowed7, 'able to purchase with right kyc approver signature').to.equal(true);
    });
  });
  
  describe("ERC20Distribution - Token distribution", ()=>{
    before(async () => {
      await setupContracts();
  
      it("is able to set approver", async () => {
        expect(await distribution._kyc_approver(), 'default kyc approver is zero address').to.equal(ethers.constants.AddressZero);
        await distribution.changeKYCApprover(ADDRESS_KYCPROVIDER1);
        expect(await distribution._kyc_approver(), 'able to set kyc approver').to.equal(ADDRESS_KYCPROVIDER1);
      });
    })
  
    it("initialization - has correct beneficiary", async () => {
      expect(await distribution._beneficiary()).to.equal(treasury.address);
    })

    it("initialization - has correct start rate", async () => {
      expect(await distribution.startrate_distribution()).to.equal(cDistStartRate);
    })

    it("initialization - has correct end rate", async () => {
      expect(await distribution.endrate_distribution()).to.equal(cDistEndRate);
    })

    it("initialization - has correct total distribution volume", async () => {
      expect(await distribution.total_distribution_balance()).to.equal(cDistVolume);
    })

    it("initialization - has correct start distribution volume", async () => {
      expect(await distribution.current_distributed_balance()).to.equal("0");
    })

    it("initialization - is paused after creation", async () => {
      expect(await distribution.paused()).to.equal(true);
    })
  
    it("start distribution - it can receive tokens for distribution", async () => {
      let totalSupply = await token.totalSupply();
      // console.log("mint %s tokens to distribution", cDistVolume)
      await token.connect(deployer).mint(distribution.address, cDistVolume);
    })

    it("start distribution - it has received the correct amount of tokens", async () => {
      let balance = await token.balanceOf(distribution.address);
      expect(balance).to.equal(cDistVolume);
    })

    it("start distribution - distribution can be started", async () => {
      // Transfer initial token amount to the distribution contract
      await distribution.startDistribution();

      expect(await distribution.paused()).to.equal(false);
    })
  
    it("start distribution - accepts correct KYC approver", async () => {
      await distribution.changeKYCApprover(ADDRESS_KYCPROVIDER1);
      expect(await distribution._kyc_approver()).to.equal(ADDRESS_KYCPROVIDER1);
    });
  });
  
  describe("ERC20Distribution - Slippage", ()=>{
    let validto;
    let user1kycproof;
  
    beforeEach(async ()=> {
      await setupContracts();
  
      await token.connect(deployer).mint(distribution.address, cDistVolume);
      await distribution.startDistribution();
  
      await distribution.changeKYCApprover(ADDRESS_KYCPROVIDER1);
  
      const currentblock = await ethers.provider.getBlockNumber()
      validto = currentblock + 1000;
      user1kycproof = await createProof(MNEMONIC_KYCPROVIDER1, user1, validto);
    })
  
    it('it is possible to buy at the current rate', async ()=> {
      let currentrate = await distribution.currentRate();

      await userBuysTokens("3000", currentrate, user1, user1kycproof, validto);
      let balanceafter = await token.balanceOf(user1.address);
      expect(balanceafter).to.equal(ethers.utils.parseEther("3000"));
    });

    it('it is possible to buy at a lower than current rate (last token)', async ()=> {
      let currentrate = await distribution.currentRate();
      await userBuysTokens("41985995", currentrate, user1, user1kycproof, validto);

      let nextrate = await distribution.currentRate();
      expect(nextrate).to.equal("2");

      await userBuysTokens("1", nextrate.sub(1), user1, user1kycproof, validto);
      nextrate = await distribution.currentRate();
      expect(nextrate).to.equal("1");

      // let balance = await token.balanceOf(user1.address);
      //
      // await userBuysTokens("3000", currentrate.sub("100"), user1, user1kycproof, validto);
      // let balanceafter = await token.balanceOf(user1.address);
      //
      // let actualbalance = ethers.utils.parseEther("3000").div(worserate).mul(currentrate);
      // expect(balanceafter).to.equal(actualbalance);
      //
      // console.log(ethers.utils.formatEther(actualbalance.div(currentrate)))
    });

    it('it is possible to buy at a lower than current rate', async ()=> {
      let currentrate = await distribution.currentRate();
      let worserate = currentrate.sub("100");
    
      await userBuysTokens("3000", currentrate.sub("100"), user1, user1kycproof, validto);
      let balanceafter = await token.balanceOf(user1.address);
    
      let actualbalance = ethers.utils.parseEther("3000").div(worserate).mul(currentrate);
      expect(balanceafter).to.equal(actualbalance);
    
      // console.log(ethers.utils.formatEther(actualbalance.div(currentrate)))
    });
    
    
    it('it is not possible to buy at a higher than current rate', async ()=> {
      let currentrate = await distribution.currentRate();
    
      let errorresult = userBuysTokens("3000", currentrate.add("10"), user1, user1kycproof, validto);
      await expect(errorresult).to.be.revertedWith("unable to sell: current rate is below requested rate");
    });
  });
  
  describe("ERC20Distribution - execute buycycles", ()=>{
    beforeEach(async ()=> {
      await setupContracts();
  
      await token.connect(deployer).mint(distribution.address, cDistVolume);
      await distribution.startDistribution();
  
      await distribution.changeKYCApprover(ADDRESS_KYCPROVIDER1);
    });
    
    const executeBuyCycles = async (buyCycles, label) => {

      // buyCycles = [buyCycles[0]]
      for(let idx=0; idx<buyCycles.length; idx++) {
        const cycle = buyCycles[idx];
        let info = ` ${ethers.utils.formatEther(cycle.tokens_wei)} tokens @${cycle.rate} t/e for ${ethers.utils.formatEther(cycle.cost_wei)} [${ethers.utils.formatEther(cycle.tokenbalance_end_wei)} tokens remaining]`;
        // context(label + "/cycle #"+(idx+1)+" - buy "+info, async () => {
          let balance;
          let currentrate;
          
          const currentblock = await ethers.provider.getBlockNumber()
          const validto = currentblock + 100000;
          const user1kycproof = await createProof(MNEMONIC_KYCPROVIDER1, user1, validto);
          const user2kycproof = await createProof(MNEMONIC_KYCPROVIDER1, user2, validto);

          const expired = currentblock -1
          const user1expiredproof = await createProof(MNEMONIC_KYCPROVIDER1, user1, expired);

          let user = (idx % 2)===0?user1:user2;
          let proof = (idx % 2)===0?user1kycproof:user2kycproof;
        
          it("startbalance and current rate are correct", async () => {
            balance = await token.balanceOf(distribution.address);
            expect(balance).to.equal(cycle.tokenbalance_start_wei);
        
            currentrate = await distribution.currentRate();
            expect(currentrate).to.equal(cycle.rate.toString());
          });
        
          it("is unable to buy above current rate", async () => {
            // buying > currentrate should fail
            let tokens = ethers.utils.formatEther(cycle.tokens_wei);
            let errorresult = userBuysTokens(tokens, "3001", user, proof, validto);
            await expect(errorresult).to.be.revertedWith("unable to sell: current rate is below requested rate");
          });
          
          it("is able to buy at or above current rate", async () => {
            let ratewithslippage = (idx % 2)===0?currentrate:"1";
            await userSpendsEther(ethers.utils.formatEther(cycle.cost_wei).toString(), ratewithslippage, user, proof, validto);
          });
          
          it("end balance is correct", async () => {
            let balance2 = await token.balanceOf(distribution.address);
            expect(balance2).to.equal(cycle.tokenbalance_end_wei);
          });

          it("transaction with invalid KYC proof fails", async ()=> {
            let tokens = ethers.utils.formatEther(cycle.tokens_wei);
            let errorresult = userBuysTokens(tokens, cycle.rate, user3, user1kycproof, validto);
            await expect(errorresult).to.be.revertedWith("KYC: invalid token");
          })
          
          it("transaction with expired KYC proof fails", async ()=> {
            let tokens = ethers.utils.formatEther(cycle.tokens_wei);
            let errorresult = userBuysTokens(tokens, cycle.rate, user1, user1expiredproof, expired);
            await expect(errorresult).to.be.revertedWith("KYC: token expired");
          })
        // });
      };
    }
    
    it("it tests small amounts at the start of distribution (fixed token amount)",async () => {
      const cBatchsize = 10
      let tokencounts = [];
      let total = 0;
      while(total<10000) {
        total += cBatchsize;
        tokencounts.push(cBatchsize);
      }
      const buyCycles = getBuyCyclesByCount(tokencounts);
      await executeBuyCycles(buyCycles, "T1")
    }).timeout(cMaxTestDuration); // it
    
    it("it tests small amounts at the tail of distribution (fixed token amount)",async () => {
      const cBatchsize = 100;
      let tokencounts = [41900000];
      let total = tokencounts[0];
      while(total<42000000) {
        total += cBatchsize;
        tokencounts.push(cBatchsize);
      }
    
      const buyCycles = getBuyCyclesByCount(tokencounts);
      await executeBuyCycles(buyCycles)
    }).timeout(cMaxTestDuration); // it
    
    it("it tests medium amounts across the entire distribution (fixed token amount)",async () => {
      const cBatchsize = 9000;
      let tokencounts = [];
      let total = 0;
      while(total<42000000) {
        total += cBatchsize;
        tokencounts.push(cBatchsize);
      }
    
      const buyCycles = getBuyCyclesByCount(tokencounts);
      await executeBuyCycles(buyCycles)
    }).timeout(cMaxTestDuration); // it

    it("it tests random amounts across the entire distribution (fixed token amount)",async () => {
      const cBatchsize = 500000;
      let tokencounts = [];
      let total = 0;
      const factor = 1000 * 1000
      while(total<42000000) {
        let buyamount = Math.round(cBatchsize * Math.random()*factor)/factor;
        if(buyamount>0) {
          total += cBatchsize;
          tokencounts.push(buyamount);
        }
      }
    
      const buyCycles = getBuyCyclesByCount(tokencounts);
      await executeBuyCycles(buyCycles)
    }).timeout(cMaxTestDuration); // it

    it("is able to execute cycle for given amounts of ether",async () => {
      // let ethervalues = [1000];
      let ethervalues = [];
      let factor = 1000*1000;
      for(i=1;i<15;i++) { ethervalues.push(8 * Math.round(Math.random()*factor)/factor) }
    
      const buyCycles = getBuyCyclesByEther(ethervalues, false);
      await executeBuyCycles(buyCycles)
    }) // it
  }).timeout(cMaxTestDuration);
});