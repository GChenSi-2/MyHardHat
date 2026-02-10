import { expect } from "chai";
import { network } from "hardhat";

describe("MockStakingAdapter - Time-based Rewards", function () {
  it("Should accumulate rewards over time", async function () {
    const { ethers, networkHelpers } = await network.connect();
    const [owner, user1, user2] = await ethers.getSigners();

    // 1. 部署代币
    const MockToken = await ethers.getContractFactory("LSTToken");
    const stakingToken = await MockToken.deploy("WETH", "WETH", owner.address, 18);
    const rewardToken = await MockToken.deploy("Reward", "RWD", owner.address, 18);
    await stakingToken.waitForDeployment();
    await rewardToken.waitForDeployment();

    // 2. 部署 Staking Adapter
    const Adapter = await ethers.getContractFactory("MockStakingAdapter");
    const adapter = await Adapter.deploy(
      await stakingToken.getAddress(),
      await rewardToken.getAddress()
    );
    await adapter.waitForDeployment();

    // 3. 设置奖励率: 每秒 1 token
    await adapter.setRewardRate(ethers.parseEther("1"));

    // 4. 给 adapter 充值奖励代币
    await rewardToken.mint(await adapter.getAddress(), ethers.parseEther("10000"));

    // 5. 给用户1 mint 并质押 100 token
    await stakingToken.mint(user1.address, ethers.parseEther("100"));
    await stakingToken.connect(user1).approve(
      await adapter.getAddress(),
      ethers.parseEther("100")
    );
    await adapter.connect(user1).stake(ethers.parseEther("100"));

    console.log("\n=== User1 质押 100 tokens ===");
    console.log("Initial staked:", ethers.formatEther(
      await adapter.stakedBalanceOf(user1.address)
    ));

    // 6. 等待 10 秒
    await networkHelpers.time.increase(10);
    // await networkHelpers.mine(1); // 关键：推进时间后挖一个新区块，触发 timestamp 生效
    
    let pending = await adapter.pendingRewards(user1.address);
    console.log("\n等待 10 秒后:");
    console.log("Pending rewards:", ethers.formatEther(pending));
    // 预期: 10 秒 × 1 token/秒 = 10 tokens

    // 7. User2 质押 100 tokens
    await stakingToken.mint(user2.address, ethers.parseEther("100"));
    await stakingToken.connect(user2).approve(
      await adapter.getAddress(),
      ethers.parseEther("100")
    );
    await adapter.connect(user2).stake(ethers.parseEther("100"));

    console.log("\n=== User2 质押 100 tokens ===");
    console.log("Total staked:", ethers.formatEther(await adapter.totalStaked()));

    // 8. 再等待 10 秒
    await networkHelpers.time.increase(10);
    // await networkHelpers.mine(1); // 关键：推进时间后挖一个新区块，触发 timestamp 生效

    let pending1 = await adapter.pendingRewards(user1.address);
    let pending2 = await adapter.pendingRewards(user2.address);
    
    console.log("\n再等待 10 秒后:");
    console.log("User1 pending:", ethers.formatEther(pending1));
    // 预期: 10 + (10 秒 × 1 token/秒 × 100/200) = 10 + 5 = 15 tokens
    console.log("User2 pending:", ethers.formatEther(pending2));
    // 预期: 10 秒 × 1 token/秒 × 100/200 = 5 tokens

    // 9. User1 领取奖励
    await adapter.connect(user1).claimRewards();
    console.log("\n=== User1 领取奖励 ===");
    
    const balance = await rewardToken.balanceOf(user1.address);
    console.log("User1 reward balance:", ethers.formatEther(balance));

    // 10. User1 增加质押
    await stakingToken.mint(user1.address, ethers.parseEther("100"));
    await stakingToken.connect(user1).approve(
      await adapter.getAddress(),
      ethers.parseEther("100")
    );
    await adapter.connect(user1).stake(ethers.parseEther("100"));

    console.log("\n=== User1 增加质押 100 tokens ===");
    console.log("User1 total staked:", ethers.formatEther(
      await adapter.stakedBalanceOf(user1.address)
    ));

    // 11. 再等待 10 秒
    await networkHelpers.time.increase(10);
    // await networkHelpers.mine(1); // 关键：推进时间后挖一个新区块，触发 timestamp 生效
    pending1 = await adapter.pendingRewards(user1.address);
    pending2 = await adapter.pendingRewards(user2.address);

    console.log("\n再等待 10 秒后:");
    console.log("User1 pending:", ethers.formatEther(pending1));
    // 预期: 10 秒 × 1 token/秒 × 200/300 = 6.67 tokens
    console.log("User2 pending:", ethers.formatEther(pending2));
    // 预期: 5 + (10 秒 × 1 token/秒 × 100/300) = 5 + 3.33 = 8.33 tokens
  });
});