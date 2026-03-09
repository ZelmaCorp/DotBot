#!/usr/bin/env node
/**
 * Periodically tests Polkadot, Paseo, and Westend RPC endpoints and prints results.
 *
 * Correct RPC check: open WebSocket → send JSON-RPC request (system_chain) → wait for response.
 * Nodes do not send anything until you send a request, so we must send first then wait.
 *
 * Per-endpoint uptime is persisted across runs in scripts/.rpc-stats.json.
 *
 * Usage (from repo root):
 *   npm run test:rpc        — run every 60s (Ctrl+C to stop)
 *   npm run test:rpc:once   — run once and exit
 *
 * Env: RPC_TEST_INTERVAL_MS overrides interval. Requires network access; uses `ws` only (no @polkadot/api).
 */

import fs from 'fs/promises';
import path from 'path';
import WebSocket from 'ws';

const STATS_FILE = path.join(process.cwd(), 'scripts', '.rpc-stats.json');

const INTERVAL_MS = 60_000;
const REQUEST_TIMEOUT_MS = 10_000;

const RPC_REQUEST = JSON.stringify({
  id: 1,
  jsonrpc: '2.0',
  method: 'system_chain',
  params: [],
});

const ENDPOINTS = {
  Polkadot: {
    relay: [
      'wss://polkadot.api.onfinality.io/public-ws',
      'wss://polkadot-rpc.dwellir.com',
      'wss://rpc.ibp.network/polkadot',
      'wss://polkadot.dotters.network',
      'wss://rpc.polkadot.io',
    ],
    assetHub: [
      'wss://statemint.api.onfinality.io/public-ws',
      'wss://statemint-rpc.dwellir.com',
      'wss://rpc-asset-hub.polkadot.io',
    ],
  },
  Paseo: {
    relay: [
      'wss://paseo.rpc.amforc.com:443',
      'wss://paseo-rpc.dwellir.com',
      'wss://rpc.ibp.network/paseo',
      'wss://paseo.dotters.network',
      'wss://pas-rpc.stakeworld.io',
    ],
    assetHub: [
      'wss://asset-hub-paseo-rpc.n.dwellir.com',
      'wss://sys.ibp.network/asset-hub-paseo',
      'wss://asset-hub-paseo.dotters.network',
      'wss://sys.turboflakes.io/asset-hub-paseo',
    ],
  },
  Westend: {
    relay: [
      'wss://westend.api.onfinality.io/public-ws',
      'wss://westend.public.curie.radiumblock.co/ws',
    ],
    assetHub: [
      'wss://westmint.api.onfinality.io/public-ws',
      'wss://sys.ibp.network/westmint',
    ],
  },
};

function testEndpoint(url) {
  return new Promise((resolve) => {
    const start = Date.now();
    let settled = false;
    const done = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) ws.close();
      } catch (_) {}
      resolve(result);
    };

    const timer = setTimeout(() => {
      done({ ok: false, error: 'Timeout (no response)' });
    }, REQUEST_TIMEOUT_MS);

    let ws;
    try {
      ws = new WebSocket(url);
    } catch (err) {
      done({ ok: false, error: err?.message || String(err) });
      return;
    }

    ws.on('open', () => {
      ws.send(RPC_REQUEST);
    });

    ws.on('message', (data) => {
      const latency = Date.now() - start;
      let chain = '';
      try {
        const j = JSON.parse(data.toString());
        if (j.error) {
          done({ ok: false, error: j.error.message || JSON.stringify(j.error) });
          return;
        }
        if (j.result != null) chain = String(j.result);
      } catch (_) {}
      done({ ok: true, chain: chain || '—', latency });
    });

    ws.on('error', (err) => {
      done({ ok: false, error: err?.message || String(err) });
    });

    ws.on('close', () => {
      if (!settled) done({ ok: false, error: 'Connection closed before response' });
    });
  });
}

function shorten(url) {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '') + (u.pathname !== '/' ? u.pathname.slice(0, 20) : '');
  } catch {
    return url.slice(0, 40);
  }
}

function formatResult(url, result, historical) {
  const short = shorten(url);
  let uptimeStr = '';
  if (historical && historical.checks > 0) {
    const pct = Math.round((historical.ok / historical.checks) * 1000) / 10;
    uptimeStr = `  (${pct}% uptime, ${historical.checks} checks)`;
  }
  if (result.ok) {
    const latencyStr = result.latency != null ? ` ${result.latency}ms` : '';
    return `  ✓ ${short.padEnd(42)} ${result.chain}${latencyStr}${uptimeStr}`;
  }
  return `  ✗ ${short.padEnd(42)} ${result.error}${uptimeStr}`;
}

function printStatistics(stats, errorCounts) {
  console.log('\n  Connection statistics');
  console.log('  ' + '─'.repeat(50));
  let totalUp = 0;
  let totalDown = 0;
  for (const [network, s] of Object.entries(stats)) {
    const relayPct = s.relayTotal > 0 ? Math.round((s.relayUp / s.relayTotal) * 100) : 0;
    const hubPct = s.hubTotal > 0 ? Math.round((s.hubUp / s.hubTotal) * 100) : 0;
    console.log(`  ${network}`);
    console.log(`    Relay:     ${s.relayUp}/${s.relayTotal} (${relayPct}%)`);
    console.log(`    Asset Hub: ${s.hubUp}/${s.hubTotal} (${hubPct}%)`);
    totalUp += s.up;
    totalDown += s.down;
  }
  console.log('  ' + '─'.repeat(50));
  const total = totalUp + totalDown;
  const overallPct = total > 0 ? Math.round((totalUp / total) * 100) : 0;
  console.log(`  TOTAL     ${totalUp} up, ${totalDown} down — ${total} endpoints (${overallPct}% reachable)`);
  if (errorCounts && Object.keys(errorCounts).length > 0) {
    console.log('  Failures by reason:');
    const sorted = Object.entries(errorCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);
    for (const [reason, count] of sorted) {
      const short = reason.length > 48 ? reason.slice(0, 45) + '...' : reason;
      console.log(`    ${short}: ${count}`);
    }
  }
}

function printIndividualUptime(historicalByUrl, endpoints) {
  console.log('\n  Individual node uptime (all runs)');
  console.log('  ' + '─'.repeat(50));
  for (const [network, { relay, assetHub }] of Object.entries(endpoints)) {
    for (const [label, urls] of [
      ['Relay', relay],
      ['Asset Hub', assetHub],
    ]) {
      const groupName = `${network} ${label}`;
      const withHistory = urls
        .map((url) => ({ url, h: historicalByUrl[url] }))
        .filter(({ h }) => h && h.checks > 0)
        .map(({ url, h }) => ({ url, pct: (h.ok / h.checks) * 100, ...h }))
        .sort((a, b) => b.pct - a.pct);
      if (withHistory.length === 0) continue;
      console.log(`  ${groupName}:`);
      for (const { url, pct, ok, checks } of withHistory) {
        const short = shorten(url);
        const pctStr = (Math.round(pct * 10) / 10).toFixed(1);
        console.log(`    ${short.padEnd(40)} ${pctStr}%  (${ok}/${checks})`);
      }
    }
  }
  console.log('  ' + '─'.repeat(50));
}

async function loadHistoricalStats() {
  try {
    const raw = await fs.readFile(STATS_FILE, 'utf8');
    const data = JSON.parse(raw);
    return data?.endpoints && typeof data.endpoints === 'object' ? data.endpoints : {};
  } catch {
    return {};
  }
}

async function saveHistoricalStats(endpoints) {
  try {
    await fs.writeFile(STATS_FILE, JSON.stringify({ endpoints }, null, 2), 'utf8');
  } catch (err) {
    console.error('  [Warning] Could not save .rpc-stats.json:', err?.message);
  }
}

async function runOnce() {
  const time = new Date().toISOString();
  console.log('\n' + '─'.repeat(80));
  console.log(` RPC endpoint check — ${time}`);
  console.log('─'.repeat(80));

  const historicalByUrl = await loadHistoricalStats();
  const stats = {};
  const errorCounts = {};
  const resultsByUrl = {};

  for (const [network, { relay, assetHub }] of Object.entries(ENDPOINTS)) {
    stats[network] = { relayUp: 0, relayTotal: relay.length, hubUp: 0, hubTotal: assetHub.length, up: 0, total: 0 };
    console.log(`\n${network}`);
    console.log('  Relay chain:');
    for (const url of relay) {
      const result = await testEndpoint(url);
      resultsByUrl[url] = result;
      if (result.ok) stats[network].relayUp++;
      else errorCounts[result.error] = (errorCounts[result.error] || 0) + 1;
      const hist = historicalByUrl[url];
      console.log(formatResult(url, result, hist));
    }
    console.log('  Asset Hub:');
    for (const url of assetHub) {
      const result = await testEndpoint(url);
      resultsByUrl[url] = result;
      if (result.ok) stats[network].hubUp++;
      else errorCounts[result.error] = (errorCounts[result.error] || 0) + 1;
      const hist = historicalByUrl[url];
      console.log(formatResult(url, result, hist));
    }
    stats[network].up = stats[network].relayUp + stats[network].hubUp;
    stats[network].total = stats[network].relayTotal + stats[network].hubTotal;
    stats[network].down = stats[network].total - stats[network].up;
  }

  for (const [url, result] of Object.entries(resultsByUrl)) {
    const prev = historicalByUrl[url] || { checks: 0, ok: 0 };
    historicalByUrl[url] = {
      checks: prev.checks + 1,
      ok: prev.ok + (result.ok ? 1 : 0),
    };
  }
  await saveHistoricalStats(historicalByUrl);

  printStatistics(stats, errorCounts);
  printIndividualUptime(historicalByUrl, ENDPOINTS);
  console.log('\n' + '─'.repeat(80));
}

async function main() {
  const interval = process.env.RPC_TEST_INTERVAL_MS
    ? parseInt(process.env.RPC_TEST_INTERVAL_MS, 10)
    : INTERVAL_MS;
  const once = process.argv.includes('--once');

  try {
    await runOnce();
    if (once) {
      process.exit(0);
      return;
    }
    console.log(`\nNext run in ${interval / 1000}s (Ctrl+C to stop, or use --once for single run).\n`);
    setInterval(runOnce, interval);
  } catch (err) {
    console.error('Fatal:', err?.message || err);
    process.exit(1);
  }
}

main();
