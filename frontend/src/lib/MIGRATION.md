# Migration to DotBot Library

This document describes the migration of core DotBot functionality into a reusable library structure.

## Structure

```
frontend/
└── src/
    ├── lib/                # DotBot Core Library (NEW)
    │   ├── agents/         # Agent classes
    │   ├── prompts/        # System prompt generation
    │   ├── types/          # Shared types
    │   ├── config/         # Configuration (logger)
    │   ├── index.ts        # Main export
    │   └── package.json   # Library package.json
    │
    ├── components/         # React components
    ├── services/           # Frontend services
    ├── stores/             # State management
    ├── types/              # Frontend-specific types
    └── ...                 # Other frontend code
```

## What's in the Library

The `lib/` directory contains all core DotBot functionality:

- **agents/**: All agent classes (AssetTransferAgent, StakingAgent, etc.)
- **prompts/**: System prompt generation and agent definitions
- **types/**: Shared types (logging, etc.)
- **config/**: Logger configuration

## What Stays in Frontend

The `src/` directory contains frontend-specific code:

- **components/**: React UI components
- **services/**: Frontend services (ASI-One integration, agent communication)
- **stores/**: Frontend state management
- **types/**: Frontend-specific types (wallet, chat UI types)
- **assets/**, **styles/**: UI assets and styles

## Usage

### From Frontend

```typescript
// Import from lib
import { AssetTransferAgent, buildSystemPrompt, Subsystem } from './lib';
```

### As NPM Package (Future)

```typescript
// After publishing to npm
import { AssetTransferAgent, buildSystemPrompt } from '@dotbot/core';
```

## Backward Compatibility

Re-export files are provided in `src/agents/index.ts` and `src/prompts/system/index.ts` for backward compatibility. These can be removed once all imports are updated.

## Next Steps

1. Update remaining imports to use `./lib` instead of relative paths
2. Test that everything works
3. Remove old `src/agents/` and `src/prompts/` directories (optional)
4. When ready to publish: Copy `src/lib/` to a separate repository and publish to npm as `@dotbot/core`

