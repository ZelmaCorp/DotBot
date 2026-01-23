/**
 * Chopsticks Client
 * 
 * Client for connecting to the Chopsticks simulation server.
 * This replaces direct Chopsticks usage in the frontend.
 * 
 * The client makes HTTP requests to the backend Chopsticks server
 * to perform transaction simulations.
 */

import type { ApiPromise } from '@polkadot/api';
import type { SubmittableExtrinsic } from '@polkadot/api/types';
import { BN } from '@polkadot/util';
import { SimulationResult, SimulationStatusCallback } from './chopsticks';
import { SequentialSimulationResult, SequentialSimulationItem } from './sequentialSimulation';
import { createSubsystemLogger, Subsystem } from '../logger';

const simulationLogger = createSubsystemLogger(Subsystem.SIMULATION);

// Server URL - defaults to backend server (port 8000), can be overridden via environment variable
// In frontend+backend setup, backend is typically on port 8000, frontend on 3000
// In standalone backend, this will be localhost:8000
const DEFAULT_SERVER_URL = process.env.CHOPSTICKS_SERVER_URL || 
  (typeof window !== 'undefined' 
    ? `${window.location.protocol}//${window.location.hostname}:8000` 
    : 'http://localhost:8000');

/**
 * Get the Chopsticks server URL
 * 
 * Priority:
 * 1. Window global variable (for runtime override)
 * 2. CHOPSTICKS_SERVER_URL environment variable
 * 3. REACT_APP_API_URL environment variable (common frontend config)
 * 4. Default: backend on port 8000
 */
function getServerUrl(): string {
  // Check if we're in a browser environment with override
  if (typeof window !== 'undefined' && (window as any).CHOPSTICKS_SERVER_URL) {
    return (window as any).CHOPSTICKS_SERVER_URL;
  }
  
  // Check environment variables
  if (typeof process !== 'undefined') {
    if (process.env.CHOPSTICKS_SERVER_URL) {
      return process.env.CHOPSTICKS_SERVER_URL;
    }
    // Fallback to REACT_APP_API_URL (common in Create React App)
    if (process.env.REACT_APP_API_URL) {
      return process.env.REACT_APP_API_URL;
    }
  }
  
  return DEFAULT_SERVER_URL;
}

/**
 * Check if the Chopsticks server is available
 */
export async function isChopsticksAvailable(): Promise<boolean> {
  try {
    const serverUrl = getServerUrl();
    const healthUrl = `${serverUrl}/api/simulation/health`;
    
    const response = await fetch(healthUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(5000), // 5 second timeout
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      const text = await response.text();
      simulationLogger.debug({ 
        status: response.status,
        statusText: response.statusText,
        responsePreview: text.substring(0, 100)
      }, 'Simulation server health check failed');
      return false;
    }
    
    // Check if response is JSON
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      simulationLogger.debug({ 
        contentType,
        responsePreview: text.substring(0, 100)
      }, 'Simulation server returned non-JSON response');
      return false;
    }
    
    const data = await response.json();
    const isAvailable = data.status === 'ok';
    
    if (!isAvailable) {
      simulationLogger.debug({ data }, 'Simulation server health check returned non-ok status');
    }
    
    return isAvailable;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorDetails = error instanceof Error && error.name === 'AbortError' 
      ? 'Request timeout (server may be down or unreachable)'
      : errorMessage;
    
    simulationLogger.debug({ 
      error: errorDetails,
      errorName: error instanceof Error ? error.name : 'Unknown'
    }, 'Simulation server not available');
    return false;
  }
}

/**
 * Simulate a transaction using the Chopsticks server
 */
export async function simulateTransaction(
  api: ApiPromise,
  rpcEndpoints: string | string[],
  extrinsic: SubmittableExtrinsic<'promise'>,
  senderAddress: string,
  onStatusUpdate?: SimulationStatusCallback
): Promise<SimulationResult> {
  const serverUrl = getServerUrl();
  const endpoints = Array.isArray(rpcEndpoints) ? rpcEndpoints : [rpcEndpoints];
  
  // Update status
  if (onStatusUpdate) {
    onStatusUpdate({
      phase: 'initializing',
      message: 'Connecting to simulation server...',
      progress: 5,
    });
  }
  
  // Get finalized block hash for metadata consistency
  let blockHash: string | undefined = undefined;
  try {
    if (onStatusUpdate) {
      onStatusUpdate({
        phase: 'forking',
        message: 'Getting current blockchain state...',
        progress: 10,
      });
    }
    
    const finalizedHash = await api.rpc.chain.getFinalizedHead();
    blockHash = finalizedHash.toHex();
  } catch (error) {
    simulationLogger.warn({ 
      error: error instanceof Error ? error.message : String(error)
    }, 'Failed to get finalized block hash, server will use latest');
  }
  
  // Get extrinsic hex (method call hex)
  const extrinsicHex = extrinsic.method.toHex();
  
  // Prepare request
  const request = {
    rpcEndpoints: endpoints,
    extrinsicHex,
    senderAddress,
    blockHash,
    buildBlockMode: 'Batch' as const,
  };
  
  if (onStatusUpdate) {
    onStatusUpdate({
      phase: 'executing',
      message: 'Simulating transaction on server...',
      progress: 30,
    });
  }
  
  try {
    // Make request to server
    const response = await fetch(`${serverUrl}/api/simulation/simulate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });
    
    if (!response.ok) {
      let errorMessage = `Server returned ${response.status} ${response.statusText}`;
      
      try {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } else {
          const text = await response.text();
          errorMessage = text || errorMessage;
        }
      } catch (parseError) {
        simulationLogger.warn({ 
          error: parseError instanceof Error ? parseError.message : String(parseError)
        }, 'Failed to parse error response');
      }
      
      const fullErrorMessage = `Simulation failed: ${errorMessage}`;
      simulationLogger.error({ 
        status: response.status,
        error: errorMessage
      }, 'Simulation request failed');
      
      if (onStatusUpdate) {
        onStatusUpdate({
          phase: 'error',
          message: fullErrorMessage,
          progress: 100,
        });
      }
      
      return {
        success: false,
        error: fullErrorMessage,
        estimatedFee: '0',
        balanceChanges: [],
        events: [],
      };
    }
    
    // Parse response
    let result;
    try {
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(`Expected JSON but got ${contentType}: ${text.substring(0, 100)}`);
      }
      result = await response.json();
    } catch (parseError) {
      const errorMessage = parseError instanceof Error ? parseError.message : 'Failed to parse server response';
      simulationLogger.error({ error: errorMessage }, 'Failed to parse simulation response');
      
      if (onStatusUpdate) {
        onStatusUpdate({
          phase: 'error',
          message: `Simulation failed: ${errorMessage}`,
          progress: 100,
        });
      }
      
      return {
        success: false,
        error: `Failed to parse server response: ${errorMessage}`,
        estimatedFee: '0',
        balanceChanges: [],
        events: [],
      };
    }
    
    // Convert balance changes from strings back to BN
    const balanceChanges = result.balanceChanges.map((bc: { value: string; change: 'send' | 'receive' }) => ({
      value: new BN(bc.value),
      change: bc.change,
    }));
    
    if (onStatusUpdate) {
      onStatusUpdate({
        phase: result.success ? 'complete' : 'error',
        message: result.success 
          ? '✓ Simulation completed successfully' 
          : `✗ Simulation failed: ${result.error || 'Unknown error'}`,
        progress: 100,
      });
    }
    
    return {
      success: result.success,
      error: result.error,
      estimatedFee: result.estimatedFee,
      balanceChanges,
      events: result.events || [],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    simulationLogger.error({ error: errorMessage }, 'Failed to connect to simulation server');
    
    if (onStatusUpdate) {
      onStatusUpdate({
        phase: 'error',
        message: `Failed to connect to simulation server: ${errorMessage}`,
        progress: 100,
      });
    }
    
    return {
      success: false,
      error: `Failed to connect to simulation server: ${errorMessage}`,
      estimatedFee: '0',
      balanceChanges: [],
      events: [],
    };
  }
}

/**
 * Simulate sequential transactions using the Chopsticks server
 */
export async function simulateSequentialTransactions(
  api: ApiPromise,
  rpcEndpoints: string | string[],
  items: SequentialSimulationItem[],
  onStatusUpdate?: SimulationStatusCallback
): Promise<SequentialSimulationResult> {
  const serverUrl = getServerUrl();
  const endpoints = Array.isArray(rpcEndpoints) ? rpcEndpoints : [rpcEndpoints];
  
  // Update status
  if (onStatusUpdate) {
    onStatusUpdate({
      phase: 'initializing',
      message: `Preparing sequential simulation for ${items.length} transactions...`,
      progress: 5,
    });
  }
  
  // Prepare request items
  const requestItems = items.map(item => ({
    extrinsicHex: item.extrinsic.method.toHex(),
    senderAddress: item.senderAddress,
    description: item.description,
  }));
  
  // Prepare request
  const request = {
    rpcEndpoints: endpoints,
    items: requestItems,
    buildBlockMode: 'Instant' as const,
  };
  
  if (onStatusUpdate) {
    onStatusUpdate({
      phase: 'executing',
      message: `Simulating ${items.length} transactions on server...`,
      progress: 20,
    });
  }
  
  try {
    // Make request to server
    const response = await fetch(`${serverUrl}/api/simulation/simulate-sequential`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      const errorMessage = errorData.error || `Server returned ${response.status}`;
      
      if (onStatusUpdate) {
        onStatusUpdate({
          phase: 'error',
          message: `Sequential simulation failed: ${errorMessage}`,
          progress: 100,
        });
      }
      
      return {
        success: false,
        error: errorMessage,
        results: [],
        totalEstimatedFee: '0',
        finalBalanceChanges: [],
      };
    }
    
    const result = await response.json();
    
    // Convert results
    const convertedResults = result.results.map((r: any) => ({
      index: r.index,
      description: r.description,
      result: {
        ...r.result,
        balanceChanges: r.result.balanceChanges.map((bc: { value: string; change: 'send' | 'receive' }) => ({
          value: new BN(bc.value),
          change: bc.change,
        })),
      },
    }));
    
    const finalBalanceChanges = result.finalBalanceChanges.map((bc: { value: string; change: 'send' | 'receive' }) => ({
      value: new BN(bc.value),
      change: bc.change,
    }));
    
    if (onStatusUpdate) {
      onStatusUpdate({
        phase: result.success ? 'complete' : 'error',
        message: result.success 
          ? `✓ All ${items.length} transactions simulated successfully!` 
          : `✗ Sequential simulation failed: ${result.error || 'Unknown error'}`,
        progress: 100,
      });
    }
    
    return {
      success: result.success,
      error: result.error,
      results: convertedResults,
      totalEstimatedFee: result.totalEstimatedFee,
      finalBalanceChanges,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    simulationLogger.error({ error: errorMessage }, 'Failed to connect to simulation server');
    
    if (onStatusUpdate) {
      onStatusUpdate({
        phase: 'error',
        message: `Failed to connect to simulation server: ${errorMessage}`,
        progress: 100,
      });
    }
    
    return {
      success: false,
      error: `Failed to connect to simulation server: ${errorMessage}`,
      results: [],
      totalEstimatedFee: '0',
      finalBalanceChanges: [],
    };
  }
}
