import { network } from "hardhat";

const { ethers } = await network.connect();

async function main() {
  console.log("\n=== Deploying with Gas Tracking ===\n");

  // 获取初始区块号
  const startBlock = await ethers.provider.getBlockNumber();
  
  // 部署合约
  console.log("🚀 Deploying Counter...");
  const counter = await ethers.deployContract("Counter");
  await counter.waitForDeployment();
  
  const address = await counter.getAddress();
  console.log(`✅ Counter deployed to: ${address}\n`);
  
  // 执行操作并追踪 gas
  console.log("📝 Executing operations...\n");
  
  const operations = [];
  
  // Operation 1: inc()
  const tx1 = await counter.inc();
  const receipt1 = await tx1.wait();
  operations.push({
    "Operation": "inc()",
    "Gas Used": receipt1?.gasUsed.toString() || "0",
    "TX Hash": tx1.hash.slice(0, 16) + "..."
  });
  
  // Operation 2: incBy(5)
  const tx2 = await counter.incBy(5n);
  const receipt2 = await tx2.wait();
  operations.push({
    "Operation": "incBy(5)",
    "Gas Used": receipt2?.gasUsed.toString() || "0",
    "TX Hash": tx2.hash.slice(0, 16) + "..."
  });
  
  // Operation 3: incBy(10)
  const tx3 = await counter.incBy(10n);
  const receipt3 = await tx3.wait();
  operations.push({
    "Operation": "incBy(10)",
    "Gas Used": receipt3?.gasUsed.toString() || "0",
    "TX Hash": tx3.hash.slice(0, 16) + "..."
  });
  
  const endBlock = await ethers.provider.getBlockNumber();
  
  // 显示 gas 报告
  console.log("⛽ Gas Usage Report:");
  console.log("─".repeat(80));
  console.table(operations);
  
  // 计算总 gas
  const totalGas = operations.reduce((sum, op) => sum + BigInt(op["Gas Used"]), 0n);
  console.log("─".repeat(80));
  console.log(`\n💰 Total Gas Used: ${totalGas.toString()}`);
  
  // 验证最终状态
  const finalValue = await counter.x();
  console.log(`📊 Final Counter Value: ${finalValue.toString()}`);
  console.log(`📦 Blocks: ${startBlock} → ${endBlock}\n`);
  
  // 估算成本
  const gasPrice = 20n; // 20 gwei
  const costInGwei = totalGas * gasPrice;
  const costInEth = Number(costInGwei) / 1e9;
  console.log(`💵 Estimated Cost (at 20 gwei): ${costInEth.toFixed(6)} ETH\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
