import { network } from "hardhat";

async function main() {
  const { ethers } = await network.connect();
  const address = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";
  const code = await ethers.provider.getCode(address);
  console.log(`Code at ${address}: ${code}`);
  
  if (code === "0x") {
    console.log("❌ No contract deployed at this address.");
  } else {
    console.log("✅ Contract exists!");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
