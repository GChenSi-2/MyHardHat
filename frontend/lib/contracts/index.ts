import type { Address } from "viem";
import counterArtifact from "./abis/Counter.json";
import helloWorldArtifact from "./abis/HelloWorld.json";
import deploymentsJson from "./deployments.json";

export type {
  Counter,
  CounterInterface,
} from "../../../types/ethers-contracts/Counter.sol/Counter";
export type {
  HelloWorld,
  HelloWorldInterface,
} from "../../../types/ethers-contracts/HelloWorld.sol/HelloWorld";

export const abis = {
  Counter: counterArtifact.abi,
  HelloWorld: helloWorldArtifact.abi,
} as const;

type ContractName = keyof typeof abis;
type DeploymentJson = Record<string, Partial<Record<string, Address>>>;

type DeploymentMap = Record<number, Partial<Record<ContractName, Address>>>;

const deployments = Object.entries(
  deploymentsJson as DeploymentJson
).reduce<DeploymentMap>((acc, [chainId, contracts]) => {
  const numericChainId = Number.parseInt(chainId, 10);
  acc[numericChainId] = Object.entries(contracts).reduce<
    Partial<Record<ContractName, Address>>
  >((contractAcc, [name, address]) => {
    if (address) {
      contractAcc[name as ContractName] = address as Address;
    }
    return contractAcc;
  }, {});
  return acc;
}, {});

export const deploymentAddresses: DeploymentMap = deployments;

const envAddresses: Partial<Record<ContractName, Address>> = {
  Counter: process.env.NEXT_PUBLIC_COUNTER_ADDRESS as Address | undefined,
  HelloWorld: process.env.NEXT_PUBLIC_HELLO_WORLD_ADDRESS as
    | Address
    | undefined,
};

export const DEFAULT_CHAIN_ID = Number.parseInt(
  process.env.NEXT_PUBLIC_CHAIN_ID ?? "31337",
  10
);

export function getContractAddress(
  contract: ContractName,
  chainId: number = DEFAULT_CHAIN_ID
): Address | undefined {
  console.log(envAddresses[contract]);
  return envAddresses[contract] ?? deployments[chainId]?.[contract];
}

export const contracts = {
  Counter: {
    abi: abis.Counter,
    getAddress(chainId?: number) {
      return getContractAddress("Counter", chainId);
    },
  },
  HelloWorld: {
    abi: abis.HelloWorld,
    getAddress(chainId?: number) {
      return getContractAddress("HelloWorld", chainId);
    },
  },
} as const;

export function getSupportedChains(): number[] {
  return Object.keys(deployments).map((chainId) =>
    Number.parseInt(chainId, 10)
  );
}
