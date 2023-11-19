const hre = require("hardhat");
const fs = require("fs-extra");
const path = require("path");

const copyArtifacts = (contractName, targetfolder) => {
  try {
    const sourcePath = path.join(
      __dirname,
      `/../artifacts/contracts/${contractName}.sol/${contractName}.json`
    );
    const artifact = JSON.parse(fs.readFileSync(sourcePath));

    const data = {
      abi: artifact.abi,
      bytecode: artifact.bytecode,
    };

    if (fs.existsSync(targetfolder) === false) {
      console.log(`Creating folder ${targetfolder}`);
      fs.mkdirSync(targetfolder, { recursive: true });
    }

    const destinationPath = path.join(targetfolder, `/${contractName}.json`);
    fs.writeFileSync(destinationPath, JSON.stringify(data, null, 2));

    console.log(`Contract info saved to ${destinationPath}`);
    return true;
  } catch (ex) {
    console.error("Unable to copy artifact file - error: ", ex);
    return false;
  }
};

async function main() {
  console.log(
    "Creating & copying artifacts for the GainDAO contracts to the backend folder:"
  );

  hre.run("clean");
  hre.run("compile");

  const targetFolder = "/storage/gaindao/server/info-store/artifacts";

  copyArtifacts("ERC20Distribution", targetFolder);
  copyArtifacts("ERC20DistributionNative", targetFolder);
  copyArtifacts("GainDAOToken", targetFolder);
  copyArtifacts("PaymentToken", targetFolder);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
