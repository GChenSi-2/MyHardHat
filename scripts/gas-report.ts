import { readFileSync, readdirSync } from "fs";
import { join } from "path";

async function main() {
  console.log("\n=== Hardhat Ignition Deployment Gas Report ===\n");

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
        const transactions: any[] = [];
        
        // 第二遍：收集TRANSACTION_CONFIRM数据并关联
        for (const line of lines) {
          const entry = JSON.parse(line);
          
          if (entry.type === "TRANSACTION_CONFIRM") {
            const receipt = entry.receipt;
            const hash = entry.hash;
            const txInfo = transactionMap.get(hash);
            
            if (receipt && txInfo) {
              // 解析合约名称
              const futureIdParts = entry.futureId.split("#");
              const contractCall = futureIdParts[1] || "Unknown";
              
              // 由于receipt中没有gasUsed，我们需要估算
              // 或者显示可用的信息
              const blockNumber = receipt.blockNumber;
              const status = receipt.status;
              const contractAddress = receipt.contractAddress;
              
              transactions.push({
                futureId: entry.futureId,
                contractName: contractCall,
                hash: hash,
                blockNumber: blockNumber,
                status: status,
                contractAddress: contractAddress || "N/A",
                maxFeePerGas: txInfo.fees?.maxFeePerGas?._kind === "bigint" 
                  ? (BigInt(txInfo.fees.maxFeePerGas.value) / 1_000_000_000n).toString() + " gwei"
                  : "N/A",
                maxPriorityFee: txInfo.fees?.maxPriorityFeePerGas?._kind === "bigint"
                  ? (BigInt(txInfo.fees.maxPriorityFeePerGas.value) / 1_000_000_000n).toString() + " gwei"
                  : "N/A"
              });
            }
          }
        }
        
        if (transactions.length > 0) {
          console.log("\n📝 Transactions:");
          console.table(transactions.map(tx => ({
            "Contract/Call": tx.contractName,
            "Status": tx.status,
            "Block": tx.blockNumber,
            "Max Fee": tx.maxFeePerGas,
            "Priority Fee": tx.maxPriorityFee,
            "Contract Address": tx.contractAddress,
            "Transaction": tx.hash.slice(0, 10) + "..."
          })));
          
          console.log(`\n✅ Total Transactions: ${transactions.length}`);
          console.log("\n💡 Note: Journal does not contain gasUsed data.");
          console.log("   To get actual gas usage, connect to the network and query the chain:");
          console.log("   await ethers.provider.getTransactionReceipt(hash)");
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
