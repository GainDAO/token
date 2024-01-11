// const hre = require("hardhat");

// const {
//   MNEMONIC_KYCPROVIDER1,
//   ADDRESS_KYCPROVIDER1,
//   MNEMONIC_KYCPROVIDER2,
//   ADDRESS_KYCPROVIDER2,
//   cMaxTestDuration,
//   cSettingsETH,
//   cSettingsUGAIN,
//   cSettingsETHFlat,
//   cSettingsUGAINFlat
// } = require("../test/Settings.js");

// const {
//   setupPaymentToken,
//   setupGainDAOToken,
//   setupERC20Distribution,
//   setupDistributionNative,
//   // setupDistributionNativeBest,
//   calculateRateUndividedNew,  
//   calculateRateUndividedNativeNew,
//   createProof,
//   getChainId,
//   waitForTxToComplete,
// } = require("../test/Library.js");
// const {
//   // calculateRateEther,
//   formatBuyCycles,
// } = require("../test/BuyCycles.js");


// const fs = require("fs-extra");
// const { stringify } = require("csv-stringify");
// const { createLineChart } = require("./Chart");

// const verbose = false;

// let paymenttoken;
// let gaintoken;
// let distribution;
// let deployer;
// let treasury;
// let pool;
// let liquiditypool;
// let tokenvault;
// let user1; 
// let user2; 
// let user3; 
// let rejecteduser;

// let user1kycproof;

// const getBuyCycles = (
//   distVolumeWei, 
//   distDividerRate, 
//   distStartRate, 
//   distEndRate, 
//   batchsize_wei, 
//   purchaseamount_wei, 
//   isnative) => {
//   try {
//     let cycleidx = 1;
//     let buycycles = [];
//     let dist_offset_wei = ethers.utils.parseEther("0");

//     let quit = false;
//     while (quit===false) {
//       if(dist_offset_wei.add(purchaseamount_wei).gt(distVolumeWei)) {
//         verbose && console.log("empty distribution in last purchase")
//         quit = true;
//         dist_offset_wei = distVolumeWei.sub(purchaseamount_wei);
//       }

//       // verbose && console.log("dist offset", ethers.utils.formatEther(dist_offset_wei.toString()), ethers.utils.formatEther(distVolumeWei));
//       verbose && console.log("purchase amount", ethers.utils.formatEther(purchaseamount_wei.toString()));
//       if(purchaseamount_wei.gt(0)) {
//         let rateundivided = undefined;
//         let cost_wei = undefined;
//         let tokens_wei = undefined;
//         if(isnative) {
//           rateundivided = calculateRateUndividedNativeNew(
//             distVolumeWei, 
//             distStartRate, 
//             distEndRate, 
//             dist_offset_wei);
//           cost_wei = purchaseamount_wei.mul(distDividerRate).div(rateundivided); //  .add("1");
//           tokens_wei = cost_wei.div(distDividerRate).mul(rateundivided);
//           // console.log(">>>> c %s / pr %s", ethers.utils.formatEther(cost_wei), rateundivided.div(distDividerRate).toString())
//         } else {
//           rateundivided = calculateRateUndividedNew(
//             distVolumeWei, 
//             distStartRate, 
//             distEndRate, 
//             dist_offset_wei.toString());
//           cost_wei = purchaseamount_wei.mul(rateundivided).div(distDividerRate); //  .add("1");
//           tokens_wei = cost_wei.mul(distDividerRate).div(rateundivided);
//         }

//         if (tokens_wei.eq(purchaseamount_wei) === false) {
//             verbose && console.log("mismatch between actual token count and desired token count", tokens_wei.sub(purchaseamount_wei).toString())
//         }

//         // dist_offset_wei        // distributed volume at start of this cycle
//         // rateundivided          // rate at which tokens were purchased
//         // tokens_wei             // tokens purchased in this cycle
//         // cost_wei               // cost of tokens in this cycle
//         let cycle = { 
//           dist_offset_wei,
//           dividerrate:distDividerRate,
//           rateundivided, 
//           tokens_wei:purchaseamount_wei, 
//           cost_wei:cost_wei, 
//           actual_tokens_wei: "0",
//           actual_dividerrate: "0",
//           actual_rateundivided: "0",
//           actual_cost_wei: "0",
//         }

//         buycycles.push(cycle);

//         let cyclestr = {
//             cycleidx,
//             dist_volume: ethers.utils.formatEther(dist_offset_wei.toString()),
//             dividerrate: distDividerRate.toString(),
//             rateundivided,
//             tokens: ethers.utils.formatEther(tokens_wei.toString()),
//             cost: ethers.utils.formatEther(cost_wei.toString()),
//         }

//         verbose && console.log(JSON.stringify(cyclestr, 0, 2))
//       } else {
//         verbose && console.log("no tokens to purchase")
//       }

//       dist_offset_wei = dist_offset_wei.add(batchsize_wei);
//       cycleidx++;
//     }


//     // console.log("got buy cycles", buycycles); // JSON.stringify(formatBuyCycles(buycycles),null,2))

//     return buycycles
//   } catch (ex) {
//       console.error(`getBuyCycles - error ${ex.message}`, ex);
//       return false;
//   }
// }

// // const getBuyCycles = (settings, batchsize_wei, purchaseamount, isnative) => {
// //   try {
// //     let cycleidx = 1;
// //     let buycycles = [];
// //     let dist_offset_wei = ethers.utils.parseEther("0");

// //     let purchaseamount_wei = ethers.utils.parseEther(purchaseamount.toString());
// //     let quit = false;
// //     while (quit===false) {
// //       if(dist_offset_wei.add(purchaseamount_wei).gt(settings.cDistVolumeWei)) {
// //         verbose && console.log("empty distribution in latst purchase")
// //         quit = true;
// //         dist_offset_wei = settings.cDistVolumeWei.sub(purchaseamount_wei);
// //       }

// //       // verbose && console.log("dist offset", ethers.utils.formatEther(dist_offset_wei.toString()), ethers.utils.formatEther(settings.cDistVolumeWei));
// //       verbose && console.log("purchase amount", ethers.utils.formatEther(purchaseamount_wei.toString()));
// //       if(purchaseamount_wei.gt(0)) {
// //         let rateundivided = undefined;
// //         let cost_wei = undefined;
// //         let tokens_wei = undefined;
// //         if(isnative) {
// //           rateundivided = ethers.BigNumber.from(calculateRateUndividedNative(settings, dist_offset_wei.toString()));
// //           cost_wei = purchaseamount_wei.div(rateundivided).mul(settings.cDistDividerRate); //  .add("1");
// //           tokens_wei = cost_wei.div(settings.cDistDividerRate).mul(rateundivided);
// //         } else {
// //           rateundivided = ethers.BigNumber.from(calculateRateUndivided(settings, dist_offset_wei.toString()));
// //           cost_wei = purchaseamount_wei.mul(rateundivided).div(settings.cDistDividerRate); //  .add("1");
// //           tokens_wei = cost_wei.mul(settings.cDistDividerRate).div(rateundivided);
// //         }


// //         if (tokens_wei.eq(purchaseamount_wei) === false) {
// //             verbose && console.log("mismatch between actual token count and desired token count", tokens_wei.sub(purchaseamount_wei).toString())
// //         }

// //         // dist_offset_wei        // distributed volume at start of this cycle
// //         // rateundivided          // rate at which tokens were purchased
// //         // tokens_wei             // tokens purchased in this cycle
// //         // cost_wei               // cost of tokens in this cycle
// //         let cycle = { 
// //           dist_offset_wei,
// //           dividerrate:settings.cDistDividerRate,
// //           rateundivided, 
// //           tokens_wei:purchaseamount_wei, 
// //           cost_wei:cost_wei, 
// //           actual_tokens_wei: "0",
// //           actual_dividerrate: "0",
// //           actual_rateundivided: "0",
// //           actual_cost_wei: "0",
// //         }

// //         buycycles.push(cycle);

// //         let cyclestr = {
// //             cycleidx,
// //             dist_volume: ethers.utils.formatEther(dist_offset_wei.toString()),
// //             dividerrate: settings.cDistDividerRate.toString(),
// //             rateundivided,
// //             tokens: ethers.utils.formatEther(tokens_wei.toString()),
// //             cost: ethers.utils.formatEther(cost_wei.toString()),
// //         }

// //         verbose && console.log(JSON.stringify(cyclestr, 0, 2))
// //       } else {
// //         verbose && console.log("no tokens to purchase")
// //       }

// //       dist_offset_wei = dist_offset_wei.add(batchsize_wei);
// //       cycleidx++;
// //     }

// //     return buycycles
// //   } catch (ex) {
// //       console.error(`getBuyCycles - error ${ex.message}`, ex);
// //       return false;
// //   }
// // }

// const setupContractsNonNative = async (settings, startdistribution = false) => {
//   [
//     dummy,
//     deployer,
//     treasury,
//     pool,
//     liquiditypool,
//     tokenvault,
//     holder1,
//     holder2,
//     holder3,
//     holder4,
//     holder5,
//     holder6,
//     whale1,
//     whale2,
//   ] = await ethers.getSigners();

//   user1 = whale1;
//   user2 = whale2;
//   user3 = holder3;
//   rejecteduser = holder4;


//   try {
//     paymenttoken = await setupPaymentToken(
//       deployer,
//       user1,
//       user2,
//       user3,
//       rejecteduser,
//       settings.paymentTokenVolume,
//       settings.paymentTokenName
//     );
//     gaintoken = await setupGainDAOToken(
//       deployer,
//       settings.gainTokenname,
//       settings.gainTokensymbol,
//       settings.cDistVolumeWei
//     );
//     distribution = await setupERC20Distribution(
//       deployer,
//       paymenttoken.address,
//       gaintoken.address,
//       pool.address, // beneficiary account
//       settings.cDistStartRate,
//       settings.cDistEndRate,
//       settings.cDistDividerRate,
//       settings.cDistVolumeWei
//     );

//     if (startdistribution) {
//       await gaintoken
//         .connect(deployer)
//         .mint(distribution.address, settings.cDistVolumeWei);
//       await distribution.startDistribution();

//       await distribution.changeKYCApprover(ADDRESS_KYCPROVIDER1);
//     }
//   } catch (ex) {
//     console.error("setupContractsNonNative - error ", ex.message);
//   }

//   // await distribution.changeKYCApprover(ADDRESS_KYCPROVIDER1);
// };

// const setupContractsNative = async (
//   gainTokenname, 
//   gainTokensymbol,
//   tokenVolumeWei, 
//   distVolumeWei,
//   distStartRate, 
//   distEndRate, 
//   distDividerRate,
//   startdistribution = false) => {
//   [
//     dummy,
//     dummy,
//     dummy,
//     deployer,
//     treasury,
//     pool,
//     user1,
//     user2,
//     user3,
//     rejecteduser,
//   ] = await ethers.getSigners();

//   try {
//     gaintoken = await setupGainDAOToken(
//       deployer,
//       gainTokenname,
//       gainTokensymbol,
//       tokenVolumeWei, // settings.cDistVolumeWei
//     );

//     distribution = await setupDistributionNative(
//       deployer,
//       gaintoken.address,
//       pool.address, // beneficiary account
//       distStartRate, // settings.cDistStartRate,
//       distEndRate, // settings.cDistEndRate,
//       distDividerRate,
//       distVolumeWei
//     ); 

//     if (startdistribution) {
//       await gaintoken
//         .connect(deployer)
//         .mint(distribution.address, tokenVolumeWei);
//       await distribution.startDistribution();

//       await distribution.changeKYCApprover(ADDRESS_KYCPROVIDER1);
//     }
//   } catch (ex) {
//     console.error("setupContractsNative - error ", ex.message);
//   }

//   // await distribution.changeKYCApprover(ADDRESS_KYCPROVIDER1);
// };

// const writeBuyCyclesCSV = (filename, buycycles) => { 
//   const writableStream = fs.createWriteStream(filename);
//   const columns = [
//     'dist_offset',
//     'dividerrate',
//     'rateundivided',
//     'tokens',
//     'cost',
//     'actual_dividerrate',
//     'actual_rateundivided',
//     'actual_tokens',
//     'actual_cost'
//   ];

//   const stringifier = stringify({ header: true, columns: columns });
//   buycycles.forEach(
//       cycle => {
//         stringifier.write([
//           ethers.utils.formatEther(cycle.dist_offset_wei),
//           cycle.dividerrate.toString(),
//           cycle.rateundivided.toString(),
//           ethers.utils.formatEther(cycle.tokens_wei),
//           ethers.utils.formatEther(cycle.cost_wei),
//           cycle.actual_dividerrate,
//           cycle.actual_rateundivided,
//           ethers.utils.formatEther(cycle.actual_tokens_wei),
//           ethers.utils.formatEther(cycle.actual_cost_wei)
//       ])
//     }
//   )

//   stringifier.pipe(writableStream);
// }

// const writeAggregatesCSV = (filename, labelcolumn, columns, aggregates) => { 
//   const writableStream = fs.createWriteStream(filename);

//   const stringifier = stringify({ header: true, columns: [labelcolumn, ...columns ], delimitor: '\t'});
//   aggregates.forEach(
//       row => {
//         let values = []
//         values.push(row[labelcolumn])
//         for(column of columns) {
//           values.push(row[column]);
//         }
//         stringifier.write(values)
//     }
//   )

//   stringifier.pipe(writableStream);
// }


// async function do_run(distVolumeWei, buycycles, description, isnative = true) {

//   const currentblock = await ethers.provider.getBlockNumber();
//   let validto = currentblock + 1000;  
//   let user1_kycproof = await createProof(MNEMONIC_KYCPROVIDER1, user1, validto, await getChainId(), distribution.address);
//   // let dummyproof =
//   // "0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
//   const dividerrate_distribution = await distribution.dividerrate_distribution();
 
//   // console.log("+++++++++++++++++++++++++++++++")
//   // console.log(JSON.stringify(buycycles, 0, 2))

//   for(let index=0;index<buycycles.length;index++) {
//     const bc = buycycles[index];
//     let current_distributed_balance_wei = await distribution.current_distributed_balance();
//     console.log("buycycle %s / cdb %s/ ", index, current_distributed_balance_wei, bc);

//           // dist_offset_wei        // distributed volume at start of this cycle
//           // rateundivided          // rate at which tokens were purchased
//           // tokens_wei             // tokens purchased in this cycle
//           // cost_wei               // cost of tokens in this cycle


//     let current_offset_wei = bc.dist_offset_wei;
//     const fixoffset_amount_wei = current_offset_wei.sub(current_distributed_balance_wei);

//     // console.log("fix-offset amount %s / cdb %s / co", 
//     //   ethers.utils.formatEther(fixoffset_amount_wei.toString()),    
//     //   ethers.utils.formatEther(current_offset_wei.toString()),
//     //   ethers.utils.formatEther(current_distributed_balance_wei), 
//     // );

//     if(current_distributed_balance_wei.lt(distVolumeWei)) {
//       if(fixoffset_amount_wei>0) {
//         const purchaserateundivided = await distribution.currentRateUndivided(fixoffset_amount_wei);

//         if(isnative) {
//           const fiat_value_wei = 
//             fixoffset_amount_wei
//             .mul(dividerrate_distribution)
//             .div(purchaserateundivided);
            
//           const tx1 = await distribution.connect(user1).purchaseTokens(
//             fixoffset_amount_wei,
//             purchaserateundivided,
//             user1_kycproof,
//             validto, 
//             { value: fiat_value_wei });
//           await waitForTxToComplete(tx1);
//             console.log("## update distributed balance to %s by purchasing %s tokens for %s eth", 
//             bc.dist_offset_wei, 
//             ethers.utils.formatEther(fixoffset_amount_wei),
//             ethers.utils.formatEther(fiat_value_wei))
//         } else {
//           const fiat_value_wei = 
//             purchaserateundivided
//             .mul(fixoffset_amount_wei)
//             .div(dividerrate_distribution);
//           const tx1 = await paymenttoken
//             .connect(user1)
//             .approve(distribution.address, fiat_value_wei);
//           await waitForTxToComplete(tx1);
      
//           const tx2 = await distribution
//             .connect(user1)
//             .purchaseTokens(
//               fixoffset_amount_wei, 
//               purchaserateundivided,
//               user1_kycproof,
//               validto);
//           await waitForTxToComplete(tx2);
//         }
//       }

//       current_distributed_balance_wei = await distribution.current_distributed_balance();
//       // console.log("new distributed balance", ethers.utils.formatEther(await distribution.current_distributed_balance()))

//       if(current_distributed_balance_wei.eq(current_offset_wei)===false) {
//         console.warn("initial volume bad!!!!");
//       }

//       const purchaseamount_wei = bc.tokens_wei
//       const purchaserateundivided = await distribution.currentRateUndivided(purchaseamount_wei);
//       let fiat_value_wei = undefined; 
//       if(isnative) {
//         fiat_value_wei = 
//         purchaseamount_wei
//           .mul(dividerrate_distribution)
//           .div(purchaserateundivided);
//         console.log("## purchasing %s tokens for %s eth", 
//           ethers.utils.formatEther(purchaseamount_wei),
//           ethers.utils.formatEther(fiat_value_wei))
//         await distribution.connect(user1).purchaseTokens(
//           purchaseamount_wei,
//           purchaserateundivided,
//           user1_kycproof,
//           validto, 
//           { value: fiat_value_wei }
//         );
//       } else {
//         fiat_value_wei = 
//           purchaserateundivided
//           .mul(purchaseamount_wei)
//           .div(dividerrate_distribution);
//         const tx1 = await paymenttoken
//           .connect(user1)
//           .approve(distribution.address, fiat_value_wei);
//         await waitForTxToComplete(tx1);
    
//         const tx2 = await distribution
//           .connect(user1)
//           .purchaseTokens(
//             purchaseamount_wei, 
//             purchaserateundivided,
//             user1_kycproof,
//             validto);
//         await waitForTxToComplete(tx2);
//       }

//       bc.actual_dividerrate = dividerrate_distribution.toString();
//       bc.actual_rateundivided = purchaserateundivided.toString();
//       bc.actual_tokens_wei = purchaseamount_wei;
//       bc.actual_cost_wei = fiat_value_wei.toString();

//       if(Number(bc.actual_dividerrate) !== Number(bc.dividerrate)) {
//           console.warn("mismatch - dividerrate", Number(bc.actual_dividerrate),Number(bc.dividerrate))
//       }
//       if(Number(bc.actual_rateundivided) != Number(bc.rateundivided)) {
//           console.warn("mismatch - rateundivided", Number(bc.actual_rateundivided), Number(bc.rateundivided))
//       }
//       if(Number(bc.actual_tokens_wei) !== Number(bc.tokens_wei)) {
//           console.warn("mismatch - tokens", Number(bc.actual_tokens_wei), Number(bc.tokens_wei))
//       }
//       if(Number(bc.actual_cost_wei) !== Number(bc.cost_wei)) {
//           console.warn("mismatch - cost",Number(bc.actual_cost_wei),Number(bc.cost_wei))
//       }

//       // console.log("@%s - %s gain tokens cost %s eth", 
//       //   ethers.utils.formatEther(bc.dist_offset_wei),
//       //   ethers.utils.formatEther(bc.actual_tokens_wei),
//       //   ethers.utils.formatEther(bc.actual_cost_wei));
//     } else {
//       bc.actual_dividerrate =
//       bc.actual_rateundivided = 0
//       bc.actual_tokens_wei = 0
//       bc.actual_cost_wei = 0
//     }

//     console.log("#### end of buycycle %s", index);
//   };

//   writeBuyCyclesCSV(
//     `./curve-data/buycycles/gaineth-${description}.csv`, 
//     buycycles);

//   return buycycles;
// }

// async function create_data(
//   fiat, 
//   token, 
//   title, 
//   purchaseAmounts, 
//   gainTokenname, 
//   gainTokensymbol,
//   tokenVolumeWei, 
//   distVolumeWei,
//   distStartRate, 
//   distEndRate, 
//   distDividerRate, 
//   isnative, 
//   fastmode) {
//   try {
//     const fiatpertoken = `${fiat}_per_${token}`
//     const tokenperfiat = `${token}_per_${fiat}`

//     let aggregate = [];
//     for(pa of purchaseAmounts) {
//       if(isnative) {

//         await setupContractsNative(
//           gainTokenname, 
//           gainTokensymbol,
//           tokenVolumeWei, 
//           distVolumeWei,
//           distStartRate, 
//           distEndRate, 
//           distDividerRate,
//           true);
//       } else {
//         // await setupContractsNonNative(theSettings, true);
//       }

//       let batchsize_wei = fastmode ? distVolumeWei.div(10) : distVolumeWei.div(40);
//       // const buycycles = getBuyCycles(theSettings, batchsize_wei, pa, isnative);
//       const buycycles = getBuyCycles(
//         distVolumeWei, 
//         distDividerRate, 
//         distStartRate, 
//         distEndRate, 
//         batchsize_wei, 
//         ethers.utils.parseEther(pa.toString()), 
//         isnative)

//       await do_run(distVolumeWei, buycycles, `${title}-${ethers.utils.formatEther(batchsize_wei)}-${pa}`, isnative);

//       // consolidate the buycycles
//       for(let i=0; i < buycycles.length; i++) {
//         let ag = null;
//         const bc = buycycles[i];

//         if(aggregate.length<buycycles.length) {
//           ag = { dist_offset:ethers.utils.formatEther(bc.dist_offset_wei) }
//           aggregate.push(ag);
//         }
//         aggregate[i][fiatpertoken+pa] = bc.actual_cost_wei/bc.actual_tokens_wei;
//         aggregate[i][tokenperfiat+pa] = bc.actual_tokens_wei/bc.actual_cost_wei;
//       }
//     }

//     display_columns = [];
//     for(pa of purchaseAmounts) { display_columns.push(fiatpertoken+pa); }
//     await createLineChart(aggregate, `./curve-data/${title}-${fiatpertoken}.png`, "", 'dist_offset', display_columns);

//     display_columns = [];
//     for(pa of purchaseAmounts) { display_columns.push(tokenperfiat+pa); }
//     await createLineChart(aggregate, `./curve-data/${title}-${tokenperfiat}.png`, "", 'dist_offset', display_columns);

//     display_columns = [];
//     for(pa of purchaseAmounts) { display_columns.push(fiatpertoken+pa); }
//     for(pa of purchaseAmounts) { display_columns.push(tokenperfiat+pa); }
//     writeAggregatesCSV(`./curve-data/aggregates-${title}.csv`, 'dist_offset', display_columns, aggregate);

//     console.log(`done - ${title}`);
//   }catch(ex) {
//     console.error(`create data ${title} - error:`,ex);
//   }
// }

// async function main() {
//   const fastmode = false;

//   await hre.run("clean");
//   await hre.run("compile");

//   // async function create_data(
//   //   fiat, 
//   //   token, 
//   //   title, 
//   //   purchaseAmounts, 
//   //   gainTokenname, 
//   //   gainTokensymbol,
//   //   tokenVolumeWei, 
//   //   distVolumeWei,
//   //   distStartRate, 
//   //   distEndRate, 
//   //   distDividerRate, 
//   //   isnative, 
//   //   fastmode) {
  

//   await create_data(
//     'eth',
//     'gain', 
//     'eth - distribution',
//     [1000],
//     cSettingsETH.gainTokenname, 
//     cSettingsETH.gainTokensymbol,
//     cSettingsETH.cFullDistributionVolumeWei, 
//     cSettingsETH.cDistVolumeWei,
//     cSettingsETH.cDistStartRate, 
//     cSettingsETH.cDistEndRate, 
//     cSettingsETH.cDistDividerRate, 
//     true, 
//     fastmode);
//   console.log('after wait first create_data')

//   // await create_data(
//   //   'eth',
//   //   'gain', 
//   //   'eth - team distribution',
//   //   [1000],
//   //   cSettingsETH.gainTokenname, 
//   //   cSettingsETH.gainTokensymbol,
//   //   cSettingsETH.tokenVolumeWei, 
//   //   cSettingsETH.cTeamDistVolumeWei,
//   //   cSettingsETH.cTeamDistStartRate, 
//   //   cSettingsETH.cTeamDistEndRate, 
//   //   cSettingsETH.cDistDividerRate, 
//   //   true, 
//   //   fastmode);

//   // await create_data(
//   //   'eth',
//   //   'gain', 
//   //   'eth - marketing distribution',
//   //   [1000],
//   //   cSettingsETH.gainTokenname, 
//   //   cSettingsETH.gainTokensymbol,
//   //   cSettingsETH.tokenVolumeWei, 
//   //   cSettingsETH.cMarketingDistVolumeWei,
//   //   cSettingsETH.cMarketingDistStartRate, 
//   //   cSettingsETH.cMarketingDistEndRate, 
//   //   cSettingsETH.cDistDividerRate, 
//   //   true, 
//   //   fastmode);      
  

//   // await create_data('eth','gain',cSettingsETHFlat, 'eth-flat', [1], true, fastmode);
//   // await create_data('usdc','ugain',cSettingsUGAIN, 'usdc', [1], false, fastmode);
//   // await create_data('usdc','ugain',cSettingsUGAINFlat, 'usdc-flat', [1], false, fastmode);
// }

// main().catch((error) => {
//   console.error(error);
//   process.exitCode = 1;
// });
