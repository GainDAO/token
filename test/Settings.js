const MNEMONIC_KYCPROVIDER1 =
  "invite grit junior buzz expose horn weird letter mountain worth carpet author";
const ADDRESS_KYCPROVIDER1 = "0x7A0aE71e1De58A0804F17dcFfcF395aDcaE1D946";
const MNEMONIC_KYCPROVIDER2 =
  "october shell good pair success finish roof arena equip bargain logic escape";
const ADDRESS_KYCPROVIDER2 = "0x8edC5f9b83F4eB246Ab70719B5f583C1E4EEC4e9";

const cMaxTestDuration = 15 * 60 * 1000;

const cDigitsUGAIN = {
  cPrecisionDigits: 6, // number of digits of precision returned
  cShiftCommaDigits: 3, // actual start/end rates are (given rate / 10^cShiftCommaDigits)
};

const cUGAINFullDistributionVolumeWei = ethers.utils.parseUnits("250000000", 6);

const cSettingsUGAIN = {
  paymentTokenName: "SIMUSDC",
  paymentTokenVolume: "2500000000000", // overall payment token supply size during testing
  paymentTokenDecimals: 6,

  gainTokenname: "TEST-USD",
  gainTokensymbol: "TUSD",
  gainTokenDecimals: 6,
  cDistVolumeWei: cUGAINFullDistributionVolumeWei.mul(55).div(200), // 27.5%

  cDistDividerRate: ethers.BigNumber.from(
    10 ** cDigitsUGAIN.cPrecisionDigits * 10 ** cDigitsUGAIN.cShiftCommaDigits
  ),
  cDistStartRate: ethers.BigNumber.from("1").mul(
    10 ** (cDigitsUGAIN.cPrecisionDigits + cDigitsUGAIN.cShiftCommaDigits)
  ),
  cDistEndRate: ethers.BigNumber.from("20").mul(
    10 ** (cDigitsUGAIN.cPrecisionDigits + cDigitsUGAIN.cShiftCommaDigits)
  ),
};

const cDigitsETH = {
  cPrecisionDigits: 3, // number of digits of precision returned
  cShiftCommaDigits: 0, // actual start/end rates are (given rate / 10^cShiftCommaDigits)
};

const cETHFullDistributionVolumeWei = ethers.utils.parseEther("42000000");

const cSettingsETH = {
  cFullDistributionVolumeWei: cETHFullDistributionVolumeWei,

  liquidityPoolVolumeWei: cETHFullDistributionVolumeWei.mul(55).div(200), // 27.5%
  tokenVaultVolumeWei: cETHFullDistributionVolumeWei.div(2), // 50%

  paymentTokenName: "SIMGAETH",
  paymentTokenVolume: "42000000000", // overall payment token supply size during testing
  paymentTokenDecimals: 18,

  gainTokenname: "TEST-GAETH",
  gainTokensymbol: "TGAITH",
  gainTokenDecimals: 18,
  cDistVolumeWei: cETHFullDistributionVolumeWei.mul(3).div(20), // 15%

  // normal distribution volume
  cDistDividerRate: ethers.BigNumber.from(
    10 ** (cDigitsETH.cPrecisionDigits + cDigitsETH.cShiftCommaDigits)
  ),
  cDistStartRate: ethers.BigNumber.from("1000").mul(
    10 ** (cDigitsETH.cPrecisionDigits + cDigitsETH.cShiftCommaDigits)
  ),
  cDistEndRate: ethers.BigNumber.from("50").mul(
    10 ** (cDigitsETH.cPrecisionDigits + cDigitsETH.cShiftCommaDigits)
  ),

  // team distribution volume
  cTeamDistVolumeWei: cETHFullDistributionVolumeWei.div(20), // 5%
  cTeamDistStartRate: ethers.BigNumber.from("1000").mul(
    10 ** (cDigitsETH.cPrecisionDigits + cDigitsETH.cShiftCommaDigits)
  ),
  cTeamDistEndRate: ethers.BigNumber.from("1000").mul(
    10 ** (cDigitsETH.cPrecisionDigits + cDigitsETH.cShiftCommaDigits)
  ),

  // marketing distribution volume
  cMarketingDistVolumeWei: cETHFullDistributionVolumeWei.div(40), // 2.5%
  cMarketingDistStartRate: ethers.BigNumber.from("1000").mul(
    10 ** (cDigitsETH.cPrecisionDigits + cDigitsETH.cShiftCommaDigits)
  ),
  cMarketingDistEndRate: ethers.BigNumber.from("1000").mul(
    10 ** (cDigitsETH.cPrecisionDigits + cDigitsETH.cShiftCommaDigits)
  ),
};

module.exports = {
  MNEMONIC_KYCPROVIDER1,
  ADDRESS_KYCPROVIDER1,
  MNEMONIC_KYCPROVIDER2,
  ADDRESS_KYCPROVIDER2,
  cMaxTestDuration,
  cSettingsUGAIN,
  cSettingsETH,
};
