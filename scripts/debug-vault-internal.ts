import { network } from "hardhat";

async function main() {
  const { ethers } = await network.connect();
  const [user] = await ethers.getSigners();

  const VAULT_ADDRESS = "0x5c74c94173F05dA1720953407cbb920F3DF9f887";
  const MLST_ADDRESS = "0x0F9019Dd30C7Cc5774d4883fba933aA0Caba9424";
  const ROUTER_ADDRESS = "0xF8e31cb472bc70500f08Cd84917E5A1912Ec8397";

  const vault = await ethers.getContractAt("LSTVault", VAULT_ADDRESS);
  const mlst = await ethers.getContractAt("LSTToken", MLST_ADDRESS);

  console.log("🔍 模拟 swapExit 的每一步操作...\n");

  // 准备
  const swapAmount = ethers.parseEther("10");
  const minOut = ethers.parseEther("0.01");
  const deadline = Math.floor(Date.now() / 1000) + 3600;

  // 检查初始余额
  console.log("📊 初始状态");
  const userMlstBefore = await mlst.balanceOf(user.address);
  const vaultMlstBefore = await mlst.balanceOf(VAULT_ADDRESS);
  console.log("   User mLST:", ethers.formatEther(userMlstBefore));
  console.log("   Vault mLST:", ethers.formatEther(vaultMlstBefore));
  console.log("");

  // Step 1: User 授权 Vault
  console.log("📍 [1] User 授权 Vault");
  const approveTx = await mlst.approve(VAULT_ADDRESS, swapAmount);
  await approveTx.wait();
  const allowance = await mlst.allowance(user.address, VAULT_ADDRESS);
  console.log("   ✅ Allowance:", ethers.formatEther(allowance));
  console.log("");

  // Step 2: 模拟 Vault 内部操作（手动执行）
  console.log("📍 [2] 模拟 Vault transferFrom");
  // 实际上 vault.swapExit 会调用 lst.transferFrom(msg.sender, address(this), sharesIn)
  // 我们用手动转账模拟
  const transferTx = await mlst.transfer(VAULT_ADDRESS, swapAmount);
  await transferTx.wait();
  
  const userMlstAfterTransfer = await mlst.balanceOf(user.address);
  const vaultMlstAfterTransfer = await mlst.balanceOf(VAULT_ADDRESS);
  console.log("   ✅ Transfer 完成");
  console.log("   User mLST:", ethers.formatEther(userMlstAfterTransfer));
  console.log("   Vault mLST:", ethers.formatEther(vaultMlstAfterTransfer));
  console.log("");

  // Step 3: Vault 授权 Router（需要模拟 Vault 的操作）
  console.log("📍 [3] 需要 Vault 授权 Router");
  console.log("   ⚠️  我们无法直接从 Vault 发起交易");
  console.log("   ⚠️  这就是 swapExit 失败的原因！");
  console.log("");

  // 让我们尝试直接调用 swapExit 看看能否捕获更详细的错误
  console.log("📍 [4] 尝试调用 swapExit (应该失败)");
  try {
    // 重新授权（因为我们刚才手动 transfer 了）
    const reapproveTx = await mlst.approve(VAULT_ADDRESS, swapAmount);
    await reapproveTx.wait();

    const tx = await vault.swapExit.staticCall(swapAmount, minOut, deadline);
    console.log("   ✅ Static call 成功!");
    console.log("   返回值:", ethers.formatEther(tx));
  } catch (error: any) {
    console.log("   ❌ Static call 失败");
    
    // 尝试提取错误信息
    const errorMessage = error.message || error.toString();
    console.log("   Error:", errorMessage);
    
    // 如果是 revert，尝试解析 revert 原因
    if (error.data) {
      console.log("   Error data:", error.data);
    }
    
    // 尝试手动调用 Router 看看具体哪里出错
    console.log("\n📍 [5] 手动测试 Vault → Router 调用");
    
    // 模拟 Vault 调用 Router（但我们无法用 impersonateAccount 在 localhost）
    // 所以让我们检查 Vault 合约本身是否有问题
    
    console.log("   检查 Vault 配置:");
    const vaultRouter = await vault.router();
    const vaultOracle = await vault.oracle();
    const vaultMaxSlippage = await vault.maxSlippageBps();
    console.log("   - Router:", vaultRouter);
    console.log("   - Oracle:", vaultOracle);
    console.log("   - Max slippage:", vaultMaxSlippage.toString(), "bps");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
