/**
 * Balance and chain: relay + asset hub balance, chain/version.
 */

type DotBotInstance = any;

/** Extract free/reserved/frozen from system.account response (handles varying runtime shapes). RPC may return numbers (e.g. 0) or strings; we always return string. */
function parseAccountData(raw: unknown): { free: string; reserved: string; frozen: string } {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
  const data = obj?.data && typeof obj.data === 'object' ? (obj.data as Record<string, unknown>) : obj;
  const free = data?.free != null ? String(data.free) : '0';
  const reserved = data?.reserved != null ? String(data.reserved) : '0';
  const frozen =
    data?.frozen != null ? String(data.frozen)
    : data?.miscFrozen != null ? String(data.miscFrozen)
    : '0';
  return { free, reserved, frozen };
}

/** Relay + asset hub balance (free/reserved/frozen) and total free. */
export async function getBalance(dotbot: DotBotInstance): Promise<{
  relayChain: { free: string; reserved: string; frozen: string };
  assetHub: { free: string; reserved: string; frozen: string } | null;
  total: string;
}> {
  await dotbot.ensureRpcConnectionsReady();
  const address = dotbot.wallet?.address ?? '';
  if (!address) {
    dotbot.rpcLogger?.warn?.({ network: dotbot.network }, 'getBalance: No wallet address — balance will be zero');
    return {
      relayChain: { free: '0', reserved: '0', frozen: '0' },
      assetHub: null,
      total: '0',
    };
  }

  const relayAccountInfo = await dotbot.api!.query.system.account(address);
  const relayRaw = relayAccountInfo.toJSON();
  const relayBalance = parseAccountData(relayRaw);

  let assetHubBalance: { free: string; reserved: string; frozen: string } | null = null;
  if (!dotbot.assetHubApi) {
    dotbot.rpcLogger?.warn?.(
      { network: dotbot.network },
      'getBalance: Asset Hub not connected — balance will be relay-only. Check backend RPC logs for Asset Hub connection errors.'
    );
  }
  if (dotbot.assetHubApi) {
    try {
      const assetHubAccountInfo = await dotbot.assetHubApi.query.system.account(address);
      const assetHubRaw = assetHubAccountInfo.toJSON();
      assetHubBalance = parseAccountData(assetHubRaw);
    } catch (err) {
      dotbot.rpcLogger?.debug?.(
        { error: err instanceof Error ? err.message : String(err) },
        'Failed to fetch Asset Hub balance'
      );
    }
  }

  const totalFree = BigInt(relayBalance.free) + (assetHubBalance ? BigInt(assetHubBalance.free) : BigInt(0));
  return { relayChain: relayBalance, assetHub: assetHubBalance, total: totalFree.toString() };
}

/** Chain name and runtime version from relay RPC. */
export async function getChainInfo(dotbot: DotBotInstance): Promise<{ chain: string; version: string }> {
  await dotbot.ensureRpcConnectionsReady();
  const [chain, version] = await Promise.all([dotbot.api!.rpc.system.chain(), dotbot.api!.rpc.system.version()]);
  return { chain: chain.toString(), version: version.toString() };
}
