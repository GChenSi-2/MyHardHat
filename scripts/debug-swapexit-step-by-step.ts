import { network } from "hardhat";

async function main() {
  const { ethers } = await network.connect();
  const [user] = await ethers.getSigners();

  const VAULT_ADDRESS = "0x5c74c94173F05dA1720953407cbb920F3DF9f887";
  const MLST_ADDRESS = "0x0F9019Dd30C7Cc5774d4883fba933aA0Caba9424";
  const ROUTER_ADDRESS = "0xF8e31cb472bc70500f08Cd84917E5A1912Ec8397";

  const vault = await ethers.getContractAt("LSTVault", VAULT_ADDRESS);
  const mlst = await ethers.getContractAt("LSTToken", MLST_ADDRESS);
  const router = await ethers.getContractAt("MockUniswapV2Router02", ROUTER_ADDRESS);

  console.log("🧪 测试 swapExit 每一步...\n");

  // Step 1: 检查初始余额
  console.log("📊 [1] 初始余额");
  const userEthBefore = await ethers.provider.getBalance(user.address);
  const userMlstBefore = await mlst.balanceOf(user.address);
  console.log("   User ETH:", ethers.formatEther(userEthBefore));
  console.log("   User mLST:", ethers.formatEther(userMlstBefore));
  console.log("");

  // Step 2: 存款获得 mLST
  console.log("📊 [2] Deposit 获得 mLST");
  try {
    const depositTx = await vault.deposit({ value: ethers.parseEther("1") });
    await depositTx.wait();
    const userMlstAfterDeposit = await mlst.balanceOf(user.address);
    console.log("   ✅ Deposit 成功!");
    console.log("   User mLST:", ethers.formatEther(userMlstAfterDeposit));
    console.log("");
  } catch (error: any) {
    console.log("   ❌ Deposit 失败:", error.message);
    return;
  }

  // Step 3: 检查 oracle quote
  console.log("📊 [3] 检查 Oracle Quote");
  try {
    const oracleAddress = await vault.oracle();
    const oracle = await ethers.getContractAt("UniswapV2SpotOracle", oracleAddress);
    const swapAmount = ethers.parseEther("10");
    const quote = await oracle.quoteEthOut(MLST_ADDRESS, swapAmount);
    console.log("   Oracle quote for 10 mLST:", ethers.formatEther(quote), "ETH");
    
    const maxSlippageBps = await vault.maxSlippageBps();
    const floor = quote * (10000n - maxSlippageBps) / 10000n;
    console.log("   Max slippage:", maxSlippageBps.toString(), "bps");
    console.log("   Floor (minOut):", ethers.formatEther(floor), "ETH");
    console.log("");
  } catch (error: any) {
    console.log("   ❌ Oracle quote 失败:", error.message);
    console.log("");
  }

  // Step 4: 授权 Vault
  console.log("📊 [4] 授权 Vault");
  try {
    const swapAmount = ethers.parseEther("10");
    const approveTx = await mlst.approve(VAULT_ADDRESS, swapAmount);
    await approveTx.wait();
    console.log("   ✅ 授权成功!");
    console.log("");
  } catch (error: any) {
    console.log("   ❌ 授权失败:", error.message);
    return;
  }

  // Step 5: 测试 Router 的计算
  console.log("📊 [5] 测试 Router 计算");
  try {
    const exchangeRate = await router.exchangeRates(MLST_ADDRESS);
    console.log("   Exchange rate:", ethers.formatEther(exchangeRate), "mLST per ETH");
    
    const swapAmount = ethers.parseEther("10");
    const expectedOut = swapAmount * BigInt(1e18) / exchangeRate;
    console.log("   Expected out for 10 mLST:", ethers.formatEther(expectedOut), "ETH");
    
    const routerBalance = await ethers.provider.getBalance(ROUTER_ADDRESS);
    console.log("   Router ETH balance:", ethers.formatEther(routerBalance), "ETH");
    console.log("");
  } catch (error: any) {
    console.log("   ❌ Router 计算失败:", error.message);
    console.log("");
  }

  // Step 6: 直接测试 Router.swapExactTokensForETH
  console.log("📊 [6] 直接调用 Router.swapExactTokensForETH");
  try {
    const swapAmount = ethers.parseEther("10");
    
    // 再次授权 Router
    console.log("   ⚙️  授权 Router...");
    const approveRouterTx = await mlst.approve(ROUTER_ADDRESS, swapAmount);
    await approveRouterTx.wait();
    console.log("   ✅ 授权成功");

    const path = [MLST_ADDRESS, await router.WETH()];
    const deadline = Math.floor(Date.now() / 1000) + 3600;
    const minOut = ethers.parseEther("0.01"); // 很低的 minOut 避免slippage问题

    console.log("   ⚙️  调用 swapExactTokensForETH...");
    const swapTx = await router.swapExactTokensForETH(
      swapAmount,
      minOut,
      path,
      user.address,
      deadline
    );
    const receipt = await swapTx.wait();
    console.log("   ✅ Swap 成功!");
    console.log("   Gas used:", receipt.gasUsed.toString());
    
    const userEthAfter = await ethers.provider.getBalance(user.address);
    const userMlstAfter = await mlst.balanceOf(user.address);
    console.log("   User ETH after:", ethers.formatEther(userEthAfter));
    console.log("   User mLST after:", ethers.formatEther(userMlstAfter));
    console.log("");

    console.log("✅ 直接调用 Router 成功！现在测试 Vault.swapExit");
  } catch (error: any) {
    console.log("   ❌ Swap 失败:", error.message);
    console.log(error);
    return;
  }

  // Step 7: 测试 Vault.swapExit
  console.log("\n📊 [7] 测试 Vault.swapExit");
  try {
    const swapAmount = ethers.parseEther("10");
    const minOut = ethers.parseEther("0.01");
    const deadline = Math.floor(Date.now() / 1000) + 3600;

    // 重新授权
    console.log("   ⚙️  授权 Vault...");
    const approveVaultTx = await mlst.approve(VAULT_ADDRESS, swapAmount);
    await approveVaultTx.wait();
    console.log("   ✅ 授权成功");

    console.log("   ⚙️  调用 swapExit...");
    const swapExitTx = await vault.swapExit(swapAmount, minOut, deadline);
    const receipt = await swapExitTx.wait();
    console.log("   ✅ SwapExit 成功!");
    console.log("   Gas used:", receipt.gasUsed.toString());
  } catch (error: any) {
    console.log("   ❌ SwapExit 失败:", error.message);
    console.log(error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
