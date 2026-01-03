import { ConnectButton } from "@rainbow-me/rainbowkit";

import { Counter } from "@/components/Counter";
import { HelloWorld } from "@/components/HelloWorld";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 bg-zinc-50 px-6 py-12 font-sans dark:bg-zinc-950 sm:px-12">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">Contract Dashboard</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Connect your wallet and interact with deployed contracts on localhost or testnet.
          </p>
        </div>
        <ConnectButton chainStatus="icon" showBalance={false} />
      </header>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Counter />
        <HelloWorld />
      </section>
    </main>
  );
}
