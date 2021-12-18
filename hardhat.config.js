require("@nomiclabs/hardhat-waffle");
require('dotenv').config();
require("hardhat-gas-reporter");

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async () => {
  const accounts = await ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

task("seedphrase", "Prints the current seed phrase", async () => {
  console.log("seed phrase: %s", process.env.MNEMONIC !== undefined ? process.env.MNEMONIC : "")
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      chainId: 1337,
      mining: {
        auto: true,
        interval: 5000
      },
      accounts: {
        mnemonic:
          process.env.MNEMONIC !== undefined ? process.env.MNEMONIC : "",
          accountsBalance: "1000000000000000000000000000000",
      },
    },
    testnet: {
      url: 'http://206.189.99.250:8080',
      gasPrice: 4000000000000,
      chainId: 36618,
      accounts: [
        "0xe8458a486cf38d360fa05777f988ad32ba6647a81b85364cf68a18981aef9886"
      ]
    },
    dagobah: {
      url: `https://dagobah.connectorz.org`,
      chainId: 13321,
      gasprice: 4000000000000,
      accounts: {
        mnemonic:
          process.env.MNEMONIC !== undefined ? process.env.MNEMONIC : "",
      },
    },

  },
  solidity: {
    version: "0.8.2",
    settings: {
      optimizer: {
        enabled: true,
        runs: 300
      }
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
    gasPrice: 179,
    coinmarketcap: process.env.COINMARKETCAP,
  },
  etherscan: {
      apiKey: process.env.ETHERSCAN_API_KEY,
  },
};