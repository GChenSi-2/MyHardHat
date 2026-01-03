import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { network } from "hardhat";
const { ethers } = await network.connect();

async function main() {
  console.log("\n=== Hardhat Ignition Deployment Gas Report (Detailed) ===\n");

  const deploymentsPath = "./ignition/deployments";
  
  try {
    const chains = readdirSync(deploymentsPath);
    
    for (const chain of chains) {
      console.log(`\n📊 Network: ${chain}`);
      console.log("─".repeat(80));
      
      const journalPath = join(deploymentsPath, chain, "journal.jsonl");
      
      try {
        const journalContent = readFileSync(journalPath, "utf-8");
        const lines = journalContent.trim().split("\n");
        
        // 建立交易发送和确认的映射
        const transactionMap = new Map<string, any>();
        
        // 第一遍：收集所有TRANSACTION_SEND数据
        for (const line of lines) {
          const entry = JSON.parse(line);
          
          if (entry.type === "TRANSACTION_SEND") {
            transactionMap.set(entry.transaction.hash, {
              futureId: entry.futureId,
              hash: entry.transaction.hash,
              fees: entry.transaction.fees,
              nonce: entry.nonce
            });
          }
        }
        
        let totalGasUsed = 0n;
        let totalCost = 0n;
        const transactions: any[] = [];
        
        console.log("🔍 Fetching transaction receipts from blockchain...\n");
        
        // 第二遍：收集TRANSACTION_CONFIRM数据并从链上查询gasUsed
        for (const line of lines) {
          const entry = JSON.parse(line);
          
          if (entry.type === "TRANSACTION_CONFIRM") {
            const receipt = entry.receipt;
            const hash = entry.hash;
            const txInfo = transactionMap.get(hash);
            
            if (receipt && txInfo) {
              try {
                // 从链上获取实际的交易收据
                const txReceipt = await ethers.provider.getTransactionReceipt(hash);
                
                if (txReceipt) {
                  const gasUsed = txReceipt.gasUsed;
                  const effectiveGasPrice = txReceipt.gasPrice || 0n;
                  const cost = gasUsed * effectiveGasPrice;
                  
                  totalGasUsed += gasUsed;
                  totalCost += cost;
                  
                  // 解析合约名称
                  const futureIdParts = entry.futureId.split("#");
                  const contractCall = futureIdParts[1] || "Unknown";
                  
                  transactions.push({
                    name: contractCall,
                    gasUsed: gasUsed.toString(),
                    gasPrice: ethers.formatUnits(effectiveGasPrice, "gwei"),
                    cost: ethers.formatEther(cost),
                    maxFeePerGas: txInfo.fees?.maxFeePerGas?._kind === "bigint" 
                      ? (BigInt(txInfo.fees.maxFeePerGas.value) / 1_000_000_000n).toString()
                      : "N/A",
                    status: receipt.status,
                    blockNumber: receipt.blockNumber,
                    hash: hash,
                    contractAddress: receipt.contractAddress || "N/A"
                  });
                }
              } catch (err: any) {
                console.warn(`⚠️  Could not fetch receipt for ${hash}: ${err.message}`);
                
                // 如果无法从链上获取，使用journal中的基本信息
                const futureIdParts = entry.futureId.split("#");
                const contractCall = futureIdParts[1] || "Unknown";
                
                transactions.push({
                  name: contractCall,
                  gasUsed: "N/A",
                  gasPrice: "N/A",
                  cost: "N/A",
                  maxFeePerGas: txInfo.fees?.maxFeePerGas?._kind === "bigint" 
                    ? (BigInt(txInfo.fees.maxFeePerGas.value) / 1_000_000_000n).toString()
                    : "N/A",
                  status: receipt.status,
                  blockNumber: receipt.blockNumber,
                  hash: hash,
                  contractAddress: receipt.contractAddress || "N/A"
                });
              }
            }
          }
        }
        
        if (transactions.length > 0) {
          console.log("📝 Transaction Details:");
          console.table(transactions.map(tx => ({
            "Contract/Call": tx.name,
            "Gas Used": tx.gasUsed,
            "Gas Price (gwei)": tx.gasPrice,
            "Cost (ETH)": tx.cost,
            "Max Fee (gwei)": tx.maxFeePerGas,
            "Block": tx.blockNumber,
            "Status": tx.status
          })));
          
          console.log("\n" + "─".repeat(80));
          console.log(`\n⛽ Total Gas Used: ${totalGasUsed.toString()}`);
          console.log(`💰 Total Cost: ${ethers.formatEther(totalCost)} ETH`);
          
          // 显示每个交易的完整hash
          console.log("\n📋 Transaction Hashes:");
          transactions.forEach((tx, i) => {
            console.log(`${i + 1}. ${tx.name}: ${tx.hash}`);
            if (tx.contractAddress !== "N/A") {
              console.log(`   Contract Address: ${tx.contractAddress}`);
            }
          });
        } else {
          console.log("No transactions found in this deployment.");
        }
        
      } catch (err: any) {
        if (err.code === "ENOENT") {
          console.log("No deployment journal found.");
        } else {
          console.error(`Error reading journal: ${err.message}`);
        }
      }
    }
    
    console.log("\n" + "=".repeat(80) + "\n");
    
  } catch (err: any) {
    if (err.code === "ENOENT") {
      console.log("❌ No deployments found. Run a deployment first:");
      console.log("   yarn deploy:ignition");
      console.log("   yarn deploy:detailed");
    } else {
      console.error(`Error: ${err.message}`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
