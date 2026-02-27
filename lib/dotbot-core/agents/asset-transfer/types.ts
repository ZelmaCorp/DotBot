/**
 * Types for Asset Transfer Agent
 */

import { BaseAgentParams } from '../types';

/**
 * Chain selection for transfers
 * - 'assetHub': Asset Hub (recommended for DOT transfers post-migration)
 * - 'relay': Relay Chain (for staking, governance, validator operations)
 */
export type ChainType = 'assetHub' | 'relay';

export interface TransferParams extends BaseAgentParams {
  /** Recipient address */
  recipient: string;
  
  /** Amount to transfer in human token units (e.g. "1", "1.5", 5). Always converted to Planck internally. */
  amount: string | number;
  
  /** Target chain for the transfer - defaults to 'assetHub' for DOT */
  chain?: ChainType;
  
  /** Keep account alive (prevent reaping) - defaults to false */
  keepAlive?: boolean;
  
  /** Whether to validate balance before creating extrinsic - defaults to true */
  validateBalance?: boolean;
}

export interface BatchTransferParams extends BaseAgentParams {
  /** Array of transfers */
  transfers: Array<{
    recipient: string;
    /** Amount in human token units (e.g. "1", "1.5"). Always converted to Planck internally. */
    amount: string | number;
  }>;
  
  /** Target chain for the batch transfer - defaults to 'assetHub' for DOT */
  chain?: ChainType;
  
  /** Whether to validate balance before creating extrinsic - defaults to true */
  validateBalance?: boolean;
}

