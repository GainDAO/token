const MNEMONIC_KYCPROVIDER1 =
  "invite grit junior buzz expose horn weird letter mountain worth carpet author";
const ADDRESS_KYCPROVIDER1 = "0x7A0aE71e1De58A0804F17dcFfcF395aDcaE1D946";
const MNEMONIC_KYCPROVIDER2 =
  "october shell good pair success finish roof arena equip bargain logic escape";
const ADDRESS_KYCPROVIDER2 = "0x8edC5f9b83F4eB246Ab70719B5f583C1E4EEC4e9";

const cMaxTestDuration = 15 * 60 * 1000;

// GAIN
// const cDistVolume = "21000000";
// const cDistVolumeWei = ethers.utils.parseEther(cDistVolume);
// const cPrecisionFactor = 1000;
// const cShiftCommaFactor = 10000
// const cDistStartRate = ethers.BigNumber.from(333*cPrecisionFactor);
// const cDistEndRate = ethers.BigNumber.from(10000*cPrecisionFactor);
// const cDistDividerRate = ethers.BigNumber.from(cPrecisionFactor*cShiftCommaFactor);
const cDigitsUGAIN = {
  cPrecisionDigits: 3, // number of digits of precision returned
  cShiftCommaDigits: 2, // actual start/end rates are (given rate / 10^cShiftCommaDigits)
};

const cSettingsUGAIN = {
  paymentTokenName: "SIMUSDC",
  paymentTokenVolume: "42000000000", // overall payment token supply size during testing

  gainTokenname: "TEST-USD",
  gainTokensymbol: "TUSD",
  cDistVolumeWei: ethers.utils.parseEther("42000000"),

  cDistDividerRate: ethers.BigNumber.from(
    10 ** cDigitsUGAIN.cPrecisionDigits * 10 ** cDigitsUGAIN.cShiftCommaDigits
  ),
  cDistStartRate: ethers.BigNumber.from(
    0.01 * 10 ** cDigitsUGAIN.cShiftCommaDigits
  ).mul(10 ** cDigitsUGAIN.cPrecisionDigits),
  cDistEndRate: ethers.BigNumber.from(
    30 * 10 ** cDigitsUGAIN.cShiftCommaDigits
  ).mul(10 ** cDigitsUGAIN.cPrecisionDigits),
};

const cDigitsWGAIN = {
  cPrecisionDigits: 0, // number of digits of precision returned
  cShiftCommaDigits: 12, // actual start/end rates are (given rate / 10^cShiftCommaDigits)
};

const cSettingsWGAIN = {
  paymentTokenName: "SIMWBTC",
  paymentTokenVolume: "42000000000", // overall payment token supply size during testing

  gainTokenname: "TEST-WBTC",
  gainTokensymbol: "TWBTC",
  cDistVolumeWei: ethers.utils.parseEther("42000000"),

  cDistDividerRate: ethers.BigNumber.from(
    10 ** (cDigitsWGAIN.cPrecisionDigits + cDigitsWGAIN.cShiftCommaDigits)
  ),
  cDistStartRate: ethers.BigNumber.from(
    Math.round(
      10 ** (cDigitsWGAIN.cPrecisionDigits + cDigitsWGAIN.cShiftCommaDigits) /
        20 /
        3000,
      0
    )
  ),
  cDistEndRate: ethers.BigNumber.from(
    Math.round(
      10 ** (cDigitsWGAIN.cShiftCommaDigits + cDigitsWGAIN.cPrecisionDigits) /
        20,
      0
    )
  ),
};

// const cDistVolume = ethers.utils.parseEther("42000000");
// const cDistStartRate = ethers.BigNumber.from(3000);
// const cDistEndRate = ethers.BigNumber.from(1);

const cDigitsETH = {
  cPrecisionDigits: 3, // number of digits of precision returned
  cShiftCommaDigits: 6, // actual start/end rates are (given rate / 10^cShiftCommaDigits)
};

const cSettingsETH = {
  paymentTokenName: "SIMGAETH",
  paymentTokenVolume: "42000000000", // overall payment token supply size during testing

  gainTokenname: "TEST-GAETH",
  gainTokensymbol: "TGAITH",
  cDistVolumeWei: ethers.utils.parseEther("42000000"),

  cDistDividerRate: ethers.BigNumber.from(
    10 ** (cDigitsETH.cPrecisionDigits + cDigitsETH.cShiftCommaDigits)
  ),
  cDistStartRate: ethers.BigNumber.from(
    33334 * 10 ** cDigitsETH.cShiftCommaDigits // 1/3000 Eth/Token
  ).mul(10 ** cDigitsETH.cPrecisionDigits),
  cDistEndRate: ethers.BigNumber.from(
    10 ** 6 * 10 ** cDigitsETH.cShiftCommaDigits // 1 Eth/Token
  ).mul(10 ** cDigitsETH.cPrecisionDigits),
};

module.exports = {
  MNEMONIC_KYCPROVIDER1,
  ADDRESS_KYCPROVIDER1,
  MNEMONIC_KYCPROVIDER2,
  ADDRESS_KYCPROVIDER2,
  cMaxTestDuration,
  cSettingsUGAIN,
  cSettingsWGAIN,
  cSettingsETH,
};
