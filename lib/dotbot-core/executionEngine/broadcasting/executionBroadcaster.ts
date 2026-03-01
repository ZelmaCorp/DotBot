/**
 * Execution Broadcaster
 * 
 * Handles transaction broadcasting and monitoring.
 */

import { ApiPromise } from '@polkadot/api';
import { SubmittableExtrinsic } from '@polkadot/api/types';
import { ExecutionResult } from '../types';

/** Callback when tx is in a block (before finality). Used for UI "Confirming..." state. */
export type BroadcastStatus = 'in_block';

const CONNECTION_LOST_MSG =
  'Connection lost while waiting for transaction. Status unknown — check block explorer for tx hash.';

/**
 * Broadcast transaction and monitor status.
 * Optional onStatus('in_block') for UI. Rejects on API disconnect so ExecutionFlow doesn't hang.
 */
export async function broadcastTransaction(
  extrinsic: SubmittableExtrinsic<'promise'>,
  api: ApiPromise,
  timeout: number,
  onStatus?: (status: BroadcastStatus) => void
): Promise<ExecutionResult> {
  return new Promise<ExecutionResult>((resolve, reject) => {
    let settled = false;
    const timeoutHandle = setTimeout(() => done(new Error('Transaction timeout')), timeout);
    const onDisconnected = () => done(new Error(CONNECTION_LOST_MSG));

    const done = (err?: Error, value?: ExecutionResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutHandle);
      if (typeof api.off === 'function') api.off('disconnected', onDisconnected);
      if (err) reject(err);
      else resolve(value!);
    };

    if (typeof api.on === 'function') api.on('disconnected', onDisconnected);
    try {
      extrinsic
        .send((result) => handleTransactionResult(result, api, extrinsic, (v) => done(undefined, v), onStatus))
        .catch((error: Error) => done(error instanceof Error ? error : new Error(String(error))));
    } catch (error) {
      done(error instanceof Error ? error : new Error(String(error)));
    }
  });
}

function handleTransactionResult(
  result: any,
  api: ApiPromise,
  extrinsic: SubmittableExtrinsic<'promise'>,
  resolve: (value: ExecutionResult) => void,
  onStatus?: (status: BroadcastStatus) => void
): void {
  if (result.status.isInBlock && onStatus) {
    onStatus('in_block');
  }
  if (result.status.isFinalized) {
    const blockHash = result.status.asFinalized.toString();

    const failedEvent = result.events.find(({ event }: any) => {
      return api.events.system.ExtrinsicFailed.is(event);
    });

    if (failedEvent) {
      const errorEvent = failedEvent.event.toHuman();
      let errorDetails = 'Transaction failed';

      if (failedEvent.event.data && failedEvent.event.data.length > 0) {
        const dispatchError = failedEvent.event.data[0];

        if (dispatchError.isModule) {
          try {
            const decoded = api.registry.findMetaError(dispatchError.asModule);
            errorDetails = `${decoded.section}.${decoded.name}: ${decoded.docs.join(' ')}`;
          } catch {
            // Could not decode error
          }
        }
      }

      resolve({
        success: false,
        error: errorDetails,
        errorCode: 'EXTRINSIC_FAILED',
        rawError: JSON.stringify(errorEvent),
      });
    } else {
      resolve({
        success: true,
        txHash: extrinsic.hash.toString(),
        blockHash,
        events: result.events.map((e: any) => e.event.toHuman()),
      });
    }
  }

  if (result.status.isInvalid || result.status.isDropped || result.status.isUsurped) {
    const statusType = result.status.isInvalid ? 'Invalid' :
      result.status.isDropped ? 'Dropped' : 'Usurped';
    resolve({
      success: false,
      error: `Transaction ${statusType}`,
      errorCode: statusType.toUpperCase(),
    });
  }
}

/**
 * Monitor transaction status
 */
export async function monitorTransaction(
  _txHash: string,
  _api: ApiPromise
): Promise<void> {
  // Monitoring is handled by broadcastTransaction callback
  // This function is kept for API compatibility
}

