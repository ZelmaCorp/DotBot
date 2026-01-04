/**
 * Transaction Simulation Service
 * Fork-based transaction validation using Chopsticks
 */

import type { ApiPromise } from '@polkadot/api';
import type { SubmittableExtrinsic } from '@polkadot/api/types';
import type { HexString } from '@polkadot/util/types';
import { BN } from '@polkadot/util';

import { ChopsticksDatabase } from './database';

export interface SimulationResult {
  success: boolean;
  error: string | null;
  estimatedFee: string;
  balanceChanges: Array<{
    value: BN;
    change: 'send' | 'receive';
  }>;
  events: any[];
}

export type SimulationStatusCallback = (status: {
  phase: 'initializing' | 'forking' | 'executing' | 'analyzing' | 'complete' | 'error';
  message: string;
  progress?: number;
  details?: string;
}) => void;

/**
 * Simulates transaction execution on a forked chain state
 */
export async function simulateTransaction(
  api: ApiPromise,
  rpcEndpoints: string | string[],
  extrinsic: SubmittableExtrinsic<'promise'>,
  senderAddress: string,
  onStatusUpdate?: SimulationStatusCallback
): Promise<SimulationResult> {
  const startTime = Date.now();
  let chain: any = null;
  let storage: ChopsticksDatabase | null = null;
  
  const updateStatus = (phase: 'initializing' | 'forking' | 'executing' | 'analyzing' | 'complete' | 'error', message: string, progress?: number, details?: string) => {
    if (onStatusUpdate) {
      onStatusUpdate({ phase, message, progress, details });
    }
    
    // Enhanced console output with emojis and formatting
    const emoji = {
      initializing: '🔧',
      forking: '🌿',
      executing: '⚡',
      analyzing: '🔍',
      complete: '✅',
      error: '❌'
    }[phase];
    
    const progressBar = progress !== undefined 
      ? ` [${'█'.repeat(Math.floor(progress / 10))}${'░'.repeat(10 - Math.floor(progress / 10))}] ${progress}%`
      : '';
    
    const detailsText = details ? ` • ${details}` : '';
    
    console.log(`${emoji} [Chopsticks] ${message}${progressBar}${detailsText}`);
  };
  
  try {
    updateStatus('initializing', 'Preparing transaction simulation...', 10);
    
    const { BuildBlockMode, setup } = await import('@acala-network/chopsticks-core');
    
    updateStatus('initializing', 'Setting up simulation environment...', 20);
    const dbName = `dotbot-sim-cache:${api.genesisHash.toHex()}`;
    storage = new ChopsticksDatabase(dbName);
    
    updateStatus('forking', 'Fetching current blockchain state...', 30);
    
    // Filter to only WebSocket endpoints (wss:// or ws://) - Chopsticks requires WebSocket
    const allEndpoints = Array.isArray(rpcEndpoints) ? rpcEndpoints : [rpcEndpoints];
    const endpoints = allEndpoints.filter(endpoint => 
      typeof endpoint === 'string' && (endpoint.startsWith('wss://') || endpoint.startsWith('ws://'))
    );
    
    if (endpoints.length === 0) {
      throw new Error('No valid WebSocket endpoints provided. Chopsticks requires WebSocket (wss://) endpoints, not HTTP (https://)');
    }
    
    if (endpoints.length < allEndpoints.length) {
      console.warn(`[Chopsticks] Filtered out ${allEndpoints.length - endpoints.length} HTTP endpoint(s), using ${endpoints.length} WebSocket endpoint(s)`);
    }
    
    // Try to get block hash from the provided API, but with timeout handling
    // If that fails, we'll use the endpoints directly in setup (which will fetch it)
    let blockHash: any = null;
    let blockNumber: any = null;
    
    try {
      // Use Promise.race to add a timeout
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('getBlockHash timeout after 30s')), 30000)
      );
      
      blockHash = await Promise.race([
        api.rpc.chain.getBlockHash(),
        timeoutPromise
      ]);
      blockNumber = await Promise.race([
        api.rpc.chain.getHeader(blockHash),
        timeoutPromise
      ]);
    } catch (apiError) {
      console.warn('[Chopsticks] Failed to get block hash from API, will fetch from endpoint:', apiError);
      // If API call fails, setup() will fetch the block hash from the endpoint
      blockHash = null;
      blockNumber = null;
    }
    
    if (blockHash && blockNumber) {
      updateStatus('forking', `Creating chain fork at block #${blockNumber.number.toNumber()}...`, 40, `Block: ${blockHash.toHex().slice(0, 12)}...`);
    } else {
      updateStatus('forking', 'Creating chain fork (fetching latest block from endpoint)...', 40);
    }
    
    chain = await setup({
      endpoint: endpoints,
      block: blockHash ? blockHash.toHex() : undefined, // If blockHash is null, setup will use latest
      buildBlockMode: BuildBlockMode.Batch,
      mockSignatureHost: true,
      db: storage,
    });
    
    // If we didn't get block info from API, get it from the chain after setup
    if (!blockHash || !blockNumber) {
      try {
        const chainBlockHash = await chain.head;
        const chainBlockNumber = await chain.api.rpc.chain.getHeader(chainBlockHash);
        blockHash = chainBlockHash;
        blockNumber = chainBlockNumber;
        updateStatus('forking', `Chain fork created at block #${chainBlockNumber.number.toNumber()}...`, 45, `Block: ${chainBlockHash.toHex().slice(0, 12)}...`);
      } catch (err) {
        console.warn('[Chopsticks] Could not get block info from chain:', err);
      }
    }
    
    updateStatus('executing', 'Simulating transaction execution...', 60, 'Running on forked chain state');
    
    // Use the block hash we got (either from API or from chain after setup)
    const finalBlockHash = blockHash || await chain.head;
    
    const { outcome, storageDiff } = await chain.dryRunExtrinsic(
      {
        call: extrinsic.method.toHex(),
        address: senderAddress,
      },
      typeof finalBlockHash === 'string' ? finalBlockHash : finalBlockHash.toHex()
    );
    
    updateStatus('analyzing', 'Analyzing simulation results...', 80);
    
    const balanceDeltas = await computeBalanceDeltas(
      api,
      senderAddress,
      storageDiff
    );
    
    const { succeeded, failureReason } = parseOutcome(api, outcome);
    
    let fee = '0';
    try {
      updateStatus('analyzing', 'Calculating transaction fees...', 90);
      const feeInfo = await extrinsic.paymentInfo(senderAddress);
      fee = feeInfo.partialFee.toString();
    } catch (feeError) {
      // paymentInfo can fail with wasm trap if the extrinsic has issues
      // But simulation already passed, so we can proceed without fee estimate
      const errorMessage = feeError instanceof Error ? feeError.message : String(feeError);
      console.warn('[Chopsticks] Fee estimation failed (simulation passed, proceeding without fee):', errorMessage);
      // Keep fee as '0' - caller can estimate separately if needed
    }
    
    // Cleanup
    try {
      const cleanupBlockHash = blockHash || await chain.head;
      const cleanupBlockHashHex = typeof cleanupBlockHash === 'string' ? cleanupBlockHash : cleanupBlockHash.toHex();
      await storage.deleteBlock(cleanupBlockHashHex);
      await storage.close();
      await chain.close();
    } catch (cleanupError) {
      console.warn('[Chopsticks] Cleanup warning:', cleanupError);
    }
    
    const duration = Date.now() - startTime;
    
    if (succeeded) {
      const balanceChangeText = balanceDeltas.length > 0 
        ? `Balance change: ${balanceDeltas[0].change === 'send' ? '-' : '+'}${balanceDeltas[0].value.toString()}`
        : 'No balance changes';
      updateStatus('complete', `✓ Simulation successful!`, 100, `Validated in ${duration}ms • ${balanceChangeText}`);
    } else {
      updateStatus('error', `✗ Simulation failed: ${failureReason || 'Unknown error'}`, 100);
    }
    
    return {
      success: succeeded,
      error: failureReason,
      estimatedFee: fee,
      balanceChanges: balanceDeltas,
      events: [],
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    updateStatus('error', `✗ Simulation error: ${errorMessage}`, 100);
    
    // Attempt cleanup even on error
    try {
      if (storage) await storage.close();
      if (chain) await chain.close();
    } catch (cleanupError) {
      console.warn('[Chopsticks] Cleanup error:', cleanupError);
    }
    
    // Re-throw the error so caller knows Chopsticks failed
    return {
      success: false,
      error: `Chopsticks simulation failed: ${errorMessage}`,
      estimatedFee: '0',
      balanceChanges: [],
      events: [],
    };
  }
}

async function computeBalanceDeltas(
  api: ApiPromise,
  accountAddress: string,
  storageChanges: [HexString, HexString | null][]
): Promise<Array<{ value: BN; change: 'send' | 'receive' }>> {
  const deltas: Array<{ value: BN; change: 'send' | 'receive' }> = [];
  
  try {
    const accountKey = api.query.system.account.key(accountAddress);
    
    for (const [key, newVal] of storageChanges) {
      if (key === accountKey && newVal !== null) {
        const newState: any = api.createType('FrameSystemAccountInfo', newVal);
        const currentState: any = await api.query.system.account(accountAddress);
        
        const currentTotal = currentState.data.free.add(currentState.data.reserved);
        const newTotal = newState.data.free.add(newState.data.reserved);
        
        if (newTotal.gt(currentTotal)) {
          deltas.push({
            change: 'receive',
            value: newTotal.sub(currentTotal),
          });
        } else if (newTotal.lt(currentTotal)) {
          deltas.push({
            change: 'send',
            value: currentTotal.sub(newTotal),
          });
        }
      }
    }
  } catch {
    // Ignore parsing errors
  }
  
  return deltas;
}

function parseOutcome(
  api: ApiPromise,
  outcome: any
): { succeeded: boolean; failureReason: string | null } {
  if (outcome.isOk) {
    const result = outcome.asOk;
    
    if (result.isOk) {
      return { succeeded: true, failureReason: null };
    } else {
      const err = result.asErr;
      
      if (err.isModule) {
        const meta = api.registry.findMetaError(err.asModule);
        const msg = `${meta.section}.${meta.name}: ${meta.docs.join(', ')}`;
        return { succeeded: false, failureReason: msg };
      } else if (err.isToken) {
        return { 
          succeeded: false, 
          failureReason: `TokenError: ${err.asToken.type}` 
        };
      } else {
        return { 
          succeeded: false, 
          failureReason: `DispatchError: ${err.type}` 
        };
      }
    }
  } else {
    const invalid = outcome.asErr;
    return { 
      succeeded: false, 
      failureReason: `InvalidTransaction: ${invalid.type}` 
    };
  }
}

export async function isChopsticksAvailable(): Promise<boolean> {
  try {
    await import('@acala-network/chopsticks-core');
    return true;
  } catch {
    return false;
  }
}
