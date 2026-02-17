# Paseo Support – Documentation

This folder documents the Paseo testnet integration: what we know about the errors, what we tried, and what still needs to be fixed.

---

## What we know about the error(s)

### 1. "Unknown network: paseo" (500 on session create)

- **Symptom:** Backend returns 500 when creating a session with network **paseo**. Error message: `"Unknown network: paseo"`. Stack pointed at `getEndpointsForNetwork` in dotbot-core.
- **Cause:** The **running** Node process was using an old build of `@dotbot/core` that did not include the `paseo` case in `getEndpointsForNetwork` (or was using a stale single-file artifact `dist/rpcManager.js` / `dist/rpcManager.d.ts` that lacked paseo).
- **Relevant code:** `lib/dotbot-core/rpcManager/factories.ts` (getEndpointsForNetwork), `lib/dotbot-core/rpcManager/endpoints.ts` (PASEO_*), `lib/dotbot-core/rpcManager/types.ts` (Network type).

### 2. Frontend / backend still using old endpoints (passet, stakeworld)

- **Symptom:** Browser or backend logs show attempts to `wss://pas-rpc.stakeworld.io/assethub` or `wss://sys.ibp.network/passet` (or wrong path `paseo-assethub`) even after updating endpoints.
- **Cause:**  
  - **Webpack/Craco cache:** Frontend dev server caches compiled `@dotbot/core`; restart without clearing cache can serve an old bundle.  
  - **Backend not restarted:** Backend loads `@dotbot/core` at startup; without restart after `npm run build:core`, it keeps the old code.  
  - **Stale dist:** A leftover single-file `dist/rpcManager.d.ts` / `dist/rpcManager.js` (from an old layout) had the wrong Network type and RpcEndpoints; resolution could pick that instead of `dist/rpcManager/`.

### 3. Balance shows 0 when user has 5000 PAS on Asset Hub

- **Symptom:** User has 5000 PAS on **Paseo Asset Hub** (PassetHub), but the bot replies "Your current balance is 0 PAS on both the Relay Chain and Asset Hub."
- **Cause:** Balance is queried **on the backend** (in Node), not in the browser. When the user sends "What is my balance?", the **backend** DotBot runs `getBalance()` (used when building the LLM context). The backend has its **own** DotBot and its **own** RPC connections. If the **backend’s** Asset Hub connection fails (e.g. timeout or network in Node), `dotbot.assetHubApi` stays `null`, so the backend only queries the relay chain (0 PAS) and never queries Asset Hub (where the 5000 PAS are). The **frontend** DotBot can connect to Asset Hub in the browser (logs show "Execution session created" for both relay and asset hub); that does not affect the balance number the backend sends to the LLM.
- **Relevant code:** `lib/dotbot-core/dotbot/balanceChain.ts` (getBalance), `lib/dotbot-core/dotbot/llm.ts` (buildContextualSystemPrompt → getBalance), `lib/dotbot-core/dotbot/rpcLifecycle.ts` (ensureRpcConnectionsReady → assetHubManager.getReadApi()).

### 4. Address format (5FRPx... vs 14Mh7...)

- **Symptom:** Bot or UI showed the wallet as `5FRPx...` (generic Substrate SS58 42) instead of `14Mh7...` (Polkadot format SS58 0) on Paseo.
- **Cause:** Paseo uses **Polkadot address format (SS58 0)**, same as mainnet. The codebase previously had Paseo as SS58 42; the wallet (e.g. Talisman) often returns the generic form. Without re-encoding for the network, the app sent the wallet’s 5F... address to the backend and the bot echoed it.
- **Relevant code:** `lib/dotbot-core/prompts/system/knowledge/types.ts` (NETWORK_CONFIG.paseo.ss58Format), `lib/dotbot-core/prompts/system/knowledge/paseoKnowledge.ts`, frontend `getAddressForNetwork()` in `appUtils.ts` and usage in `App.tsx`.

---

## What we tried

### Core: Paseo in dotbot-core

- **Endpoints:** Added `PASEO_RELAY_CHAIN` and `PASEO_ASSET_HUB` in `lib/dotbot-core/rpcManager/endpoints.ts`. Paseo Asset Hub (paraId 1000) uses path **asset-hub-paseo** (e.g. `wss://sys.ibp.network/asset-hub-paseo`), not `paseo-assethub`; endpoints aligned with Polkadot.js Apps.
- **Factories:** Added `case 'paseo'` in `getEndpointsForNetwork` and Paseo factory functions in `lib/dotbot-core/rpcManager/factories.ts`.
- **Types:** `Network` and RpcEndpoints in source already included paseo; **removed** stale `dist/rpcManager.d.ts` and `dist/rpcManager.js` so resolution uses `dist/rpcManager/` (correct types and endpoints).
- **Network metadata:** Paseo `ss58Format` changed from **42** to **0** (Polkadot address format) in `lib/dotbot-core/prompts/system/knowledge/types.ts` and in `paseoKnowledge.ts` (header, pattern step, formatted prompt). Tests in `networkUtils.test.ts` updated to expect `getNetworkSS58Format('paseo') === 0`.
- **Export:** `getNetworkSS58Format` exported from `lib/dotbot-core/index.ts` for frontend use.

### Express / backend

- **Startup check:** In `lib/dotbot-express/src/sessionManager.ts`, added `ensurePaseoSupport()`: on first `createSessionManager()` / `createRedisSessionManager()` we call `getEndpointsForNetwork('paseo')`; if it throws "Unknown network", we log a clear error telling the operator to run `npm run build:core` and restart the backend.
- **Session create error:** In `lib/dotbot-express/src/routes/dotbotRoutes.ts`, the session-creation catch detects "Unknown network" and returns a message to run `npm run build:core` and restart the backend.

### Frontend

- **Address for network:** In `frontend/src/utils/appUtils.ts`, added `getAddressForNetwork(address, network)` (decode + encode with `getNetworkSS58Format(network)`). When creating the backend session and when sending chat messages, the frontend now sends the network-canonical address (e.g. 14Mh7... on Paseo) via this helper.
- **Cache / rebuild:** Added `dev:frontend:fresh` in root `package.json`: runs `npm run build:core`, clears `frontend/node_modules/.cache`, then starts the frontend so the new core and endpoints are bundled. Documented that a hard refresh (and optional "Disable cache" in DevTools) may be needed so the browser doesn’t use an old bundle.

### Balance / RPC (in @dotbot/core – balance does not leave the frontend’s DotBot; the one used for the reply is the backend’s)

- **Logging:** In `lib/dotbot-core/dotbot/balanceChain.ts`, when `dotbot.assetHubApi` is null we log a warning so backend logs show that balance is relay-only and suggest checking backend RPC logs for Asset Hub connection errors.
- **Balance debugging:** Added info log `getBalance: result` with `network`, `addressPrefix`, `relayFree`, `assetHubFree`, `total`, `assetHubConnected`. Added debug logs with raw `relayAccountJson` / `assetHubAccountJson` from `system.account` so you can see exactly what the RPC returns. Parsing is defensive: supports both `data.free` and top-level `free` (varying runtime shapes).

### Scripts

- **Root package.json:** `dev:backend:fresh` = `npm run build:core && npm run dev --workspace=backend`. `dev:frontend:fresh` = build core, clear frontend cache, start frontend.

---

## What needs to be fixed

**Resolved:** Balance 0 on Paseo Asset Hub was fixed by using the correct RPC path **asset-hub-paseo** (see `endpoints.ts` PASEO_ASSET_HUB).

### 1. (Resolved) Backend Asset Hub connection (balance 0 despite 5000 PAS on PassetHub)

- **Problem:** The backend’s DotBot runs in Node. When it builds balance context it calls `ensureRpcConnectionsReady()` then `getBalance()`. If `assetHubManager.getReadApi()` fails in Node (timeout, DNS, or network), `dotbot.assetHubApi` stays null and the backend never queries Asset Hub, so it reports 0 for Asset Hub.
- **What to do:**
  - **Verify:** After `npm run build:core` and backend restart, when the user asks for balance, check the **backend** terminal for:  
    `"Asset Hub connection failed, will retry when needed"` (rpcLifecycle) or  
    `"getBalance: Asset Hub not connected — balance will be relay-only"` (balanceChain). If present, the backend’s Asset Hub connection is failing.
  - **Possible fixes:**
    - Increase connection timeout for testnets (Paseo) on the backend when calling `getReadApi()`.
    - Add a retry (e.g. one retry) for Asset Hub `getReadApi()` in `ensureRpcConnectionsReady` or in the balance path so transient failures still allow Asset Hub balance.
    - If the backend runs in a restricted environment (firewall, different DNS), ensure it can reach the Asset Hub endpoint (e.g. `wss://sys.ibp.network/asset-hub-paseo`); otherwise consider an RPC WebSocket proxy (browser and backend talk to same-origin; backend proxies to RPC) as in `xx_wss_all_fail/ANALYSIS.md`.

---

## Debugging “balance 0” (all in @dotbot/core)

Balance is fetched **only on the backend** when building the system prompt for chat: `buildContextualSystemPrompt` → `getBalance()` in `lib/dotbot-core/dotbot/balanceChain.ts`. It does not run in the frontend for the reply you see.

1. **Backend logs (info):** On each balance query you should see a log like:
   - `getBalance: result` with `network`, `addressPrefix`, `relayFree`, `assetHubFree`, `total`, `assetHubConnected`.
   - If `assetHubConnected: false`, the backend’s Asset Hub RPC is not connected (see “Asset Hub not connected” / “Asset Hub connection failed” in logs).
   - If `relayFree` and `assetHubFree` are both `"0"`, the RPC is returning zero; next step is to confirm the address and raw RPC response.

2. **Backend logs (debug):** Set `LOG_LEVEL=debug` (or `DOTBOT_LOG_LEVEL=debug`) and restart the backend. Then ask “What is my balance?” again. You should see:
   - `getBalance: relay system.account response` with `relayAccountJson` (full `system.account` response for the relay chain).
   - If Asset Hub is connected: `getBalance: Asset Hub system.account response` with `assetHubAccountJson`.
   - Check whether the JSON has `data.free` (or top-level `free`). The parser supports both; if your chain uses another shape, we can extend `parseAccountData` in `balanceChain.ts`.

3. **Address:** Confirm the backend is using the right address (e.g. Paseo = SS58 0, so 14Mh7...). The frontend sends the network-canonical address at session create and in chat; the DotBot that runs `getBalance()` uses `dotbot.wallet.address` from the session. The info log’s `addressPrefix` is the first 8 characters of that address.

4. **Relay also 0:** If the relay chain balance is 0 but you expect non-zero, either the address is wrong for that chain or the RPC response shape differs (use debug logs to inspect `relayAccountJson`).

5. **RPC returns numeric 0 but explorer shows balance:** We optionally query the **Assets pallet** on Asset Hub (`api.query.assets.account(assetId, address)`) for Paseo (asset ID 0). This is only useful when (1) the chain stores that balance in the Assets pallet and (2) the RPC exposes `query.assets.account`. If you see **"Asset Hub has no query.assets.account"** in logs, this RPC doesn’t expose that storage — so either the chain uses a different pallet name, or the explorer’s 10,000 comes from somewhere else (e.g. another account/chain). Run with `LOG_LEVEL=debug` and look for **"Asset Hub available query pallets"** to see which query names the chain actually exposes; then we can target the right one or confirm the source of the explorer balance.

6. **Asset Hub RPC is actually the relay chain:** If the "Asset Hub available query pallets" list contains **relay-chain pallets** (`babe`, `grandpa`, `paras`, `staking`, `nominationPools`, `hrmp`) and **no** `assets`, then the Asset Hub endpoint is serving the **relay chain runtime**, not the Asset Hub parachain. The explorer balance is on the real Asset Hub; our "Asset Hub" connection is querying the wrong chain. **Fix:** Use an RPC that serves the Paseo Asset Hub (parachain) runtime, or report to the provider (e.g. IBP use path `asset-hub-paseo`). The code now logs a WARN when this pattern is detected.

### 2. (Optional) Clearer separation of frontend vs backend DotBot

- **Observation:** There are two DotBot instances: one in the browser (frontend), one in Node (backend). The frontend’s execution sessions (and "Execution session created" logs) are for signing/execution in the browser. The backend’s DotBot is what runs `chat()` and `getBalance()` for the reply. Documenting this in the main docs or in this folder can avoid confusion when "frontend connects" but "balance is still 0."

### 3. (Optional) Stale bundle detection

- **Observation:** If the frontend bundle is old (e.g. still contains `passet` or two PassetHub endpoints), the only remedy today is `dev:frontend:fresh` and hard refresh. An optional improvement: at app load, call `getEndpointsForNetwork('paseo')` and check that PASEO_ASSET_HUB includes the expected URL; if not, show a short "Please refresh the app (or run npm run dev:frontend:fresh)" message.

---

## File reference

| Area | Files |
|------|--------|
| Endpoints | `lib/dotbot-core/rpcManager/endpoints.ts` |
| Factories / getEndpointsForNetwork | `lib/dotbot-core/rpcManager/factories.ts` |
| Network type & ss58Format | `lib/dotbot-core/rpcManager/types.ts`, `lib/dotbot-core/prompts/system/knowledge/types.ts` |
| Paseo knowledge (LLM) | `lib/dotbot-core/prompts/system/knowledge/paseoKnowledge.ts` |
| Balance query | `lib/dotbot-core/dotbot/balanceChain.ts` |
| RPC lifecycle (ensureRpcConnectionsReady) | `lib/dotbot-core/dotbot/rpcLifecycle.ts` |
| Context / prompt (getBalance) | `lib/dotbot-core/dotbot/llm.ts` |
| Session manager (ensurePaseoSupport) | `lib/dotbot-express/src/sessionManager.ts` |
| Frontend address for network | `frontend/src/utils/appUtils.ts`, `frontend/src/App.tsx` |
| Scripts | Root `package.json` (`dev:frontend:fresh`, `dev:backend:fresh`, `build:core`) |
