import { expect } from "chai";
import { ethers } from "hardhat";
import { it } from "mocha";
import { Leverage } from "../typechain";

describe("Greeter and Leverage trading", function () {
  it("Should return the new greeting once it's changed", async function () {
    const Greeter = await ethers.getContractFactory("Greeter");
    const greeter = await Greeter.deploy("Hello, world!");
    await greeter.deployed();

    expect(await greeter.greet()).to.equal("Hello, world!");

    const setGreetingTx = await greeter.setGreeting("Hola, mundo!");

    // wait until the transaction is mined
    await setGreetingTx.wait();

    expect(await greeter.greet()).to.equal("Hola, mundo!");
  });
  it("Should pass the leverage trading", async () => {
    const ERC20Factory = await ethers.getContractFactory("MockERC20");
    const PairFactory = await ethers.getContractFactory("Pair");
    const LeverageFactory = await ethers.getContractFactory("Leverage");

    const [owner, addr1, addr2, ...addrs] = await ethers.getSigners();

    console.log("deploying with wallet ", owner.address);

    console.log("deploying token0 ...");
    const token0 = await ERC20Factory.deploy("Mock Token 0", "MT0");
    await token0.deployed();
    console.log("token0 address = ", token0.address);

    console.log("deploying token1 ...");
    const token1 = await ERC20Factory.deploy("Mock Token 1", "MT1");
    await token1.deployed();
    console.log("token1 address = ", token1.address);

    console.log("deploying pair ...");
    const pair = await PairFactory.deploy(token0.address, token1.address);
    await pair.deployed();
    console.log("pair address = ", pair.address);

    console.log("approving token0 to pair ...");
    let tx = await token0.approve(pair.address, "1000000000000000000000000");
    await tx.wait();

    console.log("approving token1 to pair ...");
    tx = await token1.approve(pair.address, "1000000000000000000000000");
    await tx.wait();

    console.log("adding liquidity to pair ...");
    tx = await pair.addLiquidity(
      "1000000000000000000000000",
      "1000000000000000000000000"
    );
    await tx.wait();

    let t0bal = await token0.balanceOf(pair.address);
    expect(t0bal.toString()).to.be.equal("1000000000000000000000000");

    const {
      _reserve0,
      _reserve1,
      _blockTimestampLast,
    } = await pair.getReserves();
    console.log("getReserves() : ", _reserve0, _reserve1, _blockTimestampLast);

    console.log("approving for swap ...");
    tx = await token0.approve(pair.address, "500000000000000000000000");
    await tx.wait();

    console.log("swapping ... ");
    tx = await pair.swapToken(
      "500000000000000000000000",
      token0.address,
      token1.address,
      addr1.address
    );
    await tx.wait();

    let t1bal = await token1.balanceOf(addr1.address);
    console.log("addr1 balance of token1 is ", t1bal.toString());

    console.log("deploying leverage ... ");
    const leverage = await LeverageFactory.deploy(
      token0.address,
      token1.address,
      pair.address,
      10
    );
    await leverage.deployed();
    console.log("leverage address = ", leverage.address);

    const ownerbal0 = await token0.balanceOf(owner.address);
    console.log("ownerbal0 = ", ownerbal0.toString());

    console.log("approving for adding pool ...");
    tx = await token0.approve(owner.address, "5000000000000000000000000");
    await tx.wait();
    tx = await token1.approve(owner.address, "5000000000000000000000000");
    await tx.wait();

    console.log("adding pool to the leverage 0 ...");
    tx = await token0.transferFrom(
      owner.address,
      leverage.address,
      "5000000000000000000000000"
    );

    console.log("adding pool to the leverage 1 ...");
    tx = await token1.transferFrom(
      owner.address,
      leverage.address,
      "5000000000000000000000000"
    );

    console.log("approving for the deposite 0 ... ");
    tx = await token0.approve(leverage.address, "500000000000000000000000");

    console.log("depositing token0 ...");
    tx = await leverage.deposite("500000000000000000000000", token0.address);
    await tx.wait();

    await expect(await token0.balanceOf(leverage.address)).to.be.equal(
      "5500000000000000000000000"
    );

    // console.log("approving for the deposite 1 ... ");
    // tx = await token1.approve(leverage.address, "500000000000000000000000");

    // console.log("depositing token0 ...");
    // tx = await leverage.deposite("500000000000000000000000", token1.address);
    // await tx.wait();

    // await expect(await token1.balanceOf(leverage.address)).to.be.equal(
    //   "5500000000000000000000000"
    // );

    console.log("creating position ...");
    tx = await leverage.createPosition(
      token0.address,
      "4000000000000000000000000",
      10
    );
    await tx.wait();

    const rem = await leverage.getRemainingValue(owner.address);
    console.log("rem = ", rem.toString());

    const out = await leverage.getOutput(
      token0.address,
      "200000000000000000000000"
    );
    console.log("out = ", out.toString());

    const bal = await leverage.userPositionInfo(owner.address, 0);
    console.log("userinfo of owner is ", bal);

    console.log("position swapping ... ");
    tx = await leverage.swapPosition(0, "2000000000000000000000000");

    const usrinfo0 = await leverage.userPositionInfo(owner.address, 0);
    console.log("userinfo0 of owner is now ", usrinfo0);

    const usrinfo1 = await leverage.userPositionInfo(owner.address, 1);
    console.log("userinfo1 of owner is now ", usrinfo1);
  });
});
