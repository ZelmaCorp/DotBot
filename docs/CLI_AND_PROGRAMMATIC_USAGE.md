# CLI and Programmatic Usage

DotBot is designed to work in **any JavaScript/TypeScript environment**, not just browsers. This document explains how to use DotBot in CLI tools, backend services, and automated scripts.

## Overview

The DotBot library has three usage modes:

1. **Browser with UI** (Recommended for web apps)
   - Uses `DotBot` class with wallet extensions
   - Interactive approval via UI modals
   - Full chat history and execution tracking

2. **Programmatic/CLI** (For automation, backend, scripts)
   - Uses `ExecutionSystem` directly
   - Auto-approval or custom approval logic
   - No chat history needed

3. **Hybrid** (Advanced)
   - Mix of both approaches
   - Custom signing handlers
   - Flexible approval workflows

---

## 1. Browser with UI (Recommended)

This is the standard way to use DotBot in a web application:

```typescript
import { DotBot } from '@dotbot/lib';

const dotbot = await DotBot.create({
  wallet: account,
  endpoint: 'wss://rpc.polkadot.io',
  onSigningRequest: showModal // Your UI modal
});

// User chats with DotBot
await dotbot.chat("Send 2 DOT to Bob");

// DotBot prepares execution, shows in UI
// User clicks "Accept & Start"
// Transaction executes
```

**Features:**
- ✅ Full chat history
- ✅ Multiple execution flows per conversation
- ✅ Environment-bound instances (mainnet/testnet)
- ✅ Persistent storage (localStorage)
- ✅ Interactive approval

---

## 2. Programmatic/CLI Usage

For automation, backend services, or CLI tools, you can bypass the chat interface and use the execution engine directly.

### Option A: Using ExecutionSystem (Recommended)

The `ExecutionSystem` provides a complete execution pipeline without chat or UI:

```typescript
import { ApiPromise, WsProvider } from '@polkadot/api';
import { ExecutionSystem, KeyringSigner } from '@dotbot/lib';

// 1. Connect to chain
const provider = new WsProvider('wss://rpc.polkadot.io');
const api = await ApiPromise.create({ provider });

// 2. Create signer from mnemonic (for CLI/backend)
const signer = KeyringSigner.fromMnemonic(
  "your twelve word seed phrase goes here like this example"
);

// 3. Initialize execution system
const system = new ExecutionSystem();
await system.initialize(api, account, signer);

// 4. Execute a plan (auto-approve)
const executionPlan = {
  id: 'transfer-001',
  originalRequest: 'Send 2 DOT to Bob',
  steps: [
    {
      id: 'step-1',
      stepNumber: 1,
      agentClassName: 'AssetTransferAgent',
      functionName: 'transfer',
      parameters: {
        to: '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty',
        amount: '2000000000000', // 2 DOT (10 decimals)
        asset: 'DOT'
      },
      executionType: 'extrinsic',
      status: 'pending',
      description: 'Transfer 2 DOT to Bob',
      requiresConfirmation: false,
      createdAt: Date.now()
    }
  ],
  status: 'pending',
  requiresApproval: false,
  createdAt: Date.now()
};

const result = await system.execute(executionPlan, { 
  autoApprove: true 
});

console.log('Execution completed:', result);
```

### Option B: Using Executioner Directly (Advanced)

For even lower-level control, use the `Executioner` class:

```typescript
import { Executioner, ExecutionArray, KeyringSigner } from '@dotbot/lib';

// Create executioner
const executioner = new Executioner();
const signer = KeyringSigner.fromMnemonic("your seed phrase");
await executioner.initialize(api, account, signer);

// Create execution array manually
const executionArray = new ExecutionArray();
// ... add items to array ...

// Execute
await executioner.execute(executionArray, { autoApprove: true });
```

---

## 3. KeyringSigner for CLI/Backend

The `KeyringSigner` class allows you to sign transactions without browser wallet extensions:

```typescript
import { KeyringSigner } from '@dotbot/lib';

// From mnemonic (12 or 24 words)
const signer = KeyringSigner.fromMnemonic(
  "your twelve word seed phrase goes here"
);

// From URI (with derivation path)
const signer2 = KeyringSigner.fromUri(
  "//Alice",  // Dev account
  'sr25519'   // or 'ed25519'
);

// Use with ExecutionSystem
await system.initialize(api, account, signer);
```

**Security Note:** Never hardcode mnemonics in production code. Use environment variables:

```typescript
const signer = KeyringSigner.fromMnemonic(process.env.WALLET_MNEMONIC!);
```

---

## 4. Example: CLI Tool

Here's a complete example of a CLI tool that sends DOT:

```typescript
#!/usr/bin/env node
import { ApiPromise, WsProvider } from '@polkadot/api';
import { ExecutionSystem, KeyringSigner } from '@dotbot/lib';

async function main() {
  const [to, amount] = process.argv.slice(2);
  
  if (!to || !amount) {
    console.error('Usage: send-dot <address> <amount>');
    process.exit(1);
  }

  // Connect
  const provider = new WsProvider('wss://rpc.polkadot.io');
  const api = await ApiPromise.create({ provider });
  
  // Signer from env
  const signer = KeyringSigner.fromMnemonic(process.env.WALLET_MNEMONIC!);
  const account = signer.getAccount();
  
  // Initialize system
  const system = new ExecutionSystem();
  await system.initialize(api, account, signer);
  
  // Create plan
  const plan = {
    id: `transfer-${Date.now()}`,
    originalRequest: `Send ${amount} DOT to ${to}`,
    steps: [{
      id: 'step-1',
      stepNumber: 1,
      agentClassName: 'AssetTransferAgent',
      functionName: 'transfer',
      parameters: {
        to,
        amount: String(parseFloat(amount) * 1e10), // Convert to Planck
        asset: 'DOT'
      },
      executionType: 'extrinsic',
      status: 'pending',
      description: `Transfer ${amount} DOT`,
      requiresConfirmation: false,
      createdAt: Date.now()
    }],
    status: 'pending',
    requiresApproval: false,
    createdAt: Date.now()
  };
  
  // Execute
  console.log(`Sending ${amount} DOT to ${to}...`);
  const result = await system.execute(plan, { autoApprove: true });
  console.log('✅ Transaction completed!');
  
  await api.disconnect();
}

main().catch(console.error);
```

**Usage:**
```bash
export WALLET_MNEMONIC="your twelve word seed phrase"
node send-dot.js 5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty 2.5
```

---

## 5. Example: Backend Service

Here's how to use DotBot in a backend service (e.g., Express API):

```typescript
import express from 'express';
import { ApiPromise, WsProvider } from '@polkadot/api';
import { ExecutionSystem, KeyringSigner } from '@dotbot/lib';

const app = express();
app.use(express.json());

// Initialize once at startup
let system: ExecutionSystem;
let api: ApiPromise;

async function initializeSystem() {
  const provider = new WsProvider('wss://rpc.polkadot.io');
  api = await ApiPromise.create({ provider });
  
  const signer = KeyringSigner.fromMnemonic(process.env.WALLET_MNEMONIC!);
  const account = signer.getAccount();
  
  system = new ExecutionSystem();
  await system.initialize(api, account, signer);
  
  console.log('✅ Execution system initialized');
}

// Endpoint to execute transfers
app.post('/api/transfer', async (req, res) => {
  try {
    const { to, amount } = req.body;
    
    const plan = {
      id: `transfer-${Date.now()}`,
      originalRequest: `Send ${amount} DOT to ${to}`,
      steps: [{
        id: 'step-1',
        stepNumber: 1,
        agentClassName: 'AssetTransferAgent',
        functionName: 'transfer',
        parameters: { to, amount: String(parseFloat(amount) * 1e10), asset: 'DOT' },
        executionType: 'extrinsic',
        status: 'pending',
        description: `Transfer ${amount} DOT`,
        requiresConfirmation: false,
        createdAt: Date.now()
      }],
      status: 'pending',
      requiresApproval: false,
      createdAt: Date.now()
    };
    
    const result = await system.execute(plan, { autoApprove: true });
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start server
initializeSystem().then(() => {
  app.listen(3000, () => console.log('Server running on port 3000'));
});
```

---

## 6. Comparison: DotBot vs ExecutionSystem

| Feature | DotBot | ExecutionSystem |
|---------|--------|-----------------|
| **Use Case** | Web apps with UI | CLI, backend, automation |
| **Chat History** | ✅ Yes | ❌ No |
| **Multiple Executions** | ✅ Yes (tracked) | ❌ One at a time |
| **Approval Flow** | Interactive (UI) | Auto or custom |
| **Storage** | localStorage | None (stateless) |
| **Wallet** | Browser extension | KeyringSigner |
| **Complexity** | Higher (full-featured) | Lower (minimal) |

---

## 7. Advanced: Custom Approval Logic

You can implement custom approval logic for programmatic usage:

```typescript
const system = new ExecutionSystem();

// Custom approval handler
system.setSigningHandler(async (request) => {
  // Your custom logic
  if (request.description.includes('large amount')) {
    // Send notification, wait for admin approval, etc.
    await notifyAdmin(request);
    const approved = await waitForAdminApproval(request.itemId);
    return approved;
  }
  
  // Auto-approve small transactions
  return true;
});

await system.initialize(api, account, signer);
await system.execute(plan); // Uses custom approval logic
```

---

## 8. Testing and Simulation

For testing, use the Westend testnet:

```typescript
import { createRpcManagersForNetwork } from '@dotbot/lib';

// Connect to Westend testnet
const managers = createRpcManagersForNetwork('westend');
const provider = new WsProvider(managers.relayChainManager.getCurrentEndpoint());
const api = await ApiPromise.create({ provider });

// Use testnet faucet to get WND tokens
// https://faucet.polkadot.io/westend

const signer = KeyringSigner.fromMnemonic(process.env.TESTNET_MNEMONIC!);
const system = new ExecutionSystem();
await system.initialize(api, signer.getAccount(), signer);

// Execute on testnet (no real money!)
await system.execute(plan, { autoApprove: true });
```

---

## Summary

- **Web apps**: Use `DotBot` class for full-featured chat and UI
- **CLI/Backend**: Use `ExecutionSystem` for direct execution
- **Signing**: Use `KeyringSigner` for non-browser environments
- **Testing**: Use Westend testnet for safe testing

For more details, see:
- `frontend/src/lib/executionEngine/index.ts` - Execution engine exports
- `frontend/src/lib/executionEngine/signers/` - Signer implementations
- `frontend/src/lib/dotbot.ts` - DotBot class

