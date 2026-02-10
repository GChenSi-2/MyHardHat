import { network } from "hardhat";

async function main() {
    const { ethers } = await network.connect();
    const address = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
    console.log(`Checking balance for address: ${address}`);

    try {
        const balance = await ethers.provider.getBalance(address);
        const balanceEth = ethers.formatEther(balance);
        console.log(`\n💰 Balance: ${balanceEth} ETH`);
    } catch (error) {
        console.error("Error fetching balance:", error);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
