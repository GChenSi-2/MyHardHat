import { ethers } from "hardhat";

async function main() {
  // 主网真实地址
  const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
  const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
  const USDC_WETH_PAIR = "0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc"; // Uniswap V2

  const Oracle = await ethers.getContractFactory("UniswapV2SpotOracle");
  const oracle = await Oracle.deploy(USDC_WETH_PAIR, WETH);
  
  await oracle.waitForDeployment();
  console.log("Oracle deployed to:", await oracle.getAddress());

  // 测试
  const quote = await oracle.quoteEthOut(USDC, 1000_000000); // 1000 USDC
  console.log("Quote for 1000 USDC:", ethers.formatEther(quote), "ETH");
}

main().catch(console.error);