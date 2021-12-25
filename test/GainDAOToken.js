const { expect } = require("chai");

describe("GainDAOToken", () => {
  let token;
  let deployer;
  let pauser;
  let minter;
  let burner;
  let user;

  before(async () => {
    [deployer, pauser, minter, burner, user] = await ethers.getSigners();
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
      
      it("test minter role", async () => {
        const subject = minter.address
        const role = await token.MINTER_ROLE();
        expect(await token.hasRole(role, subject), 'role is not assigned by default').to.be.false;
        await token.connect(deployer).grantRole(role, subject);
        expect(await token.hasRole(role, subject), 'can grant role').to.be.true;
        await token.connect(deployer).revokeRole(role, subject);
        expect(await token.hasRole(role, subject), 'can revoke role').to.be.false;
      })

      it("test pauser role", async () => {
        const subject = minter.address
        const role = await token.PAUSER_ROLE();
        expect(await token.hasRole(role, subject), 'role is not assigned by default').to.be.false;
        await token.connect(deployer).grantRole(role, subject);
        expect(await token.hasRole(role, subject), 'can grant role').to.be.true;
        await token.connect(deployer).revokeRole(role, subject);
        expect(await token.hasRole(role, subject), 'can revoke role').to.be.false;
      })

      it("test burner role", async () => {
        const subject = minter.address
        const role = await token.BURNER_ROLE();
        expect(await token.hasRole(role, subject), 'role is not assigned by default').to.be.false;
        await token.connect(deployer).grantRole(role, subject);
        expect(await token.hasRole(role, subject), 'can grant role').to.be.true;
        await token.connect(deployer).revokeRole(role, subject);
        expect(await token.hasRole(role, subject), 'can revoke role').to.be.false;
      })
    })
  })

  context("pausing and unpausing", () => {
    it("is deployed in a paused state", async () => {
      expect(await token.paused()).to.be.true;
    })

    it("non pauser cannot unpause the token", async () => {
      let allowed = token.connect(user).unpause()
      await expect(allowed, 'non pauser cannot unvert the token')
        .to.be.revertedWith("GainDAOToken: _msgSender() does not have the pauser role");
    })

    it("cannot transfer coins when the token is paused", async () => {
      let allowed = token.connect(user).transfer(deployer.address, 100)
      await expect(allowed, 'cannot transfer coins when the token is paused')
        .to.be.revertedWith("GainDAOToken: paused");
    })

    it("non minter cannot mint coins", async () => {
      let allowed = token.connect(user).mint(user.address, 100)
      await expect(allowed, 'non minter cannot mint coins')
        .to.be.revertedWith("GainDAOToken: _msgSender() does not have the minter role");
    })

    it("minter can mint coins while the token is paused", async () => {
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
      let allowed = token.connect(user).mint(user.address, 100)
      await expect(allowed, 'non minter cannot mint tokens')
        .to.be.revertedWith("GainDAOToken: _msgSender() does not have the minter role");
    })

    it("cannot mint more tokens that the cap", async () => {
      let allowed = token.connect(deployer).mint(deployer.address, (await token.cap()) + 1)
      await expect(allowed, 'cannot mint more tokens that the cap')
        .to.be.revertedWith("ERC20Capped: cap exceeded");
    })
  })

  context("burning", () => {
    it("burner cannot burn tokens when paused", async () => {
      await token.connect(deployer).mint(deployer.address, 100);
      let allowed = token.connect(deployer).burn(75)
      await expect(allowed, 'burner cannot burn tokens when paused')
        .to.be.revertedWith("GainDAOToken: paused");
    })

    it("burner can burn tokens", async () => {
      await token.connect(deployer).mint(deployer.address, 100);
      await token.connect(deployer).unpause();
      await token.connect(deployer).burn(75);
      expect(await token.balanceOf(deployer.address)).to.equal(25);
    })

    it("non burner cannot burn tokens", async () => {
      let allowed = token.connect(user).burn(100)
      await expect(allowed, 'non burner cannot burn tokens')
        .to.be.revertedWith("GainDAOToken: _msgSender() does not have the burner role");
    })

    it("cannot burn more tokens that balance", async () => {
      await token.connect(deployer).mint(deployer.address, 100);
      await token.connect(deployer).unpause();

      let allowed = token.connect(deployer).burn(110)
      await expect(allowed, 'non burner cannot burn tokens')
        .to.be.revertedWith("ERC20: burn amount exceeds balance");
    })
  })
});