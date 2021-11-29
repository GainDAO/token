const { expect } = require("chai");

// let expectError = async (promise, expectedError) => {
//   try {
//     await promise;
//   } catch (error) {
//     if (error.message.indexOf(expectedError) === -1) {
//       // When the exception was a revert, the resulting string will include only
//       // the revert reason, otherwise it will be the type of exception (e.g. 'invalid opcode')
//       const actualError = error.message.replace(
//         /Returned error: VM Exception while processing transaction: (revert )?/,
//         '',
//       );
//       expect(actualError).to.equal(expectedError, "Wrong kind of exception received");
//     }
//     return;
//   }
//
//   expect.fail("Expected an error that did not occur");
// }

describe("ERC20Distribution", () => {
  let token;
  let deployer;
  let treasury;
  let user1;
  let user2;
  let user3;
  let user4;

  const cDistVolume = ethers.utils.parseEther("42000000");
  const cDistStartRate = ethers.BigNumber.from(3000);
  const cDistEndRate = ethers.BigNumber.from(1);
  
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
  
  const userBuysTokens = async (amountstr, buyrate, user ) => {
    const ntokenstobuy=ethers.utils.parseEther(amountstr);
    const value = ntokenstobuy.div(buyrate);
    console.log("%s buys %s tokens for %s eth", user.address, ethers.utils.formatEther(ntokenstobuy), ethers.utils.formatEther(value))
    await distribution.connect(user).purchaseTokens(ntokenstobuy.toString(), buyrate, { value });
  }

  before(async () => {
    [deployer, treasury, user1, user2, user3, user4] = await ethers.getSigners();
    console.log("deployer address",  deployer.address);
    console.log("deployer balance",  ethers.utils.formatEther(await ethers.provider.getBalance(deployer.address)));
    
    
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
  })

  beforeEach(async () => {
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
      console.log("mint %s tokens to distribution", cDistVolume)
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
  
  const buyCycles = getBuyCycles();

  buyCycles.forEach((cycle, idx)=>{
    context("run buy cycle #"+(idx+1), async () => {
      it("has correct buy cycle values", async () => {
        let balance = await token.balanceOf(distribution.address);
        expect(balance).to.equal(ethers.utils.parseEther(cycle.tokenbalance_start.toString()));

        let currentrate = await distribution.currentRate();
        expect(currentrate).to.equal(cycle.rate.toString());

        let user = (idx % 2)===0?user1:user2;

        await userBuysTokens(cycle.tokens, cycle.rate, user);

        let balance2 = await token.balanceOf(distribution.address);
        expect(balance2).to.equal(ethers.utils.parseEther(cycle.tokenbalance_end.toString()));

        // await displayStatus("buy cycle #"+(idx+1), user);
      });
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