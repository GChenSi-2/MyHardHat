import { expect } from "chai";
import { network } from "hardhat";
import type { ContractTransactionResponse } from "ethers";

describe("MockStakingAdapter - Time-based Rewards (method 2: use real dt)", function () {
  function bn(x: number | bigint) {
    return BigInt(x);
  }

  async function txTimestamp(
    ethers: any,
    tx: ContractTransactionResponse
  ): Promise<number> {
    const receipt = await tx.wait();
    const block = await ethers.provider.getBlock(receipt!.blockNumber);
    return Number(block!.timestamp);
  }

  function segmentReward(
    dtSeconds: bigint,
    rewardRatePerSec: bigint,
    userStake: bigint,
    totalStake: bigint
  ): bigint {
    if (dtSeconds <= 0n || totalStake === 0n || userStake === 0n) return 0n;
    // totalReward = dt * rate; userShare = totalReward * userStake / totalStake
    return (dtSeconds * rewardRatePerSec * userStake) / totalStake;
  }

  function expectApprox(actual: bigint, expected: bigint, tolerance: bigint) {
    const low = expected > tolerance ? expected - tolerance : 0n;
    const high = expected + tolerance;
    expect(actual).to.be.gte(low);
    expect(actual).to.be.lte(high);
  }

  it("Should accumulate rewards over time using real dt", async function () {
    const { ethers, networkHelpers } = await network.connect();
    const [owner, user1, user2] = await ethers.getSigners();

    const RATE = ethers.parseEther("1"); // 1 token/sec (18 decimals)
    const STAKE_100 = ethers.parseEther("100");
    const STAKE_200 = ethers.parseEther("200");

    // 容忍值：允許些微 rounding / 分段更新差異
    const TOL = 10n ** 12n; // 1e12 wei = 0.000001 token

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
    await (await adapter.setRewardRate(RATE)).wait();

    // 4. 给 adapter 充值奖励代币
    await (await rewardToken.mint(await adapter.getAddress(), ethers.parseEther("10000"))).wait();

    // 5. User1 mint + approve + stake 100
    await (await stakingToken.mint(user1.address, STAKE_100)).wait();
    await (await stakingToken.connect(user1).approve(await adapter.getAddress(), STAKE_100)).wait();

    const tStake1 = await txTimestamp(ethers, await adapter.connect(user1).stake(STAKE_100));

    // ---- 等待一段时间（不假设刚好 10 秒）----
    await networkHelpers.time.increase(10);
    await networkHelpers.mine(1);
    const tRead1 = Number((await ethers.provider.getBlock("latest"))!.timestamp);

    const pendingAfter1 = (await adapter.pendingRewards(user1.address)) as bigint;

    // 预期：从 tStake1 到 tRead1，只有 user1，share=100/100
    const exp1 = segmentReward(bn(tRead1 - tStake1), RATE, STAKE_100, STAKE_100);

    console.log("\n[Checkpoint #1]");
    console.log("dt:", tRead1 - tStake1, "sec");
    console.log("pending(user1):", ethers.formatEther(pendingAfter1));
    console.log("expected:", ethers.formatEther(exp1));

    expectApprox(pendingAfter1, exp1, TOL);

    // 7. User2 mint + approve + stake 100
    await (await stakingToken.mint(user2.address, STAKE_100)).wait();
    await (await stakingToken.connect(user2).approve(await adapter.getAddress(), STAKE_100)).wait();

    const tStake2 = await txTimestamp(ethers, await adapter.connect(user2).stake(STAKE_100));

    // 8. 再等待 10 秒（仍用真实 dt）
    await networkHelpers.time.increase(10);
    await networkHelpers.mine(1);
    const tRead2 = Number((await ethers.provider.getBlock("latest"))!.timestamp);

    const pending1_2 = (await adapter.pendingRewards(user1.address)) as bigint;
    const pending2_2 = (await adapter.pendingRewards(user2.address)) as bigint;

    // user1：stake1->stake2 (100/100) + stake2->read2 (100/200)
    const exp1_a = segmentReward(bn(tStake2 - tStake1), RATE, STAKE_100, STAKE_100);
    const exp1_b = segmentReward(bn(tRead2 - tStake2), RATE, STAKE_100, STAKE_200);
    const expUser1_2 = exp1_a + exp1_b;

    // user2：stake2->read2 (100/200)
    const expUser2_2 = segmentReward(bn(tRead2 - tStake2), RATE, STAKE_100, STAKE_200);

    console.log("\n[Checkpoint #2]");
    console.log("dt(stake1->stake2):", tStake2 - tStake1, "sec");
    console.log("dt(stake2->read2):", tRead2 - tStake2, "sec");
    console.log("pending(user1):", ethers.formatEther(pending1_2), "expected:", ethers.formatEther(expUser1_2));
    console.log("pending(user2):", ethers.formatEther(pending2_2), "expected:", ethers.formatEther(expUser2_2));

    expectApprox(pending1_2, expUser1_2, TOL);
    expectApprox(pending2_2, expUser2_2, TOL);

    // 9. User1 领取奖励（用 claim 所在 block timestamp 计算应得）
    const tClaim1 = await txTimestamp(ethers, await adapter.connect(user1).claimRewards());
    const balAfterClaim = (await rewardToken.balanceOf(user1.address)) as bigint;

    // user1：stake1->stake2 (100/100) + stake2->claim1 (100/200)
    const expClaim = exp1_a + segmentReward(bn(tClaim1 - tStake2), RATE, STAKE_100, STAKE_200);

    console.log("\n[Checkpoint #3 - claim user1]");
    console.log("dt(stake2->claim1):", tClaim1 - tStake2, "sec");
    console.log("claimed balance:", ethers.formatEther(balAfterClaim), "expected:", ethers.formatEther(expClaim));

    expectApprox(balAfterClaim, expClaim, TOL);

    // 10. User1 增加质押 100（从 claim 到这次 stake 之间也会累积一些）
    await (await stakingToken.mint(user1.address, STAKE_100)).wait();
    await (await stakingToken.connect(user1).approve(await adapter.getAddress(), STAKE_100)).wait();

    const tStake3 = await txTimestamp(ethers, await adapter.connect(user1).stake(STAKE_100));

    // 11. 再等待 10 秒
    await networkHelpers.time.increase(10);
    await networkHelpers.mine(1);
    const tRead3 = Number((await ethers.provider.getBlock("latest"))!.timestamp);

    const pending1_3 = (await adapter.pendingRewards(user1.address)) as bigint;
    const pending2_3 = (await adapter.pendingRewards(user2.address)) as bigint;

    // user1 pending（claim 已清零，所以从 claim1 之后开始）：
    // claim1->stake3: user1=100/200
    // stake3->read3: user1=200/300
    const expUser1_3 =
      segmentReward(bn(tStake3 - tClaim1), RATE, STAKE_100, STAKE_200) +
      segmentReward(bn(tRead3 - tStake3), RATE, ethers.parseEther("200"), ethers.parseEther("300"));

    // user2 从 stake2 开始一直没 claim：
    // stake2->claim1: 100/200
    // claim1->stake3: 100/200
    // stake3->read3: 100/300
    const expUser2_3 =
      segmentReward(bn(tClaim1 - tStake2), RATE, STAKE_100, STAKE_200) +
      segmentReward(bn(tStake3 - tClaim1), RATE, STAKE_100, STAKE_200) +
      segmentReward(bn(tRead3 - tStake3), RATE, STAKE_100, ethers.parseEther("300"));

    console.log("\n[Checkpoint #4]");
    console.log("dt(claim1->stake3):", tStake3 - tClaim1, "sec");
    console.log("dt(stake3->read3):", tRead3 - tStake3, "sec");
    console.log("pending(user1):", ethers.formatEther(pending1_3), "expected:", ethers.formatEther(expUser1_3));
    console.log("pending(user2):", ethers.formatEther(pending2_3), "expected:", ethers.formatEther(expUser2_3));

    expectApprox(pending1_3, expUser1_3, TOL);
    expectApprox(pending2_3, expUser2_3, TOL);
  });
});