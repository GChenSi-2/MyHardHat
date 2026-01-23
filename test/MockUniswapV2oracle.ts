import { expect } from "chai";
import { network } from "hardhat";
const { ethers } = await network.connect();

describe("UniswapV2Oracle", function () {
  it("Should quote ETH correctly", async function () {
    console.log("\n=== Starting UniswapV2Oracle Test ===\n");
    
    
    const [deployer] = await ethers.getSigners();
    console.log("✓ Deployer address:", deployer.address);
    
    // 定义 decimals
    const wethDecimals = 18;
    const tokenDecimals = 6; // 例如 USDC
    
    // 1. 部署 Mock 代币
    console.log("\n--- Step 1: Deploying Mock Tokens ---");
    const LSTToken = await ethers.getContractFactory("LSTToken");
    
    const weth = await LSTToken.deploy("WETH", "WETH", deployer.address, wethDecimals);
    await weth.waitForDeployment();
    console.log("✓ WETH deployed at:", await weth.getAddress(), `(${wethDecimals} decimals)`);
    
    const token = await LSTToken.deploy("TEST", "TEST", deployer.address, wethDecimals);
    await token.waitForDeployment();
    console.log("✓ TEST token deployed at:", await token.getAddress(), `(${wethDecimals} decimals)`);

    // 2. 部署 Mock Pair
    console.log("\n--- Step 2: Deploying Mock Pair ---");
    const MockPair = await ethers.getContractFactory("MockUniswapV2Pair");
    const pair = await MockPair.deploy(
      await token.getAddress(),
      await weth.getAddress()
    );
    await pair.waitForDeployment();
    console.log("✓ Mock Pair deployed at:", await pair.getAddress());

    // 3. 设置储备量: 1000 TOKEN = 1 ETH
    console.log("\n--- Step 3: Setting Reserves ---");
    await pair.setReserves(
      ethers.parseEther("1000"),
      ethers.parseEther("1")
    );
    const reserves = await pair.getReserves();
    console.log("✓ Reserves set:");
    console.log("  - Reserve0:", ethers.formatEther(reserves[0]), "TEST");
    console.log("  - Reserve1:", ethers.formatEther(reserves[1]), "WETH");

    // 4. 部署 Oracle
    console.log("\n--- Step 4: Deploying Oracle ---");
    const Oracle = await ethers.getContractFactory("UniswapV2SpotOracle");
    const oracle = await Oracle.deploy(
      await pair.getAddress(),
      await weth.getAddress()
    );
    await oracle.waitForDeployment();
    console.log("✓ Oracle deployed at:", await oracle.getAddress());

    // 5. 测试报价
    console.log("\n--- Step 5: Testing Quote ---");
    const inputAmount = ethers.parseEther("100");
    console.log("Input amount:", ethers.formatEther(inputAmount), "TEST");
    
    const quote = await oracle.quoteEthOut(
      await token.getAddress(),
      inputAmount
    );
    console.log("✓ Quote output:", ethers.formatEther(quote), "ETH");
    
    const expectedOutput = ethers.parseEther("0.1");
    console.log("Expected output:", ethers.formatEther(expectedOutput), "ETH");

    expect(quote).to.equal(expectedOutput); // 100 / 1000 = 0.1 ETH
  });
});