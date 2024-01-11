require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();
//require("hardhat-gas-reporter");
require("solidity-coverage");

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html

task("accounts", "Prints the list of accounts", async () => {
  const accounts = await ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});
//
// task("seedphrase", "Prints the current seed phrase", async () => {
//   console.log("seed phrase: %s", process.env.MNEMONIC !== undefined ? process.env.MNEMONIC : "")
// });

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  defaultNetwork: "dagobah",
  networks: {
    hardhat: {
      chainId: 1337,
      mining: {
        auto: true,
        interval: 5000,
      },
      // accounts: {
      //   mnemonic:
      //     process.env.MNEMONIC !== undefined ? process.env.MNEMONIC : "",
      //   accountsBalance: "1000000000000000000000000000000000000",
      // },
      accounts: [
        {
          "accountname": "master",
          "privateKey": "0x0e81c93295f3038dc3f58baf5af4413feb444f6f5c4e1354dfb12a543dfeb8b9",
          "balance": "1000000000000000000000000000000000000"
        },
        {
          "accountname": "deployer",
          "privateKey": "0x4595c4a92a7112f61671a17f8ea3d49e5827c9101337800d2d482435e43b2434",
          // "balance": "100000000000000000000"
          "balance": "100000000000000000000000000"
        },
        {
          "accountname": "gainetherpool",
          "privateKey": "0xd30489e3b3ea43e5c18d0f94922e7a900130f3965c5730ded474582713b19016",
          "balance": "1000000000000000000"
        },
        {
          "accountname": "treasury",
          "privateKey": "0x214c960f4466510455e1483e52183d5a90630f3ace35f0aaa2fc8925e73f6195",
          "balance": "1000000000000000000"
        },
        {
          "accountname": "liquiditypool",
          "privateKey": "0xbef742b52f50029c7e4e56b65015c8006df45795bdb31b9508b241ac22bac6ef",
          "balance": "1000000000000000000"
        },
        {
          "accountname": "tokenvault",
          "privateKey": "0x362a7c02e2b736d0c0404734f59b6f09f319db4d6ae7124bcaf102566a37f517",
          "balance": "1000000000000000000"
        },
        {
          "accountname": "holder1",
          "privateKey": "0xe5deed9a4f39226f325880c2e99452168979e68a1aa36682e1da91f59e3fa1c0",
          "balance": "100000000000000000000000"
        },
        {
          "accountname": "holder2",
          "privateKey": "0xe8baf5a88866e0f585bd63795698b4944620fb6755b268e3cc4d0045081e0058",
          "balance": "100000000000000000000"
        },
        {
          "accountname": "holder3",
          "privateKey": "0xefa9b73dd373451514cd17f694ed8ec45e2db6104f1a8ea3bf14d3a4ba151ce0",
          "balance": "100000000000000000000"
        },
        {
          "accountname": "holder4",
          "privateKey": "0x0163298c8b8afbcd5a20daa8c48e2ea291311daa3a31e15d7145350553f6ba0e",
          "balance": "100000000000000000000"
        },
        {
          "accountname": "holder5",
          "privateKey": "0x95d1f3121ebe631ee27a575c8c4146fb67e08787380d0e64a3b56f5616584db5",
          "balance": "100000000000000000000"
        },
        {
          "accountname": "holder6",
          "privateKey": "0xb2c3677a49d39ae2112f57e676c5425b5d737e8590502d23756024d5de68a151",
          "balance": "100000000000000000000"
        },
        {
          "accountname": "whale1",
          "privateKey": "0x64f379e6ad934679479a64f7e416141eeeff3a96eaf59d19814f10e80100e286",
          "balance": "1000000000000000000000000000"
        },
        {
          "accountname": "whale2",
          "privateKey": "0x804516e7b433540baa4b295072f19ef60e7cddf3e395c250159502d585b20531",
          "balance": "1000000000000000000000000000"
        }
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
    // rinkeby: {
    //   url: process.env.INFURAENDPOINT_RINKEBY,
    //   accounts: {
    //     mnemonic:
    //       process.env.MNEMONIC !== undefined ? process.env.MNEMONIC : "",
    //     // accountsBalance: "1000000000000000000000000000",
    //   },
    // },
  },
  solidity: {
    version: "0.8.4",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1000,
      },
    },
  },
  gasReporter: {
    enabled: false && process.env.REPORT_GAS !== undefined,
    currency: "EUR",
    gasPrice: 179,
    coinmarketcap: process.env.COINMARKETCAP,
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
  mocha: {
    timeout: 15 * 60 * 1000,
  },
};
