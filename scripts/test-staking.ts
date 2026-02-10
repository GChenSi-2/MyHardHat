import { network } from "hardhat";

/**
 * 测试 Staking 系统
 * 演示完整的 stake -> 等待奖励 -> 提取奖励流程
 */

async function main() {
  const { ethers } = await network.connect();
  const [user] = await ethers.getSigners();
  console.log("🧪 开始测试 Staking 系统...");
  console.log("👤 测试账户:", user.address);
  console.log("💰 账户余额:", ethers.formatEther(await ethers.provider.getBalance(user.address)), "ETH\n");

  // ========================================
  // 配置：填入部署的合约地址
  // ========================================
  const VAULT_ADDRESS = "0x8bEe2037448F096900Fd9affc427d38aE6CC0350";
  const MLST_ADDRESS = "0x72A2e04a66336BC6A394a7808402968D65e9335A";
  const TST_ADDRESS = "0x942ED2fa862887Dc698682cc6a86355324F0f01e";
  const ADAPTER_ADDRESS = "0x8D81A3DCd17030cD5F23Ac7370e4Efb10D2b3cA4";
  const ROUTER_ADDRESS = "0x0aec7c174554AF8aEc3680BB58431F6618311510";
  const PAIR_ADDRESS = "0x8e264821AFa98DD104eEcfcfa7FD9f8D8B320adA";

  // 获取合约实例
  const vault = await ethers.getContractAt("LSTVault", VAULT_ADDRESS);
  const mlst = await ethers.getContractAt("LSTToken", MLST_ADDRESS);
  const tst = await ethers.getContractAt("MockERC20", TST_ADDRESS);
  const adapter = await ethers.getContractAt("MockStakingAdapter", ADAPTER_ADDRESS);

  console.log("=" .repeat(70));
  console.log("📊 初始状态");
  console.log("=" .repeat(70));
  
  const tstBalance = await tst.balanceOf(user.address);
  const mlstBalance = await mlst.balanceOf(user.address);
  console.log("TST 余额:", ethers.formatEther(tstBalance));
  console.log("mLST 余额:", ethers.formatEther(mlstBalance));
  console.log();

  // ========================================
  // 步骤 1: Stake TST 到 Adapter
  // ========================================
  console.log("=" .repeat(70));
  console.log("📍 步骤 1: 质押 TST 到 Adapter");
  console.log("=" .repeat(70));

  const stakeAmount = ethers.parseEther("1000"); // 质押 1000 TST
  console.log("💰 质押数量:", ethers.formatEther(stakeAmount), "TST");

  // 授权 Adapter 使用 TST
  console.log("⚙️  授权 Adapter...");
  const approveTx = await tst.approve(ADAPTER_ADDRESS, stakeAmount);
  await approveTx.wait();
  console.log("✅ 授权成功");

  // 质押
  console.log("⚙️  质押中...");
  const stakeTx = await adapter.stake(stakeAmount);
  await stakeTx.wait();
  console.log("✅ 质押成功！\n");

  // 查看质押状态
  const stakedBalance = await adapter.stakedBalanceOf(user.address);
  console.log("📊 已质押:", ethers.formatEther(stakedBalance), "TST");
  console.log();

  // ========================================
  // 步骤 2: 等待一段时间积累奖励
  // ========================================
  console.log("=" .repeat(70));
  console.log("⏳ 步骤 2: 等待奖励积累（模拟 10 秒）");
  console.log("=" .repeat(70));
  
  console.log("⏰ 等待 10 秒...");
  await new Promise(resolve => setTimeout(resolve, 10000));
  
  // 在本地链上手动推进时间
  await ethers.provider.send("evm_increaseTime", [10]);
  await ethers.provider.send("evm_mine", []);
  
  console.log("✅ 时间已过 10 秒\n");

  // ========================================
  // 步骤 3: 查看累积的奖励
  // ========================================
  console.log("=" .repeat(70));
  console.log("💎 步骤 3: 查看累积的奖励");
  console.log("=" .repeat(70));
  
  const earned = await adapter.earned(user.address);
  console.log("🎁 累积奖励:", ethers.formatEther(earned), "mLST");
  console.log("   (每秒 1 mLST × 10 秒 = 约 10 mLST)\n");

  // ========================================
  // 步骤 4: 领取奖励
  // ========================================
  console.log("=" .repeat(70));
  console.log("🎉 步骤 4: 领取奖励");
  console.log("=" .repeat(70));
  
  const mlstBefore = await mlst.balanceOf(user.address);
  console.log("领取前 mLST 余额:", ethers.formatEther(mlstBefore));
  
  console.log("⚙️  领取中...");
  const claimTx = await adapter.claimRewards();
  await claimTx.wait();
  console.log("✅ 领取成功！");
  
  const mlstAfter = await mlst.balanceOf(user.address);
  const claimed = mlstAfter - mlstBefore;
  console.log("领取后 mLST 余额:", ethers.formatEther(mlstAfter));
  console.log("🎁 实际领取:", ethers.formatEther(claimed), "mLST\n");

  // ========================================
  // 步骤 5: 取消质押
  // ========================================
  console.log("=" .repeat(70));
  console.log("🔙 步骤 5: 取消质押");
  console.log("=" .repeat(70));
  
  const unstakeAmount = ethers.parseEther("500"); // 取消质押 500 TST
  console.log("💰 取消质押数量:", ethers.formatEther(unstakeAmount), "TST");
  
  console.log("⚙️  取消质押中...");
  const unstakeTx = await adapter.unstake(unstakeAmount);
  await unstakeTx.wait();
  console.log("✅ 取消质押成功！");
  
  const stakedAfter = await adapter.stakedBalanceOf(user.address);
  console.log("📊 剩余质押:", ethers.formatEther(stakedAfter), "TST\n");

  // ========================================
  // 步骤 6: 测试 Vault Deposit
  // ========================================
  console.log("=" .repeat(70));
  console.log("🏦 步骤 6: 测试 Vault Deposit (存入 ETH 获得 mLST)");
  console.log("=" .repeat(70));
  
  const depositAmount = ethers.parseEther("1"); // 存入 1 ETH
  console.log("💰 存入数量:", ethers.formatEther(depositAmount), "ETH");
  
  const mlstBeforeDeposit = await mlst.balanceOf(user.address);
  console.log("存入前 mLST 余额:", ethers.formatEther(mlstBeforeDeposit));
  
  console.log("⚙️  存入中...");
  const depositTx = await vault.deposit({ value: depositAmount });
  await depositTx.wait();
  console.log("✅ 存入成功！");
  
  const mlstAfterDeposit = await mlst.balanceOf(user.address);
  const mintedShares = mlstAfterDeposit - mlstBeforeDeposit;
  console.log("存入后 mLST 余额:", ethers.formatEther(mlstAfterDeposit));
  console.log("🎁 获得 mLST:", ethers.formatEther(mintedShares), "mLST\n");

  // ========================================
  // 步骤 7: 测试 Swap Exit (将 mLST 换为 ETH)
  // ========================================
  console.log("=" .repeat(70));
  console.log("🔄 步骤 7: 测试 Swap Exit (将 mLST 换为 ETH)");
  console.log("=" .repeat(70));
  
  // 增加流动性以降低滑点
  console.log("💧 增加流动性...");
  const router = await ethers.getContractAt("MockUniswapV2Router02", ROUTER_ADDRESS);
  const wethAddress = await router.WETH();
  const weth = await ethers.getContractAt("MockERC20", wethAddress);
  const pair = await ethers.getContractAt("MockUniswapV2Pair", PAIR_ADDRESS);

  const addMlst = ethers.parseEther("10000"); // 增加 10,000 mLST
  const addWeth = ethers.parseEther("100");   // 增加 100 WETH

  await mlst.transfer(PAIR_ADDRESS, addMlst);
  await weth.transfer(PAIR_ADDRESS, addWeth);
  
  // 更新 MockPair 的储备量
  const balance0 = await mlst.balanceOf(PAIR_ADDRESS);
  const balance1 = await weth.balanceOf(PAIR_ADDRESS);
  await pair.setReserves(balance0, balance1);
  console.log("✅ 流动性已增加: Pool has", ethers.formatEther(balance0), "mLST +", ethers.formatEther(balance1), "WETH\n");

  const swapAmount = ethers.parseEther("10"); // 交换 10 mLST
  console.log("💰 交换数量:", ethers.formatEther(swapAmount), "mLST");
  
  // 授权 Vault 使用 mLST
  console.log("⚙️  授权 Vault...");
  const approveVaultTx = await mlst.approve(VAULT_ADDRESS, swapAmount);
  await approveVaultTx.wait();
  console.log("✅ 授权成功");
  
  const ethBefore = await ethers.provider.getBalance(user.address);
  // ... rest of the code updated correctly below
  const mlstBeforeSwap = await mlst.balanceOf(user.address);
  
  console.log("交换前 ETH 余额:", ethers.formatEther(ethBefore));
  console.log("交换前 mLST 余额:", ethers.formatEther(mlstBeforeSwap));
  
  console.log("⚙️  交换中...");
  const deadline = Math.floor(Date.now() / 1000) + 3600; // 1小时后过期
  
  const oracleAddress = await vault.oracle();
  const oracle = await ethers.getContractAt("UniswapV2SpotOracle", oracleAddress);
  const quote = await oracle.quoteEthOut(MLST_ADDRESS, swapAmount);
  const minEthOut = quote * 9800n / 10000n;
  
  console.log(`  Oracle quote: ${ethers.formatEther(quote)} ETH`);
  console.log(`  Setting minEthOut: ${ethers.formatEther(minEthOut)} ETH`);
  
  const swapTx = await vault.swapExit(
    swapAmount,
    minEthOut,
    deadline
  );
  const receipt = await swapTx.wait();
  console.log("✅ 交换成功！");
  
  const ethAfter = await ethers.provider.getBalance(user.address);
  const mlstAfterSwap = await mlst.balanceOf(user.address);
  
  // 计算实际获得的 ETH（减去 gas 费）
  let ethReceived = 0n;
  if(receipt) {
    const gasUsed = receipt.gasUsed * receipt.gasPrice;
    ethReceived = ethAfter - ethBefore + gasUsed;
  }
  
  console.log("交换后 ETH 余额:", ethers.formatEther(ethAfter));
  console.log("交换后 mLST 余额:", ethers.formatEther(mlstAfterSwap));
  console.log("🎁 实际获得 ETH:", ethers.formatEther(ethReceived), "ETH");
  console.log("   (10 mLST / 100 ≈ 0.1 ETH, 考虑滑点)\n");

  // ========================================
  // 最终状态
  // ========================================
  console.log("=" .repeat(70));
  console.log("🏁 最终状态");
  console.log("=" .repeat(70));
  
  const finalTst = await tst.balanceOf(user.address);
  const finalMlst = await mlst.balanceOf(user.address);
  const finalStaked = await adapter.stakedBalanceOf(user.address);
  const finalEarned = await adapter.earned(user.address);
  
  console.log("TST 余额:", ethers.formatEther(finalTst));
  console.log("mLST 余额:", ethers.formatEther(finalMlst));
  console.log("已质押 TST:", ethers.formatEther(finalStaked));
  console.log("待领取奖励:", ethers.formatEther(finalEarned), "mLST");
  console.log();

  console.log("✅ 测试完成！");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ 测试失败:", error);
    process.exit(1);
  });
