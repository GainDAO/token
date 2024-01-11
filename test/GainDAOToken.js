const { expect } = require("chai");
const { waitForTxToComplete } = require("./Library.js");

describe("GainDAOToken - construction", () => {
  let token;
  let bank;
  let deployer;
  let user;

  before(async () => {
    [deployer, user] = await ethers.getSigners();

    console.log("deployer:", deployer.address, await deployer.getBalance());
    console.log("user:", user.address, await user.getBalance());
  });

  describe("construction - USD POOL", async () => {
    const name = "GAINDAO-USD";
    const symbol = "uGAIN";
    const cap_wei = ethers.utils.parseEther("21000001");

    it("can deploy " + symbol, async () => {
      const GainDAOToken = await ethers.getContractFactory("GainDAOToken");
      token = await GainDAOToken.deploy(name, symbol, cap_wei);

      await token.deployed();
    });

    it("has the correct name", async () => {
      expect(await token.name()).to.equal(name);
    });

    it("has the correct symbol", async () => {
      expect(await token.symbol()).to.equal(symbol);
    });

    it("has the correct cap", async () => {
      expect(await token.cap()).to.equal(cap_wei);
    });
  });
});

describe("GainDAOToken - operation", async () => {
  let token;
  let deployer;
  let minter;
  let user;

  const name = "GAINDAO-USD";
  const symbol = "uGAIN";
  const cap_wei = ethers.utils.parseEther("21000000");

  before(async () => {
    [dummy, dummy, dummy, deployer, minter, user] =
      await ethers.getSigners();
  });

  beforeEach(async () => {
    const GainDAOToken = await ethers.getContractFactory("GainDAOToken");
    token = await GainDAOToken.connect(deployer).deploy(name, symbol, cap_wei);

    await token.deployed();
  });

  describe("initialization", () => {
    it("has the correct name", async () => {
      expect(await token.name()).to.equal(name);
    });

    it("has the correct symbol", async () => {
      expect(await token.symbol()).to.equal(symbol);
    });

    it("has the correct cap", async () => {
      expect(await token.cap()).to.equal(cap_wei);
    });

    it("has the correct decimals", async () => {
      expect(await token.decimals()).to.equal(18);
    });

    describe("correctly setup the roles", () => {
      it("deployer is admin", async () => {
        expect(
          await token.hasRole(
            await token.DEFAULT_ADMIN_ROLE(),
            deployer.address
          )
        ).to.be.true;
      });

      it("deployer is minter", async () => {
        expect(await token.hasRole(await token.MINTER_ROLE(), deployer.address))
          .to.be.true;
      });

      it("test minter role", async () => {
        const subject = minter.address;
        const role = await token.MINTER_ROLE();
        expect(
          await token.hasRole(role, subject),
          "role is not assigned by default"
        ).to.be.false;
        const tx1 = await token.connect(deployer).grantRole(role, subject);
        await waitForTxToComplete(tx1);
        expect(await token.hasRole(role, subject), "can grant role").to.be.true;
        const tx2 = await token.connect(deployer).revokeRole(role, subject);
        await waitForTxToComplete(tx2);
        expect(await token.hasRole(role, subject), "can revoke role").to.be
          .false;
      });
    });
  });

  describe("minting", async () => {
    it("minter can mint tokens", async () => {
      const tx = await token.connect(deployer).mint(deployer.address, 100);
      await waitForTxToComplete(tx);
      expect(await token.balanceOf(deployer.address)).to.equal(100);
    });

    it("non minter cannot mint tokens", async () => {
      let allowed = token.connect(user).mint(user.address, 100);
      await expect(
        allowed, 
        "non minter cannot mint tokens")
        .to.be.revertedWithCustomError(
          token,
          "Unauthorized");
    });

    it("cannot mint more tokens than the cap", async () => {
      let allowed = token
        .connect(deployer)
        .mint(deployer.address, (await token.cap()) + 1);
      await expect(
        allowed,
        "cannot mint more tokens than the cap"
      ).to.be.revertedWith("ERC20Capped: cap exceeded");
    });
  });

  describe("burning", async () => {
    it("can burn tokens", async () => {
      const tx1 = await token.connect(deployer).mint(user.address, 100);
      await waitForTxToComplete(tx1);
      const tx3 = await token.connect(user).burn(75);
      await waitForTxToComplete(tx3);
      expect(await token.balanceOf(user.address)).to.equal(25);
    });

    it("cannot burn more tokens than balance", async () => {
      const tx1 = await token.connect(deployer).mint(user.address, 100);
      await waitForTxToComplete(tx1);

      let allowed = token.connect(user).burn(110);
      await expect(allowed, "non burner cannot burn tokens").to.be.revertedWith(
        "ERC20: burn amount exceeds balance"
      );
    });
  });
});
