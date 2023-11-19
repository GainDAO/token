const {
    calculateRateUndividedNative,
    calculateRateUndivided
} = require('./Library.js');

// const formatBuyCycles = (buyCycles) => (buyCycles.map(cycle => ({ start: ethers.utils.formatEther(cycle.tokenbalance_start_wei), rateundivided: cycle.rateundivided })))

const formatBuyCycles = (buyCycles) => { 
    const data = buyCycles.map(
        cycle => ({ 
            tokenbalance_start: ethers.utils.formatEther(cycle.tokenbalance_start_wei), 
            dist_volume_start: ethers.utils.formatEther(cycle.dist_volume_wei),
            tokens: ethers.utils.formatEther(cycle.tokens_wei), 
            rateundivided: cycle.rateundivided.toString(), 
            cost: ethers.utils.formatEther(cycle.cost_wei), 
        })
    )

    return data; 
}

// const calculateRateEther = (volume_wei, totalvolume_wei, startrate_ = 3000, endrate_ = 1, verbose = false) => {
//     try {
//         let startrate = ethers.BigNumber.from(startrate_ * 1000 * 1000);
//         let deltarate = ethers.BigNumber.from((startrate_ - endrate_) * 1000 * 1000);
//         let rate_full = startrate.sub(deltarate.mul(volume_wei).div(totalvolume_wei)).div(1000 * 1000);
//         let rate = Math.floor(rate_full.toNumber());

//         verbose && console.log("calculateRateEther - rate %s [fullres: %s]", rate, rate_full);
//         verbose && console.log("  startrate %s / deltarate %s", startrate, deltarate);
//         verbose && console.log("  volume %s / %s", volume_wei, totalvolume_wei);

//         return rate;
//     } catch (ex) {
//         console.error("calculateRateEther - error", ex.message);
//         return 0;
//     }
// }

const getBuyCyclesByCount = (settings, tokencounts, isnative, verbose = false) => {
    try {
        let tokenbalance_start_wei = settings.cDistVolumeWei;

        let dist_volume_wei = ethers.BigNumber.from(0);
        let pool_balance_end_wei = ethers.BigNumber.from(0);

        let buyCycles = [];
        for (let i = 0; i < tokencounts.length; i++) {
            let tokens_per_step_wei = ethers.utils.parseEther(tokencounts[i].toString());

            // console.log("create buycycle for %s tokens / %s wei", tokencounts[i], tokens_per_step_wei);
            let rateundivided=undefined;
            let cost_wei=undefined;
            let tokens_wei=undefined;
            if(isnative) {
                rateundivided = calculateRateUndividedNative(settings, dist_volume_wei.toString());
                //    console.log("got undivided rate of %s / %s -> %s", rate, settings.cDistDividerRate, rate/settings.cDistDividerRate);
                cost_wei = tokens_per_step_wei.mul(settings.cDistDividerRate).div(rateundivided);
                tokens_wei = tokens_per_step_wei; // cost_wei.mul(rateundivided).div(settings.cDistDividerRate);
            } else {
                rateundivided = calculateRateUndivided(settings, dist_volume_wei.toString());
                //    console.log("got undivided rate of %s / %s -> %s", rate, settings.cDistDividerRate, rate/settings.cDistDividerRate);
                cost_wei = tokens_per_step_wei.mul(rateundivided).div(settings.cDistDividerRate);
                tokens_wei = tokens_per_step_wei; // cost_wei.mul(rateundivided).div(settings.cDistDividerRate);
                // tokens_wei = cost_wei.mul(settings.cDistDividerRate).div(rateundivided);
            }

            // some rounding error is unavoidable, but should be small
            if(tokens_per_step_wei.sub(tokens_wei).gt(ethers.BigNumber.from(1000))) {
                console.error("mismatch between actual token count and desired token count too big")
                console.log("mismatch value: ", tokens_per_step_wei.sub(tokens_wei));
                return false;
            }

            if (tokens_wei.gt(tokenbalance_start_wei)) {
                tokens_wei = tokenbalance_start_wei;
                verbose && console.log("clip last purchase to available tokens")
                if(isnative) {
                    rateundivided = calculateRateUndividedNative(settings, dist_volume_wei.toString());
                    cost_wei = tokens_wei.mul(settings.cDistDividerRate).div(rateundivided);
                } else {
                    rateundivided = calculateRateUndivided(settings, dist_volume_wei.toString());
                    cost_wei = tokens_wei.mul(rateundivided).div(settings.cDistDividerRate);
                }
            }
            let tokenbalance_end_wei = tokenbalance_start_wei.sub(tokens_wei);
            pool_balance_end_wei = pool_balance_end_wei.add(cost_wei);

            let cycle = { tokenbalance_start_wei, tokens_wei, rateundivided, cost_wei, tokenbalance_end_wei, dist_volume_wei, pool_balance_end_wei }

            buyCycles.push(cycle);

            let cyclestr = {
                cycleidx: i,
                tokenbalance_start_wei,
                tokens_wei,
                rateundivided,
                cost_wei,
                tokenbalance_end_wei,
                dist_volume_wei,
                pool_balance_end_wei,
            }

            verbose && console.log(JSON.stringify(cyclestr, 0, 2))
            // console.log(JSON.stringify(cyclestr,0,2))

            dist_volume_wei = dist_volume_wei.add(tokens_wei);
            tokenbalance_start_wei = tokenbalance_end_wei;
        }

        return buyCycles
    } catch (ex) {
        console.error(`getBuyCyclesByCount - error ${ex.message}`, ex);
        return false;
    }
}

// const getBuyCyclesByEther = (ethervalues, total_volume_wei, startrate, endrate, verbose = false) => {
// 
//   let tokenbalance_start_wei = startrate > endrate ? total_volume_wei : ethers.BigNumber.from(0);
// 
//   let dist_volume_wei = ethers.BigNumber.from(0);
//   let pool_balance_end_wei = ethers.BigNumber.from(0);
// 
//   let buyCycles = [];
// 
//   for(let i=0; i<ethervalues.length;i++) {
//     try {
//       let rate = calculateRateEther(total_volume_wei, dist_volume_wei, startrate, endrate)
//       let cost_wei = ethers.utils.parseEther(ethervalues[i].toString());
//       let tokens_wei = cost_wei.mul(rate);
//       console.log("Buycycle Ether %s - cost %s / tokens %s / rate %s", i, cost_wei, tokens_wei, rate);
//       let tokens_remaining = total_volume_wei.sub(tokenbalance_start_wei)
//       if(tokens_wei.gt(tokens_remaining)) {
//         verbose && console.log("getBuyCyclesByEther - clip last purchase to available tokens")
//         tokens_wei = tokens_remaining;
//         cost_wei = tokens_wei.mul(rate);
//       }formatBuyCycles
// 
//       let tokenbalance_end_wei;
//       if(startrate>endrate) {
//         tokenbalance_end_wei = tokenbalance_start_wei.sub(tokens_wei);
//       } else {
//         tokenbalance_end_wei = tokenbalance_start_wei.add(tokens_wei);
//       }
// 
//       pool_balance_end_wei = pool_balance_end_wei.add(cost_wei);
// 
//       let cycle = {
//         tokenbalance_start_wei,
//         tokens_wei,
//         rate,formatBuyCycles
//         cost_wei,
//         tokenbalance_end_wei,
//         dist_volume_wei,
//         pool_balance_end_wei
//       }
// 
//       if(!tokens_wei.isZero()) {
//         buyCycles.push(cycle);
// 
//         let cyclestr = {
//           tokenbalance_start_wei: ethers.utils.formatEther(tokenbalance_start_wei.toString()),
//           tokens_wei: ethers.utils.formatEther(tokens_wei.toString()),
//           rate,
//           cost_wei: ethers.utils.formatEther(cost_wei.toString()),
//           tokenbalance_end_wei: ethers.utils.formatEther(tokenbalance_end_wei.toString()),
//           dist_volume_wei: ethers.utils.formatEther(dist_volume_wei.toString()),
//           pool_balance_end_wei: ethers.utils.formatEther(pool_balance_end_wei.toString()),
//         }
// 
//         verbose && console.log(JSON.stringify(cyclestr,0,2))
//       } else {
//         verbose && console.log("getBuyCyclesByEther - ignore buycycle when distribution is done")
//       }
// 
//       dist_volume_wei = dist_volume_wei.add(tokens_wei);
//       tokenbalance_start_wei = tokenbalance_end_wei
//     } catch(ex) {
//       console.error("getBuyCyclesByEther failed in cycle #%s (%s) []", i, ethervalues[i], ex.message);
//       return false;
//     }
//   }
// 
//   return buyCycles;
// }

module.exports = {
    // calculateRateEther,
    getBuyCyclesByCount,
    formatBuyCycles
}
// getBuyCyclesByEther
