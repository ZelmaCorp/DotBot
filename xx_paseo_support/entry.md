# Paseo support – entry

See **[README.md](./README.md)** for full documentation.

- **What we know:** 500 "Unknown network: paseo" (stale core/build), wrong endpoints in bundle (cache), balance 0 (backend’s Asset Hub connection fails), address format (SS58 0 for Paseo).
- **What we tried:** Paseo in core (endpoints, types, ss58Format 0), removed stale dist, frontend `getAddressForNetwork()`, `dev:frontend:fresh` / cache clear, backend startup check, balanceChain warning when Asset Hub not connected.
- **What needs to be fixed:** Backend Asset Hub connection so balance query sees PassetHub (timeout/retry or env/network); optional: document frontend vs backend DotBot, optional stale-bundle hint.
