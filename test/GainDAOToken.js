const { expect } = require("chai");

let expectError = async (promise, expectedError) => {
  try {
    await promise;
  } catch (error) {
    if (error.message.indexOf(expectedError) === -1) {
      // When the exception was a revert, the resulting string will include only
      // the revert reason, otherwise it will be the type of exception (e.g. 'invalid opcode')
      const actualError = error.message.replace(
        /Returned error: VM Exception while processing transaction: (revert )?/,
        '',
      );
      expect(actualError).to.equal(expectedError, "Wrong kind of exception received");
    }
    return;
  }

  expect.fail("Expected an error that did not occur");
}

describe("GainDAOToken", () => {
  let token;
  let deployer;
  let user;

  before(async () => {
    [deployer, user] = await ethers.getSigners();
  })

  beforeEach(async () => {
    const GainDAOToken = await ethers.getContractFactory("GainDAOToken");
    token = await GainDAOToken.deploy();

    await token.deployed();
  })

  context("initialization", () => {
    it("has the correct name", async () => {
      expect(await token.name()).to.equal("GainDAO Token");
    })

    it("has the correct symbol", async () => {
      expect(await token.symbol()).to.equal("GAIN");
    })

    it("has the correct decimals", async () => {
      expect(await token.decimals()).to.equal(18);
    })

    context("correctly setup the roles", () => {
      it("deployer is admin", async () => {
        expect(await token.hasRole(await token.DEFAULT_ADMIN_ROLE(), deployer.address)).to.be.true;
      })

      it("deployer is pauser", async () => {
        expect(await token.hasRole(await token.PAUSER_ROLE(), deployer.address)).to.be.true;
      })

      it("deployer is minter", async () => {
        expect(await token.hasRole(await token.MINTER_ROLE(), deployer.address)).to.be.true;
      })
    })
  })

  context("pausing and unpausing", () => {
    it("is deployed in a paused state", async () => {
      expect(await token.paused()).to.be.true;
    })

    it("non pauser cannot unpause the token", async () => {
      await expectError(
        token.connect(user).unpause(),
        "GainDAOToken: _msgSender() does not have the pauser role",
      );
    })

    it("cannot transfer coins when the token is paused", async () => {
      await expectError(
        token.connect(user).transfer(deployer.address, 100),
        "GainDAOToken: paused",
      );
    })

    it("can mint coins while the token is paused", async () => {
      await token.connect(deployer).mint(user.address, 100);
    })

    it("pauser can unpause the token", async () => {
      await token.connect(deployer).unpause();
      expect(await token.paused()).to.be.false;
    })

    it("can transfer coins once the token is unpaused", async () => {
      await token.connect(deployer).unpause();
      await token.connect(deployer).mint(deployer.address, 100);
      await token.connect(deployer).transfer(user.address, 100);
      expect(await token.balanceOf(user.address)).to.equal(100);
    })
  })

  context("minting", () => {
    it("minter can mint tokens", async () => {
      await token.connect(deployer).mint(deployer.address, 100);
      expect(await token.balanceOf(deployer.address)).to.equal(100);
    })

    it("minting does not unpause the token", async () => {
      await token.connect(deployer).mint(deployer.address, 100);
      expect(await token.paused()).to.be.true;
    })

    it("minting does not repause an unpaused token", async () => {
      await token.connect(deployer).unpause();
      await token.connect(deployer).mint(deployer.address, 100);
      expect(await token.paused()).to.be.false;
    })

    it("non minter cannot mint tokens", async () => {
      await expectError(
        token.connect(user).mint(user.address, 100),
        "GainDAOToken: _msgSender() does not have the minter role",
      );
    })

    it("cannot mint more tokens that the cap", async () => {
      await expectError(
        token.connect(deployer).mint(deployer.address, (await token.cap()) + 1),
        "ERC20Capped: cap exceeded"
      );
    })
  })
});
