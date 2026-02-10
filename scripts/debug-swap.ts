import { network } from "hardhat";

/**
 * 调试 SwapExit 问题
 */

async function main() {
  const { ethers } = await network.connect();
  const [user] = await ethers.getSigners();
  console.log("🔍 调试 SwapExit 问题\n");

  // 合约地址
  const VAULT_ADDRESS = "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9";
  const MLST_ADDRESS = "0x856e4424f806D16E8CBC702B3c0F2ede5468eae5";
  const ROUTER_ADDRESS = "0xA51c1fc2f0D1a1b8494Ed1FE312d7C3a78Ed91C0";
  const PAIR_ADDRESS = "0x0DCd1Bf9A1b36cE34237eEaFef220932846BCD82";
  const WETH_ADDRESS = "0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e";
  const ORACLE_ADDRESS = "0x9A676e781A523b5d0C0e43731313A708CB607508";

  const vault = await ethers.getContractAt("LSTVault", VAULT_ADDRESS);
  const mlst = await ethers.getContractAt("LSTToken", MLST_ADDRESS);
  const router = await ethers.getContractAt("MockUniswapV2Router02", ROUTER_ADDRESS);
  const pair = await ethers.getContractAt("MockUniswapV2Pair", PAIR_ADDRESS);
  const weth = await ethers.getContractAt("MockERC20", WETH_ADDRESS);
  const oracle = await ethers.getContractAt("UniswapV2SpotOracle", ORACLE_ADDRESS);

  console.log("=" .repeat(70));
  console.log("📊 检查合约状态");
  console.log("=" .repeat(70));

  // 1. 检查 Router ETH 余额
  const routerEthBalance = await ethers.provider.getBalance(ROUTER_ADDRESS);
  console.log("Router ETH 余额:", ethers.formatEther(routerEthBalance));

  // 2. 检查 Pair 储备量
  const reserves = await pair.getReserves();
  console.log("\nPair 储备量:");
  console.log("  - Reserve0 (mLST):", ethers.formatEther(reserves[0]));
  console.log("  - Reserve1 (WETH):", ethers.formatEther(reserves[1]));

  // 3. 检查 Pair 的实际余额
  const pairMlstBalance = await mlst.balanceOf(PAIR_ADDRESS);
  const pairWethBalance = await weth.balanceOf(PAIR_ADDRESS);
  console.log("\nPair 实际余额:");
  console.log("  - mLST:", ethers.formatEther(pairMlstBalance));
  console.log("  - WETH:", ethers.formatEther(pairWethBalance));

  // 4. 检查 Oracle 报价
  const swapAmount = ethers.parseEther("10");
  try {
    const quote = await oracle.quoteEthOut(MLST_ADDRESS, swapAmount);
    console.log("\nOracle 报价 (10 mLST):", ethers.formatEther(quote), "ETH");
  } catch (error: any) {
    console.log("\n❌ Oracle 报价失败:", error.message);
  }

  // 5. 检查 Vault 配置
  const vaultRouter = await vault.router();
  const vaultOracle = await vault.oracle();
  const maxSlippage = await vault.maxSlippageBps();
  console.log("\nVault 配置:");
  console.log("  - Router:", vaultRouter);
  console.log("  - Oracle:", vaultOracle);
  console.log("  - Max Slippage:", maxSlippage.toString(), "bps");

  // 6. 尝试直接调用 router 计算
  console.log("\n=" .repeat(70));
  console.log("🧪 测试直接调用 Router");
  console.log("=" .repeat(70));
  
  try {
    // 检查 Router 是否设置了 Pair
    const routerPair = await router.pairs(MLST_ADDRESS);
    console.log("Router 的 Pair 设置:", routerPair);
    
    if (routerPair === ethers.ZeroAddress) {
      console.log("⚠️  警告: Router 没有设置 Pair！");
    }
  } catch (error: any) {
    console.log("❌ 检查 Router Pair 失败:", error.message);
  }

  console.log("\n✅ 调试完成");
}

main().catch(console.error);
