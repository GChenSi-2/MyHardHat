// import "@nomicfoundation/hardhat-ethers";
import { network } from "hardhat";

async function foo(){
  const { ethers } = await network.connect();
  const contractFactory = await ethers.getContractFactory("HelloWorld");
  const contract = await contractFactory.deploy();
  await contract.waitForDeployment();
  console.log(`HelloWorld deployed to: ${contract.target}`);
  return contract;
} 
async function deploy() {
    return await foo();
}
async function sayhello(contract: any) {
  console.log("Say Hello:", await contract.greet());
}

deploy().then(sayhello).catch(console.error);
