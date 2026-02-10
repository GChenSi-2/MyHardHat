"use client";

import { useState, useEffect } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useBalance } from "wagmi";
import { parseEther, formatEther } from "viem";
import LSTVaultABI from "@/lib/contracts/abis/LSTVault.json";
import LSTTokenABI from "@/lib/contracts/abis/LSTToken.json";
import WETHABI from "@/lib/contracts/abis/WETH.json";
import MockStakingAdapterABI from "@/lib/contracts/abis/MockStakingAdapter.json";
import UniswapV2SpotOracleABI from "@/lib/contracts/abis/UniswapV2SpotOracle.json";

// Addresses from test-staking.ts
const ADDRESSES = {
  VAULT: "0x525C7063E7C20997BaaE9bDa922159152D0e8417" as `0x${string}`,
  MLST: "0x4f4588Ed715A88420222a08c74e8D8c0f432Df96" as `0x${string}`,
  TST: "0x38a024C0b412B9d1db8BC398140D00F5Af3093D4" as `0x${string}`,
  ADAPTER: "0x5fc748f1FEb28d7b76fa1c6B07D8ba2d5535177c" as `0x${string}`,
  ROUTER: "0x40918Ba7f132E0aCba2CE4de4c4baF9BD2D7D849" as `0x${string}`,
  PAIR: "0xF32D39ff9f6Aa7a7A64d7a4F00a54826Ef791a55" as `0x${string}`,
};

export function StakingTest() {
  const { address: userAddress, isConnected } = useAccount();
  const address = userAddress || ("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as `0x${string}`);
  const { data: hash, writeContract, isPending, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  const [tstBalance, setTstBalance] = useState("0");
  const [mlstBalance, setMlstBalance] = useState("0");
  const [stakedBalance, setStakedBalance] = useState("0");
  const [earned, setEarned] = useState("0");
  const [specificError, setSpecificError] = useState<{ type: string; message: string } | null>(null);

  // Inputs
  const [stakeAmount, setStakeAmount] = useState("");
  const [wrapAmount, setWrapAmount] = useState("");
  const [unstakeAmount, setUnstakeAmount] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [swapAmount, setSwapAmount] = useState("");
  const [minEthOut, setMinEthOut] = useState("0");
  const [oracleQuote, setOracleQuote] = useState("0");

  // Reads
  const { data: tstBal, refetch: refetchTst } = useReadContract({
    address: ADDRESSES.TST,
    abi: WETHABI.abi,
    functionName: "balanceOf",
    args: [address],
    query: { enabled: !!address },
  });

  const { data: mlstBal, refetch: refetchMlst } = useReadContract({
    address: ADDRESSES.MLST,
    abi: LSTTokenABI.abi,
    functionName: "balanceOf",
    args: [address],
    query: { enabled: !!address },
  });

  const { data: stakedBal, refetch: refetchStaked } = useReadContract({
    address: ADDRESSES.ADAPTER,
    abi: MockStakingAdapterABI.abi,
    functionName: "stakedBalanceOf",
    args: [address],
    query: { enabled: !!address },
  });

  const { data: earnedVal, refetch: refetchEarned } = useReadContract({
    address: ADDRESSES.ADAPTER,
    abi: MockStakingAdapterABI.abi,
    functionName: "earned",
    args: [address],
    query: { enabled: !!address },
  });
  
  const { data: oracleAddr } = useReadContract({
    address: ADDRESSES.VAULT,
    abi: LSTVaultABI.abi,
    functionName: "oracle",
  });

  // ETH Balance
  const { data: ethBalanceData, refetch: refetchEth } = useBalance({
    address: address,
  });
  
  // Check TST allowance
  const { data: tstAllowance, refetch: refetchTstAllowance } = useReadContract({
    address: ADDRESSES.TST,
    abi: WETHABI.abi,
    functionName: "allowance",
    args: [address, ADDRESSES.ADAPTER],
    query: { enabled: !!address, refetchInterval: 5000 },
  });

  // Check mLST allowance
  const { data: mlstAllowance, refetch: refetchMlstAllowance } = useReadContract({
    address: ADDRESSES.MLST,
    abi: LSTTokenABI.abi,
    functionName: "allowance",
    args: [address, ADDRESSES.VAULT],
    query: { enabled: !!address, refetchInterval: 5000 },
  });
  
  // Update UI balances
  useEffect(() => {
    if (tstBal) setTstBalance(formatEther(tstBal as bigint));
    if (mlstBal) setMlstBalance(formatEther(mlstBal as bigint));
    if (stakedBal) setStakedBalance(formatEther(stakedBal as bigint));
    if (earnedVal) setEarned(formatEther(earnedVal as bigint));
  }, [tstBal, mlstBal, stakedBal, earnedVal]);

  // Refetch data when transaction is confirmed
  useEffect(() => {
    if (isConfirmed) {
      refetchTst();
      refetchMlst();
      refetchStaked();
      refetchEarned();
      refetchTstAllowance();
      refetchMlstAllowance();
      refetchEth();
    }
  }, [isConfirmed]);

  // Actions
  const handleWrapETH = async () => {
    if (!wrapAmount) return;
    writeContract({
      address: ADDRESSES.TST, // WETH address
      abi: WETHABI.abi,
      functionName: "deposit",
      value: parseEther(wrapAmount),
    });
  };

  const handleApproveTST = async () => {
    if (!stakeAmount) return;
    writeContract({
      address: ADDRESSES.TST,
      abi: WETHABI.abi,
      functionName: "approve",
      args: [ADDRESSES.ADAPTER, parseEther(stakeAmount)],
      gas: 100000n, // Explicit gas limit
    });
  };

  const handleStake = async () => {
    if (!stakeAmount) return;
    setSpecificError(null);
    writeContract({
      address: ADDRESSES.ADAPTER,
      abi: MockStakingAdapterABI.abi,
      functionName: "stake",
      args: [parseEther(stakeAmount)],
      gas: 500000n, // Explicit gas limit
    });
  };

  const handleClaim = async () => {
    writeContract({
      address: ADDRESSES.ADAPTER,
      abi: MockStakingAdapterABI.abi,
      functionName: "claimRewards",
      gas: 500000n,
    });
  };

  const handleUnstake = async () => {
    if (!unstakeAmount) return;
    writeContract({
      address: ADDRESSES.ADAPTER,
      abi: MockStakingAdapterABI.abi,
      functionName: "unstake",
      args: [parseEther(unstakeAmount)],
      gas: 500000n,
    });
  };

  const handleDeposit = async () => {
    if (!depositAmount) return;
    writeContract({
      address: ADDRESSES.VAULT,
      abi: LSTVaultABI.abi,
      functionName: "deposit",
      value: parseEther(depositAmount),
      gas: 500000n,
    });
  };
  
  const handleApproveMLST = async () => {
    if (!swapAmount) return;
    writeContract({
      address: ADDRESSES.MLST,
      abi: LSTTokenABI.abi,
      functionName: "approve",
      args: [ADDRESSES.VAULT, parseEther(swapAmount)],
      gas: 100000n,
    });
  };
  
  // Oracle Quote Logic (Requires separate read/call usually, but can use useReadContract or client)
  // Here we just use a simplified flow: User inputs amount -> We assume simple UI. 
  // For proper implementation, we need to read the oracle on-demand.
  // We'll use a manual implementation of Quote logic via `useReadContract` hook that updates when swapAmount changes?
  // No, hooks can't be conditional on loops easily.
  // We will just read it always if swapAmount is valid.
  
  const { data: quoteData } = useReadContract({
      address: oracleAddr as `0x${string}`,
      abi: UniswapV2SpotOracleABI.abi,
      functionName: "quoteEthOut",
      args: [ADDRESSES.MLST, swapAmount ? parseEther(swapAmount) : 0n],
      query: { enabled: !!oracleAddr && !!swapAmount && swapAmount !== "0" },
  });

  useEffect(() => {
      if (quoteData) {
          const q = quoteData as bigint;
          const formatted = formatEther(q);
          setOracleQuote(formatted);
          // Set minOut to 98%
          const min = q * 9800n / 10000n;
          setMinEthOut(formatEther(min));
      }
  }, [quoteData]);

  // 监听错误并提取特定错误类型
  useEffect(() => {
    if (writeError) {
      const errorMessage = writeError.message || "";
      
      // 检查是否是 InsufficientAllowance 错误
      if (errorMessage.includes("InsufficientAllowance")) {
        setSpecificError({
          type: "InsufficientAllowance",
          message: "❌ Approve 额不足！请先增加 Approve 额。"
        });
      } else if (errorMessage.includes("TRANSFER_FAILED")) {
        setSpecificError({
          type: "TransferFailed",
          message: "❌ 转账失败，请检查余额。"
        });
      } else if (errorMessage.includes("ZERO_AMOUNT")) {
        setSpecificError({
          type: "ZeroAmount",
          message: "❌ 金额必须大于 0。"
        });
      } else if (errorMessage.includes("NO_REWARDS")) {
        setSpecificError({
          type: "NoRewards",
          message: "❌ 没有待领取的奖励。"
        });
      } else {
        setSpecificError({
          type: "Unknown",
          message: `❌ 交易失败: ${errorMessage}`
        });
      }
    }
  }, [writeError]);

  const handleSwapExit = async () => {
    if (!swapAmount || !minEthOut) return;
    const deadline = Math.floor(Date.now() / 1000) + 3600;
    writeContract({
      address: ADDRESSES.VAULT,
      abi: LSTVaultABI.abi,
      functionName: "swapExit",
      args: [parseEther(swapAmount), parseEther(minEthOut), BigInt(deadline)],
      gas: 1000000n, // Higher gas for swap
    });
  };

  // Helper to add liquidity (optional debug)
  const handleAddLiquidity = async () => {
      // This is complex because it requires approvals and transfers to pair
      // For simplicity, we might skip implementation or do a simplified "Send tokens to Pair" 
      alert("Liquidity provisioning is complex for this UI. Please run 'yarn test:staking' to set up liquidity initially.");
  };

    if (!isConnected) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-center text-zinc-500">Please connect your wallet to test staking.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      
      {/* Balances */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card title="ETH Balance" value={`${Number(ethBalanceData?.value ? formatEther(ethBalanceData.value) : "0").toFixed(4)} ETH`} />
        <Card title="WETH (Staking Token)" value={`${Number(tstBalance).toFixed(4)} WETH`} />
        <Card title="mLST Balance" value={`${Number(mlstBalance).toFixed(4)} mLST`} />
        <Card title="Staked WETH" value={`${Number(stakedBalance).toFixed(4)} WETH`} />
      </div>

      {/* Transaction Status */}  
      {isPending && <div className="p-3 bg-yellow-100 text-yellow-800 rounded font-medium">⏳ Transaction Pending...</div>}
      {isConfirming && <div className="p-3 bg-blue-100 text-blue-800 rounded font-medium">⏸️ Confirming...</div>}
      {isConfirmed && <div className="p-3 bg-green-100 text-green-800 rounded font-medium">✅ Transaction Confirmed!</div>}
      {specificError && (
        <div className={`p-3 rounded font-medium ${
          specificError.type === "InsufficientAllowance" 
            ? "bg-red-100 text-red-800 border border-red-300" 
            : "bg-orange-100 text-orange-800 border border-orange-300"
        }`}>
          {specificError.message}
        </div>
      )}

      {/* 0. Wrap ETH */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-xl font-bold">0. Wrap ETH (Get WETH)</h2>
        <div className="flex gap-2">
            <input
                type="text"
                placeholder="Amount ETH"
                className="flex-1 rounded border p-2"
                value={wrapAmount}
                onChange={(e) => setWrapAmount(e.target.value)}
            />
            <Button onClick={handleWrapETH}>Wrap ETH to WETH</Button>
        </div>
      </div>

      {/* 1. Staking */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-xl font-bold">1. Stake TST</h2>
        <div className="mb-3 p-3 rounded bg-blue-50 dark:bg-blue-900/30 text-sm">
          {tstAllowance && BigInt(tstAllowance as bigint) > 0n ? (
            <span className="text-green-700 dark:text-green-400">✓ {formatEther(tstAllowance as bigint)} TST Approved</span>
          ) : (
            <span className="text-orange-700 dark:text-orange-400">⚠ TST Not Approved - Click "Approve" First</span>
          )}
        </div>
        <div className="flex gap-2">
            <input
                type="text"
                placeholder="Amount TST"
                className="flex-1 rounded border p-2"
                value={stakeAmount}
                onChange={(e) => setStakeAmount(e.target.value)}
            />
            <Button onClick={handleApproveTST}>Approve</Button>
            <Button onClick={handleStake}>Stake</Button>
        </div>
      </div>

      {/* 2. Rewards */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-xl font-bold">2. Rewards</h2>
        <div className="flex items-center justify-between">
            <p>Earned: {Number(earned).toFixed(6)} mLST</p>
            <div className="flex gap-2">
                <Button onClick={() => refetchEarned()}>Refresh</Button>
                <Button onClick={handleClaim}>Claim</Button>
            </div>
        </div>
      </div>

      {/* 3. Unstake */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-xl font-bold">3. Unstake</h2>
        <div className="flex gap-2">
            <input
                type="text"
                placeholder="Amount TST"
                className="flex-1 rounded border p-2"
                value={unstakeAmount}
                onChange={(e) => setUnstakeAmount(e.target.value)}
            />
            <Button onClick={handleUnstake}>Unstake</Button>
        </div>
      </div>

      {/* 4. Vault Deposit */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-xl font-bold">4. Vault Deposit (ETH -&gt; mLST)</h2>
        <div className="flex gap-2">
            <input
                type="text"
                placeholder="Amount ETH"
                className="flex-1 rounded border p-2"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
            />
            <Button onClick={handleDeposit}>Deposit</Button>
        </div>
      </div>

      {/* 5. Swap Exit */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-xl font-bold">5. Swap Exit (mLST -&gt; ETH)</h2>
        
        <div className="mb-3 p-3 rounded bg-blue-50 dark:bg-blue-900/30 text-sm">
          {mlstAllowance && BigInt(mlstAllowance as bigint) > 0n ? (
            <span className="text-green-700 dark:text-green-400">✓ mLST Approved</span>
          ) : (
            <span className="text-orange-700 dark:text-orange-400">⚠ mLST Not Approved - Click "Approve mLST" First</span>
          )}
        </div>
        
        <div className="mb-4 flex flex-col gap-2 text-sm text-gray-500">
            <p>Oracle: {oracleAddr ? "Connected" : "Loading..."}</p>
            <p>Estimated Quote: {oracleQuote} ETH</p>
            <p>Min Out (2% slip): {minEthOut} ETH</p>
        </div>

        <div className="flex gap-2">
            <input
                type="text"
                placeholder="Amount mLST"
                className="flex-1 rounded border p-2"
                value={swapAmount}
                onChange={(e) => setSwapAmount(e.target.value)}
            />
            <Button onClick={handleApproveMLST}>Approve mLST</Button>
            <Button onClick={handleSwapExit}>Swap Exit</Button>
        </div>
      </div>

    </div>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
      <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{title}</h3>
      <p className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{value}</p>
    </div>
  );
}

function Button({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
    return (
        <button
            onClick={onClick}
            className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
        >
            {children}
        </button>
    )
}
