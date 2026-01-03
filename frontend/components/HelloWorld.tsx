'use client';

import { useMemo } from 'react';
import type { Address } from 'viem';
import { useChainId, useReadContract } from 'wagmi';

import { DEFAULT_CHAIN_ID, contracts } from '@/lib/contracts';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as Address;
const HELLO_FUNCTION = 'greet' as const;

export function HelloWorld() {
  const chainId = useChainId();
  const activeChainId = chainId ?? DEFAULT_CHAIN_ID;
  const helloWorldAddress = useMemo(
    () =>
      contracts.HelloWorld.getAddress(activeChainId) ??
      contracts.HelloWorld.getAddress(DEFAULT_CHAIN_ID) ??
      undefined,
    [activeChainId],
  );

  const {
    data: greeting,
    isPending,
    error,
    refetch,
  } = useReadContract({
    abi: contracts.HelloWorld.abi,
    address: (helloWorldAddress ?? ZERO_ADDRESS) as Address,
    functionName: HELLO_FUNCTION,
    chainId: activeChainId,
    query: {
      enabled: Boolean(helloWorldAddress),
    },
  });

  const displayMessage = greeting ?? '—';
  const errorMessage = error instanceof Error ? error.message : undefined;

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">HelloWorld</h2>
        {helloWorldAddress ? (
          <span className="truncate text-xs text-zinc-500 dark:text-zinc-400">
            {helloWorldAddress}
          </span>
        ) : (
          <span className="text-xs font-medium text-red-500">Missing address</span>
        )}
      </header>

      <div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">sayHello response</p>
        <p className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
          {isPending ? 'Loading…' : displayMessage}
        </p>
      </div>

      <button
        className="self-start rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition hover:border-blue-500 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
        onClick={() => refetch()}
        disabled={!helloWorldAddress || isPending}
      >
        Refresh greeting
      </button>

      {errorMessage && (
        <span className="text-sm text-red-500">{errorMessage}</span>
      )}
    </section>
  );
}
