# DotBot Core Library

Core library for Polkadot operations through natural language.

## Overview

This library provides:
- **Agents**: Specialized classes for creating Polkadot extrinsics (transfers, staking, governance, etc.)
- **System Prompts**: LLM system prompt generation for natural language interaction
- **Execution Arrays**: Structured execution plans for sequential operations
- **Types**: Shared types and interfaces

## Installation

```bash
npm install @dotbot/core
```

## Usage

### Basic Setup

```typescript
// Currently in this project:
import { AssetTransferAgent, buildSystemPrompt } from './lib';
// Or after publishing to npm:
// import { AssetTransferAgent, buildSystemPrompt } from '@dotbot/core';
import { ApiPromise, WsProvider } from '@polkadot/api';

// Initialize Polkadot API
const provider = new WsProvider('wss://rpc.polkadot.io');
const api = await ApiPromise.create({ provider });

// Create and initialize an agent
const agent = new AssetTransferAgent();
agent.initialize(api);

// Use the agent
const result = await agent.transfer({
  address: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
  recipient: '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty',
  amount: '1.5', // Human-readable format
});
```

### System Prompt Generation

```typescript
import { buildSystemPrompt } from '@dotbot/core';

const systemPrompt = await buildSystemPrompt({
  walletAddress: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
  network: 'polkadot',
});
```

### Available Agents

- **AssetTransferAgent**: Transfer DOT and tokens
- **StakingAgent**: Staking operations (bond, nominate, unbond, etc.)
- **GovernanceAgent**: Governance operations (vote, propose, delegate)
- More agents coming soon...

## Structure

```
lib/
├── agents/          # Agent classes and extrinsics
├── prompts/         # System prompt generation
├── types/           # Shared types
├── config/          # Configuration (logger, etc.)
└── index.ts         # Main export
```

## Development

This library is designed to be framework-agnostic and can be used in:
- React applications
- Node.js backends
- Other JavaScript/TypeScript projects

## License

MIT

