# DotBot Libraries

Shared libraries used by both frontend and backend.

## Structure

```
lib/
├── dotbot-core/          # @dotbot/core - Core blockchain operations
└── dotbot-express/       # @dotbot/express - Express.js integration
```

## @dotbot/core

Complete DotBot core library. Environment-agnostic, works in both browser and Node.js.

**Used by:**
- Frontend: Full DotBot functionality (agents, execution, AI, storage, UI state)
- Backend: AI services, orchestration, data management

**Key features:**
- **AI Integration**: Multi-provider support (ASI-One, Claude, OpenAI-ready)
- **Blockchain Agents**: Asset transfer, staking, governance operations
- **Execution Engine**: Transaction orchestration, signing, broadcasting, monitoring
- **Data Management**: localStorage abstraction, chat persistence, settings
- **Scenario Engine**: Testing framework for AI-driven operations
- **RPC Management**: Multi-endpoint failover and health monitoring
- **LLM System**: Prompts, knowledge bases, agent communication
- **Environment Abstraction**: Works seamlessly in browser and Node.js

## @dotbot/express

Express.js integration layer for backend API.

**Used by:**
- Backend only

**Provides:**
- API routes for chat and operations
- Middleware for logging and error handling
- Request validation

## Development

Both frontend and backend import from these shared libraries:

```typescript
// In frontend or backend
import { AIService } from '@dotbot/core/services/ai/aiService';
import { AssetTransferAgent } from '@dotbot/core/agents/asset-transfer';
```

TypeScript path aliases are configured in:
- `frontend/tsconfig.json`
- `backend/tsconfig.json`

## Future: npm Packages

These libraries are designed to be published as npm packages:

- `npm install @dotbot/core` - For any project needing Polkadot operations
- `npm install @dotbot/express` - For backend Express.js integrations
- `npm install @dotbot/react` - (Future) React components

For now, they're maintained in the monorepo for rapid development.
