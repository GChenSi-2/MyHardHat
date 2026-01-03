'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Address } from 'viem';
import { useChainId, useReadContract, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';

import { DEFAULT_CHAIN_ID, contracts } from '@/lib/contracts';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as Address;

export function Counter() {
  const chainId = useChainId();
  console.log(chainId)
  const activeChainId = chainId ?? DEFAULT_CHAIN_ID;
  const counterAddress = useMemo(
    () =>
      contracts.Counter.getAddress(activeChainId) ??
      contracts.Counter.getAddress(DEFAULT_CHAIN_ID) ??
      undefined,
    [activeChainId],
  );

  const [pendingHash, setPendingHash] = useState<`0x${string}` | undefined>();
  const [incrementBy, setIncrementBy] = useState('1');
  const [error, setError] = useState<string | null>(null);

  const {
    data: counterValue,
    refetch,
    isPending: isReading,
  } = useReadContract({
    abi: contracts.Counter.abi,
    address: (counterAddress ?? ZERO_ADDRESS) as Address,
    functionName: 'x',
    chainId: activeChainId,
    query: {
      enabled: Boolean(counterAddress),
    },
  });

  const { writeContractAsync, isPending: isWriting } = useWriteContract();

  const receipt = useWaitForTransactionReceipt({
    hash: pendingHash,
    chainId: activeChainId,
  });

  useEffect(() => {
    if (receipt.isSuccess) {
      refetch();
      setPendingHash(undefined);
    }
  }, [receipt.isSuccess, refetch]);

  const isConfirming = receipt.isPending;
  const isBusy = isWriting || isConfirming;

  const displayValue = counterValue ? counterValue.toString() : '0';

  function parseIncrement(): bigint {
    const parsed = Number.parseInt(incrementBy, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new Error('Increment must be a positive integer');
    }
    return BigInt(parsed);
  }

  async function handleInc() {
    if (!counterAddress) {
      setError('Counter contract address is not configured.');
      return;
    }
    try {
      setError(null);
      const hash = await writeContractAsync({
        address: counterAddress,
        abi: contracts.Counter.abi,
        functionName: 'inc',
        chainId: activeChainId,
      });
      setPendingHash(hash);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleIncBy() {
    if (!counterAddress) {
      setError('Counter contract address is not configured.');
      return;
    }
    try {
      setError(null);
      const amount = parseIncrement();
      const hash = await writeContractAsync({
        address: counterAddress,
        abi: contracts.Counter.abi,
        functionName: 'incBy',
        args: [amount],
        chainId: activeChainId,
      });
      setPendingHash(hash);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Counter</h2>
        {counterAddress ? (
          <span className="truncate text-xs text-zinc-500 dark:text-zinc-400">
            {counterAddress}
          </span>
        ) : (
          <span className="text-xs font-medium text-red-500">Missing address</span>
        )}
      </header>

      <div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Current value</p>
        <p className="text-4xl font-bold text-zinc-900 dark:text-zinc-50">
          {isReading ? 'Loading…' : displayValue}
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-300"
          onClick={handleInc}
          disabled={!counterAddress || isBusy}
        >
          {isBusy ? 'Pending…' : 'Increment'}
        </button>
        <div className="flex w-full gap-2 sm:w-auto">
          <input
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            value={incrementBy}
            onChange={(event) => setIncrementBy(event.target.value)}
            type="number"
            min={1}
            step={1}
            disabled={isBusy}
          />
          <button
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-400 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            onClick={handleIncBy}
            disabled={!counterAddress || isBusy}
          >
            {isBusy ? 'Pending…' : 'Increment By'}
          </button>
        </div>
      </div>

      {isConfirming && (
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          Waiting for confirmation…
        </span>
      )}

      {error && (
        <span className="text-sm text-red-500">{error}</span>
      )}
    </section>
  );
}
