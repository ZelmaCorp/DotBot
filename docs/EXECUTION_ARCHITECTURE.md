# DotBot Execution Architecture

**Version:** 1.0  
**Last Updated:** 2025-11-03  
**Status:** Planning & Design Phase

## Executive Summary

This document defines the complete architecture for DotBot's transaction execution system. The system enables users to interact with the Polkadot ecosystem through natural language, with an LLM orchestrating multiple specialized agents to prepare blockchain extrinsics that users must explicitly approve before execution.

**Core Principle:** Agents are NOT autonomous. Every transaction requires explicit user approval.

**Key Components:**
1. **System Prompt Logic** - Knowledge base for LLM decision-making
2. **Agent Extrinsic Preparation** - Specialized agents return unsigned extrinsics
3. **Execution Array System** - Collection and dependency management
4. **Flow Visualization** - User preview of operations before approval
5. **Extrinsic Executioner** - Controlled execution with user approval gates

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Enhanced Flow Diagram](#enhanced-flow-diagram)
3. [Complex Scenario Walkthrough](#complex-scenario-walkthrough)
4. [Production Tasks](#production-tasks)
   - [Task 1: System Prompt Logic](#task-1-system-prompt-logic)
   - [Task 2: Agent Extrinsic Returns](#task-2-agent-extrinsic-returns)
   - [Task 3: Execution Array System](#task-3-execution-array-system)
   - [Task 4: Flow Visualization](#task-4-flow-visualization)
   - [Task 5: Extrinsic Executioner](#task-5-extrinsic-executioner)
5. [Implementation Timeline](#implementation-timeline)
6. [Safety Considerations](#safety-considerations)
7. [References](#references)

---

## System Overview

### Architecture Principles

1. **Centralized Intelligence**: Single LLM analyzes user intent and orchestrates multi-step operations
2. **Agent Specialization**: Each agent handles specific domain (transfers, swaps, governance, multisig)
3. **Extrinsic Collection**: All operations prepared before any execution
4. **User Approval Gates**: No automatic transaction signing - user reviews and approves each step
5. **Dependency Management**: System understands and respects operation dependencies

### Current State

**Implemented:**
- ASI-One LLM integration (frontend/src/services/asiOneService.ts)
- Basic agent communication (frontend/src/services/agentCommunication.ts)
- Asset Transfer Agent (agents/asset-transfer-agent/agent.py)
- Wallet connection and authentication (frontend/src/services/web3AuthService.ts)

**Missing (This Architecture):**
- System prompt file with Polkadot knowledge
- LLM tool-calling for agent orchestration
- Agents returning actual extrinsics
- Execution array management
- Flow visualization UI
- Transaction signing and execution pipeline

---

## Enhanced Flow Diagram

```
      ┌─────────┐
      │ Actor   │
      └────┬────┘
           │
           ▼
  ┌─────────────────┐
  │ Asks Question   │
  │ "Send 10 HDX    │
  │  to Alice"      │
  └───────┬─────────┘
          │
          ▼
┌──────────────────────────────────────────────────────┐
│ LLM Analyzes with System Prompt                      │
│                                                       │
│ 1. Reads system prompt file:                         │
│    - Polkadot ecosystem knowledge                    │
│    - Parachain <> token mappings                     │
│    - Available agents & their capabilities           │
│    - XCM and cross-chain patterns                    │
│                                                       │
│ 2. Determines requirements:                          │
│    - HDX is on HydraDX parachain                     │
│    - User has DOT (assume relay or AssetHub)         │
│    - Need: transfer → swap → send                    │
│                                                       │
│ 3. Builds execution plan:                            │
│    - Tool 1: asset-transfer (DOT→HydraDX)           │
│    - Tool 2: asset-swap (DOT→HDX)                    │
│    - Tool 3: asset-transfer (HDX→Alice)              │
│                                                       │
│ 4. Checks feasibility:                               │
│    - Query user balance                              │
│    - Check DEX liquidity                             │
│    - Calculate total costs                           │
└───────────┬──────────────────────────────────────────┘
            │
            ▼ (If feasible)
     ┌──────────────────────────────┐
     │ LLM calls agents/tools       │
     │ (sequential or parallel)     │
     └────┬───────────┬─────────────┘
          │           │
          ▼           ▼
 ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
 │ Transfer    │   │ Swap        │   │ Transfer    │
 │ Agent       │   │ Agent       │   │ Agent       │
 └──────┬──────┘   └──────┬──────┘   └──────┬──────┘
        │                 │                 │
        └─────────────────┴─────────────────┘
                          │
                          ▼
        ┌──────────────────────────────────────┐
        │ Extrinsics collected with metadata:  │
        │                                       │
        │ [0] XCM transfer: DOT→HydraDX        │
        │     - Fee: 0.03 DOT                  │
        │     - Dependency: none               │
        │                                       │
        │ [1] Swap: DOT→HDX on HydraDX         │
        │     - Fee: 0.2% (≈0.02 DOT)          │
        │     - Dependency: [0] must succeed   │
        │     - Estimated output: 10.05 HDX    │
        │                                       │
        │ [2] Transfer: HDX→Alice              │
        │     - Fee: 0.0001 HDX                │
        │     - Dependency: [1] must succeed   │
        └──────────────┬────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────────────┐
        │ Execution array prepared              │
        │ - Total DOT needed: 10.5 DOT         │
        │ - Expected HDX output: 10 HDX         │
        │ - Total time: ~30-45 seconds         │
        │ - Risk: Medium (price volatility)    │
        └──────────────┬────────────────────────┘
                       │
                       ├────────────► ┌─────────────────────────┐
                       │               │ FLOW VISUALIZATION      │
                       │               │                         │
                       │               │ [Polkadot]              │
                       │               │   ↓ 10.5 DOT            │
                       │               │ [HydraDX]               │
                       │               │   ↓ Swap (fee: 0.2%)    │
                       │               │   ↓ 10 HDX              │
                       │               │ [Alice's Wallet]        │
                       │               │                         │
                       │               │ [Approve] [Reject]      │
                       │               └─────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────────┐
        │ User reviews & signs             │
        │ - Can see each step              │
        │ - Understands dependencies       │
        │ - Sees all fees upfront          │
        └──────────────┬───────────────────┘
                       │
                       ▼
        ┌──────────────────────────────────┐
        │ Sequential execution with status │
        │ monitoring                        │
        │                                   │
        │ ✓ [0] DOT transferred to HydraDX│
        │ ⏳ [1] Swapping DOT→HDX...        │
        │ ⏸ [2] Waiting for [1]...         │
        └───────────────────────────────────┘
```

---

## Complex Scenario Walkthrough

### User Request: "Send 10 HDX to Alice"

**Complexity:** User only has DOT, no mention of chain switching or swapping needed.

### LLM Analysis Process

**Step 1: Understanding the Request**
- Target: Send 10 HDX to Alice
- HDX = Native token of HydraDX parachain
- Current user holdings: DOT (likely on Polkadot relay or AssetHub)

**Step 2: Knowledge Retrieval (from System Prompt)**
```markdown
# From System Prompt File:
- HydraDX: HDX (native), DOT (bridged) - DEX parachain
- HDX cannot be directly purchased with DOT on relay chain
- HydraDX has liquidity pools: DOT/HDX, USDT/HDX, etc.
- XCM required for cross-chain transfers
```

**Step 3: Operation Planning**
The LLM must determine:
1. User needs DOT → HDX conversion
2. HydraDX is the optimal place for this swap (native DEX)
3. Execution sequence:
   - Transfer DOT from Polkadot → HydraDX (XCM)
   - Swap DOT → HDX on HydraDX
   - Transfer HDX to Alice on HydraDX

**Step 4: Agent Tool Calls**
```json
[
  {
    "tool": "asset_transfer_agent",
    "parameters": {
      "operation_type": "xcm_transfer",
      "source_chain": "polkadot",
      "destination_chain": "hydradx",
      "asset": "DOT",
      "amount": "10.5",
      "recipient": "<user_address_on_hydradx>"
    }
  },
  {
    "tool": "asset_swap_agent",
    "parameters": {
      "chain": "hydradx",
      "from_asset": "DOT",
      "to_asset": "HDX",
      "amount_in": "10.5",
      "min_amount_out": "9.8",
      "slippage_tolerance": "0.02"
    }
  },
  {
    "tool": "asset_transfer_agent",
    "parameters": {
      "operation_type": "native_transfer",
      "source_chain": "hydradx",
      "destination_chain": "hydradx",
      "asset": "HDX",
      "amount": "10",
      "recipient": "5Alice...Address"
    }
  }
]
```

**Step 5: Feasibility Validation**
Before preparing extrinsics:
- Check: User has ≥10.5 DOT? ✓
- Check: HydraDX has DOT/HDX liquidity? ✓
- Check: Price impact acceptable? ✓
- Check: Alice's address is valid? ✓

**Step 6: Extrinsic Collection**
Each agent returns unsigned extrinsics with dependencies marked.

**Step 7: User Approval**
System shows flow visualization, user reviews and approves.

**Step 8: Sequential Execution**
Execute in order, respecting dependencies, with user signing each step.

---

## Production Tasks

### Task 1: System Prompt Logic

**Priority:** 🔴 CRITICAL (Foundation)  
**Estimated Effort:** 2 weeks  
**Status:** Not Started

#### Objectives

Create a comprehensive, file-based system prompt that provides the LLM with:
1. Complete Polkadot ecosystem knowledge
2. Agent tool definitions (OpenAI function calling format)
3. Cross-chain operation patterns
4. Example workflows for common operations

#### File Structure

```
prompts/
├── system-prompt.md           # Main system prompt
├── polkadot-knowledge.md      # Ecosystem topology
├── agent-tools.json           # Tool schemas
└── examples/                  # Few-shot examples
    ├── simple-transfer.md
    ├── cross-chain-transfer.md
    ├── swap-and-transfer.md
    └── governance-vote.md
```

#### System Prompt Content

##### Main Prompt Structure

```markdown
# DotBot System Prompt

You are DotBot, an AI assistant specialized in the Polkadot ecosystem. You help users execute blockchain operations through natural language.

## Your Role

1. Analyze user requests to understand intent
2. Determine required blockchain operations
3. Call appropriate agent tools to prepare transactions
4. Guide users through the approval and execution process

## Critical Rules

- NEVER assume automatic execution - users must approve all transactions
- ALWAYS explain what will happen before calling tools
- ALWAYS check feasibility before preparing extrinsics
- ALWAYS consider cross-chain requirements
- ALWAYS calculate total costs including fees

## Available Tools

You have access to specialized agents (tools) that prepare blockchain extrinsics:

[See agent-tools.json for complete schemas]

## Polkadot Ecosystem Knowledge

[See polkadot-knowledge.md for complete topology]

## Common Patterns

[See examples/ directory]
```

##### Polkadot Knowledge Base (polkadot-knowledge.md)

```markdown
# Polkadot Ecosystem Knowledge

## Relay Chains

### Polkadot
- Native Token: DOT
- Decimals: 10
- SS58 Format: 0
- Purpose: Security, governance, staking
- No smart contracts

### Kusama
- Native Token: KSM
- Decimals: 12
- SS58 Format: 2
- Purpose: Canary network, experimental features

## Parachains

### HydraDX (Polkadot)
- Parachain ID: 2034
- Native Token: HDX
- Decimals: 12
- Purpose: Omnipool DEX
- Key Features:
  - Single-sided liquidity provision
  - Low slippage swaps
  - DOT/HDX, USDT/HDX, USDC/HDX pools
- Supported Assets: DOT, HDX, USDT, USDC, DAI

### Acala (Polkadot)
- Parachain ID: 2000
- Native Token: ACA
- Decimals: 12
- Purpose: DeFi hub
- Key Features:
  - Acala Swap (DEX)
  - aUSD stablecoin
  - Liquid staking (LDOT)
- Supported Assets: DOT, ACA, aUSD, LDOT

### AssetHub (Polkadot)
- Parachain ID: 1000
- Native Token: DOT (uses relay DOT)
- Purpose: Asset issuance and management
- Key Features:
  - Create and manage assets
  - USDT, USDC bridge destination
  - Low fees for asset operations
- Supported Assets: DOT, USDT, USDC, various user-created assets

### Moonbeam (Polkadot)
- Parachain ID: 2004
- Native Token: GLMR
- Decimals: 18
- Purpose: EVM compatibility
- Key Features:
  - Full Ethereum compatibility
  - Deploy Solidity contracts
  - ERC-20 token support
- Supported Assets: GLMR, WETH, USDC, various ERC-20s

## Cross-Chain Messaging (XCM)

### Transfer Patterns

**Relay → Parachain:**
```
polkadotXcm.limitedReserveTransferAssets({
  dest: { V3: { parents: 0, interior: { X1: { Parachain: 2034 } } } },
  beneficiary: { V3: { ... } },
  assets: { ... },
  fee_asset_item: 0,
  weight_limit: "Unlimited"
})
```

**Parachain → Relay:**
```
xTokens.transfer({
  currency_id: { Token: "DOT" },
  amount: 1000000000000,
  dest: { V3: { parents: 1, interior: { X1: { AccountId32: { ... } } } } },
  dest_weight_limit: "Unlimited"
})
```

**Parachain → Parachain:**
```
xTokens.transferMultiCurrencies({
  currencies: [...],
  fee_item: 0,
  dest: { V3: { parents: 1, interior: { X2: [...] } } },
  dest_weight_limit: "Unlimited"
})
```

## Operation Decision Tree

### User wants to send Token X to Address Y

1. Does user have Token X?
   - Yes → Simple transfer
   - No → Proceed to step 2

2. Can user get Token X through swap?
   - Check available tokens
   - Check DEX liquidity
   - Calculate optimal route

3. Is Token X on same chain as user's tokens?
   - Yes → Swap then transfer
   - No → XCM transfer → Swap → Transfer

4. Calculate costs:
   - XCM fees
   - Swap fees
   - Transfer fees
   - Buffer for price slippage

### Example: Send HDX but only have DOT

**Analysis:**
- HDX is on HydraDX
- User likely has DOT on Polkadot relay
- HydraDX has DOT/HDX pool
- Optimal: Relay → HydraDX (XCM) → Swap → Transfer

**Cost Calculation:**
- XCM fee: ~0.03 DOT
- Swap fee: 0.2% of swap amount
- Transfer fee: ~0.0001 HDX
- Total DOT needed: (HDX_amount / DOT_HDX_price) + 0.03 + 1% buffer
```

##### Agent Tool Definitions (agent-tools.json)

```json
{
  "tools": [
    {
      "name": "asset_transfer_agent",
      "description": "Prepares asset transfer extrinsics for Polkadot ecosystem, including native transfers and XCM cross-chain transfers",
      "parameters": {
        "type": "object",
        "properties": {
          "operation_type": {
            "type": "string",
            "enum": ["native_transfer", "xcm_transfer", "batch_transfer"],
            "description": "Type of transfer operation"
          },
          "source_chain": {
            "type": "string",
            "enum": ["polkadot", "kusama", "hydradx", "acala", "moonbeam", "assethub"],
            "description": "Source parachain"
          },
          "destination_chain": {
            "type": "string",
            "enum": ["polkadot", "kusama", "hydradx", "acala", "moonbeam", "assethub"],
            "description": "Destination parachain (same as source for native)"
          },
          "asset": {
            "type": "string",
            "description": "Asset symbol (e.g., 'DOT', 'HDX', 'USDT')"
          },
          "amount": {
            "type": "string",
            "description": "Amount to transfer (human-readable format, e.g., '10.5')"
          },
          "recipient": {
            "type": "string",
            "description": "Recipient address (SS58 format)"
          },
          "sender_address": {
            "type": "string",
            "description": "Sender address (for balance checks and nonce)"
          }
        },
        "required": ["operation_type", "source_chain", "asset", "amount", "recipient"]
      }
    },
    {
      "name": "asset_swap_agent",
      "description": "Prepares token swap extrinsics on Polkadot DEXs, with optimal routing and slippage protection",
      "parameters": {
        "type": "object",
        "properties": {
          "chain": {
            "type": "string",
            "enum": ["hydradx", "acala", "karura"],
            "description": "DEX parachain to use for swap"
          },
          "from_asset": {
            "type": "string",
            "description": "Asset to swap from (e.g., 'DOT')"
          },
          "to_asset": {
            "type": "string",
            "description": "Asset to swap to (e.g., 'HDX')"
          },
          "amount_in": {
            "type": "string",
            "description": "Input amount (human-readable)"
          },
          "min_amount_out": {
            "type": "string",
            "description": "Minimum acceptable output amount (for slippage protection)"
          },
          "slippage_tolerance": {
            "type": "number",
            "description": "Maximum acceptable slippage (0.01 = 1%)",
            "default": 0.02
          },
          "route": {
            "type": "array",
            "items": { "type": "string" },
            "description": "Optional: Specify custom route for multi-hop swaps"
          }
        },
        "required": ["chain", "from_asset", "to_asset", "amount_in"]
      }
    },
    {
      "name": "governance_agent",
      "description": "Prepares governance extrinsics for voting, delegating, and proposal management",
      "parameters": {
        "type": "object",
        "properties": {
          "operation_type": {
            "type": "string",
            "enum": ["vote", "delegate", "undelegate", "propose"],
            "description": "Type of governance operation"
          },
          "referendum_id": {
            "type": "number",
            "description": "Referendum ID (for voting)"
          },
          "vote_decision": {
            "type": "string",
            "enum": ["aye", "nay", "abstain"],
            "description": "Vote decision"
          },
          "conviction": {
            "type": "string",
            "enum": ["None", "Locked1x", "Locked2x", "Locked3x", "Locked4x", "Locked5x", "Locked6x"],
            "description": "Vote conviction multiplier",
            "default": "None"
          },
          "amount": {
            "type": "string",
            "description": "Amount to lock for voting (DOT)"
          }
        },
        "required": ["operation_type"]
      }
    },
    {
      "name": "multisig_agent",
      "description": "Prepares multisig wallet extrinsics for creation and transaction management",
      "parameters": {
        "type": "object",
        "properties": {
          "operation_type": {
            "type": "string",
            "enum": ["create", "approve", "execute", "cancel"],
            "description": "Type of multisig operation"
          },
          "threshold": {
            "type": "number",
            "description": "Required number of approvals (for creation)"
          },
          "signatories": {
            "type": "array",
            "items": { "type": "string" },
            "description": "List of signatory addresses"
          },
          "call_hash": {
            "type": "string",
            "description": "Hash of the call to approve/execute"
          },
          "call_data": {
            "type": "object",
            "description": "The actual call to execute (for creation)"
          }
        },
        "required": ["operation_type"]
      }
    }
  ]
}
```

#### Integration Points

**File:** `frontend/src/services/asiOneService.ts`

Current implementation (line 163-182):
```typescript
private getSystemPrompt(context?: any): string {
  return `You are DotBot...` // Hardcoded
}
```

**New Implementation:**
```typescript
import systemPromptMd from '../../prompts/system-prompt.md';
import polkadotKnowledge from '../../prompts/polkadot-knowledge.md';
import agentTools from '../../prompts/agent-tools.json';

private getSystemPrompt(context?: any): string {
  // Load base prompt
  let prompt = systemPromptMd;
  
  // Inject Polkadot knowledge
  prompt += '\n\n## Polkadot Ecosystem\n\n' + polkadotKnowledge;
  
  // Inject tool definitions
  prompt += '\n\n## Available Tools\n\n' + JSON.stringify(agentTools, null, 2);
  
  // Inject dynamic context
  prompt += `\n\n## Current Context\n\n`;
  prompt += `- User Wallet: ${context?.walletAddress || 'Not connected'}\n`;
  prompt += `- Network: ${context?.network || 'Polkadot'}\n`;
  prompt += `- Balance: ${context?.balance || 'Unknown'}\n`;
  
  return prompt;
}
```

#### Deliverables

1. ✅ Markdown files with complete Polkadot knowledge
2. ✅ JSON schema for all agent tools (OpenAI format)
3. ✅ Example workflows for common operations
4. ✅ File loading mechanism in ASI-One service
5. ✅ Version control for prompts

---

### Task 2: Agent Extrinsic Returns

**Priority:** 🔴 CRITICAL (Core)  
**Estimated Effort:** 2 weeks  
**Status:** Not Started  
**Dependencies:** Task 1 (partial)

#### Objectives

Upgrade all agents to return properly formatted, unsigned Polkadot extrinsics instead of generic transaction data objects.

#### Current State

**File:** `agents/asset-transfer-agent/agent.py` (lines 178-190)

Current return format:
```python
transaction_data = {
    "pallet": "Balances",
    "call": "transfer",
    "args": {
        "dest": {"Id": request.recipient},
        "value": amount_planck
    },
    "network": request.network,
    "amount_display": f"{request.amount} {request.asset}",
    "recipient_display": request.recipient,
    "estimated_fee": "0.01 DOT"
}
```

#### New Standard Format

All agents must return:

```typescript
interface AgentExtrinsicResponse {
  success: boolean;
  agent_id: string;
  operation_description: string; // "Transfer 10 DOT to Alice on Polkadot"
  
  extrinsics: Array<{
    id: string; // unique identifier
    chain: string; // "polkadot", "hydradx", etc.
    
    // The actual unsigned extrinsic
    extrinsic: {
      method: {
        pallet: string;  // "balances"
        method: string;  // "transferKeepAlive"
        args: Record<string, any>;
      };
      // Optional: serialized hex for direct use with polkadot.js
      hex?: string;
    };
    
    // Human-readable breakdown
    human_readable: {
      action: string; // "Transfer DOT"
      from: string;   // User's address
      to: string;     // Recipient address
      amount: string; // "10 DOT"
      network: string; // "Polkadot"
    };
    
    // Execution metadata
    metadata: {
      estimated_fee: string; // "0.01 DOT"
      requires_signature: true;
      dependencies: string[]; // IDs of extrinsics that must execute first
      estimated_time: number; // seconds
      risk_level: "low" | "medium" | "high";
      can_batch: boolean; // can this be batched with others on same chain?
      nonce?: number; // if pre-calculated
    };
  }>;
  
  // Overall operation metadata
  operation_metadata: {
    total_estimated_fee: string; // "0.05 DOT, 0.001 HDX"
    total_estimated_time: number; // total seconds
    execution_order: string[]; // ordered array of extrinsic IDs
    warnings?: string[]; // any warnings for user
  };
}
```

#### Implementation Examples

##### Asset Transfer Agent (Python)

```python
# agents/asset-transfer-agent/agent.py

from substrateinterface import SubstrateInterface
import uuid

async def prepare_transfer(self, request: TransferRequest) -> AgentExtrinsicResponse:
    """Prepare transfer extrinsic with complete metadata"""
    
    # Connect to chain
    api = SubstrateInterface(url=self.networks[request.network]["rpc_url"])
    
    # Build the extrinsic (unsigned)
    call = api.compose_call(
        call_module='Balances',
        call_function='transferKeepAlive',
        call_params={
            'dest': request.recipient,
            'value': int(float(request.amount) * 10**10)  # Convert to planck
        }
    )
    
    # Get fee estimate
    payment_info = api.get_payment_info(call, request.sender_address)
    fee_planck = payment_info['partialFee']
    fee_dot = fee_planck / 10**10
    
    # Generate unique ID
    extrinsic_id = str(uuid.uuid4())
    
    return {
        "success": True,
        "agent_id": "asset-transfer",
        "operation_description": f"Transfer {request.amount} {request.asset} to {request.recipient[:8]}... on {request.network}",
        
        "extrinsics": [{
            "id": extrinsic_id,
            "chain": request.network,
            
            "extrinsic": {
                "method": {
                    "pallet": "Balances",
                    "method": "transferKeepAlive",
                    "args": {
                        "dest": request.recipient,
                        "value": int(float(request.amount) * 10**10)
                    }
                },
                # Optional: include hex for direct signing
                "hex": call.data.hex()
            },
            
            "human_readable": {
                "action": f"Transfer {request.asset}",
                "from": request.sender_address,
                "to": request.recipient,
                "amount": f"{request.amount} {request.asset}",
                "network": request.network.capitalize()
            },
            
            "metadata": {
                "estimated_fee": f"{fee_dot:.4f} {request.asset}",
                "requires_signature": True,
                "dependencies": [],
                "estimated_time": 12,  # block time
                "risk_level": "low",
                "can_batch": True,
                "nonce": None  # Will be set at signing time
            }
        }],
        
        "operation_metadata": {
            "total_estimated_fee": f"{fee_dot:.4f} {request.asset}",
            "total_estimated_time": 12,
            "execution_order": [extrinsic_id],
            "warnings": []
        }
    }
```

##### Asset Swap Agent (Conceptual)

```typescript
// For HydraDX swap (would be in Python, showing TS for clarity)

interface SwapExtrinsic extends AgentExtrinsicResponse {
  extrinsics: [{
    id: string;
    chain: "hydradx";
    extrinsic: {
      method: {
        pallet: "Router" | "Omnipool";
        method: "sell" | "buy";
        args: {
          asset_in: number;  // Asset ID
          asset_out: number; // Asset ID
          amount_in: string;
          min_amount_out: string;
          route: number[];   // Route through pools
        };
      };
    };
    human_readable: {
      action: "Swap DOT for HDX";
      from: string;      // User address
      to: string;        // Same (swap in place)
      amount: "10.5 DOT → ~10 HDX";
      network: "HydraDX";
    };
    metadata: {
      estimated_fee: "0.02 DOT";
      requires_signature: true;
      dependencies: string[];  // May depend on XCM transfer
      estimated_time: 12;
      risk_level: "medium";  // Price volatility
      can_batch: false;      // Swaps should be isolated
      price_impact: "0.15%"; // Extra metadata for swaps
      liquidity_available: "5000 DOT";
    };
  }];
}
```

#### Migration Strategy

1. **Phase 1:** Update Asset Transfer Agent
   - Implement new response format
   - Test with Polkadot relay chain
   - Add fee estimation
   - Add XCM support

2. **Phase 2:** Create Asset Swap Agent
   - HydraDX integration
   - Route optimization
   - Price impact calculation

3. **Phase 3:** Update Frontend Integration
   - Update `agentCommunication.ts` to handle new format
   - Parse extrinsic responses
   - Extract metadata for display

4. **Phase 4:** Testing
   - Unit tests for each agent
   - Integration tests for frontend
   - End-to-end tests with testnet

#### Deliverables

1. ✅ Updated Asset Transfer Agent with new format
2. ✅ Asset Swap Agent implementation
3. ✅ Governance Agent (basic voting support)
4. ✅ Frontend service updates for parsing
5. ✅ Test coverage for all agents

---

### Task 3: Execution Array System

**Priority:** 🟡 IMPORTANT (Management Layer)  
**Estimated Effort:** 1.5 weeks  
**Status:** Not Started  
**Dependencies:** Task 2

#### Objectives

Create a state management system that collects extrinsics from multiple agents, resolves dependencies, validates feasibility, and prepares them for execution.

#### Architecture

The Execution Array System consists of:

1. **Store** - Zustand store for state management
2. **Dependency Resolver** - Builds execution order graph
3. **Validator** - Checks feasibility before execution
4. **Cost Calculator** - Aggregates fees and resource requirements

#### Implementation

##### Execution Store (Zustand)

**File:** `frontend/src/stores/executionStore.ts` (new file)

```typescript
import create from 'zustand';
import { ExecutionExtrinsic, ExecutionStatus, ValidationResult } from '../types/execution';

interface ExecutionArrayStore {
  // State
  extrinsics: Map<string, ExecutionExtrinsic>;
  dependencies: Map<string, string[]>;
  executionOrder: string[];
  currentlyExecuting: string | null;
  statuses: Map<string, ExecutionStatus>;
  
  // Metadata
  totalCost: CostBreakdown | null;
  validationResult: ValidationResult | null;
  
  // Actions - Collection
  addExtrinsic: (extrinsic: ExecutionExtrinsic) => void;
  addExtrinsics: (extrinsics: ExecutionExtrinsic[]) => void;
  removeExtrinsic: (id: string) => void;
  clearAll: () => void;
  
  // Actions - Analysis
  resolveExecutionOrder: () => string[];
  validateAll: () => Promise<ValidationResult>;
  calculateTotalCost: () => CostBreakdown;
  identifyBatchableGroups: () => string[][];
  
  // Actions - Execution
  setCurrentlyExecuting: (id: string | null) => void;
  updateStatus: (id: string, status: ExecutionStatus) => void;
  markCompleted: (id: string, result: any) => void;
  markFailed: (id: string, error: string) => void;
}

export const useExecutionStore = create<ExecutionArrayStore>((set, get) => ({
  // Initial state
  extrinsics: new Map(),
  dependencies: new Map(),
  executionOrder: [],
  currentlyExecuting: null,
  statuses: new Map(),
  totalCost: null,
  validationResult: null,
  
  // Add single extrinsic
  addExtrinsic: (extrinsic) => {
    const { extrinsics, dependencies, statuses } = get();
    
    extrinsics.set(extrinsic.id, extrinsic);
    dependencies.set(extrinsic.id, extrinsic.metadata.dependencies || []);
    statuses.set(extrinsic.id, 'pending');
    
    set({ 
      extrinsics: new Map(extrinsics),
      dependencies: new Map(dependencies),
      statuses: new Map(statuses)
    });
    
    // Auto-resolve execution order
    get().resolveExecutionOrder();
  },
  
  // Add multiple extrinsics
  addExtrinsics: (extrinsicList) => {
    extrinsicList.forEach(ext => get().addExtrinsic(ext));
  },
  
  // Remove extrinsic
  removeExtrinsic: (id) => {
    const { extrinsics, dependencies, statuses } = get();
    
    extrinsics.delete(id);
    dependencies.delete(id);
    statuses.delete(id);
    
    // Remove this ID from other dependencies
    dependencies.forEach((deps, key) => {
      const filtered = deps.filter(d => d !== id);
      dependencies.set(key, filtered);
    });
    
    set({
      extrinsics: new Map(extrinsics),
      dependencies: new Map(dependencies),
      statuses: new Map(statuses)
    });
    
    get().resolveExecutionOrder();
  },
  
  // Clear all
  clearAll: () => {
    set({
      extrinsics: new Map(),
      dependencies: new Map(),
      executionOrder: [],
      currentlyExecuting: null,
      statuses: new Map(),
      totalCost: null,
      validationResult: null
    });
  },
  
  // Resolve execution order using topological sort
  resolveExecutionOrder: () => {
    const { dependencies } = get();
    const order: string[] = [];
    const visited = new Set<string>();
    const temp = new Set<string>();
    
    // Topological sort DFS
    const visit = (id: string) => {
      if (temp.has(id)) {
        throw new Error('Circular dependency detected');
      }
      if (visited.has(id)) return;
      
      temp.add(id);
      
      const deps = dependencies.get(id) || [];
      deps.forEach(depId => visit(depId));
      
      temp.delete(id);
      visited.add(id);
      order.push(id);
    };
    
    // Visit all nodes
    Array.from(dependencies.keys()).forEach(id => {
      if (!visited.has(id)) {
        visit(id);
      }
    });
    
    set({ executionOrder: order });
    return order;
  },
  
  // Validate all extrinsics
  validateAll: async () => {
    const { extrinsics, executionOrder } = get();
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Check each extrinsic
    for (const id of executionOrder) {
      const ext = extrinsics.get(id);
      if (!ext) continue;
      
      // Validate recipient address format
      if (ext.humanReadable.to && !isValidSubstrateAddress(ext.humanReadable.to)) {
        errors.push(`Invalid recipient address in ${ext.id}`);
      }
      
      // Check for sufficient balance (would call RPC)
      // This is simplified - real implementation would query chain
      const hasBalance = await checkBalance(ext);
      if (!hasBalance) {
        errors.push(`Insufficient balance for ${ext.humanReadable.action}`);
      }
      
      // Validate dependencies exist
      for (const depId of ext.metadata.dependencies) {
        if (!extrinsics.has(depId)) {
          errors.push(`Missing dependency ${depId} for ${id}`);
        }
      }
    }
    
    const result: ValidationResult = {
      valid: errors.length === 0,
      errors,
      warnings
    };
    
    set({ validationResult: result });
    return result;
  },
  
  // Calculate total cost across all chains
  calculateTotalCost: () => {
    const { extrinsics } = get();
    const costByChain: Record<string, Record<string, number>> = {};
    let totalTime = 0;
    
    extrinsics.forEach(ext => {
      const chain = ext.chain;
      const fee = ext.metadata.estimated_fee;
      
      // Parse fee (e.g., "0.01 DOT")
      const [amount, token] = fee.split(' ');
      const numericAmount = parseFloat(amount);
      
      if (!costByChain[chain]) {
        costByChain[chain] = {};
      }
      
      costByChain[chain][token] = (costByChain[chain][token] || 0) + numericAmount;
      totalTime += ext.metadata.estimated_time || 0;
    });
    
    // Aggregate by token across all chains
    const totalByToken: Record<string, number> = {};
    Object.values(costByChain).forEach(chainCosts => {
      Object.entries(chainCosts).forEach(([token, amount]) => {
        totalByToken[token] = (totalByToken[token] || 0) + amount;
      });
    });
    
    const result: CostBreakdown = {
      byChain: costByChain,
      totalByToken,
      totalTime,
      sufficientBalance: true // Would be determined by validation
    };
    
    set({ totalCost: result });
    return result;
  },
  
  // Identify groups of extrinsics that can be batched
  identifyBatchableGroups: () => {
    const { extrinsics, executionOrder } = get();
    const groups: string[][] = [];
    let currentGroup: string[] = [];
    let currentChain: string | null = null;
    
    for (const id of executionOrder) {
      const ext = extrinsics.get(id);
      if (!ext) continue;
      
      // Can only batch if:
      // 1. Same chain
      // 2. Can batch flag is true
      // 3. No dependencies on previous (or all deps in current group)
      const canBatch = ext.metadata.can_batch &&
                       (ext.chain === currentChain || currentChain === null) &&
                       ext.metadata.dependencies.every(d => currentGroup.includes(d));
      
      if (canBatch) {
        currentGroup.push(id);
        currentChain = ext.chain;
      } else {
        // Start new group
        if (currentGroup.length > 0) {
          groups.push(currentGroup);
        }
        currentGroup = [id];
        currentChain = ext.chain;
      }
    }
    
    // Add final group
    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }
    
    return groups;
  },
  
  // Execution tracking
  setCurrentlyExecuting: (id) => {
    set({ currentlyExecuting: id });
  },
  
  updateStatus: (id, status) => {
    const { statuses } = get();
    statuses.set(id, status);
    set({ statuses: new Map(statuses) });
  },
  
  markCompleted: (id, result) => {
    get().updateStatus(id, 'finalized');
    // Could store result in separate map if needed
  },
  
  markFailed: (id, error) => {
    get().updateStatus(id, 'failed');
    // Could store error details
  }
}));

// Helper types

interface ExecutionExtrinsic {
  id: string;
  chain: string;
  extrinsic: any;
  humanReadable: {
    action: string;
    from: string;
    to: string;
    amount: string;
    network: string;
  };
  metadata: {
    estimated_fee: string;
    requires_signature: boolean;
    dependencies: string[];
    estimated_time: number;
    risk_level: "low" | "medium" | "high";
    can_batch: boolean;
  };
  addedAt: number;
}

type ExecutionStatus = 
  | "pending"
  | "ready"
  | "signing"
  | "broadcasting"
  | "in_block"
  | "finalized"
  | "failed"
  | "cancelled";

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

interface CostBreakdown {
  byChain: Record<string, Record<string, number>>;
  totalByToken: Record<string, number>;
  totalTime: number;
  sufficientBalance: boolean;
  missingAmounts?: Record<string, number>;
}

// Helper functions (would be in separate file)
function isValidSubstrateAddress(address: string): boolean {
  // Implement SS58 validation
  return address.length > 40 && address.startsWith('5');
}

async function checkBalance(ext: ExecutionExtrinsic): Promise<boolean> {
  // Would query chain for user balance
  // Compare against required amount + fees
  return true; // Placeholder
}
```

#### Usage Example

```typescript
// In a React component

import { useExecutionStore } from '../stores/executionStore';

function TransactionFlow() {
  const {
    extrinsics,
    executionOrder,
    totalCost,
    addExtrinsics,
    validateAll,
    calculateTotalCost
  } = useExecutionStore();
  
  // When agent returns extrinsics
  const handleAgentResponse = (response: AgentExtrinsicResponse) => {
    addExtrinsics(response.extrinsics);
    
    // Validate and calculate costs
    const validation = await validateAll();
    if (!validation.valid) {
      alert(`Validation errors: ${validation.errors.join(', ')}`);
      return;
    }
    
    const cost = calculateTotalCost();
    console.log('Total cost:', cost);
  };
  
  return (
    <div>
      <h2>Execution Queue</h2>
      {executionOrder.map(id => {
        const ext = extrinsics.get(id);
        return <ExtrinsicCard key={id} extrinsic={ext} />;
      })}
      
      {totalCost && (
        <div>
          <h3>Total Cost</h3>
          {Object.entries(totalCost.totalByToken).map(([token, amount]) => (
            <p key={token}>{amount} {token}</p>
          ))}
        </div>
      )}
    </div>
  );
}
```

#### Deliverables

1. ✅ Execution store with Zustand
2. ✅ Dependency resolution (topological sort)
3. ✅ Validation logic (balance, addresses, dependencies)
4. ✅ Cost calculation and aggregation
5. ✅ Batch identification algorithm
6. ✅ React hooks for UI integration
7. ✅ Unit tests for store logic

---

### Task 4: Flow Visualization

**Priority:** 🟢 NICE-TO-HAVE (UX Enhancement)  
**Estimated Effort:** 1 week  
**Status:** Not Started  
**Dependencies:** Task 3

#### Objectives

Create an intuitive visual representation of the transaction flow before user approval, showing chains, operations, amounts, and fees.

#### Component Design

**File:** `frontend/src/components/execution/FlowDiagram.tsx` (new file)

```typescript
import React from 'react';
import { useExecutionStore } from '../../stores/executionStore';
import './FlowDiagram.css';

interface FlowDiagramProps {
  onApprove: () => void;
  onReject: () => void;
}

export const FlowDiagram: React.FC<FlowDiagramProps> = ({ onApprove, onReject }) => {
  const { extrinsics, executionOrder, totalCost } = useExecutionStore();
  
  // Group extrinsics by chain for visualization
  const flowSteps = executionOrder.map(id => extrinsics.get(id)!);
  
  return (
    <div className="flow-diagram">
      <h2>Transaction Flow Preview</h2>
      
      <div className="flow-container">
        {flowSteps.map((step, index) => (
          <React.Fragment key={step.id}>
            <FlowStep
              step={step}
              stepNumber={index + 1}
            />
            
            {index < flowSteps.length - 1 && (
              <FlowArrow />
            )}
          </React.Fragment>
        ))}
      </div>
      
      <FlowSummary totalCost={totalCost} />
      
      <div className="flow-actions">
        <button onClick={onReject} className="btn-secondary">
          Cancel
        </button>
        <button onClick={onApprove} className="btn-primary">
          Approve & Sign All
        </button>
      </div>
    </div>
  );
};

const FlowStep: React.FC<{ step: any; stepNumber: number }> = ({ step, stepNumber }) => {
  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return '#4CAF50';
      case 'medium': return '#FF9800';
      case 'high': return '#F44336';
      default: return '#666';
    }
  };
  
  return (
    <div className="flow-step">
      <div className="step-header">
        <span className="step-number">{stepNumber}</span>
        <span className="step-chain">{step.chain}</span>
      </div>
      
      <div className="step-content">
        <h3>{step.humanReadable.action}</h3>
        <div className="step-details">
          <p><strong>Amount:</strong> {step.humanReadable.amount}</p>
          {step.humanReadable.to && (
            <p><strong>To:</strong> {step.humanReadable.to.slice(0, 8)}...{step.humanReadable.to.slice(-6)}</p>
          )}
          <p><strong>Fee:</strong> {step.metadata.estimated_fee}</p>
          <p><strong>Time:</strong> ~{step.metadata.estimated_time}s</p>
        </div>
        
        <div 
          className="risk-indicator"
          style={{ backgroundColor: getRiskColor(step.metadata.risk_level) }}
        >
          Risk: {step.metadata.risk_level}
        </div>
        
        {step.metadata.dependencies.length > 0 && (
          <div className="dependencies">
            ⚠️ Depends on step {step.metadata.dependencies.map(d => 
              flowSteps.findIndex(s => s.id === d) + 1
            ).join(', ')}
          </div>
        )}
      </div>
    </div>
  );
};

const FlowArrow: React.FC = () => {
  return (
    <div className="flow-arrow">
      <svg width="40" height="40" viewBox="0 0 40 40">
        <path d="M5 20 L30 20 M25 15 L30 20 L25 25" 
              stroke="currentColor" 
              strokeWidth="2" 
              fill="none" />
      </svg>
    </div>
  );
};

const FlowSummary: React.FC<{ totalCost: any }> = ({ totalCost }) => {
  if (!totalCost) return null;
  
  return (
    <div className="flow-summary">
      <h3>Summary</h3>
      <div className="summary-grid">
        <div>
          <strong>Total Cost:</strong>
          <ul>
            {Object.entries(totalCost.totalByToken).map(([token, amount]) => (
              <li key={token}>{amount} {token}</li>
            ))}
          </ul>
        </div>
        <div>
          <strong>Total Time:</strong>
          <p>~{totalCost.totalTime} seconds</p>
        </div>
        <div>
          <strong>Balance Check:</strong>
          <p className={totalCost.sufficientBalance ? 'text-success' : 'text-error'}>
            {totalCost.sufficientBalance ? '✓ Sufficient' : '✗ Insufficient'}
          </p>
        </div>
      </div>
    </div>
  );
};
```

**CSS File:** `frontend/src/components/execution/FlowDiagram.css` (new file)

```css
.flow-diagram {
  background: var(--surface-color);
  border-radius: 12px;
  padding: 24px;
  max-width: 800px;
  margin: 0 auto;
}

.flow-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin: 24px 0;
}

.flow-step {
  background: var(--card-background);
  border: 2px solid var(--border-color);
  border-radius: 8px;
  padding: 16px;
  transition: all 0.2s;
}

.flow-step:hover {
  border-color: var(--primary-color);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.step-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.step-number {
  background: var(--primary-color);
  color: white;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
}

.step-chain {
  background: var(--secondary-color);
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 12px;
  text-transform: uppercase;
  font-weight: 600;
}

.step-content h3 {
  margin: 0 0 12px 0;
  color: var(--text-primary);
}

.step-details {
  margin: 12px 0;
  font-size: 14px;
  color: var(--text-secondary);
}

.step-details p {
  margin: 4px 0;
}

.risk-indicator {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 4px;
  color: white;
  font-size: 12px;
  font-weight: 600;
  margin-top: 8px;
}

.dependencies {
  margin-top: 12px;
  padding: 8px;
  background: rgba(255, 152, 0, 0.1);
  border-left: 3px solid #FF9800;
  font-size: 13px;
}

.flow-arrow {
  display: flex;
  justify-content: center;
  align-items: center;
  color: var(--text-secondary);
}

.flow-summary {
  background: var(--highlight-background);
  border-radius: 8px;
  padding: 16px;
  margin: 24px 0;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-top: 12px;
}

.flow-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 24px;
}

.btn-primary,
.btn-secondary {
  padding: 12px 24px;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  font-size: 16px;
  transition: all 0.2s;
}

.btn-primary {
  background: var(--primary-color);
  color: white;
}

.btn-primary:hover {
  background: var(--primary-color-dark);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.btn-secondary {
  background: transparent;
  border: 2px solid var(--border-color);
  color: var(--text-primary);
}

.btn-secondary:hover {
  border-color: var(--primary-color);
}

.text-success {
  color: #4CAF50;
}

.text-error {
  color: #F44336;
}
```

#### Integration

```typescript
// In App.tsx or transaction flow component

import { FlowDiagram } from './components/execution/FlowDiagram';
import { useExecutionStore } from './stores/executionStore';

function TransactionApprovalScreen() {
  const { clearAll } = useExecutionStore();
  
  const handleApprove = () => {
    // Proceed to signing
    startExecution();
  };
  
  const handleReject = () => {
    clearAll();
    // Return to chat
  };
  
  return (
    <FlowDiagram
      onApprove={handleApprove}
      onReject={handleReject}
    />
  );
}
```

#### Deliverables

1. ✅ FlowDiagram React component
2. ✅ Styling with CSS
3. ✅ Visual step representation
4. ✅ Dependency indicators
5. ✅ Cost summary display
6. ✅ Approve/reject actions
7. ✅ Responsive design

---

### Task 5: Extrinsic Executioner

**Priority:** 🔴 CRITICAL (Execution Layer)  
**Estimated Effort:** 3 weeks  
**Status:** Not Started  
**Dependencies:** Tasks 2, 3

This is the most complex component of the system. It handles the actual execution of transactions with full user control.

#### Architecture Overview

```
┌─────────────────────────────────┐
│   Extrinsic Executioner         │
│                                 │
│  ┌──────────────────────────┐  │
│  │  API Connections         │  │
│  │  (Polkadot, HydraDX...)  │  │
│  └──────────────────────────┘  │
│                                 │
│  ┌──────────────────────────┐  │
│  │  Execution Controller    │  │
│  │  - Sequential            │  │
│  │  - Batch                 │  │
│  │  - Dependency resolver   │  │
│  └──────────────────────────┘  │
│                                 │
│  ┌──────────────────────────┐  │
│  │  Signing Manager         │  │
│  │  - User approval UI      │  │
│  │  - Wallet integration    │  │
│  │  - Signature collection  │  │
│  └──────────────────────────┘  │
│                                 │
│  ┌──────────────────────────┐  │
│  │  Status Monitor          │  │
│  │  - Transaction tracking  │  │
│  │  - Event listening       │  │
│  │  - Error handling        │  │
│  └──────────────────────────┘  │
└─────────────────────────────────┘
```

#### Core Implementation

**File:** `frontend/src/services/extrinsicExecutioner.ts` (new file)

```typescript
import { ApiPromise, WsProvider } from '@polkadot/api';
import { web3FromAddress } from '@polkadot/extension-dapp';
import { SubmittableExtrinsic } from '@polkadot/api/types';
import { useExecutionStore } from '../stores/executionStore';
import { Web3AuthService } from './web3AuthService';
import type { WalletAccount } from '../types/wallet';

export interface ExecutionOptions {
  continueOnError: boolean;  // Continue if one extrinsic fails?
  allowBatching: boolean;     // Allow batching compatible extrinsics?
  timeout: number;            // Timeout per extrinsic (ms)
}

export interface ExecutionResult {
  success: boolean;
  results: Map<string, ExtrinsicResult>;
  totalTime: number;
  errors: string[];
}

export interface ExtrinsicResult {
  success: boolean;
  extrinsicId: string;
  blockHash?: string;
  events?: any[];
  error?: string;
  txHash?: string;
}

interface SignatureResult {
  approved: boolean;
  signature?: any;
  error?: string;
}

export class ExtrinsicExecutioner {
  private apiConnections: Map<string, ApiPromise>;
  private web3AuthService: Web3AuthService;
  private executionStore: ReturnType<typeof useExecutionStore>;
  
  // Network RPC endpoints
  private rpcEndpoints: Record<string, string> = {
    'polkadot': 'wss://rpc.polkadot.io',
    'kusama': 'wss://kusama-rpc.polkadot.io',
    'hydradx': 'wss://rpc.hydradx.cloud',
    'acala': 'wss://acala-rpc.dwellir.com',
    'moonbeam': 'wss://wss.api.moonbeam.network',
    'assethub': 'wss://polkadot-asset-hub-rpc.polkadot.io'
  };
  
  constructor() {
    this.apiConnections = new Map();
    this.web3AuthService = new Web3AuthService();
    this.executionStore = useExecutionStore.getState();
  }
  
  /**
   * Main execution method
   * Takes execution array and executes with user approval at each step
   */
  async executeAll(options: ExecutionOptions = {
    continueOnError: false,
    allowBatching: true,
    timeout: 60000
  }): Promise<ExecutionResult> {
    
    const startTime = Date.now();
    const results: Map<string, ExtrinsicResult> = new Map();
    const errors: string[] = [];
    
    try {
      // Get execution order from store
      const { extrinsics, executionOrder } = this.executionStore;
      
      if (executionOrder.length === 0) {
        throw new Error('No extrinsics to execute');
      }
      
      // Validate before starting
      const validation = await this.executionStore.validateAll();
      if (!validation.valid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }
      
      // Group extrinsics for execution
      const executionGroups = options.allowBatching
        ? this.groupExtrinsicsForBatching(extrinsics, executionOrder)
        : this.groupSequentially(extrinsics, executionOrder);
      
      // Execute each group
      for (const group of executionGroups) {
        if (group.canBatch && group.extrinsics.length > 1) {
          // Execute as batch (single signature)
          const batchResult = await this.executeBatch(group.extrinsics, options);
          group.extrinsics.forEach(ext => {
            results.set(ext.id, batchResult);
          });
        } else {
          // Execute sequentially
          for (const extrinsic of group.extrinsics) {
            const result = await this.executeSequential(extrinsic, options);
            results.set(extrinsic.id, result);
            
            // Check if we should continue after failure
            if (!result.success && !options.continueOnError) {
              errors.push(`Execution stopped after failure: ${result.error}`);
              return this.buildExecutionResult(results, false, Date.now() - startTime, errors);
            }
            
            // Wait for dependencies if needed
            if (extrinsic.metadata.dependencies.length > 0) {
              await this.waitForDependencies(extrinsic.metadata.dependencies, results);
            }
          }
        }
      }
      
      return this.buildExecutionResult(results, true, Date.now() - startTime, errors);
      
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Unknown error');
      return this.buildExecutionResult(results, false, Date.now() - startTime, errors);
    }
  }
  
  /**
   * Execute a single extrinsic with user approval
   */
  private async executeSequential(
    extrinsic: any,
    options: ExecutionOptions
  ): Promise<ExtrinsicResult> {
    
    // Update status: ready for signing
    this.executionStore.updateStatus(extrinsic.id, 'signing');
    
    try {
      // Get API connection for this chain
      const api = await this.getApiConnection(extrinsic.chain);
      
      // Build the actual extrinsic object from agent data
      const tx = api.tx[extrinsic.extrinsic.method.pallet][
        extrinsic.extrinsic.method.method
      ](...Object.values(extrinsic.extrinsic.method.args));
      
      // Get current account
      const account = this.web3AuthService.getCurrentAccount();
      if (!account) {
        throw new Error('No account connected');
      }
      
      // Request user signature (MUST approve each one)
      const signatureResult = await this.requestUserSignature(
        tx,
        account,
        extrinsic.humanReadable,
        extrinsic.metadata
      );
      
      if (!signatureResult.approved) {
        this.executionStore.updateStatus(extrinsic.id, 'cancelled');
        return {
          success: false,
          extrinsicId: extrinsic.id,
          error: signatureResult.error || 'User rejected transaction'
        };
      }
      
      // Broadcast transaction
      this.executionStore.updateStatus(extrinsic.id, 'broadcasting');
      
      return await this.broadcastTransaction(
        tx,
        account,
        extrinsic.id,
        options.timeout
      );
      
    } catch (error) {
      this.executionStore.updateStatus(extrinsic.id, 'failed');
      return {
        success: false,
        extrinsicId: extrinsic.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Execute multiple extrinsics as a batch (single signature)
   * Only works if all on same chain and user approves batching
   */
  private async executeBatch(
    extrinsics: any[],
    options: ExecutionOptions
  ): Promise<ExtrinsicResult> {
    
    // Verify all on same chain
    const chains = new Set(extrinsics.map(e => e.chain));
    if (chains.size > 1) {
      throw new Error('Cannot batch extrinsics across different chains');
    }
    
    const chain = extrinsics[0].chain;
    const api = await this.getApiConnection(chain);
    
    // Build individual transactions
    const txs = extrinsics.map(ext => 
      api.tx[ext.extrinsic.method.pallet][ext.extrinsic.method.method](
        ...Object.values(ext.extrinsic.method.args)
      )
    );
    
    // Create batch transaction
    const batchTx = api.tx.utility.batchAll(txs);
    
    // Request user signature for batch
    const account = this.web3AuthService.getCurrentAccount();
    if (!account) throw new Error('No account connected');
    
    const batchDescription = {
      action: `Batch of ${extrinsics.length} operations`,
      operations: extrinsics.map(e => e.humanReadable.action),
      totalFee: this.calculateBatchFee(extrinsics),
      network: chain
    };
    
    const signatureResult = await this.requestUserSignature(
      batchTx,
      account,
      batchDescription,
      { estimated_fee: batchDescription.totalFee }
    );
    
    if (!signatureResult.approved) {
      extrinsics.forEach(e => this.executionStore.updateStatus(e.id, 'cancelled'));
      return {
        success: false,
        extrinsicId: 'batch_' + extrinsics.map(e => e.id).join('_'),
        error: signatureResult.error || 'User rejected batch transaction'
      };
    }
    
    // Broadcast batch
    return await this.broadcastTransaction(
      batchTx,
      account,
      'batch_' + extrinsics.map(e => e.id).join('_'),
      options.timeout
    );
  }
  
  /**
   * Request user signature with UI modal
   * This is where user MUST approve - NO AUTOMATIC SIGNING
   */
  private async requestUserSignature(
    tx: SubmittableExtrinsic<'promise'>,
    account: WalletAccount,
    humanReadable: any,
    metadata: any
  ): Promise<SignatureResult> {
    
    return new Promise((resolve) => {
      
      // Dispatch event to show signing modal
      window.dispatchEvent(new CustomEvent('show-signing-modal', {
        detail: {
          transaction: tx,
          humanReadable,
          metadata,
          account,
          
          onApprove: async () => {
            // User clicked "Approve & Sign"
            try {
              // Get injector from wallet extension
              const injector = await web3FromAddress(account.address);
              
              // This will open the wallet extension's signing popup
              // User must approve in their wallet extension
              await tx.signAsync(account.address, {
                signer: injector.signer
              });
              
              resolve({
                approved: true
              });
            } catch (error) {
              resolve({
                approved: false,
                error: error instanceof Error ? error.message : 'Signing failed'
              });
            }
          },
          
          onReject: () => {
            // User clicked "Reject"
            resolve({
              approved: false,
              error: 'User rejected transaction'
            });
          }
        }
      }));
    });
  }
  
  /**
   * Broadcast signed transaction and monitor status
   */
  private async broadcastTransaction(
    tx: SubmittableExtrinsic<'promise'>,
    account: WalletAccount,
    extrinsicId: string,
    timeout: number
  ): Promise<ExtrinsicResult> {
    
    return new Promise((resolve, reject) => {
      
      const timeoutHandle = setTimeout(() => {
        reject(new Error('Transaction timeout'));
      }, timeout);
      
      // Get injector
      web3FromAddress(account.address).then(injector => {
        
        // Send transaction
        tx.signAndSend(account.address, { signer: injector.signer }, (result) => {
          
          if (result.status.isInBlock) {
            this.executionStore.updateStatus(extrinsicId, 'in_block');
            console.log(`Transaction in block: ${result.status.asInBlock}`);
          }
          
          if (result.status.isFinalized) {
            clearTimeout(timeoutHandle);
            this.executionStore.updateStatus(extrinsicId, 'finalized');
            
            // Check if transaction succeeded
            const success = !result.events.some(({ event }) =>
              api.events.system.ExtrinsicFailed.is(event)
            );
            
            if (success) {
              resolve({
                success: true,
                extrinsicId,
                blockHash: result.status.asFinalized.toString(),
                txHash: tx.hash.toString(),
                events: result.events.map(e => e.event.toHuman())
              });
            } else {
              // Find error event
              const errorEvent = result.events.find(({ event }) =>
                api.events.system.ExtrinsicFailed.is(event)
              );
              
              resolve({
                success: false,
                extrinsicId,
                error: errorEvent ? JSON.stringify(errorEvent.event.toHuman()) : 'Transaction failed'
              });
            }
          }
          
        }).catch((error: Error) => {
          clearTimeout(timeoutHandle);
          this.executionStore.updateStatus(extrinsicId, 'failed');
          resolve({
            success: false,
            extrinsicId,
            error: error.message
          });
        });
      });
    });
  }
  
  /**
   * Get or create API connection for a chain
   */
  private async getApiConnection(chain: string): Promise<ApiPromise> {
    if (this.apiConnections.has(chain)) {
      return this.apiConnections.get(chain)!;
    }
    
    const endpoint = this.rpcEndpoints[chain];
    if (!endpoint) {
      throw new Error(`Unknown chain: ${chain}`);
    }
    
    const provider = new WsProvider(endpoint);
    const api = await ApiPromise.create({ provider });
    await api.isReady;
    
    this.apiConnections.set(chain, api);
    return api;
  }
  
  /**
   * Group extrinsics for optimal batching
   */
  private groupExtrinsicsForBatching(
    extrinsics: Map<string, any>,
    executionOrder: string[]
  ): ExecutionGroup[] {
    const groups: ExecutionGroup[] = [];
    let currentGroup: any[] = [];
    let currentChain: string | null = null;
    
    for (const id of executionOrder) {
      const ext = extrinsics.get(id)!;
      
      // Can batch if same chain and can_batch flag is true
      const canBatch = ext.metadata.can_batch &&
                       (ext.chain === currentChain || currentChain === null) &&
                       ext.metadata.dependencies.every((d: string) => 
                         currentGroup.some(e => e.id === d)
                       );
      
      if (canBatch) {
        currentGroup.push(ext);
        currentChain = ext.chain;
      } else {
        if (currentGroup.length > 0) {
          groups.push({
            canBatch: currentGroup.length > 1,
            extrinsics: currentGroup
          });
        }
        currentGroup = [ext];
        currentChain = ext.chain;
      }
    }
    
    if (currentGroup.length > 0) {
      groups.push({
        canBatch: currentGroup.length > 1,
        extrinsics: currentGroup
      });
    }
    
    return groups;
  }
  
  /**
   * Group all extrinsics sequentially (no batching)
   */
  private groupSequentially(
    extrinsics: Map<string, any>,
    executionOrder: string[]
  ): ExecutionGroup[] {
    return executionOrder.map(id => ({
      canBatch: false,
      extrinsics: [extrinsics.get(id)!]
    }));
  }
  
  /**
   * Wait for dependencies to complete
   */
  private async waitForDependencies(
    dependencyIds: string[],
    results: Map<string, ExtrinsicResult>
  ): Promise<void> {
    // Simple polling - could be improved with events
    while (true) {
      const allComplete = dependencyIds.every(id => {
        const result = results.get(id);
        return result && (result.success || result.error);
      });
      
      if (allComplete) break;
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  /**
   * Calculate batch transaction fee
   */
  private calculateBatchFee(extrinsics: any[]): string {
    // Simplified - real implementation would query chain
    const total = extrinsics.reduce((sum, ext) => {
      const fee = parseFloat(ext.metadata.estimated_fee.split(' ')[0]);
      return sum + fee;
    }, 0);
    
    const token = extrinsics[0].metadata.estimated_fee.split(' ')[1];
    return `${total.toFixed(4)} ${token}`;
  }
  
  /**
   * Build final execution result
   */
  private buildExecutionResult(
    results: Map<string, ExtrinsicResult>,
    success: boolean,
    totalTime: number,
    errors: string[]
  ): ExecutionResult {
    return {
      success,
      results,
      totalTime,
      errors
    };
  }
  
  /**
   * Disconnect all API connections
   */
  async disconnect(): Promise<void> {
    for (const [chain, api] of this.apiConnections) {
      await api.disconnect();
    }
    this.apiConnections.clear();
  }
}

interface ExecutionGroup {
  canBatch: boolean;
  extrinsics: any[];
}
```

#### Signing Modal Component

**File:** `frontend/src/components/execution/SigningModal.tsx` (new file)

```typescript
import React, { useEffect, useState } from 'react';
import './SigningModal.css';

interface SigningRequest {
  transaction: any;
  humanReadable: any;
  metadata: any;
  account: any;
  onApprove: () => void;
  onReject: () => void;
}

export const SigningModal: React.FC = () => {
  const [request, setRequest] = useState<SigningRequest | null>(null);
  const [isSigning, setIsSigning] = useState(false);
  
  useEffect(() => {
    const handler = (event: any) => {
      setRequest(event.detail);
      setIsSigning(false);
    };
    
    window.addEventListener('show-signing-modal', handler);
    return () => window.removeEventListener('show-signing-modal', handler);
  }, []);
  
  if (!request) return null;
  
  const handleApprove = async () => {
    setIsSigning(true);
    try {
      await request.onApprove();
    } finally {
      setRequest(null);
      setIsSigning(false);
    }
  };
  
  const handleReject = () => {
    request.onReject();
    setRequest(null);
  };
  
  const isBatch = request.humanReadable.operations !== undefined;
  
  return (
    <div className="modal-overlay">
      <div className="signing-modal">
        <div className="modal-header">
          <h2>🔐 Transaction Approval Required</h2>
          <p className="modal-subtitle">Review and approve this transaction</p>
        </div>
        
        <div className="transaction-details">
          {isBatch ? (
            <>
              <h3>{request.humanReadable.action}</h3>
              <div className="batch-operations">
                {request.humanReadable.operations.map((op: string, i: number) => (
                  <div key={i} className="batch-op">
                    <span className="batch-op-number">{i + 1}</span>
                    <span>{op}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <h3>{request.humanReadable.action}</h3>
              <div className="detail-row">
                <span className="detail-label">Network:</span>
                <span className="detail-value">{request.humanReadable.network}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">From:</span>
                <span className="detail-value address">{request.account.address}</span>
              </div>
              {request.humanReadable.to && (
                <div className="detail-row">
                  <span className="detail-label">To:</span>
                  <span className="detail-value address">{request.humanReadable.to}</span>
                </div>
              )}
              {request.humanReadable.amount && (
                <div className="detail-row">
                  <span className="detail-label">Amount:</span>
                  <span className="detail-value amount">{request.humanReadable.amount}</span>
                </div>
              )}
            </>
          )}
          
          <div className="detail-row fee">
            <span className="detail-label">Estimated Fee:</span>
            <span className="detail-value">{request.metadata.estimated_fee}</span>
          </div>
        </div>
        
        <div className="warning-box">
          <div className="warning-icon">⚠️</div>
          <div className="warning-text">
            <strong>You are about to sign a blockchain transaction.</strong>
            <p>Review all details carefully. This action cannot be undone.</p>
          </div>
        </div>
        
        <div className="modal-actions">
          <button 
            onClick={handleReject}
            className="btn-reject"
            disabled={isSigning}
          >
            Reject
          </button>
          <button 
            onClick={handleApprove}
            className="btn-approve"
            disabled={isSigning}
          >
            {isSigning ? 'Signing...' : 'Approve & Sign'}
          </button>
        </div>
      </div>
    </div>
  );
};
```

#### Deliverables

1. ✅ ExtrinsicExecutioner service class
2. ✅ API connection management for multiple chains
3. ✅ Sequential execution logic
4. ✅ Batch execution support
5. ✅ User signing approval flow (NO automatic signing)
6. ✅ SigningModal React component
7. ✅ Transaction status monitoring
8. ✅ Error handling and recovery
9. ✅ Timeout management
10. ✅ Integration with execution store
11. ✅ Unit and integration tests

---

## Implementation Timeline

### Week 1-2: Foundation

**Task 1: System Prompt Logic**
- Create prompt file structure
- Write Polkadot knowledge base
- Define agent tool schemas
- Implement file loading in ASI-One service
- Test with complex scenarios

**Deliverable:** Complete system prompt with LLM able to understand Polkadot operations

---

### Week 3-4: Core Execution

**Task 2: Agent Extrinsic Returns (Start)**
- Update Asset Transfer Agent
- Implement extrinsic creation with substrate-interface
- Add fee estimation
- Test on Polkadot testnet (Westend)

**Task 2: Agent Extrinsic Returns (Complete)**
- Add XCM transfer support
- Create Asset Swap Agent (basic)
- Update frontend agent communication service
- Integration testing

**Deliverable:** Agents returning properly formatted unsigned extrinsics

---

### Week 5-6: Management & UX

**Task 3: Execution Array System**
- Implement Zustand execution store
- Build dependency resolution (topological sort)
- Create validation logic
- Add cost calculation
- Test with complex multi-step operations

**Task 5: Extrinsic Executioner (Basic)**
- Set up API connections
- Implement sequential execution
- Create signing approval flow
- Basic transaction broadcasting

**Deliverable:** Working execution pipeline for simple operations

---

### Week 7-8: Advanced Features

**Task 5: Extrinsic Executioner (Advanced)**
- Add batch execution support
- Implement status monitoring
- Error handling and recovery
- Timeout management
- Multi-chain support

**Task 4: Flow Visualization**
- Create FlowDiagram component
- Add visual styling
- Implement approval/rejection flow
- Test user experience

**Deliverable:** Complete execution system with visualization

---

### Week 9: Polish & Testing

- Comprehensive testing
  - Unit tests for all components
  - Integration tests
  - End-to-end tests on testnet
- Security audit
  - No automatic signing
  - Proper error handling
  - User warnings
- User testing
  - Gather feedback
  - Iterate on UX
- Documentation
  - API documentation
  - User guides
  - Developer onboarding

**Deliverable:** Production-ready system

---

## Safety Considerations

### Critical Safety Rules

#### 1. No Automatic Transaction Signing

**Rule:** Agents are NOT autonomous. Every transaction requires explicit user approval.

**Implementation:**
- `ExtrinsicExecutioner.requestUserSignature()` always shows modal
- Modal cannot be bypassed or auto-approved
- User must click "Approve & Sign" button
- Wallet extension requires additional confirmation

**Code Enforcement:**
```typescript
// WRONG - Never do this
if (autoApprove) {
  await tx.signAndSend(account);
}

// CORRECT - Always require approval
const approval = await this.requestUserSignature(tx, account, details);
if (!approval.approved) {
  return { success: false, error: 'User rejected' };
}
```

#### 2. Clear Transaction Details

**Rule:** User must see exactly what they're signing before approval.

**Implementation:**
- Human-readable description of every operation
- Display recipient addresses, amounts, fees
- Show network/chain information
- Highlight risk level
- Display dependencies and execution order

**Example:**
```
Transaction Details:
✓ Action: Transfer DOT
✓ Network: Polkadot
✓ From: 5GrwvaEF5zXb... (Your wallet)
✓ To: 5FHneW46xGX... (Alice)
✓ Amount: 10 DOT
✓ Fee: 0.01 DOT
⚠️ Risk: Low
```

#### 3. Balance Validation

**Rule:** Verify user has sufficient balance before preparing extrinsics.

**Implementation:**
- Query chain for current balance
- Calculate total cost (amount + fees + buffer)
- Warn user if insufficient
- Prevent execution if balance too low

```typescript
const balance = await api.query.system.account(address);
const totalRequired = amount + fees;

if (balance.data.free < totalRequired) {
  throw new Error(`Insufficient balance. Need ${totalRequired}, have ${balance.data.free}`);
}
```

#### 4. Dependency Failure Handling

**Rule:** If Step N fails, don't execute Step N+1 if it depends on N.

**Implementation:**
- Track execution status for each extrinsic
- Check dependencies before execution
- Stop execution chain on critical failures
- Allow user to retry or cancel

```typescript
const dep = results.get(dependencyId);
if (!dep || !dep.success) {
  return {
    success: false,
    error: `Dependency ${dependencyId} failed - cannot proceed`
  };
}
```

#### 5. Timeout Protection

**Rule:** Don't leave transactions pending indefinitely.

**Implementation:**
- Set timeout for each extrinsic (default 60s)
- Cancel if no finalization within timeout
- Clear pending state
- Allow user to retry

```typescript
const timeoutHandle = setTimeout(() => {
  reject(new Error('Transaction timeout - not finalized within 60s'));
}, 60000);
```

#### 6. Audit Trail

**Rule:** Log all user actions and transaction outcomes.

**Implementation:**
- Log every approval/rejection
- Store transaction hashes
- Track block numbers
- Record errors and failures
- Allow export of history

```typescript
logger.info({
  action: 'transaction_approved',
  userId: account.address,
  extrinsicId: ext.id,
  timestamp: Date.now(),
  details: humanReadable
});
```

#### 7. Error Communication

**Rule:** Errors must be clear and actionable.

**Bad:**
```
Error: 1010
```

**Good:**
```
Transaction Failed: Insufficient Balance

You need 10.05 DOT but only have 5.2 DOT.

What you can do:
• Add more DOT to your wallet
• Reduce the transfer amount
• Cancel this transaction
```

#### 8. Slippage Protection (for Swaps)

**Rule:** User must set acceptable slippage tolerance.

**Implementation:**
- Default: 2% slippage
- User can adjust
- Swap fails if slippage exceeded
- Clear warning about price volatility

```typescript
const minAmountOut = expectedOutput * (1 - slippageTolerance);

const swap = api.tx.router.sell(
  assetIn,
  assetOut,
  amountIn,
  minAmountOut // Protects against slippage
);
```

---

## References

### Existing Files

- `frontend/src/services/asiOneService.ts` - Current LLM integration (line 163: system prompt)
- `frontend/src/services/agentCommunication.ts` - Agent routing (line 102: routing logic)
- `agents/asset-transfer-agent/agent.py` - Current agent implementation (line 157: prepare_transfer)
- `frontend/src/types/wallet.ts` - Type definitions (line 29: SigningRequest interface)
- `frontend/src/services/web3AuthService.ts` - Wallet integration (line 141: authenticate method)

### External Documentation

- Polkadot.js API: https://polkadot.js.org/docs/api
- Substrate Interface (Python): https://github.com/polkascan/py-substrate-interface
- XCM Documentation: https://wiki.polkadot.network/docs/learn-xcm
- ASI-One API: https://docs.fetch.ai/

### Key Concepts

- **Extrinsic**: A blockchain transaction (signed or unsigned)
- **XCM**: Cross-Consensus Messaging (for parachain transfers)
- **Substrate**: Blockchain framework Polkadot is built on
- **SS58**: Address format used in Polkadot ecosystem
- **Planck**: Smallest unit of DOT (1 DOT = 10^10 planck)

---

## Glossary

- **Agent**: Specialized service that prepares extrinsics for specific operations
- **Dependency Graph**: Structure showing which extrinsics depend on others
- **Execution Array**: Collection of prepared extrinsics ready for execution
- **Flow Visualization**: UI showing user what will happen before approval
- **System Prompt**: Instructions and knowledge given to the LLM
- **Tool Calling**: LLM invoking functions/agents to accomplish tasks
- **Topological Sort**: Algorithm for ordering dependent operations
- **Unsigned Extrinsic**: Transaction that hasn't been signed yet

---

**End of Document**

*This architecture document will be updated as implementation progresses and new requirements emerge.*

