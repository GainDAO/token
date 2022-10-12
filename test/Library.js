const {
  cDistVolumeWei,
  cDistStartRate,
  cDistEndRate
} = require('./Settings.js');

const setupSimUSDToken = async (deployer, user1, user2, user3, rejecteduser, supply) => {
  try {
    // deploy SimUSD contract
    const PaymentToken = await ethers.getContractFactory("PaymentToken");
    const simusdtoken = await PaymentToken.connect(deployer).deploy(ethers.utils.parseEther(supply), rejecteduser.address);
    await simusdtoken.deployed();
    
    // fund users with SimUSD
    await simusdtoken.mint(user1.address, ethers.utils.parseEther("42000000001"));
    await simusdtoken.mint(user2.address, ethers.utils.parseEther("42000000002"));
    const tx = await simusdtoken.mint(user3.address, ethers.utils.parseEther("42000000003"));
    await waitForTxToComplete(tx);
    
    return simusdtoken;
  } catch(ex) {
    console.log("setupSimUSDToken - error", ex.message);
    return false;
  }
}

const setupGainDAOToken = async (deployer, name, symbol, cap_wei) => {
  try {
    const GainDAOToken = await ethers.getContractFactory("GainDAOToken");
    token = await GainDAOToken.connect(deployer).deploy(name, symbol, cap_wei);
    
    await token.deployed();
    const tx = await token.unpause();
    await waitForTxToComplete(tx);
    
    return token;
  } catch(ex) {
    console.log("setupGainDAOToken - error", ex.message);
    return false;
  }
}

const setupERC20Distribution = async (
  deployer, 
  usdtokenaddress, 
  gaintokenaddress,
  beneficiaryaddress, 
  startrate,
  endrate,
  ratedivider,
  volumewei
) => {
  try {
    // deploy distribution contract
    const ERC20Distribution = await ethers.getContractFactory("ERC20Distribution");
    distribution = await ERC20Distribution.connect(deployer).deploy(
      usdtokenaddress,
      gaintokenaddress,
      beneficiaryaddress,
      startrate,
      endrate,
      ratedivider,
      volumewei);
    
    await distribution.deployed();
    
    return distribution
  } catch(ex) {
    console.log("setupERC20Distribution - error", ex.message);
    return false
  }
}

const waitForTxToComplete = async (tx) => (await tx.wait())

const displayStatus = async (token, simusdtoken, distribution, treasury, message = '', user=undefined) => {
  console.log("=== %s ==================================================================", message)
  console.log("  pool balance %s tokens", ethers.utils.formatEther(await token.balanceOf(distribution.address)))
  console.log("  distribution rate: %s/%s", await distribution.currentRateUndivided("0"), await distribution.dividerrate_distribution())
  console.log("  distribution balance %s usdc", ethers.utils.formatEther(await simusdtoken.balanceOf(distribution.address)))
  console.log("  treasury balance %s usdc", ethers.utils.formatEther(await simusdtoken.balanceOf(treasury.address)))
  if(user) {
    console.log("  user %s", user.address)
    console.log("  balance %s tokens", ethers.utils.formatEther(await token.balanceOf(user.address)));
    console.log("  balance %s eth", ethers.utils.formatEther(await user.getBalance()))
    console.log("  balance %s usdc", ethers.utils.formatEther(await simusdtoken.balanceOf(user.address)))
  }
}

const calculateRateUndivided = (currentvolume, buyamount) => {
  // =ROUND(($B$20/$B$21*($B$9+$B$10/2)+$B$24), $B$7)
  const currentvolumewei = ethers.utils.parseEther(currentvolume);
  const buyamountwei = ethers.utils.parseEther(buyamount)
  
  const rateDelta = cDistEndRate.sub(cDistStartRate);
  const offset = currentvolumewei.add(buyamountwei.div(2));
  
  const rateUndivided = Math.floor((rateDelta.mul(offset).div(cDistVolumeWei)).add(cDistStartRate));
  return rateUndivided;
}

const userBuysGainTokens = async (
  simusdtoken,
  distribution,
  amountgainwei, 
  rateundivided,
  user, 
  proof, 
  validto, 
  verbose = false ) => {
  try {
    const divider = await distribution.dividerrate_distribution();
    if(undefined===rateundivided) {
      rateundivided = await distribution.currentRateUndivided(amountgainwei);  
    }
    const valuesimusd = amountgainwei.mul(rateundivided).div(divider);
    
    // verbose && console.log("ngaintobuy %s", ethers.utils.formatEther(amountgainwei))
    // verbose && console.log("buyrate %s/%s", rateundivided ,divider)
    // verbose && console.log("valuesimusd %s", ethers.utils.formatEther(valuesimusd))
    
    const balanceERC20before = await simusdtoken.balanceOf(user.address);

    const tx1 = await simusdtoken.connect(user).approve(distribution.address, valuesimusd);
    await waitForTxToComplete(tx1)
    
    const tx2 = await distribution.connect(user).purchaseTokens(amountgainwei, rateundivided, proof, validto);
    await waitForTxToComplete(tx2)
    
    const balanceERC20after = await simusdtoken.balanceOf(user.address);
    
    verbose && console.log("%s buys %s ugain for %s simusd at [%s/%s]", 
      user.address, ethers.utils.formatEther(amountgainwei), ethers.utils.formatEther(valuesimusd),
      rateundivided.toString(), divider);
    verbose && console.log("ERC20balance %s -> %s [%s]", 
      ethers.utils.formatEther(balanceERC20before), 
      ethers.utils.formatEther(balanceERC20after),
      ethers.utils.formatEther(balanceERC20after.sub(balanceERC20before)));
    return true;
  } catch(ex) {
    verbose && console.error("userBuysGainTokens - error %s", ex.message);
    return false;
  }
}

const createProof = async (mnemonic, usertowhitelist, validto) => {
  const kycwallet = ethers.Wallet.fromMnemonic(mnemonic);
  const coder = new ethers.utils.AbiCoder()
  const datahex = coder.encode(["address", "uint256"], [usertowhitelist.address, validto]);
  const hash = ethers.utils.keccak256(datahex);
  
  return kycwallet.signMessage(ethers.utils.arrayify(hash));
}

module.exports = {
  setupSimUSDToken,
  setupGainDAOToken,
  setupERC20Distribution,
  waitForTxToComplete,
  displayStatus,
  calculateRateUndivided,
  userBuysGainTokens,
  createProof
}
