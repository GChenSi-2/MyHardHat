import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

async function viewDeployments() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const deploymentsPath = path.join(__dirname, '../ignition/deployments');
  
  if (!fs.existsSync(deploymentsPath)) {
    console.log('❌ No deployments found');
    return;
  }

  const chains = fs.readdirSync(deploymentsPath);
  
  console.log('\n📋 Deployment Summary\n');
  
  for (const chain of chains) {
    const chainPath = path.join(deploymentsPath, chain);
    const deployedAddressesPath = path.join(chainPath, 'deployed_addresses.json');
    
    if (fs.existsSync(deployedAddressesPath)) {
      const deployedAddresses = JSON.parse(
        fs.readFileSync(deployedAddressesPath, 'utf-8')
      );
      
      console.log(`🔗 Network: ${chain}`);
      console.log('─'.repeat(60));
      
      for (const [contractId, address] of Object.entries(deployedAddresses)) {
        console.log(`  ${contractId}`);
        console.log(`  └─ Address: ${address}\n`);
      }
    }
  }
}

viewDeployments().catch(console.error);
