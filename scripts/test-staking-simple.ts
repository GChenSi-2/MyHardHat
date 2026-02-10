import { network } from "hardhat";

/**
 * 简单测试：只测试 Stake 基本功能
 */

async function main() {
  const { ethers } = await network.connect(); 
  const [user] = await ethers.getSigners();
  console.log("🧪 简单 Stake 测试");
  console.log("👤 账户:", user.address);
  console.log();

  // 合约地址
  const TST_ADDRESS = "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707";
  const MLST_ADDRESS = "0x856e4424f806D16E8CBC702B3c0F2ede5468eae5";
  const ADAPTER_ADDRESS = "0x0165878A594ca255338adfa4d48449f69242Eb8F";

  const tst = await ethers.getContractAt("MockERC20", TST_ADDRESS);
  const mlst = await ethers.getContractAt("LSTToken", MLST_ADDRESS);
  const adapter = await ethers.getContractAt("MockStakingAdapter", ADAPTER_ADDRESS);

  console.log("📊 初始余额:");
  console.log("TST:", ethers.formatEther(await tst.balanceOf(user.address)));
  console.log("mLST:", ethers.formatEther(await mlst.balanceOf(user.address)));
  console.log();

  // Stake
  console.log("📍 Stake 1000 TST:");
  const stakeAmount = ethers.parseEther("1000");
  await (await tst.approve(ADAPTER_ADDRESS, stakeAmount)).wait();
  console.log("✅ 授权完成");
  
  await (await adapter.stake(stakeAmount)).wait();
  console.log("✅ 质押完成");
  console.log("已质押:", ethers.formatEther(await adapter.stakedBalanceOf(user.address)), "TST");
  console.log();

  // 等待 20 秒
  console.log("⏰ 等待 20 秒积累奖励...");
  await new Promise(r => setTimeout(r, 20000));
  await ethers.provider.send("evm_increaseTime", [20]);
  await ethers.provider.send("evm_mine", []);
  
  const earned = await adapter.earned(user.address);
  console.log("💎 累积奖励:", ethers.formatEther(earned), "mLST");
  console.log();

  // 领取奖励
  console.log("🎁 领取奖励:");
  await (await adapter.claimRewards()).wait();
  console.log("✅ 领取完成");
  console.log("mLST 余额:", ethers.formatEther(await mlst.balanceOf(user.address)));
  console.log();

  console.log("✅ 测试完成！");
}

main().catch(console.error);
