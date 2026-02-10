import { network } from "hardhat";

/**
 * 部署完整的 Staking 项目
 * 步骤：
 * 1. 部署 LSTVault(admin, treasury) - 同时部署 mLST Token
 * 2. 部署 MockERC20 作为测试用的 Staking Token (TST)
 * 3. 部署 MockStakingAdapter(stakingToken=TST, rewardToken=mLST) 并设置到 vault
 * 4. 部署 MockERC20 作为 WETH
 * 5. 部署 MockUniswapV2Router02 (使用 WETH)
 * 6. 部署 MockUniswapV2Pair (mLST/WETH)
 * 7. 部署 UniswapV2SpotOracle(pair, WETH) 并设置到 vault
 * 8. 设置 Router 到 vault
 * 9. 创建 mLST/WETH 池子并添加流动性
 */

async function main() {
  const { ethers } = await network.connect();
  const [deployer] = await ethers.getSigners();
  console.log("🚀 开始部署 Staking 项目...");
  console.log("📍 部署账户:", deployer.address);
  console.log("💰 账户余额:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

  // ========================================
  // 步骤 1: 部署 LSTVault
  // ========================================
  console.log("📦 [1/7] 部署 LSTVault...");
  const admin = deployer.address;
  const treasury = deployer.address; // 可以设置为其他地址
  
  const LSTVault = await ethers.getContractFactory("LSTVault");
  const vault = await LSTVault.deploy(admin, treasury);
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log("✅ LSTVault 部署成功:", vaultAddress);
  
  // 获取 LST Token 地址
  const lstTokenAddress = await vault.lst();
  console.log("   📝 mLST Token:", lstTokenAddress, "\n");

  // ========================================
  // 步骤 2: 部署 MockERC20 (Staking Token - WETH)
  // ========================================
  console.log("📦 [2/7] 部署 MockERC20 (Local WETH)...");
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const stakingToken = await MockERC20.deploy("Wrapped Ether", "WETH", 18);
  await stakingToken.waitForDeployment();
  const stakingTokenAddress = await stakingToken.getAddress();
  console.log("✅ Local WETH 部署成功:", stakingTokenAddress, "\n");
  
  // 使用本地 WETH 作为 Staking Token
  // const stakingTokenAddress = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9"; 
  // console.log("👉 使用本地 WETH 作为 Staking Token:", stakingTokenAddress, "\n");
  
  // 使用本地 WETH 作为 Staking Token
  // const stakingTokenAddress = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9"; 
  // console.log("👉 使用本地 WETH 作为 Staking Token:", stakingTokenAddress, "\n");


  // ========================================
  // 步骤 3: 部署 MockStakingAdapter (使用 LSTToken 作为 reward)
  // ========================================
  console.log("📦 [3/7] 部署 MockStakingAdapter...");
  const MockStakingAdapter = await ethers.getContractFactory("MockStakingAdapter");
  
  // stakingToken: MockERC20 (TST)
  // rewardToken: LSTToken (mLST)
  const adapter = await MockStakingAdapter.deploy(stakingTokenAddress, lstTokenAddress);
  await adapter.waitForDeployment();
  const adapterAddress = await adapter.getAddress();
  console.log("✅ MockStakingAdapter 部署成功:", adapterAddress);
  console.log("   📝 Staking Token (TST):", stakingTokenAddress);
  console.log("   📝 Reward Token (mLST):", lstTokenAddress);
  
  // 设置奖励率（每秒 1 mLST）
  console.log("   ⚙️  设置奖励率为每秒 1 mLST...");
  const rewardRateTx = await adapter.setRewardRate(ethers.parseEther("1"));
  await rewardRateTx.wait();
  
  // 获取 LSTToken 合约实例
  const LSTToken = await ethers.getContractFactory("LSTToken");
  const lstToken = LSTToken.attach(lstTokenAddress);
  
  // 给 Adapter 铸造 mLST 作为奖励池
  // 注意：deployer 需要先 deposit 获得 DEFAULT_ADMIN_ROLE，或者直接使用 vault 的 mint
  console.log("   💰 给 Adapter 铸造 100,000 mLST 作为奖励池...");
  
  // 方式1：先 deposit 一点 ETH 到 vault（这会给 deployer 铸造一些 mLST）
  const depositTx = await vault.deposit({ value: ethers.parseEther("100.1") });
  await depositTx.wait();
  
  // 现在 deployer 有 mLST 了，可以转给 Adapter
  const deployerBalance = await lstToken.balanceOf(deployer.address);
  console.log("   📊 Deployer mLST 余额:", ethers.formatEther(deployerBalance));
  
  const transferTx = await lstToken.transfer(adapterAddress, ethers.parseEther("100000"));
  await transferTx.wait();
  console.log("   ✅ 奖励池充值成功");
  // console.log("   📊 Deployer 自动获得 10,000,000 TST（构造函数铸造）");
  
  // 将 adapter 设置到 vault
  console.log("   ⚙️  设置 Adapter 到 Vault...");
  const setAdapterTx = await vault.setAdapter(adapterAddress);
  await setAdapterTx.wait();
  console.log("   ✅ Adapter 设置成功\n");

  // ========================================
  // 步骤 4: 部署 MockERC20 作为 WETH
  // ========================================
  /*
  console.log("📦 [4/8] 部署 MockERC20 (WETH)...");
  const MockWETH = await ethers.getContractFactory("MockERC20");
  const weth = await MockWETH.deploy("Wrapped Ether", "WETH", 18);
  await weth.waitForDeployment();
  const wethAddress = await weth.getAddress();
  console.log("✅ MockERC20 (WETH) 部署成功:", wethAddress, "\n");
  */
  // 使用相同的 WETH 地址
  const wethAddress = stakingTokenAddress;
  const weth = await ethers.getContractAt("MockERC20", wethAddress);

  // ========================================
  // 步骤 5: 部署 MockUniswapV2Router02
  // ========================================
  console.log("📦 [5/8] 部署 MockUniswapV2Router02...");
  const MockRouter = await ethers.getContractFactory("MockUniswapV2Router02");
  const router = await MockRouter.deploy(wethAddress);
  await router.waitForDeployment();
  const routerAddress = await router.getAddress();
  console.log("✅ MockUniswapV2Router02 部署成功:", routerAddress, "\n");

  // ========================================
  // 步骤 6: 部署 MockUniswapV2Pair (mLST/WETH)
  // ========================================
  console.log("📦 [6/8] 部署 MockUniswapV2Pair (mLST/WETH)...");
  const MockPair = await ethers.getContractFactory("MockUniswapV2Pair");
  const pair = await MockPair.deploy(lstTokenAddress, wethAddress);
  await pair.waitForDeployment();
  const pairAddress = await pair.getAddress();
  console.log("✅ MockUniswapV2Pair 部署成功:", pairAddress, "\n");

  // ========================================
  // 步骤 7: 部署 UniswapV2SpotOracle 并设置到 vault
  // ========================================
  console.log("📦 [7/8] 部署 UniswapV2SpotOracle...");
  const Oracle = await ethers.getContractFactory("UniswapV2SpotOracle");
  const oracle = await Oracle.deploy(pairAddress, wethAddress);
  await oracle.waitForDeployment();
  const oracleAddress = await oracle.getAddress();
  console.log("✅ UniswapV2SpotOracle 部署成功:", oracleAddress);
  
  console.log("   ⚙️  设置 Oracle 到 Vault...");
  const setOracleTx = await vault.setOracle(oracleAddress);
  await setOracleTx.wait();
  console.log("   ✅ Oracle 设置成功\n");

  // ========================================
  // 步骤 8: 设置 Router 到 vault
  // ========================================
  console.log("⚙️  [8/8] 设置 Router 到 Vault...");
  const setRouterTx = await vault.setRouter(routerAddress);
  await setRouterTx.wait();
  console.log("✅ Router 设置成功\n");

  // ========================================
  // 步骤 9: 创建 mLST/WETH 池子并添加流动性
  // ========================================
  console.log("💧 [9/9] 设置 mLST/WETH 池子流动性...");
  
  // 转入实际的代币到 Pair（模拟添加流动性）
  const liquidityMlst = ethers.parseEther("100"); // 100 mLST
  const liquidityWeth = ethers.parseEther("1");   // 1 WETH
  
  console.log("   💰 给 Pair 转入流动性...");
  console.log("      - mLST:", ethers.formatEther(liquidityMlst));
  console.log("      - WETH:", ethers.formatEther(liquidityWeth));
  
  // 转入 mLST 到 Pair
  const transferMlstTx = await lstToken.transfer(pairAddress, liquidityMlst);
  await transferMlstTx.wait();
  
  // 转入 WETH 到 Pair
  const transferWethTx = await weth.transfer(pairAddress, liquidityWeth);
  await transferWethTx.wait();
  
  // 设置储备量（让 Pair 知道当前的储备）
  const setReservesTx = await pair.setReserves(liquidityMlst, liquidityWeth);
  await setReservesTx.wait();
  console.log("   ✅ 流动性添加成功");
  
  // 设置 Router 的 Pair 地址（让 Router 使用 Pair 的储备量计算价格）
  console.log("   ⚙️  设置 Router 的 Pair 地址...");
  const setPairTx = await router.setPair(lstTokenAddress, pairAddress);
  await setPairTx.wait();
  console.log("   ✅ Pair 地址设置成功");
  
  // 备用方案：也设置汇率（如果 Pair 不可用时使用）
  const exchangeRate = ethers.parseEther("100"); // 100 mLST = 1 ETH
  console.log("   ⚙️  设置备用汇率: 100 mLST = 1 ETH");
  const setRateTx = await router.setExchangeRate(lstTokenAddress, exchangeRate);
  await setRateTx.wait();
  console.log("   ✅ 备用汇率设置成功");
  
  // 给 Router 充值一些 ETH 用于测试 swap
  console.log("   💰 给 Router 充值 10 ETH...");
  const fundTx = await deployer.sendTransaction({
    to: routerAddress,
    value: ethers.parseEther("10")
  });
  await fundTx.wait();
  console.log("   ✅ Router 充值成功\n");

  // ========================================
  // 部署完成，打印摘要
  // ========================================
  console.log("=" .repeat(70));
  console.log("🎉 部署完成！合约地址汇总：");
  console.log("=" .repeat(70));
  console.log("LSTVault:              ", vaultAddress);
  console.log("mLST Token (Reward):   ", lstTokenAddress);
  console.log("TST Token (Staking):   ", stakingTokenAddress);
  console.log("MockStakingAdapter:    ", adapterAddress);
  console.log("MockUniswapV2Router02: ", routerAddress);
  console.log("MockUniswapV2Pair:     ", pairAddress);
  console.log("UniswapV2SpotOracle:   ", oracleAddress);
  console.log("WETH Address:          ", wethAddress);
  console.log("=" .repeat(70));
  console.log("\n💡 提示：");
  console.log("1. 用户可以通过 vault.deposit() 存入 ETH 并获得 mLST");
  console.log("2. 用户可以通过 vault.swapExit() 将 mLST 兑换为 ETH");
  console.log("3. Adapter 使用 TST 作为质押代币，mLST 作为奖励代币");
  console.log("4. Adapter 奖励率：每秒 1 mLST，奖励池：100,000 mLST");
  console.log("5. Router 使用 Pair 储备量计算价格（恒定乘积公式）");
  console.log("6. 流动性池比率: 100 mLST = 1 WETH\n");

  return {
    vault: vaultAddress,
    lstToken: lstTokenAddress,
    stakingToken: stakingTokenAddress,
    adapter: adapterAddress,
    router: routerAddress,
    pair: pairAddress,
    oracle: oracleAddress,
    weth: wethAddress
  };
}

// 执行部署
main()
  .then((addresses) => {
    console.log("✅ 脚本执行成功！");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ 部署失败:", error);
    process.exit(1);
  });
