import { mkdir, readdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

type ContractConfig = {
  name: string;
  artifactPath: string;
};

const CONTRACTS: ContractConfig[] = [
  { name: "Counter", artifactPath: "artifacts/contracts/Counter.sol/Counter.json" },
  { name: "HelloWorld", artifactPath: "artifacts/contracts/HelloWorld.sol/HelloWorld.json" },
];

async function loadJson<T>(absolutePath: string): Promise<T | null> {
  try {
    const content = await readFile(absolutePath, "utf-8");
    return JSON.parse(content) as T;
  } catch (error) {
    return null;
  }
}

async function writePrettyJson(absolutePath: string, data: unknown) {
  const serialized = `${JSON.stringify(data, null, 2)}\n`;
  await writeFile(absolutePath, serialized, "utf-8");
}

async function syncAbis(rootDir: string, frontendContractsDir: string) {
  const abisDir = path.join(frontendContractsDir, "abis");
  await mkdir(abisDir, { recursive: true });

  for (const contract of CONTRACTS) {
    const artifactAbsolutePath = path.join(rootDir, contract.artifactPath);
    const artifact = await loadJson<{ abi?: unknown[] }>(artifactAbsolutePath);

    if (!artifact || !Array.isArray(artifact.abi)) {
      console.warn(`Skipping ABI copy for ${contract.name}; artifact not found at ${artifactAbsolutePath}`);
      continue;
    }

    const targetPath = path.join(abisDir, `${contract.name}.json`);
    await writePrettyJson(targetPath, { abi: artifact.abi });
  }
}

async function syncDeployments(rootDir: string, frontendContractsDir: string) {
  const deploymentsRoot = path.join(rootDir, "ignition", "deployments");

  const chainFolders = await readdir(deploymentsRoot, { withFileTypes: true }).catch(() => []);
  const deployments: Record<number, Record<string, string>> = {};

  for (const entry of chainFolders) {
    if (!entry.isDirectory() || !entry.name.startsWith("chain-")) {
      continue;
    }

    const chainId = Number.parseInt(entry.name.replace("chain-", ""), 10);
    if (!Number.isFinite(chainId)) {
      continue;
    }

    const deployedFile = path.join(deploymentsRoot, entry.name, "deployed_addresses.json");
    const deployed = await loadJson<Record<string, string>>(deployedFile);

    if (!deployed) {
      continue;
    }

    const chainContracts: Record<string, string> = {};

    for (const [key, address] of Object.entries(deployed)) {
      const contractName = key.split("#").pop() ?? key;
      if (CONTRACTS.some((contract) => contract.name === contractName)) {
        chainContracts[contractName] = address;
      }
    }

    if (Object.keys(chainContracts).length > 0) {
      deployments[chainId] = chainContracts;
    }
  }

  const deploymentsPath = path.join(frontendContractsDir, "deployments.json");
  await mkdir(frontendContractsDir, { recursive: true });
  await writePrettyJson(deploymentsPath, deployments);
}

async function main() {
  const currentFile = fileURLToPath(import.meta.url);
  const rootDir = path.resolve(path.dirname(currentFile), "..");
  const frontendContractsDir = path.join(rootDir, "frontend", "lib", "contracts");

  await syncAbis(rootDir, frontendContractsDir);
  await syncDeployments(rootDir, frontendContractsDir);

  console.log("Synced contract artifacts to frontend/lib/contracts");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
