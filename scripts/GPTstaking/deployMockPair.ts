import { network } from "hardhat";
const { ethers } = await network.connect();
async function main() {
  // 1. 部署 Mock WETH 和 Token
  const [deployer] = await ethers.getSigners();
  const MockToken = await ethers.getContractFactory("LSTToken");
  const weth = await MockToken.deploy("Wrapped ETH", "WETH", deployer.address, 18);
  const token = await MockToken.deploy("Test Token", "TEST", deployer.address, 18);
  
  await weth.waitForDeployment();
  await token.waitForDeployment();

  console.log("WETH deployed to:", await weth.getAddress());
  console.log("Token deployed to:", await token.getAddress());

  // 2. 部署 Mock Pair
  const MockPair = await ethers.getContractFactory("MockUniswapV2Pair");
  const pair = await MockPair.deploy(
    await token.getAddress(),
    await weth.getAddress()
  );
  await pair.waitForDeployment();

  console.log("Pair deployed to:", await pair.getAddress());

  // 3. 设置初始流动性 (例如: 1000 TOKEN = 1 ETH)
  await pair.setReserves(
    ethers.parseEther("1000"), // 1000 TOKEN
    ethers.parseEther("1")     // 1 ETH
  );

  // 4. 部署 Oracle
  const Oracle = await ethers.getContractFactory("UniswapV2SpotOracle");
  const oracle = await Oracle.deploy(
    await pair.getAddress(),
    await weth.getAddress()
  );
  await oracle.waitForDeployment();

  console.log("Oracle deployed to:", await oracle.getAddress());

  // 5. 测试 Oracle
  const quote = await oracle.quoteEthOut(
    await token.getAddress(),
    ethers.parseEther("100")
  );
  console.log("Quote for 100 TOKEN:", ethers.formatEther(quote), "ETH");
}

main().catch(console.error);