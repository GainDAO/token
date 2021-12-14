const { expect } = require("chai");

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
    // console.log("%s buys %s tokens for %s eth", user.address, ethers.utils.formatEther(ntokenstobuy), ethers.utils.formatEther(value))
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
  
  context("start distribution", async () => {
    it("can receive tokens for distribution", async () => {
      let totalSupply = await token.totalSupply();
      console.log("mint %s tokens to distribution", ethers.utils.formatEther(cDistVolume))
      await token.connect(deployer).mint(distribution.address, cDistVolume);
    })
    
    it("has received the correct amount of tokens", async () => {
      let balance = await token.balanceOf(distribution.address);
      expect(balance).to.equal(cDistVolume);
      console.log("distribution now has %s tokens", ethers.utils.formatEther(balance))
    })
    
    it("distribution can be started", async () => {
      // Transfer initial token amount to the distribution contract
      await distribution.startDistribution();
    
      expect(await distribution.paused()).to.equal(false);
    })
  });
  
  const calculateRate = volume => Math.floor(3000  - (2999 * volume) / 42000000);
  
  context("start distribution",  async ()=>{
    it("checks ratio calculations", async ()=> {
      let idx = 0;
      let currentrate = 0;
      let newrate = 0;
      let balance = 0;
      let tokens = "0";
      
      balance = await token.balanceOf(distribution.address);
      currentrate = await distribution.currentRate();
      tokens = "1"; // (1 * currentrate).toString();
      await userBuysTokens(tokens, currentrate, user1);
      newrate = await distribution.currentRate();
      console.log("%s - %s -> %s - remaining %s", (idx+1), currentrate.toString(), newrate.toString(), balance);

      balance = await token.balanceOf(distribution.address);
      currentrate = await distribution.currentRate();
      tokens = "14003"; // (1 * currentrate).toString();
      await userBuysTokens(tokens, currentrate, user1);
      newrate = await distribution.currentRate();
      console.log("%s - %s -> %s - remaining %s", (idx+1), currentrate.toString(), newrate.toString(), balance);
      
      balance = await token.balanceOf(distribution.address);
      currentrate = await distribution.currentRate();
      tokens = "1"; // (1 * currentrate).toString();
      await userBuysTokens(tokens, currentrate, user1);
      newrate = await distribution.currentRate();
      console.log("%s - %s -> %s - remaining %s", (idx+1), currentrate.toString(), newrate.toString(), balance);
      
      balance = await token.balanceOf(distribution.address);
      currentrate = await distribution.currentRate();
      tokens = "14004"; // (1 * currentrate).toString();
      await userBuysTokens(tokens, currentrate, user1);
      newrate = await distribution.currentRate();
      console.log("%s - %s -> %s - remaining %s", (idx+1), currentrate.toString(), newrate.toString(), balance);
  
      balance = await token.balanceOf(distribution.address);
      currentrate = await distribution.currentRate();
      tokens = "1"; // (1 * currentrate).toString();
      await userBuysTokens(tokens, currentrate, user1);
      newrate = await distribution.currentRate();
      console.log("%s - %s -> %s - remaining %s", (idx+1), currentrate.toString(), newrate.toString(), balance);

      // while(balance>0) {
      //   let currentrate = await distribution.currentRate();
      //   let tokens = "100"; // (1 * currentrate).toString();
      //   let user = (idx % 2)===0?user1:user2;
      //
      //   await userBuysTokens(tokens, currentrate, user);
      //   let newrate = await distribution.currentRate();
      //   console.log("%s - %s -> %s - remaining %s", (idx+1), currentrate.toString(), newrate.toString(), balance));
      //   balance = await token.balanceOf(distribution.address);
      //   idx++;
      //
      //   if(idx>3) break;
      // };
    }).timeout(60*1000)
  });
});