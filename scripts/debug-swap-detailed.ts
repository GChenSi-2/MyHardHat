import { network } from "hardhat";

/**
 * 详细调试 swapExit 流程
 */

async function main() {
  const { ethers } = await network.connect();
  const [user] = await ethers.getSigners();

  // 合约地址
  const VAULT_ADDRESS = "0xD8a5a9b31c3C0232E196d518E89Fd8bF83AcAd43";
  const MLST_ADDRESS = "0x285BcEFFE7558b6c73Cb0632dA1497D81A2810eE";
  const ROUTER_ADDRESS = "0x172076E0166D1F9Cc711C77Adf8488051744980C";
  const PAIR_ADDRESS = "0x4EE6eCAD1c2Dae9f525404De8555724e3c35d07B";
  const WETH_ADDRESS = "0xf4B146FbA71F41E0592668ffbF264F1D186b2Ca8";

  // 获取合约实例
  const vault = await ethers.getContractAt("LSTVault", VAULT_ADDRESS);
  const mlst = await ethers.getContractAt("LSTToken", MLST_ADDRESS);
  const router = await ethers.getContractAt("MockUniswapV2Router02", ROUTER_ADDRESS);
  const pair = await ethers.getContractAt("MockUniswapV2Pair", PAIR_ADDRESS);
  const weth = await ethers.getContractAt("MockERC20", WETH_ADDRESS);

  console.log("🔍 开始详细调试 swapExit...\n");

  // 1. 检查 Pair 的储备量
  console.log("📊 [1] 检查 Pair 储备量");
  const reserves = await pair.getReserves();
  console.log("   reserve0:", ethers.formatEther(reserves[0]));
  console.log("   reserve1:", ethers.formatEther(reserves[1]));
  
  const token0 = await pair.token0();
  const token1 = await pair.token1();
  console.log("   token0:", token0);
  console.log("   token1:", token1);
  console.log("   mLST:", MLST_ADDRESS);
  console.log("   WETH:", WETH_ADDRESS);
  
  const [mlstReserve, wethReserve] = token0 === MLST_ADDRESS 
    ? [reserves[0], reserves[1]]
    : [reserves[1], reserves[0]];
  console.log("   mLST reserve:", ethers.formatEther(mlstReserve));
  console.log("   WETH reserve:", ethers.formatEther(wethReserve), "\n");

  // 2. 检查 Router 余额
  console.log("📊 [2] 检查 Router 余额");
  const routerEthBalance = await ethers.provider.getBalance(ROUTER_ADDRESS);
  const routerWethBalance = await weth.balanceOf(ROUTER_ADDRESS);
  console.log("   Router ETH:", ethers.formatEther(routerEthBalance));
  console.log("   Router WETH:", ethers.formatEther(routerWethBalance), "\n");

  // 3. 检查用户 mLST 余额
  console.log("📊 [3] 检查用户 mLST 余额");
  const userMlstBalance = await mlst.balanceOf(user.address);
  console.log("   User mLST:", ethers.formatEther(userMlstBalance), "\n");

  // 4. 尝试直接测试 Router 的 swapExactTokensForETH
  console.log("🔧 [4] 直接测试 Router.swapExactTokensForETH");
  const swapAmount = ethers.parseEther("10");
  
  console.log("   ⚙️  授权 Router...");
  const approveTx = await mlst.approve(ROUTER_ADDRESS, swapAmount);
  await approveTx.wait();
  console.log("   ✅ 授权成功");

  const path = [MLST_ADDRESS, WETH_ADDRESS];
  const deadline = Math.floor(Date.now() / 1000) + 3600;

  console.log("   ⚙️  计算预期输出...");
  const exchangeRate = await router.exchangeRates(MLST_ADDRESS);
  console.log("   Exchange rate:", ethers.formatEther(exchangeRate));
  
  // 预期输出 = swapAmount * 1e18 / exchangeRate
  const expectedOut = swapAmount * BigInt(1e18) / exchangeRate;
  console.log("   Expected ETH out:", ethers.formatEther(expectedOut));
  
  console.log("\n   ⚙️  调用 Router.swapExactTokensForETH...");
  console.log("      - amountIn:", ethers.formatEther(swapAmount));
  console.log("      - amountOutMin:", ethers.formatEther(expectedOut));
  console.log("      - path:", path);
  console.log("      - to:", user.address);
  console.log("      - deadline:", deadline);
  
  try {
    const tx = await router.swapExactTokensForETH(
      swapAmount,
      expectedOut,
      path,
      user.address,
      deadline
    );
    console.log("   📝 Transaction hash:", tx.hash);
    
    console.log("   ⏳ 等待交易确认...");
    const receipt = await tx.wait();
    console.log("   ✅ 交易成功！");
    console.log("   ⛽ Gas used:", receipt.gasUsed.toString());
    
  } catch (error: any) {
    console.log("   ❌ 交易失败:");
    console.log(error);
    
    // 尝试静态调用获取更详细的错误
    try {
      await router.swapExactTokensForETH.staticCall(
        swapAmount,
        expectedOut,
        path,
        user.address,
        deadline
      );
    } catch (staticError: any) {
      console.log("\n   🔍 静态调用错误详情:");
      console.log(staticError);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
