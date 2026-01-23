import { HardhatUserConfig } from "hardhat/config";

const config: HardhatUserConfig = {
  networks: {
    hardhat: {
      type: "edr-simulated",
      forking: {
        url: "https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY",
        blockNumber: 18000000 // 可选：固定区块
      }
    }
  }
};

export default config;