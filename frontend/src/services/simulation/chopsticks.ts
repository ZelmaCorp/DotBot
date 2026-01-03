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

/**
 * Simulates transaction execution on a forked chain state
 */
export async function simulateTransaction(
  api: ApiPromise,
  rpcEndpoints: string | string[],
  extrinsic: SubmittableExtrinsic<'promise'>,
  senderAddress: string
): Promise<SimulationResult> {
  const startTime = Date.now();
  
  try {
    const { BuildBlockMode, setup } = await import('@acala-network/chopsticks-core');
    
    const dbName = `dotbot-sim-cache:${api.genesisHash.toHex()}`;
    const storage = new ChopsticksDatabase(dbName);
    
    const blockHash = await api.rpc.chain.getBlockHash();
    
    const chain = await setup({
      endpoint: Array.isArray(rpcEndpoints) ? rpcEndpoints : [rpcEndpoints],
      block: blockHash.toHex(),
      buildBlockMode: BuildBlockMode.Batch,
      mockSignatureHost: true,
      db: storage,
    });
    
    const { outcome, storageDiff } = await chain.dryRunExtrinsic(
      {
        call: extrinsic.method.toHex(),
        address: senderAddress,
      },
      blockHash.toHex()
    );
    
    const balanceDeltas = await computeBalanceDeltas(
      api,
      senderAddress,
      storageDiff
    );
    
    const { succeeded, failureReason } = parseOutcome(api, outcome);
    
    let fee = '0';
    try {
      const feeInfo = await extrinsic.paymentInfo(senderAddress);
      fee = feeInfo.partialFee.toString();
    } catch {
      // Fee estimation failed, use default
    }
    
    await storage.deleteBlock(blockHash.toHex());
    await storage.close();
    await chain.close();
    
    return {
      success: succeeded,
      error: failureReason,
      estimatedFee: fee,
      balanceChanges: balanceDeltas,
      events: [],
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
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
