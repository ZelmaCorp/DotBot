/**
 * Transfer Extrinsic Builder
 * 
 * Creates a transfer extrinsic for DOT or tokens using transferAllowDeath.
 * This allows the sender's account to be reaped if balance falls below ED.
 */

import { ApiPromise } from '@polkadot/api';
import { SubmittableExtrinsic } from '@polkadot/api/types';

/**
 * Parameters for creating a transfer extrinsic
 */
export interface TransferExtrinsicParams {
  recipient: string;
  amount: string;
}

/**
 * Create a transfer extrinsic using balances.transferAllowDeath
 * 
 * Note: This was formerly called balances.transfer in older Polkadot.js versions.
 * Transfers liquid free balance to another account. If the sender's balance falls 
 * below the Existential Deposit (ED) as a result, the account is reaped.
 * 
 * @param api Polkadot API instance
 * @param params Transfer parameters
 * @returns Transfer extrinsic
 */
export function createTransferExtrinsic(
  api: ApiPromise,
  params: TransferExtrinsicParams
): SubmittableExtrinsic<'promise'> {
  const { recipient, amount } = params;
  
  // Validate recipient address
  if (!recipient || recipient.trim().length === 0) {
    throw new Error('Recipient address is required');
  }

  // Validate amount
  if (!amount || amount === '0') {
    throw new Error('Transfer amount must be greater than zero');
  }

  // Use transferAllowDeath (renamed from transfer in Polkadot.js v10+)
  return api.tx.balances.transferAllowDeath(recipient, amount);
}

