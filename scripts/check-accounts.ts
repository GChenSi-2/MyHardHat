import { network } from "hardhat";

async function main() {
  const { ethers } = await network.connect();
  console.log("🔍 正在查看本地鏈 (Localhost) 的帳戶和 ETH 餘額...\n");

  // 獲取所有 Hardhat 生成的預設帳戶
  const accounts = await ethers.getSigners();
  
  if (accounts.length === 0) {
    console.log("❌ 未找到帳戶，請確保 Hardhat 節點 (npx hardhat node) 正在運行。");
    return;
  }

  console.log("--------------------------------------------------------------------------------");
  console.log("| Index | Address                                    | ETH Balance               |");
  console.log("--------------------------------------------------------------------------------");

  for (let i = 0; i < accounts.length; i++) {
    const address = accounts[i].address;
    const balance = await ethers.provider.getBalance(address);
    // 只列出前 5 個或有餘額的帳戶
    if (i < 5 || balance > 0n) {
      console.log(`| ${i.toString().padEnd(5)} | ${address} | ${ethers.formatEther(balance).padEnd(25)} |`);
    }
  }
  console.log("--------------------------------------------------------------------------------");
  
  console.log("\n💡 提示：");
  console.log("1. 'ETH' 是鏈上的原生代幣 (Native Currency)，它沒有合約地址。");
  console.log("2. 這些帳戶是 Hardhat 啟動時預設生成的，密鑰在 Hardhat 文檔中公開。");
  console.log("3. index 0 (第一個帳戶) 通常是默認的部署者 (Deployer)。");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
