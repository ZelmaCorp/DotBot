/**
 * Transaction Simulation Service
 * 
 * Client interface for Chopsticks transaction simulation.
 * 
 * NOTE: This module provides a client interface that connects to the backend server.
 * All Chopsticks setup and execution happens on the server (@dotbot/express).
 * 
 * The server must be running and accessible for simulation to work.
 */

import type { ApiPromise } from '@polkadot/api';
import type { SubmittableExtrinsic } from '@polkadot/api/types';
import { BN } from '@polkadot/util';
import { createSubsystemLogger, Subsystem } from '../logger';

// Import client functions - simulation is now client-server architecture
// All Chopsticks setup happens on the server (@dotbot/express)
import { 
  simulateTransaction as simulateTransactionClient, 
  isChopsticksAvailable as isChopsticksServerAvailable 
} from './chopsticksClient';

const simulationLogger = createSubsystemLogger(Subsystem.SIMULATION);

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
 * Simulates transaction execution using the Chopsticks server
 * 
 * NOTE: This function delegates to the client, which connects to the backend server.
 * All Chopsticks setup and execution happens on the server (@dotbot/express).
 * 
 * The server must be running and accessible for simulation to work.
 */
export async function simulateTransaction(
  api: ApiPromise,
  rpcEndpoints: string | string[],
  extrinsic: SubmittableExtrinsic<'promise'>,
  senderAddress: string,
  onStatusUpdate?: SimulationStatusCallback
): Promise<SimulationResult> {
  // Check if server is available
  const serverAvailable = await isChopsticksServerAvailable();
  if (!serverAvailable) {
    const errorMsg = 'Chopsticks simulation server is not available. Please ensure the backend server is running at the correct URL and the simulation routes are mounted at /api/simulation.';
    simulationLogger.error({}, errorMsg);
    
    // Show error via status update if available
    if (onStatusUpdate) {
      onStatusUpdate({
        phase: 'error',
        message: errorMsg,
        progress: 100,
        details: 'Check that the backend server is running and accessible.'
      });
    }
    
    // Return error result instead of throwing
    return {
      success: false,
      error: errorMsg,
      estimatedFee: '0',
      balanceChanges: [],
      events: [],
    };
  }
  
  simulationLogger.debug({}, 'Using Chopsticks server for simulation');
  
  // Delegate to client, which makes HTTP request to server
  return await simulateTransactionClient(api, rpcEndpoints, extrinsic, senderAddress, onStatusUpdate);
}

/**
 * Check if Chopsticks simulation is available
 * 
 * This checks if the backend server is running and accessible.
 */
export async function isChopsticksAvailable(): Promise<boolean> {
  return await isChopsticksServerAvailable();
}
