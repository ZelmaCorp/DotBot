## Status (revision session)

**Done:** API.md – Removed all "NEW" labels from TOC and section headers; updated monorepo structure (dotbot-core / dotbot-express descriptions); standalone note; replaced emoji "Why DotBot?" with plain "Why use the high-level API?"; Kusama row: "Infrastructure ready; LLM knowledge base not yet implemented"; Backend API intro (shared core, multiple modes); OpenAPI + Integration Testing intros (no NEW); AgentResult `estimatedFee` note (decimals vary by network); Multi-Network Factory Functions clarified as returning RpcManager instances; Simulation "NEW in v0.2.2" removed; inline `// ← NEW` removed from DotBotConfig and storageKey.  
ARCHITECTURE.md – "distributed system" → "has frontend and backend components in a monorepo"; Design Rationale reframed (modularity, frontend can run standalone); Transfer Operation Flow: added step "2. LLM / PLANNING" and renumbered 3–5.  
docs/README.md – Key Principles "Production-Safe" → "Production-safety in mind (POC/alpha)"; architecture box "blockchain ops" → "client-side mode"; removed NEW from Chat History and ScenarioEngine; License → GNU GPL v3.  
Root README.md – Same Production-safety and architecture box fixes; already had GPL v3.

**Session 2 (shortening, validation):** ARCHITECTURE.md – Moved Decisions 10–13 into Design Decisions (after Decision 9), replaced long text with condensed summaries; removed duplicate Decisions 10–13 from end of file; shortened Decision 2 (removed long code comparison); scenarioEngine description → "Testing framework (UI-integrated scenarios)". API.md – Aligned with backend: `POST /api/dotbot/initialize` → `POST /api/dotbot/session`; `POST /api/dotbot/execute` → `POST /api/dotbot/session/:sessionId/execution/:executionId/start`; `GET /api/dotbot/history/:sessionId` → `GET /api/dotbot/session/:sessionId/chats`; updated client example and OpenAPI structure; removed most "Version Added" lines; DotBot.create() "UPDATED" → "Supports". docs/README.md – AgentResult estimatedFee note; Execution Flow version label removed; Next Steps added DevOps link. Root README – Documentation section added DevOps link. Two READMEs kept: root = entry point; docs/README = full guide (synced).

**Remaining (optional):** DEVOPS.md only if something is outdated; doc comments (skipped per user).

**Session 3 (improvements from feedback):** API.md – Added Quick navigation mini-table at top (key sections + anchors); **Top 5 things to do first** for beginners; **Endpoint naming** note (all DotBot routes use `/api/dotbot` prefix); **Execution plan and array example** with full JSON sample; **LLM integration example** (system prompt + conversation history); **Utilities API** intro with pointer to Network Utilities. docs/README.md – **Top 5 things to do first** for newcomers.

**Session 4 (ARCHITECTURE.md):** Quick navigation table; Backend API endpoints (reference) table; Key methods (reference) in Module Structure; API Flow example updated to `/api/dotbot` endpoints; consistent code-block formatting (`text` for diagrams/trees).

**Validation (developer-friendly):** Checked endpoints vs backend (`app.use('/api/dotbot', dotbotRouter)` — correct); npm scripts (`dev:backend`, `dev:frontend`, `build:core`) match package.json; API.md quick-nav anchors exist (Getting Started, Backend API, Network Configuration, Utilities API, OpenAPI Specification, TypeScript Types, execution-plan-and-array-example, llm-integration-example); docs cross-links (root README → docs/README, API, ARCHITECTURE, DEVOPS; docs/README Next Steps → same). Root README Documentation section clarified (start here, API, Architecture, DevOps); docs/README given a short "For developers" entry point with Top 5 → Quick Start → API → ARCHITECTURE.

---

## API.md (original notes)

```
Backend API ← NEW in v0.2.0
OpenAPI Specification ← NEW in v0.2.0
Integration Testing ← NEW in v0.2.0
```
remove NEW labels as of now, this is a POC now, that is sent to OpenGov, we are cleaning up accordinly. **[DONE]**

```
Monorepo Setup (Recommended)
```
make sure this is up-to-date, we also have dotbot-express

```
DotBot/
├── package.json         # Workspace root (4 workspaces)
├── lib/
│   ├── dotbot-core/     # Something like this 'Core library that is used in frontend and backend as well'
│   └── dotbot-express/  # Express integration
├── backend/             # TypeScript/Express backend that is using dotbot-express
└── frontend/            # React frontend
```

```
Standalone Installation (Advanced)

If using DotBot libraries in your own project:

npm install @polkadot/api @polkadot/util @polkadot/util-crypto

Note: In v0.2.0, @dotbot/core and @dotbot/express are workspace packages. Future versions will publish to npm for standalone installation.
```
I hope this is right. Yes, these will be npm packages, that's correct for sure.

```
Recommended: Use DotBot (High-Level API)
```
if this is technically correct, keep

```
Why DotBot?

    🎯 Natural language interface - just chat!
    🤖 Handles agents, orchestration, and execution automatically
    🔐 Manages signing requests and user confirmations
    📊 Provides execution status updates
    ✨ Network-aware (correct tokens, knowledge, etc.)
``` <- this is not that much documentation language. I guess we totally want to remove these parts.

```
Advanced Setup (Low-Level API)
```
if technically correct, keep

```
Kusama 	KSM 	12 	Canary 	⚠️ Partial 	Kusama ecosystem (coming soon)
``` <- use the right word! (not really supported, don't over-sell)

```
Backend API

NEW in v0.2.0: DotBot backend provides REST API endpoints for AI chat and blockchain operations.
Architecture
```
remove NEW, clarify that dotbot-core is a shared library, multiple modes of operation.


Check all existing API endpoints, make sure they match!

```
OpenAPI Specification

NEW in v0.2.0: Complete API contract defined in backend/openapi.yaml.
```
make sure this is up-to-date (docs is up-to-date, only SUGGEST code base edit)

```
Integration Testing

NEW in v0.2.0: OpenAPI-based integration testing ensures API compliance.
```
make sure we don't lie here, that it really exists, works (always suggest code base edit, that will be a production task, not doing it on-the-fly)

```Core Concepts
AgentResult
```
'Fee in Planck (1 DOT = 10^10 Planck)' this might not be true in all networks
make sure all of these are correct

'Multi-Network Factory Functions' is this related to RpcManager class? If yes, clarify!

'Additional Utilities' validate/update everything

Go through the rest of the documentation in same mentality.

## ARCHITECTURE.md

This file is very large, needs to make it smaller, without loosing the essence.

'DotBot is a distributed system with frontend and backend components, designed for secure API key management and scalable blockchain operations.' - "distributed system" I wouldn't use this word, probably. Don't say things that are not true.

'Project Structure' make sure that all correct

'│   │   ├── scenarioEngine/  # Testing framework that can be accessed from the UI'


```
Design Rationale: Why Backend?

Problem: AI provider API keys exposed in frontend code

Solution: Move AI services to backend, keep blockchain operations client-side

Benefits:

    Security: API keys never exposed to client
    Flexibility: Easy to switch AI providers server-side
    Cost Control: Rate limiting and usage monitoring
    Hybrid Architecture: Blockchain ops stay client-side (leverages user's wallet)
```
probably reframe it, and highligh, that we want to keep it modular, so frontend could work in itself, if API keys are provided.

'Network System (lib/dotbot-core/prompts/system/knowledge/)' - why is this called Network System... Ok, probably this is good name, but rationale about Network-Specific-Knowledge. Up to you.

'Design Decisions'
probably make it shorter, but keep!

'Transfer Operation Flow' - does not explain LLM part

'Decision 10: Two-Step Execution Pattern' make sure that design decisions are not scattered

Look through the whole docs in this mentallity, if possible, make it shorter, make it up-to-date, make it easy to read, professional-looking (probably remove trivia-decisions, which are really "should understand at first glance" types of decisions)

## DEVOPS.md

Don't really touch DEVOPS.md, unless it is not up-to-date!

## README.md (inside docs/)

'Production-Safe: Automatic fallbacks and runtime capability detection' <- never say that it is production-safe! Say that it is designed in production safety in mind, don't overlook the fact, that this is POC / alpha!

'Prerequisites' - needs to be up-to-date

'Architecture Overview'
'│         Uses @dotbot/core for blockchain ops            │' - uses dotbot/core in client-side mode, don't say blockchain ops, because that's probably not everything that it does
Make sure that it is clear that a lot of things is happening in front end!

Look through the whole README, make sure that everything is correct

## README.md (main entry point)

Decide whether it makes sense to have 2 READMEs, adjust!
We plan to use GNU v3 license! 