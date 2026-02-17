# Analysis: All WSS Endpoints Fail in Browser (Firefox)

## Symptom

When creating a transaction on the frontend (e.g. after sending a chat message that triggers execution):

- **Browser** tries to connect to **11 Polkadot RPC endpoints** in order (e.g. `wss://polkadot.api.onfinality.io/public-ws`, `wss://polkadot-rpc.dwellir.com`, … `wss://rpc.polkadot.io`).
- **Every** connection fails with:  
  `Firefox can't establish a connection to the server at wss://...`  
  and `Connection failed (unknown error type)`.
- Call stack at failure:  
  `getReadApi` → `ensureRpcConnectionsReady` → `prepareExecution` → App/Chat flow.
- **Backend** can connect to the same RPCs (API/INIT logs show polkadot/statemint); the failure is **only** in the browser.

## Regression ruled out

**Checking out an old commit still shows the same failure** (all 11 endpoints fail, same Firefox message). So this is **not** a code regression in RpcManager, endpoints, or app logic. The cause is **environmental**: something about the current machine, Firefox, network, or extensions changed. Code reverts will not fix it.

**Confirmed: it works in Chrome.** So the failure is **Firefox-specific** (profile, settings, or an extension in Firefox is blocking or breaking outbound `wss://` connections). Use Chrome (or another browser) for now, or try Firefox Safe Mode / a clean profile to isolate the cause; the RPC proxy remains an option if you need it to work in that Firefox profile.

## Root cause

The **browser** is opening **direct** WebSocket connections to **external** `wss://` URLs. In some environments, those outbound connections are blocked or fail:

- **Firefox**: strict tracking protection or privacy settings can block WebSocket to third‑party domains.
- **Corporate / institutional network**: firewall or proxy often blocks outbound `wss://` (or only allows same-origin).

**If you’ve ruled those out**, other possible causes when **it used to work** (e.g. on localhost, “yesterday it worked”):

1. **Wrong WebSocket URL for app (Socket.IO)**  
   Log shows: `Firefox can't establish a connection to the server at ws://localhost:3000/ws`.  
   If the app runs on port 3000 (frontend) and the backend is on 8000, something may be connecting to `ws://localhost:3000/ws` instead of the backend (e.g. `http://localhost:8000` for Socket.IO). Check `REACT_APP_WS_URL` and `REACT_APP_API_URL` in `.env` – they should point to the **backend** (e.g. `http://localhost:8000`), not the frontend (3000). A wrong value can break real-time features and sometimes correlate with other connection issues.

2. **Dependency / lockfile change**  
   A recent `npm install` or lockfile change may have updated `@polkadot/api` or `@polkadot/rpc-provider`. Newer versions can behave differently in the browser (e.g. different WebSocket handling or error reporting). Try: `git diff package-lock.json` (or `yarn.lock`), revert or pin `@polkadot/api` / `@polkadot/rpc-provider` to the last known-good version and reinstall.

3. **“Connection failed (unknown error type)” is from our code**  
   In `RpcManager`, `normalizeError()` turns any non-`Error` / non-string into that message. So the **underlying** failure might be an Event, an object, or something else the browser or Polkadot provider emits. We don’t log the raw value, so the real cause is hidden. Improving this (see below) will show what actually fails.

4. **Browser or extension update**  
   A browser or extension update can change how WebSockets or mixed content are handled. Try another browser or a clean profile (extensions disabled) to see if the behavior changes.

5. **Dev server / proxy change**  
   If you use a dev proxy (e.g. CRA proxy, Vite proxy) or a local reverse proxy, a config change could affect how requests or WebSockets are forwarded and make it look like “all wss fail”.

6. **Extensions**  
   Ad/tracking blockers or other extensions (e.g. React DevTools; your logs show `moz-extension://.../injectedScript.bundle.js`) can intercept or break WebSocket. Try Firefox **Safe Mode** (disables extensions) or another browser with no extensions.

**Next steps to isolate:** Try Chrome/Edge; try Firefox Safe Mode (about:support → Restart with Add-ons Disabled); try another network (e.g. phone hotspot). If it works there, the cause is this Firefox profile or this network. The only **code** fix that avoids that entirely is the **RPC WebSocket proxy** (browser talks only to same-origin).

So the issue is **not**:

- Bad or unhealthy RPC endpoints (backend uses them successfully).
- CORS (CORS does not govern WebSocket; and CSP already allows `wss:` in `connect-src`).
- Backend or Nginx misconfiguration for the existing API/WebSocket (Socket.IO) to the app.

## Why it “does not work” even when things look good

- **CSP** with `connect-src 'self' https: wss:` is correct and allows `wss://` in general; if every endpoint still fails, the block is **before** CSP (connection never established).
- **LOG_LEVEL=info** only affects **backend** logs; it does not change the fact that the **frontend** never gets an RPC connection because the **browser** cannot open any of the direct `wss://` URLs.
- **Nginx** and backend are fine for same-origin traffic; the failing traffic is **browser → external RPC**, which never goes through your server.

So “it does not work” = the **frontend RPC path** still uses **direct browser → RPC** and the environment blocks that. The fix is to **stop using direct RPC from the browser** and use a **proxy** on your backend instead.

## Recommended solution: RPC WebSocket proxy

**Idea:** The browser should **not** connect to `wss://polkadot.api.onfinality.io` etc. It should connect **only** to your origin, e.g.:

`wss://live.dotbot.zelmacorp.io/api/rpc-ws?network=polkadot&chain=relay`

The **backend** then:

1. Handles the WebSocket upgrade at `/api/rpc-ws`.
2. Reads `network` and `chain` (relay vs assethub).
3. Connects from the **server** to the real RPC (using the same endpoint list as today).
4. Proxies frames both ways: browser ↔ backend ↔ RPC.

So:

- **Browser** only talks to **same-origin** `wss://.../api/rpc-ws` → no outbound block.
- **Backend** talks to RPC (already works in your logs).

## Implementation checklist

### 1. Backend: RPC WebSocket proxy

- **Add** a module that handles HTTP `upgrade` for path `/api/rpc-ws`:
  - Parse query: `network=polkadot|kusama|westend`, `chain=relay|assethub`.
  - Resolve endpoint list via `getEndpointsForNetwork(network)` from `@dotbot/core` (relay vs assetHub from `chain`).
  - Try connecting to each RPC URL from the **server** (e.g. using `ws` package) until one succeeds.
  - Upgrade the **client** connection (browser) with the same request/socket/head (e.g. using `WebSocketServer({ noServer: true }).handleUpgrade(...)`).
  - Pipe messages both ways between client WebSocket and RPC WebSocket; close both when either closes.
- **Register** this handler on the same `http.Server` used by Express/Socket.IO, with `prependListener('upgrade', ...)` so `/api/rpc-ws` is handled before Socket.IO (so Socket.IO only sees `/socket.io`).
- **Dependency:** backend needs `ws` (and `@types/ws` for TypeScript) if not already present.

**Files:**

- New: `backend/src/rpcProxy.ts` (proxy logic + `attachRpcProxy(httpServer)`).
- Edit: `backend/src/index.ts` — after `createServer(app)` and before `listen`, call `attachRpcProxy(httpServer)` (and ensure `ws` is imported/used so the dependency is used).

### 2. DotBot core: optional proxy base URL

- **Config:** In `DotBotConfig` (e.g. in `lib/dotbot-core/dotbot/types.ts`), add an optional field, e.g. `rpcProxyBaseUrl?: string`.
- **Semantics:** When `rpcProxyBaseUrl` is set, the frontend should use **proxy URLs** instead of the raw RPC endpoint list for the **browser** RPC connection.
- **URL shape:**  
  - Relay: `${rpcProxyBaseUrl}/api/rpc-ws?network=${network}&chain=relay`  
  - Asset hub: `${rpcProxyBaseUrl}/api/rpc-ws?network=${network}&chain=assethub`  
  (ensure no double slashes; strip trailing slash from base if needed.)
- **Creation of RPC managers:** In `lib/dotbot-core/dotbot/create.ts`, when `config.rpcProxyBaseUrl` is set and we are **not** using pre-injected `relayChainManager`/`assetHubManager`, create the two managers with **one endpoint each**: the two proxy URLs above. Otherwise keep current behavior (use `createRpcManagersForNetwork(network)` with the normal endpoint lists).
- **Export:** Expose a small helper or document that the proxy URL must be the same origin as the app (e.g. `wss://live.dotbot.zelmacorp.io` with no path, and the proxy adds `/api/rpc-ws?...`). No change to RpcManager internals except that it receives proxy URLs as the “endpoints” when proxy is used.

**Files:**

- Edit: `lib/dotbot-core/dotbot/types.ts` — add `rpcProxyBaseUrl?: string` to `DotBotConfig`.
- Edit: `lib/dotbot-core/dotbot/create.ts` — if `rpcProxyBaseUrl` is set and no pre-injected managers, build two `RpcManager` instances with endpoints `[relayProxyUrl]` and `[assethubProxyUrl]` (same options as now: connectionTimeout, storageKey, etc.).

### 3. Frontend: use proxy when enabled

- **Env:** Use a build-time flag, e.g. `REACT_APP_USE_RPC_PROXY=true`, so the built frontend uses the proxy when deployed in restricted environments.
- **Base URL:** Derive the WebSocket base from the same origin or from existing config, e.g.  
  `const wsBase = process.env.REACT_APP_WS_URL || process.env.REACT_APP_API_URL || (typeof window !== 'undefined' ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}` : '')`  
  then ensure it uses `wss` on HTTPS (replace `https` with `wss` if needed).
- **DotBot creation:** When `REACT_APP_USE_RPC_PROXY` is truthy and `wsBase` is set, pass `rpcProxyBaseUrl: wsBase` into `DotBot.create(config)` (in the same place where you currently pass `wallet`, `network`, `onSigningRequest`, etc., e.g. in `frontend/src/utils/appUtils.ts` inside `createDotBotInstance`).

**Files:**

- Edit: `frontend/src/utils/appUtils.ts` — in `createDotBotInstance`, if `process.env.REACT_APP_USE_RPC_PROXY` and the chosen WS base URL exist, set `config.rpcProxyBaseUrl = <that base>` before `DotBot.create(config)`.
- Optional: document in README or env.example that for environments where direct WSS is blocked, set `REACT_APP_USE_RPC_PROXY=true` and ensure `REACT_APP_WS_URL` or `REACT_APP_API_URL` points at the same origin (e.g. `https://live.dotbot.zelmacorp.io`).

### 4. Nginx (if needed)

- The same server that serves the app and `/api/` and `/socket.io` must also allow **upgrade** for `/api/rpc-ws` (same as for Socket.IO): `proxy_http_version 1.1`, `Upgrade`, `Connection upgrade`, and no path rewriting so the backend sees `request.url` starting with `/api/rpc-ws?...`.  
- If your current Nginx already forwards all `/api/` to the backend with WebSocket upgrade enabled, `/api/rpc-ws` will work without change. If you have a special block only for `/socket.io`, add a similar block for `/api/rpc-ws` or ensure a generic `/api/` block handles upgrades.

### 5. Verification

- With proxy: browser Network tab should show a single WebSocket to `wss://<your-domain>/api/rpc-ws?network=polkadot&chain=relay` (and later possibly `chain=assethub`), and no direct connections to `polkadot.api.onfinality.io` etc.
- Backend logs (with LOG_LEVEL=info) can optionally log proxy connections for debugging.
- End-to-end: create a transaction again; preparation should succeed and you should no longer see “Failed to connect to any RPC endpoint” from the frontend.

## Summary

| What                         | Status / Action                                      |
|-----------------------------|------------------------------------------------------|
| Symptom                     | All 11 RPC endpoints fail in browser only.          |
| Cause                       | Environment blocks direct browser → external wss://. |
| CORS / CSP / LOG_LEVEL      | Not the fix; they are fine.                         |
| Fix                         | Backend RPC WebSocket proxy + frontend uses it.     |
| Backend                     | Add `/api/rpc-ws` upgrade handler and wire it.      |
| DotBot config               | Add `rpcProxyBaseUrl` and use it when set.          |
| Frontend                    | Set `rpcProxyBaseUrl` when `REACT_APP_USE_RPC_PROXY=true`. |
| Nginx                       | Ensure `/api/rpc-ws` gets WebSocket upgrade.         |

Once the proxy is implemented and the frontend uses it in the affected environment, “all wss fail” should stop and transaction preparation should work.
