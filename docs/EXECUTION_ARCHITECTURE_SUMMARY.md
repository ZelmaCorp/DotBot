# DotBot Execution Architecture - Executive Summary

**Version:** 1.0  
**Last Updated:** 2025-11-03  
**Full Documentation:** See `EXECUTION_ARCHITECTURE.md` for complete implementation details

---

## Overview

DotBot enables users to interact with the Polkadot ecosystem through natural language. An LLM orchestrates specialized agents to prepare blockchain extrinsics that users must explicitly approve before execution.

**Core Principle:** Agents are NOT autonomous. Every transaction requires explicit user approval.

---

## System Flow Diagram

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

## Complex Scenario Example

**User Request:** "Send 10 HDX to Alice"

**Challenge:** User only has DOT, HDX is on HydraDX parachain, no explicit instruction about chain switching.

**LLM Must Figure Out:**
1. HDX = native token of HydraDX parachain
2. User needs DOT → HDX conversion
3. HydraDX has liquidity pools for this swap
4. Execution sequence:
   - XCM transfer DOT from Polkadot → HydraDX
   - Swap DOT → HDX on HydraDX DEX
   - Transfer HDX to Alice

**Key Insight:** The system prompt must include deep Polkadot ecosystem knowledge for the LLM to reason through this without explicit user instructions.

---

## Production Tasks

### Task 1: System Prompt Logic (PRIORITY 1 - Foundation)

**Duration:** 2 weeks

**Objectives:**
- Create file-based system prompt with Polkadot ecosystem knowledge
- Define agent tools in OpenAI function calling format
- Include cross-chain operation patterns
- Enable LLM to make intelligent routing decisions

**File Structure:**
```
prompts/
├── system-prompt.md           # Main prompt
├── polkadot-knowledge.md      # Ecosystem topology
├── agent-tools.json           # Tool schemas
└── examples/                  # Few-shot examples
    ├── simple-transfer.md
    ├── cross-chain-transfer.md
    ├── swap-and-transfer.md
    └── governance-vote.md
```

**Key Content:**

**Polkadot Knowledge Base:**
- Relay chains (Polkadot, Kusama)
- Parachains (HydraDX, Acala, Moonbeam, AssetHub)
- Token locations (which token on which chain)
- XCM transfer patterns
- DEX locations and capabilities
- Fee structures per chain

**Agent Tool Definitions:**
- asset-transfer-agent (native transfers, XCM)
- asset-swap-agent (DEX routing, slippage protection)
- governance-agent (voting, delegation)
- multisig-agent (wallet creation, coordination)

**Decision Trees:**
- How to route "send Token X to Address Y"
- When to use XCM vs native transfers
- How to determine optimal swap routes
- Cost calculation strategies

**Integration:**
- Update `frontend/src/services/asiOneService.ts` to load prompt from files
- Replace hardcoded system prompt (line 163)
- Inject dynamic context (wallet, balance, network)

**Deliverables:**
1. Complete Polkadot knowledge markdown files
2. JSON schemas for all agent tools
3. Example workflows for common operations
4. File loading mechanism in ASI-One service
5. Testing with complex scenarios

---

### Task 2: Agent Extrinsic Returns (PRIORITY 2 - Core)

**Duration:** 2 weeks  
**Dependencies:** Task 1 (partial)

**Objectives:**
- Upgrade agents to return unsigned Polkadot extrinsics
- Include complete metadata (fees, dependencies, risk)
- Standardize response format across all agents

**Current State:**
- Agents return generic transaction data dictionaries
- Missing actual extrinsic construction
- No dependency tracking

**Standard Response Format:**
```
AgentExtrinsicResponse {
  success: boolean
  agent_id: string
  operation_description: string
  
  extrinsics: [{
    id: unique identifier
    chain: "polkadot" | "hydradx" | etc.
    
    extrinsic: {
      method: { pallet, method, args }
      hex: optional serialized form
    }
    
    human_readable: {
      action, from, to, amount, network
    }
    
    metadata: {
      estimated_fee
      requires_signature: true
      dependencies: [extrinsic_ids]
      estimated_time: seconds
      risk_level: "low" | "medium" | "high"
      can_batch: boolean
    }
  }]
  
  operation_metadata: {
    total_estimated_fee
    total_estimated_time
    execution_order: [ordered_extrinsic_ids]
    warnings: []
  }
}
```

**Implementation Phases:**

**Phase 1: Update Asset Transfer Agent**
- Use substrate-interface (Python) or @polkadot/api (TypeScript)
- Build actual unsigned extrinsics
- Calculate real fees via RPC
- Add XCM support for cross-chain transfers
- Test on Westend testnet

**Phase 2: Create Asset Swap Agent**
- HydraDX Omnipool integration
- Route optimization (single vs multi-hop)
- Price impact calculation
- Slippage protection parameters
- Liquidity validation

**Phase 3: Update Frontend Integration**
- Modify `agentCommunication.ts` to parse new format
- Extract extrinsics from responses
- Pass to execution array system

**Phase 4: Additional Agents**
- Governance agent (basic voting)
- Multisig agent (creation, approval)

**Deliverables:**
1. Updated Asset Transfer Agent with new format
2. New Asset Swap Agent
3. Frontend service updates
4. Test coverage for all agents
5. Integration tests with testnet

---

### Task 3: Execution Array System (PRIORITY 3 - Management)

**Duration:** 1.5 weeks  
**Dependencies:** Task 2

**Objectives:**
- Create state management for collected extrinsics
- Resolve dependencies and determine execution order
- Validate feasibility before execution
- Calculate total costs

**Architecture Components:**

**1. Execution Store (Zustand)**
- Collection of extrinsics
- Dependency graph
- Execution order (topologically sorted)
- Status tracking per extrinsic
- Cost aggregation

**2. Dependency Resolver**
- Build directed acyclic graph (DAG)
- Topological sort for execution order
- Detect circular dependencies
- Identify parallelizable operations

**3. Validator**
- Balance checks (sufficient funds?)
- Address validation (valid SS58 format?)
- Dependency verification (all deps exist?)
- Liquidity checks (for swaps)
- Network compatibility

**4. Cost Calculator**
- Aggregate fees by chain
- Sum by token type
- Include buffer for slippage
- Estimate total time
- Flag insufficient balance

**5. Batch Identifier**
- Find extrinsics on same chain
- Check if can_batch flags allow it
- Ensure no dependency violations
- Group for single signature

**Store Interface:**
```
ExecutionArrayStore {
  // State
  extrinsics: Map<id, extrinsic>
  dependencies: Map<id, [dependency_ids]>
  executionOrder: [ordered_ids]
  statuses: Map<id, status>
  
  // Actions
  addExtrinsic(ext)
  removeExtrinsic(id)
  clearAll()
  
  // Analysis
  resolveExecutionOrder() -> [ids]
  validateAll() -> ValidationResult
  calculateTotalCost() -> CostBreakdown
  identifyBatchableGroups() -> [[ids]]
  
  // Execution
  updateStatus(id, status)
  markCompleted(id, result)
  markFailed(id, error)
}
```

**Execution Status Flow:**
```
pending → ready → signing → broadcasting → in_block → finalized
                      ↓
                  cancelled
                      ↓
                    failed
```

**Deliverables:**
1. Zustand execution store implementation
2. Dependency resolution algorithm (topological sort)
3. Validation logic for all checks
4. Cost calculation and aggregation
5. Batch identification algorithm
6. React hooks for UI integration
7. Unit tests for store logic

---

### Task 4: Flow Visualization (PRIORITY 4 - UX)

**Duration:** 1 week  
**Dependencies:** Task 3

**Objectives:**
- Visual preview of transaction flow before approval
- Show chains, operations, amounts, fees
- Display dependencies and execution order
- Intuitive approve/reject interface

**Component Structure:**

**FlowDiagram Component**
- Main container for visualization
- Steps displayed sequentially with arrows
- Summary section with totals
- Approve/Reject buttons

**FlowStep Component**
- Individual operation card
- Chain badge (Polkadot, HydraDX, etc.)
- Operation details (action, amount, fee)
- Risk indicator (color-coded)
- Dependency warnings

**FlowSummary Component**
- Total cost breakdown by token
- Total estimated time
- Balance check status
- Risk assessment

**Visual Features:**
- Color-coded risk levels (green/yellow/red)
- Arrow indicators between steps
- Step numbering
- Expandable details
- Dependency relationship indicators
- Hover states for more info

**User Interactions:**
- Click step for full details
- Hover for quick info
- Approve all at once
- Reject to cancel flow
- Edit parameters (future)

**Responsive Design:**
- Works on desktop and mobile
- Adapts to different step counts
- Scrollable for long flows
- Maintains readability

**Deliverables:**
1. FlowDiagram React component
2. FlowStep sub-component
3. FlowSummary sub-component
4. CSS styling with theme support
5. Integration with execution store
6. Responsive layout
7. User interaction handlers

---

### Task 5: Extrinsic Executioner (PRIORITY 2-3 - Critical Path)

**Duration:** 3 weeks  
**Dependencies:** Tasks 2, 3

**Objectives:**
- Execute extrinsics in correct order
- Handle user signing with approval gates
- Track execution status in real-time
- Handle failures gracefully
- Support sequential and batch execution

**Core Responsibilities:**

**1. API Connection Management**
- Connect to multiple chains (Polkadot, HydraDX, Acala, etc.)
- Maintain WebSocket connections
- Handle reconnection logic
- Cache connections for reuse

**2. Execution Controller**
- Sequential execution (one by one)
- Batch execution (multiple in one tx)
- Dependency resolution
- Error handling and recovery

**3. Signing Manager**
- Request user approval via modal
- Integrate with wallet extensions (Polkadot.js, Talisman, SubWallet)
- Collect signatures
- Handle rejections

**4. Transaction Broadcasting**
- Send signed transactions to chain
- Monitor inclusion (in block, finalized)
- Extract events and results
- Handle network errors

**5. Status Monitoring**
- Track each extrinsic's status
- Update UI in real-time
- Listen for blockchain events
- Detect success/failure

**Execution Flow:**

**Sequential Execution:**
1. Get extrinsic from queue
2. Update status to "signing"
3. Show signing modal to user
4. User approves → get wallet signature
5. Update status to "broadcasting"
6. Send to chain, wait for inclusion
7. Update status to "in_block"
8. Wait for finalization
9. Update status to "finalized"
10. Check if next extrinsic's dependencies met
11. Proceed to next or stop

**Batch Execution:**
1. Group compatible extrinsics
2. Build utility.batchAll() transaction
3. Show batch approval modal
4. User approves → single signature
5. Broadcast batch
6. Monitor all operations
7. Mark all as complete/failed together

**Signing Approval Modal:**
- Shows transaction details
- Human-readable description
- Network, from, to, amount
- Estimated fee
- Warning message
- Approve/Reject buttons
- NO automatic approval
- Timeout if user doesn't respond

**Safety Features:**

**User Approval Gates:**
- Every transaction requires explicit approval
- Modal cannot be bypassed
- Clear warning messages
- Wallet extension confirmation

**Balance Validation:**
- Check before execution
- Include fees in calculation
- Warn if insufficient

**Dependency Handling:**
- Wait for dependencies to complete
- Don't execute if dependency failed
- Clear error messages

**Timeout Protection:**
- Maximum wait time per transaction
- Cancel if no response
- Allow retry

**Error Recovery:**
- Continue or stop on error (user choice)
- Clear error messages
- Retry mechanism
- Rollback not possible (blockchain finality)

**Audit Trail:**
- Log all approvals/rejections
- Store transaction hashes
- Track block numbers
- Record errors
- Export history

**Multi-Chain Support:**
- Different RPC endpoints per chain
- Chain-specific transaction formats
- XCM message handling
- Fee calculations per chain

**Deliverables:**
1. ExtrinsicExecutioner service class
2. API connection manager
3. Sequential execution logic
4. Batch execution support
5. SigningModal React component
6. Transaction broadcasting
7. Status monitoring system
8. Error handling and recovery
9. Timeout management
10. Integration with execution store
11. Multi-chain RPC support
12. Comprehensive testing

---

## Implementation Timeline

### Week 1-2: Foundation
- **Task 1:** System Prompt Logic (complete)
- Setup testing framework
- Document architecture decisions

**Milestone:** LLM can understand complex Polkadot operations and route to agents

---

### Week 3-4: Core Execution
- **Task 2:** Agent Extrinsic Returns (complete)
- Asset Transfer Agent upgrade
- Asset Swap Agent creation
- Frontend integration updates

**Milestone:** Agents return properly formatted unsigned extrinsics

---

### Week 5-6: Management & UX
- **Task 3:** Execution Array System (complete)
- **Task 5:** Extrinsic Executioner (basic version)
- Sequential execution working
- User signing approval flow

**Milestone:** Working execution pipeline for simple operations

---

### Week 7-8: Advanced Features
- **Task 5:** Extrinsic Executioner (advanced features)
- Batch execution support
- Multi-chain coordination
- **Task 4:** Flow Visualization
- Error handling refinement

**Milestone:** Complete execution system with visualization

---

### Week 9: Polish & Testing
- Comprehensive testing (unit, integration, e2e)
- Security audit
- User testing and feedback
- Documentation
- Bug fixes and optimization

**Milestone:** Production-ready system

---

## Safety Principles

### 1. No Automatic Signing
Every transaction requires explicit user approval. Agents are NOT autonomous.

### 2. Clear Transaction Details
User sees exactly what they're signing: action, network, amount, recipient, fees, risk level.

### 3. Balance Validation
System checks sufficient funds before preparing extrinsics.

### 4. Dependency Failure Handling
If Step N fails, dependent Step N+1 does not execute.

### 5. Timeout Protection
Transactions cannot remain pending indefinitely. Default 60s timeout.

### 6. Audit Trail
All approvals, rejections, and executions are logged with timestamps and details.

### 7. Error Communication
Errors are clear, actionable, and user-friendly (not raw blockchain error codes).

### 8. Slippage Protection
Swaps include minimum output amounts. User sets acceptable slippage tolerance.

---

## Key Data Structures

### Extrinsic
Prepared blockchain transaction with metadata about dependencies, fees, and execution requirements.

### Execution Array
Collection of extrinsics ordered by dependencies, ready for sequential or batch execution.

### Dependency Graph
Directed acyclic graph (DAG) showing which extrinsics depend on completion of others.

### Execution Status
Current state of an extrinsic: pending, ready, signing, broadcasting, in_block, finalized, failed, or cancelled.

### Cost Breakdown
Aggregated fees by chain and token type, with total time estimation.

---

## Architecture Decisions

### Why File-Based System Prompt?
- Easy to update without code changes
- Version control for prompts
- Modular knowledge organization
- Can be loaded dynamically

### Why Zustand for State Management?
- Simple and performant
- Good TypeScript support
- Easy integration with React
- Minimal boilerplate

### Why Topological Sort for Execution Order?
- Handles arbitrary dependency graphs
- Detects circular dependencies
- Provides deterministic ordering
- Efficient O(V+E) algorithm

### Why Separate Signing Modal?
- Clear user approval gate
- Consistent UX across operations
- Easy to audit and test
- Cannot be bypassed

### Why Support Batch Execution?
- Reduces number of signatures
- Lower total fees
- Faster execution
- Better UX for multi-step operations

---

## Success Criteria

### Task 1: System Prompt Logic
- ✅ LLM correctly routes "Send 10 HDX to Alice" (user has DOT)
- ✅ LLM identifies need for XCM transfer
- ✅ LLM determines optimal swap location
- ✅ All tool schemas validate with OpenAI format

### Task 2: Agent Extrinsic Returns
- ✅ Extrinsics execute successfully on testnet
- ✅ Fee estimates within 5% of actual
- ✅ XCM transfers work cross-chain
- ✅ All agents return consistent format

### Task 3: Execution Array System
- ✅ Dependency resolution correct for 10+ extrinsic graph
- ✅ Circular dependency detection works
- ✅ Balance validation catches insufficient funds
- ✅ Cost calculation accurate

### Task 4: Flow Visualization
- ✅ User understands flow before approval
- ✅ All steps clearly displayed
- ✅ Dependencies visually indicated
- ✅ Works on mobile and desktop

### Task 5: Extrinsic Executioner
- ✅ Sequential execution works for 5+ steps
- ✅ Batch execution works for compatible operations
- ✅ User approval required for every transaction
- ✅ Status updates in real-time
- ✅ Errors handled gracefully
- ✅ Multi-chain operations work

---

## Future Enhancements

### Phase 2 (Post-Launch)
- Governance proposal creation
- Multisig wallet management
- Liquid staking operations
- NFT transfers
- More DEX integrations

### Phase 3 (Advanced)
- Transaction simulation before execution
- Gas optimization suggestions
- Historical transaction replay
- Advanced error recovery
- Transaction scheduling

---

## References

- **Full Documentation:** `EXECUTION_ARCHITECTURE.md` (2,750 lines with code)
- **Existing Code:** `frontend/src/services/` and `agents/`
- **Polkadot.js Docs:** https://polkadot.js.org/docs/api
- **XCM Format:** https://wiki.polkadot.network/docs/learn-xcm

---

**End of Summary**

*For complete implementation details including all TypeScript interfaces, class implementations, and code examples, see the full architecture document.*

