import { network } from "hardhat";

async function main() {
  const { ethers } = await network.connect();
  const [user] = await ethers.getSigners();
  
  console.log("🔍 测试 SwapExit\n");

  // 新的合约地址
  const VAULT_ADDRESS = "0x5eb3Bc0a489C5A8288765d2336659EbCA68FCd00";
  const MLST_ADDRESS = "0xc95ff0608561b6bA084c78D14f09e9826190f968";

  const vault = await ethers.getContractAt("LSTVault", VAULT_ADDRESS);
  const mlst = await ethers.getContractAt("LSTToken", MLST_ADDRESS);

  const swapAmount = ethers.parseEther("10");
  const deadline = Math.floor(Date.now() / 1000) + 3600;

  console.log("用户 mLST 余额:", ethers.formatEther(await mlst.balanceOf(user.address)));
  
  // 授权
  await (await mlst.approve(VAULT_ADDRESS, swapAmount)).wait();
  console.log("✅ 授权完成\n");

  try {
    console.log("尝试 swapExit...");
    const tx = await vault.swapExit(
      swapAmount,
      ethers.parseEther("0.08"),
      deadline
    );
    await tx.wait();
    console.log("✅ 成功！");
  } catch (error: any) {
    console.log("\n❌ 失败!");
    
    // 尝试获取更详细的错误信息
    try {
      await vault.swapExit.staticCall(
        swapAmount,
        ethers.parseEther("0.08"),
        deadline
      );
    } catch (staticError: any) {
      console.log("Revert 原因:", staticError.message);
      if (staticError.data) {
        console.log("Error data:", staticError.data);
      }
    }
  }
}

main().catch(console.error);
