# Gas使用情况报告指南

## 问题说明

Hardhat Ignition的`journal.jsonl`文件只记录部署状态信息，**不包含实际的gas使用量（gasUsed）**。

### journal.jsonl包含的信息：
- ✅ 交易hash
- ✅ 区块号
- ✅ 最大gas费用设置（maxFeePerGas, maxPriorityFeePerGas）
- ✅ 交易状态
- ❌ **实际消耗的gas（gasUsed）** - 不包含

## 获取Gas使用信息的方法

### 方法1：使用基础报告（离线）

```bash
yarn gas:report
```

- ✅ 不需要网络连接
- ✅ 显示journal中的基本信息
- ❌ 无法获取实际gasUsed

### 方法2：使用详细报告（需要网络）

**步骤：**

1. **启动本地Hardhat节点**（新终端）：
   ```bash
   yarn node
   ```

2. **部署合约**（另一个终端）：
   ```bash
   yarn deploy:detailed
   ```

3. **运行详细gas报告**：
   ```bash
   yarn gas:report:detailed
   ```

这个方法会：
- ✅ 从区块链获取实际的gasUsed
- ✅ 显示实际的gasPrice
- ✅ 计算实际成本
- ✅ 显示完整的交易详情

### 方法3：在部署时实时跟踪Gas

创建自定义部署模块，使用事件监听器：

```typescript
// ignition/modules/CounterWithGasTracking.ts
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const CounterModule = buildModule("CounterWithGas", (m) => {
  const counter = m.contract("Counter");
  
  // 部署后立即获取交易receipt
  m.afterDeploy(async (context) => {
    const deployment = await context.getDeployment("Counter");
    const receipt = await deployment.deployTransaction.wait();
    
    console.log(`\n⛽ Deployment Gas Used: ${receipt.gasUsed.toString()}`);
    console.log(`💰 Gas Price: ${receipt.gasPrice?.toString()} wei`);
  });
  
  return { counter };
});

export default CounterModule;
```

### 方法4：使用hardhat-gas-reporter插件

在`hardhat.config.ts`中添加：

```typescript
import "hardhat-gas-reporter";

export default {
  gasReporter: {
    enabled: true,
    currency: "USD",
    outputFile: "gas-report.txt",
    noColors: true,
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
  },
};
```

然后运行测试时会自动生成gas报告：
```bash
yarn test
```

## 为什么Ignition不存储gasUsed？

1. **设计目的**：journal.jsonl主要用于**部署状态管理和恢复**，不是为了gas分析
2. **数据可用性**：gasUsed信息永久存储在区块链上，可以随时查询
3. **文件大小**：减少journal文件的大小和复杂度
4. **关注点分离**：部署追踪 vs 性能分析

## 推荐工作流

对于生产环境部署：

```bash
# 1. 启动本地节点进行测试
yarn node

# 2. 部署到本地测试
yarn deploy:detailed

# 3. 获取详细gas报告
yarn gas:report:detailed

# 4. 分析gas使用情况并优化

# 5. 部署到实际网络
yarn deploy:detailed --network sepolia

# 6. 在区块浏览器查看实际gas使用
# Etherscan, Polygonscan等
```

## 当前项目中的脚本

| 脚本命令 | 说明 | 需要网络 |
|---------|------|---------|
| `yarn gas:report` | 基础报告（从journal读取） | ❌ |
| `yarn gas:report:detailed` | 详细报告（从链上查询） | ✅ |
| `yarn deploy:gas` | 带gas追踪的传统部署 | ✅ |
| `yarn test:gas` | 测试中的gas报告 | ✅ |

## 总结

**journal.jsonl不包含gasUsed是正常的**。要获取实际gas使用量，需要：
1. 连接到部署的网络
2. 使用`ethers.provider.getTransactionReceipt(hash)`查询
3. 或者使用本项目提供的`yarn gas:report:detailed`命令
