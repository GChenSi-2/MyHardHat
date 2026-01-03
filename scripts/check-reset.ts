import { network } from "hardhat";

async function main() {
  const { ethers } = await network.connect();
  const [signer] = await ethers.getSigners();
  
  const address = await signer.getAddress();
  const balance = await ethers.provider.getBalance(address);
  const blockNumber = await ethers.provider.getBlockNumber();
  
  console.log("\n📊 当前状态:");
  console.log(`账户地址: ${address}`);
  console.log(`余额: ${ethers.formatEther(balance)} ETH`);
  console.log(`区块号: ${blockNumber}`);
}

main().catch(console.error);