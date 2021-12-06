const { expect } = require("chai");

const MNEMONIC_KYCPROVIDER1 = "invite grit junior buzz expose horn weird letter mountain worth carpet author";
const ADDRESS_KYCPROVIDER1 = "0x7A0aE71e1De58A0804F17dcFfcF395aDcaE1D946"
const MNEMONIC_KYCPROVIDER2 = "october shell good pair success finish roof arena equip bargain logic escape";
const ADDRESS_KYCPROVIDER2 = "0x8edC5f9b83F4eB246Ab70719B5f583C1E4EEC4e9"

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

const userBuysTokens = async (amountstr, buyrate, user, proof, validto ) => {
  const ntokenstobuy=ethers.utils.parseEther(amountstr);
  const value = ntokenstobuy.div(buyrate);
  await distribution.connect(user).purchaseTokens(ntokenstobuy.toString(), buyrate, proof, validto, { value });
  console.log("%s buys %s tokens for %s eth", user.address, ethers.utils.formatEther(ntokenstobuy), ethers.utils.formatEther(value))
}

const createProof = async (mnemonic, usertowhitelist, validto) => {
  const kycwallet = ethers.Wallet.fromMnemonic(mnemonic);
  const coder = new ethers.utils.AbiCoder()
  const datahex = coder.encode(["address", "uint256"], [usertowhitelist.address, validto]);
  const hash = ethers.utils.keccak256(datahex);
  
  return kycwallet.signMessage(ethers.utils.arrayify(hash));
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
    
    context("kyc proof calculation", async () => {
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
    });
    
    context("contract owner", async ()=>{
      it("contract owner can buy tokens with no approver set", async () => {
        // check that no approver is set
        expect(await distribution._kyc_approver()).to.equal(ethers.constants.AddressZero);
        await token.connect(deployer).mint(distribution.address, cDistVolume);
        await distribution.startDistribution();
        
        let dummyproof = "0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"

        // can buy with no kyc approver set
        let currentrate = await distribution.currentRate();
        await userBuysTokens("3000", currentrate, deployer, dummyproof, 0);
        expect(await token.balanceOf(deployer.address)).to.equal(ethers.utils.parseEther("3000"));
        
        // set kyc approver
        await distribution.changeKYCApprover(ADDRESS_KYCPROVIDER1);
        expect(await distribution._kyc_approver()).to.equal(ADDRESS_KYCPROVIDER1);
        
        // can buy with kyc approver set
        currentrate = await distribution.currentRate();
        await userBuysTokens("3000", currentrate, deployer, dummyproof, 0);
        expect(await token.balanceOf(deployer.address)).to.equal(ethers.utils.parseEther("6000"));
      });
    })
    
    context("kyc approver", async () => {
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
    });
      
    context("token holder - no kyc approver set", async () => {
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
    });
      
    context("token holder - kyc approver set", async () => {
      it("is able to create and use proof", async () => {
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

    context("initialization", async () => {
      it("has correct beneficiary", async () => {
        expect(await distribution._beneficiary()).to.equal(treasury.address);
      })
    
      it("has correct start rate", async () => {
        expect(await distribution.startrate_distribution()).to.equal(cDistStartRate);
      })
    
      it("has correct end rate", async () => {
        expect(await distribution.endrate_distribution()).to.equal(cDistEndRate);
      })
    
      it("has correct total distribution volume", async () => {
        expect(await distribution.total_distribution_balance()).to.equal(cDistVolume);
      })
    
      it("has correct start distribution volume", async () => {
        expect(await distribution.current_distributed_balance()).to.equal("0");
      })
    
      it("is paused after creation", async () => {
        expect(await distribution.paused()).to.equal(true);
      })
    })
    
    context("start distribution", async () => {
      it("can receive tokens for distribution", async () => {
        let totalSupply = await token.totalSupply();
        // console.log("mint %s tokens to distribution", cDistVolume)
        await token.connect(deployer).mint(distribution.address, cDistVolume);
      })
    
      it("has received the correct amount of tokens", async () => {
        let balance = await token.balanceOf(distribution.address);
        expect(balance).to.equal(cDistVolume);
      })
    
      it("distribution can be started", async () => {
        // Transfer initial token amount to the distribution contract
        await distribution.startDistribution();
    
        expect(await distribution.paused()).to.equal(false);
      })
    });
    
    const calculateRate = volume => Math.floor(3000  - (2999 * volume) / 42000000);
    
    const getBuyCycles = () => {
      let tokencounts = [10000000, 5000000,10000000, 5000000,10000000,2000000];
      // let tokencounts = [10000000];
    
      let buyCycles = [];
      for(let i=0;i<tokencounts.length;i++) {
        let tokens = tokencounts[i].toString();
        let dist_volume = i===0 ? 0: buyCycles[i-1].dist_volume + tokencounts[i-1]
        let tokenbalance_start = i===0?42000000:buyCycles[i-1].tokenbalance_end
        let tokenbalance_end = tokenbalance_start - tokencounts[i]
        let rate = calculateRate(dist_volume);
        let cost = tokencounts[i]/rate;
    
        let cycle = { tokenbalance_start, tokens, rate, cost, tokenbalance_end, dist_volume }
        buyCycles.push(cycle);
      }
    
      return buyCycles;
    }
    
    context("set KYC provider", async () => {
      it("has accepts correct KYC approver", async () => {
        await distribution.changeKYCApprover(ADDRESS_KYCPROVIDER1);
        expect(await distribution._kyc_approver()).to.equal(ADDRESS_KYCPROVIDER1);
      });
    })
    
    const buyCycles = getBuyCycles();

    let user1kycproof = "";
    let user2kycproof = "";
    let user1expiredproof = "";
    let validto = 0;
    let expired = 0;
    context("create kyc proof", async () => {
      it("creates kyc proof", async()=>{
        const currentblock = await ethers.provider.getBlockNumber()
        validto = currentblock + 1000;
        user1kycproof = await createProof(MNEMONIC_KYCPROVIDER1, user1, validto);
        user2kycproof = await createProof(MNEMONIC_KYCPROVIDER1, user2, validto);
        
        expired = currentblock -1
        user1expiredproof = await createProof(MNEMONIC_KYCPROVIDER1, user1, expired);
      });
    });
    
    buyCycles.forEach((cycle, idx)=>{
      let info = `${cycle.tokens} tokens @ ${cycle.rate} tokens/ether`;
      context("run buy cycle #"+(idx+1)+" - buy "+info, async () => {
        it("valid transaction executes correctly", async () => {
          let balance = await token.balanceOf(distribution.address);
          expect(balance).to.equal(ethers.utils.parseEther(cycle.tokenbalance_start.toString()));
    
          let currentrate = await distribution.currentRate();
          expect(currentrate).to.equal(cycle.rate.toString());
    
          let user = (idx % 2)===0?user1:user2;
          let proof = (idx % 2)===0?user1kycproof:user2kycproof;
    
          await userBuysTokens(cycle.tokens, cycle.rate, user, proof, validto);
    
          let balance2 = await token.balanceOf(distribution.address);
          expect(balance2).to.equal(ethers.utils.parseEther(cycle.tokenbalance_end.toString()));
    
          // await displayStatus("buy cycle #"+(idx+1), user);
        });
        
        it("transaction with invalid KYC proof fails", async ()=> {
          let errorresult = userBuysTokens(cycle.tokens, cycle.rate, user3, user1kycproof, validto);
          await expect(errorresult).to.be.revertedWith("KYC: invalid token");
        })

        it("transaction with expired KYC proof fails", async ()=> {
          let errorresult = userBuysTokens(cycle.tokens, cycle.rate, user1, user1expiredproof, expired);
          await expect(errorresult).to.be.revertedWith("KYC: token expired");
        })
      })
    });
    
    context("final results", async () => {
      it('is ready', async ()=> {
        console.log("=====================================================================")
    
        console.log("user 1 has etherbalance %s", ethers.utils.formatEther(await user1.getBalance()))
        console.log("user 1 has tokenbalance %s", ethers.utils.formatEther(await token.balanceOf(user1.address)))
    
        console.log("user 2 has etherbalance %s", ethers.utils.formatEther(await user2.getBalance()))
        console.log("user 2 has tokenbalance %s", ethers.utils.formatEther(await token.balanceOf(user2.address)))
    
        console.log("treasury has tokenbalance %s", ethers.utils.formatEther(await treasury.getBalance()))
    
        console.log("new exchange rate is now %s", await distribution.currentRate())
      })
    });
  });
});