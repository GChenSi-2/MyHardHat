import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.connect();

describe("Counter with Gas Tracking", function () {
  it("Should deploy and track gas usage", async function () {
    // 部署合约
    const counter = await ethers.deployContract("Counter");

    console.log("\n--- Gas Usage Report ---");

    // 测试 inc() 的 gas 消耗
    const tx1 = await counter.inc();
    const receipt1 = await tx1.wait();
    console.log(`inc() gas used: ${receipt1?.gasUsed.toString()}`);
    expect(receipt1?.gasUsed).to.be.greaterThan(0);

    // 测试 incBy() 的 gas 消耗
    const tx2 = await counter.incBy(5n);
    const receipt2 = await tx2.wait();
    console.log(`incBy(5) gas used: ${receipt2?.gasUsed.toString()}`);
    expect(receipt2?.gasUsed).to.be.greaterThan(0);

    // 验证状态
    const finalValue = await counter.x();
    console.log(`Final value: ${finalValue}`);

    // inc() + incBy(5) = 6
    expect(finalValue).to.equal(6n);
  });

  it("Should compare gas costs between operations", async function () {
    const counter = await ethers.deployContract("Counter");

    // 多次调用并收集 gas 数据
    const gasData = [];

    for (let i = 1; i <= 5; i++) {
      const tx = await counter.incBy(BigInt(i));
      const receipt = await tx.wait();
      gasData.push({
        operation: `incBy(${i})`,
        gasUsed: receipt?.gasUsed.toString(),
      });
    }

    console.log("\n--- Gas Comparison ---");
    console.table(gasData);
  });
});
