
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
const cDistVolume = ethers.utils.parseEther("42000000");
const cDistStartRate = ethers.BigNumber.from(3000);
const cDistEndRate = ethers.BigNumber.from(1);

describe("Launch", () => {
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

    await token.grantRole(token.DEFAULT_ADMIN_ROLE(), treasury.address);
    await token.grantRole(token.PAUSER_ROLE(), treasury.address);
    await token.grantRole(token.MINTER_ROLE(), treasury.address);
    await token.grantRole(token.BURNER_ROLE(), treasury.address);
    
    await distribution.grantRole(distribution.DEFAULT_ADMIN_ROLE(), treasury.address);
    await distribution.grantRole(distribution.KYCMANAGER_ROLE(), treasury.address);
    
    
    await token.connect(treasury).revokeRole(token.PAUSER_ROLE(), deployer.address);
    await token.connect(treasury).revokeRole(token.MINTER_ROLE(), deployer.address);
    await token.connect(treasury).revokeRole(token.BURNER_ROLE(), deployer.address);
    await token.connect(treasury).revokeRole(token.DEFAULT_ADMIN_ROLE(), deployer.address);
    
    await distribution.connect(treasury).revokeRole(distribution.KYCMANAGER_ROLE(), deployer.address);
    await distribution.connect(treasury).revokeRole(distribution.DEFAULT_ADMIN_ROLE(), deployer.address);
    
    await token.connect(treasury).unpause();
    await token.connect(treasury).mint(distribution.address, cDistVolume);

    await distribution.connect(treasury).startDistribution();

    let dummyproof = "0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
    let currentrate = await distribution.currentRate();
    await userSpendsEther("130", currentrate, treasury, dummyproof, 0);
  }
  
  it("launches the GainDAO", async ()=>{
    await setupContracts();
  });
});