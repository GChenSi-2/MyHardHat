import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.connect();
describe("Counter2", function () {

  let counter: any; // 声明在外部
  // 每个测试前部署新合约
  beforeEach(async function () {
    counter = await ethers.deployContract("Counter");
  });

  describe("Deployment", function () {
    it("Should set the initial count to 0", async function () {
      expect(await counter.count()).to.equal(0);
    });
  });

  describe("inc()", function () {
    it("Should increment count by 1", async function () {
      await counter.inc();
      expect(await counter.count()).to.equal(1);
    });

    it("Should emit CountChanged event", async function () {
      await expect(counter.inc())
        .to.emit(counter, "CountChanged")
        .withArgs(1);
    });
  });

  describe("incBy()", function () {
    it("Should increment count by specified amount", async function () {
      await counter.incBy(5);
      expect(await counter.count()).to.equal(5);
    });

    it("Should revert if increment is 0", async function () {
      await expect(counter.incBy(0))
        .to.be.revertedWith("incBy: increment should be positive");
    });

    it("Should work with multiple calls", async function () {
      await counter.incBy(3);
      await counter.incBy(7);
      expect(await counter.count()).to.equal(10);
    });
  });
});