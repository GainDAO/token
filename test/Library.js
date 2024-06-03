const setupPaymentToken = async (
  deployer,
  user1,
  user2,
  user3,
  rejecteduser,
  supply,
  tokenname,
  decimals = 6
) => {
  try {
    // deploy payment token contract
    const PaymentToken = await ethers.getContractFactory("PaymentToken");
    const paymenttoken = await PaymentToken.connect(deployer).deploy(
      ethers.utils.parseEther(supply),
      tokenname,
      tokenname,
      rejecteduser.address,
      decimals
    );
    await paymenttoken.deployed();

    // fund users with payment token
    const balance1DisplayUnits = "42000000001";
    const balance2DisplayUnits = "42000000002";
    const balance3DisplayUnits = "42000000003";

    const currentDecimals = await paymenttoken.decimals();

    await paymenttoken.mint(
      user1.address,
      ethers.utils.parseUnits(balance1DisplayUnits, currentDecimals)
    );
    await paymenttoken.mint(
      user2.address,
      ethers.utils.parseUnits(balance2DisplayUnits, currentDecimals)
    );
    const tx = await paymenttoken.mint(
      user3.address,
      ethers.utils.parseUnits(balance3DisplayUnits, currentDecimals)
    );
    await waitForTxToComplete(tx);

    return paymenttoken;
  } catch (ex) {
    console.log("setupPaymentToken - error", ex);
    return false;
  }
};

const setupGainDAOToken = async (deployer, name, symbol, cap_wei, decimals) => {
  try {
    const GainDAOToken = await ethers.getContractFactory("GainDAOToken");
    token = await GainDAOToken.connect(deployer).deploy(
      name,
      symbol,
      cap_wei,
      decimals
    );

    await token.deployed();

    return token;
  } catch (ex) {
    console.log("setupGainDAOToken - error", ex.message);
    return false;
  }
};

const setupERC20Distribution = async (
  deployer,
  paymenttokenaddress,
  gaintokenaddress,
  beneficiaryaddress,
  startrate,
  endrate,
  ratedivider,
  volumewei
) => {
  try {
    // deploy distribution contract
    const ERC20Distribution = await ethers.getContractFactory(
      "ERC20Distribution"
    );
    distribution = await ERC20Distribution.connect(deployer).deploy(
      paymenttokenaddress,
      gaintokenaddress,
      beneficiaryaddress,
      startrate,
      endrate,
      ratedivider,
      volumewei
    );

    await distribution.deployed();

    return distribution;
  } catch (ex) {
    console.log("setupERC20Distribution - error", ex.message);
    return false;
  }
};

const setupDistributionNative = async (
  deployer,
  gaintokenaddress,
  beneficiaryaddress,
  startrate,
  endrate,
  ratedivider,
  volumewei
) => {
  try {
    // deploy distribution contract
    const ERC20DistributionNative = await ethers.getContractFactory(
      "ERC20DistributionNative"
    );

    distribution = await ERC20DistributionNative.connect(deployer).deploy(
      gaintokenaddress,
      beneficiaryaddress,
      startrate,
      endrate,
      ratedivider,
      volumewei
    );

    await distribution.deployed();

    return distribution;
  } catch (ex) {
    console.log("setupDistributionNative - error", ex.message);
    return false;
  }
};

// const setupDistributionNativeBest = async (
//   deployer,
//   gaintokenaddress,
//   beneficiaryaddress,
//   startrate,
//   endrate,
//   ratedivider,
//   volumewei
// ) => {
//   try {
//     // deploy distribution contract
//     const ERC20DistributionNative = await ethers.getContractFactory(
//       "ERC20DistributionNativeBest"
//     );

//     distribution = await ERC20DistributionNative.connect(deployer).deploy(
//       gaintokenaddress,
//       beneficiaryaddress,
//       startrate,
//       endrate,
//       ratedivider,
//       volumewei
//     );

//     await distribution.deployed();

//     return distribution;
//   } catch (ex) {
//     console.log("setupDistributionNative - error", ex.message);
//     return false;
//   }
// };

const waitForTxToComplete = async (tx) => await tx.wait();

const displayStatus = async (
  gaintoken,
  paymenttoken,
  distribution,
  treasury,
  message = "",
  user = undefined
) => {
  console.log(
    "=== %s ==================================================================",
    message
  );
  console.log(
    "  pool balance %s tokens",
    ethers.utils.formatUnits(
      await gaintoken.balanceOf(distribution.address),
      await gaintoken.decimals()
    )
  );
  console.log(
    "  distribution rate: %s/%s",
    await distribution.currentRateUndivided("0"),
    await distribution.dividerrate_distribution()
  );
  console.log(
    "  distribution balance %s payment tokens",
    ethers.utils.formatUnits(
      await paymenttoken.balanceOf(distribution.address),
      await paymenttoken.decimals()
    )
  );
  console.log(
    "  treasury balance %s payment tokens",
    ethers.utils.formatUnits(
      await paymenttoken.balanceOf(treasury.address),
      await paymenttoken.decimals()
    )
  );
  if (user) {
    console.log("  user %s", user.address);
    console.log(
      "  balance %s gain tokens",
      ethers.utils.formatUnits(
        await gaintoken.balanceOf(user.address),
        await gaintoken.decimals()
      )
    );
    console.log(
      "  balance %s eth",
      ethers.utils.formatEther(await user.getBalance())
    );
    console.log(
      "  balance %s payment tokens",
      ethers.utils.formatUnits(
        await paymenttoken.balanceOf(user.address),
        await paymenttoken.decimals()
      )
    );
  }
};

const calculateRateUndivided = (settings, currentvolumewei) => {
  const rateDelta = settings.cDistEndRate.sub(settings.cDistStartRate);
  const rateUndivided = Math.floor(
    rateDelta
      .mul(currentvolumewei)
      .div(settings.cDistVolumeWei)
      .add(settings.cDistStartRate)
  );

  return rateUndivided;
};

const calculateRateUndividedNew = (
  distVolumeWei,
  distStartRate,
  distEndRate,
  currentvolumewei
) => {
  const rateDelta = distEndRate.sub(distStartRate);
  const rateUndivided = Math.floor(
    rateDelta.mul(currentvolumewei).div(distVolumeWei).add(distStartRate)
  );

  return rateUndivided;
};

const calculateRateUndividedNative = (settings, currentvolumewei) => {
  const rateDelta = settings.cDistStartRate.sub(settings.cDistEndRate);
  const offset_e18 = settings.cDistVolumeWei.sub(currentvolumewei);

  const rateUndivided = rateDelta
    .mul(offset_e18)
    .div(settings.cDistVolumeWei)
    .add(settings.cDistEndRate);

  return rateUndivided;
};

const calculateRateUndividedNativeNew = (
  distVolumeWei,
  distStartRate,
  distEndRate,
  currentVolumeWei
) => {
  const rateDelta = distStartRate.sub(distEndRate);
  const offset_e18 = distVolumeWei.sub(currentVolumeWei);

  const rateUndivided = rateDelta
    .mul(offset_e18)
    .div(distVolumeWei)
    .add(distEndRate);

  return rateUndivided;
};

const userBuysGainTokens = async (
  paymenttoken,
  distribution,
  amountgainwei,
  rateundivided,
  user,
  proof,
  validto,
  verbose = true
) => {
  try {
    const divider = await distribution.dividerrate_distribution();
    if (undefined === rateundivided) {
      rateundivided = await distribution.currentRateUndivided(amountgainwei);
    }
    const valuepaymenttoken = amountgainwei.mul(rateundivided).div(divider);

    verbose && console.log("ngaintobuy (wei) %s", amountgainwei);
    verbose &&
      console.log("buyrate %s/%s paymenttoken/gain", rateundivided, divider);
    verbose && console.log("valuepaymenttoken wei %s", valuepaymenttoken);

    const balanceERC20before = await paymenttoken.balanceOf(user.address);

    const tx1 = await paymenttoken
      .connect(user)
      .approve(distribution.address, valuepaymenttoken);
    await waitForTxToComplete(tx1);

    const tx2 = await distribution
      .connect(user)
      .purchaseTokens(amountgainwei, rateundivided, proof, validto);
    await waitForTxToComplete(tx2);

    const balanceERC20after = await paymenttoken.balanceOf(user.address);

    verbose &&
      console.log(
        "%s buys %s ugain (wei) for %s payment token (wei) at [%s/%s]",
        user.address,
        amountgainwei,
        valuepaymenttoken,
        rateundivided.toString(),
        divider
      );
    verbose &&
      console.log(
        "ERC20balance (wei) %s -> %s [%s]",
        balanceERC20before,
        balanceERC20after,
        balanceERC20after.sub(balanceERC20before)
      );
    return true;
  } catch (ex) {
    console.error("userBuysGainTokens - error %s", ex.message);
    return false;
  }
};

const userBuysGainTokensNative = async (
  distribution,
  amountgainwei,
  rateundivided,
  user,
  proof,
  validto,
  verbose,
  hideerror = false
) => {
  try {
    const divider = await distribution.dividerrate_distribution();
    if (undefined === rateundivided) {
      rateundivided = await distribution.currentRateUndivided(amountgainwei);
    }
    const valuepaymenttoken = amountgainwei.mul(divider).div(rateundivided);

    verbose && console.log("ngaintobuy (wei) %s", amountgainwei);
    verbose && console.log("buyrate %s/%s", rateundivided, divider);
    verbose && console.log("valuepaymenttoken (wei) %s", valuepaymenttoken);

    const balanceETHbefore = await user.getBalance();

    // const distvolbefore = await distribution.current_distributed_balance();
    const tx = await distribution
      .connect(user)
      .purchaseTokens(amountgainwei, rateundivided, proof, validto, {
        value: valuepaymenttoken,
      });
    await waitForTxToComplete(tx);
    // const distvolafter = await distribution.current_distributed_balance();

    const balanceETHafter = await user.getBalance();

    verbose &&
      console.log(
        "%s buys %s ugain (wei) for %s payment token (wei) at [%s/%s]",
        user.address,
        amountgainwei,
        valuepaymenttoken,
        rateundivided.toString(),
        divider
      );
    verbose &&
      console.log(
        "ERC20balance (wei) %s -> %s [%s]",
        balanceETHbefore,
        balanceETHafter,
        balanceETHafter.sub(balanceETHbefore)
      );
    return true;
  } catch (ex) {
    if (!hideerror) {
      console.error("userBuysGainTokensNative - error %s", ex.message);
    }
    return false;
  }
};

const createProof = async (
  mnemonic,
  usertowhitelist,
  validto,
  chainid,
  contractaddress
) => {
  const kycwallet = ethers.Wallet.fromMnemonic(mnemonic);
  const coder = new ethers.utils.AbiCoder();
  const datahex = coder.encode(
    ["address", "uint256", "uint256", "address"],
    [usertowhitelist.address, validto, chainid, contractaddress]
  );
  const hash = ethers.utils.keccak256(datahex);

  return kycwallet.signMessage(ethers.utils.arrayify(hash));
};

const getChainId = async () => {
  const network = await ethers.provider.getNetwork();
  return network.chainId;
};
module.exports = {
  setupPaymentToken,
  setupGainDAOToken,
  setupERC20Distribution,
  setupDistributionNative,
  // setupDistributionNativeBest,
  waitForTxToComplete,
  displayStatus,
  // calculateRateUndividedBest,
  calculateRateUndivided,
  calculateRateUndividedNew,
  calculateRateUndividedNative,
  calculateRateUndividedNativeNew,
  userBuysGainTokens,
  userBuysGainTokensNative,
  createProof,
  getChainId,
};
