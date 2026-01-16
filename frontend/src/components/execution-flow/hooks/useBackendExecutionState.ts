/**
 * OPTIONAL: Backend Execution State Hook
 * 
 * This hook is for ADVANCED use cases where you want to track execution
 * state from a backend DotBot API (stateless mode with backend simulation).
 * 
 * MOST USERS DON'T NEED THIS!
 * Use the simple useExecutionFlowState hook for standard stateful mode.
 * 
 * This requires:
 * - Backend DotBot API with session support
 * - WebSocket connection for real-time updates
 * - HTTP polling fallback
 */

import { useState, useEffect, useRef } from 'react';
import { ExecutionArrayState } from '@dotbot/core/executionEngine/types';
import { getExecutionState } from '../../../services/dotbotApi';

/**
 * Setup WebSocket subscription for backend execution updates
 */
function setupWebSocketSubscription(
  executionId: string,
  backendSessionId: string,
  wsSubscribe: (executionId: string, callback: (state: ExecutionArrayState) => void) => (() => void),
  setExecutionState: (state: ExecutionArrayState | null) => void
): (() => void) {
  console.log('[Backend] Using WebSocket for execution updates');
  
  return wsSubscribe(executionId, (state) => {
    // Check if execution is complete (all items finished)
    const allComplete = state.items.length > 0 && state.items.every(
      (item: any) => item.status === 'completed' || item.status === 'failed'
    );
    console.log('[Backend] WebSocket update received:', {
      executionId,
      itemsCount: state.items.length,
      allComplete
    });
    setExecutionState(state);
  });
}

/**
 * Setup HTTP polling fallback for backend execution updates
 */
function setupPollingFallback(
  executionId: string,
  backendSessionId: string,
  setExecutionState: (state: ExecutionArrayState | null) => void
): (() => void) {
  console.log('[Backend] Using HTTP polling for execution updates');
  
  let pollInterval: NodeJS.Timeout | null = null;
  let stopped = false;
  let noChangeCount = 0;
  const maxNoChangePolls = 20; // Stop after 2 minutes of no changes (6s * 20)
  
  const poll = async () => {
    if (stopped) return;
    
    try {
      const response = await getExecutionState(backendSessionId, executionId);
      
      // Extract ExecutionArrayState from API response
      if (!response.success || !response.state) {
        console.warn('[Backend] Invalid response from getExecutionState:', response);
        noChangeCount++;
        return;
      }
      
      const executionState: ExecutionArrayState = response.state;
      setExecutionState(executionState);
      
      // If execution is complete, stop polling
      // Check if all items are complete (no pending/executing items)
      const allComplete = executionState.items.length > 0 && executionState.items.every(
        (item: any) => item.status === 'completed' || item.status === 'failed'
      );
      if (allComplete) {
        console.log('[Backend] Execution complete, stopping polling');
        stopped = true;
        if (pollInterval) clearInterval(pollInterval);
        return;
      }
      
      // Reset no-change counter if state is changing
      noChangeCount = 0;
    } catch (error: any) {
      console.warn('[Backend] Poll failed:', error.message);
      noChangeCount++;
      
      // Stop polling after too many failures or no changes
      if (noChangeCount >= maxNoChangePolls) {
        console.log('[Backend] Too many poll failures or idle, stopping');
        stopped = true;
        if (pollInterval) clearInterval(pollInterval);
      }
    }
  };
  
  // Initial poll
  poll();
  
  // Poll every 6 seconds
  pollInterval = setInterval(poll, 6000);
  
  // Cleanup function
  return () => {
    stopped = true;
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  };
}

/**
 * Hook for tracking backend execution state
 * 
 * @param executionId - The execution ID to track
 * @param backendSessionId - Backend session ID
 * @param wsSubscribe - Optional WebSocket subscribe function
 * @returns Execution state from backend
 */
export function useBackendExecutionState(
  executionId: string | undefined,
  backendSessionId: string | null | undefined,
  wsSubscribe?: (executionId: string, callback: (state: ExecutionArrayState) => void) => (() => void)
): ExecutionArrayState | null {
  const [executionState, setExecutionState] = useState<ExecutionArrayState | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  
  useEffect(() => {
    // Cleanup previous subscription
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
    
    // Require executionId and backendSessionId
    if (!executionId || !backendSessionId) {
      return;
    }
    
    // Setup WebSocket or polling
    if (wsSubscribe) {
      cleanupRef.current = setupWebSocketSubscription(
        executionId,
        backendSessionId,
        wsSubscribe,
        setExecutionState
      );
    } else {
      cleanupRef.current = setupPollingFallback(
        executionId,
        backendSessionId,
        setExecutionState
      );
    }
    
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, [executionId, backendSessionId, wsSubscribe]);
  
  return executionState;
}
