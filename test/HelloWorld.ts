import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.connect();
describe("HelloWorld", function () {
  it("Should return the correct greeting message", async function () {
    const contract = await ethers.getContractFactory("HelloWorld");
    const deployedContract = await contract.deploy();
    await deployedContract.waitForDeployment();

    expect (await deployedContract.greet()).to.equal("Hello, World");
  });
});
