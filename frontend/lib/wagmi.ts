import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "viem";
import { hardhat, mainnet } from "wagmi/chains";

const localRpcUrl = process.env.NEXT_PUBLIC_RPC_URL ?? "http://localhost:8545";

const localhost = {
  ...hardhat,
  name: "Localhost",
  rpcUrls: {
    default: { http: [localRpcUrl] },
    public: { http: [localRpcUrl] },
  },
} as const;

export const chains = [localhost, mainnet] as const;

const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "c132da959361aeb2379523bf13335cb6";

if (!process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID && process.env.NODE_ENV !== "production") {
  console.warn("NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set; WalletConnect may not work as expected.");
}

export const wagmiConfig = getDefaultConfig({
  appName: "firstcontract",
  projectId: walletConnectProjectId,
  chains,
  transports: {
    [localhost.id]: http(localRpcUrl),
    [mainnet.id]: http(mainnet.rpcUrls.default.http[0]),
  },
  ssr: true,
});
