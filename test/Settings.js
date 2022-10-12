const MNEMONIC_KYCPROVIDER1 = "invite grit junior buzz expose horn weird letter mountain worth carpet author";
const ADDRESS_KYCPROVIDER1 = "0x7A0aE71e1De58A0804F17dcFfcF395aDcaE1D946"
const MNEMONIC_KYCPROVIDER2 = "october shell good pair success finish roof arena equip bargain logic escape";
const ADDRESS_KYCPROVIDER2 = "0x8edC5f9b83F4eB246Ab70719B5f583C1E4EEC4e9"

const cMaxTestDuration = 15 * 60*1000;

const gainTokenname = "TEST-USD";
const gainTokensymbol = "TUSD";

// GAIN
// const cDistVolume = "21000000";
// const cDistVolumeWei = ethers.utils.parseEther(cDistVolume);
// const cPrecisionFactor = 1000;
// const cShiftCommaFactor = 10000
// const cDistStartRate = ethers.BigNumber.from(333*cPrecisionFactor);
// const cDistEndRate = ethers.BigNumber.from(10000*cPrecisionFactor);
// const cDistDividerRate = ethers.BigNumber.from(cPrecisionFactor*cShiftCommaFactor);


// test 0.050 - 25.050
// const cDistVolume = "21000000";
// const cDistVolumeWei = ethers.utils.parseEther(cDistVolume);
// const cPrecisionFactor = 1000
// const cShiftCommaFactor = 100
// const cDistStartRate = ethers.BigNumber.from(5*cPrecisionFactor);
// const cDistEndRate = ethers.BigNumber.from(2505*cPrecisionFactor);
// const cDistDividerRate = ethers.BigNumber.from(1*cPrecisionFactor*cShiftCommaFactor);

// UGAIN
const cPrecisionDigits = 3   // number of digits of precision returned
const cShiftCommaDigits = 2  // actual start/end rates are (given rate / 10^cShiftCommaDigits)
const cDistVolume = "42000000";
const cDistVolumeWei = ethers.utils.parseEther(cDistVolume);

const cDistDividerRate = ethers.BigNumber.from((10**cPrecisionDigits)*(10**cShiftCommaDigits));
const cDistStartRate = ethers.BigNumber.from(0.01*(10**cShiftCommaDigits)).mul(10**cPrecisionDigits);
const cDistEndRate = ethers.BigNumber.from(30*(10**cShiftCommaDigits)).mul(10**cPrecisionDigits);

const cUSDCVolume = "42000000000";

module.exports = {
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
  cUSDCVolume,
}
