/**
 * Custom hook for managing execution flow state
 * 
 * Simple version: Only handles stateful mode (local ExecutionArray)
 * Subscribes to local DotBot ExecutionArray updates
 */

import { useState, useEffect, useRef } from 'react';
import { ExecutionArrayState } from '@dotbot/core/executionEngine/types';
import { ExecutionMessage, DotBot } from '@dotbot/core';

/**
 * Hook to manage execution flow state with local subscription
 * 
 * SIMPLE: Only handles stateful mode (client does simulation)
 * - Subscribes to local ExecutionArray updates
 * - No WebSocket polling
 * - No backend session tracking
 */
export function useExecutionFlowState(
  executionMessage: ExecutionMessage | undefined,
  dotbot: DotBot | undefined,
  legacyState: ExecutionArrayState | null | undefined
): ExecutionArrayState | null {
  const [liveExecutionState, setLiveExecutionState] = useState<ExecutionArrayState | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Subscribe to local ExecutionArray updates
  useEffect(() => {
    // Cleanup previous subscription
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    // Require executionMessage and dotbot with currentChat
    if (!executionMessage || !dotbot || !dotbot.currentChat) {
      return;
    }

    const executionArray = dotbot.currentChat.getExecutionArray(executionMessage.executionId);
    if (!executionArray) {
      // No ExecutionArray yet, use snapshot from message if available
      if (executionMessage.executionArray) {
        setLiveExecutionState(executionMessage.executionArray);
      }
      return;
    }

    // Set initial state from ExecutionArray
    setLiveExecutionState(executionArray.getState());
    
    // Subscribe to updates
    const unsubscribe = dotbot.currentChat.onExecutionUpdate(
      executionMessage.executionId,
      (state) => {
        setLiveExecutionState(state);
      }
    );

    unsubscribeRef.current = unsubscribe;

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [executionMessage?.executionId, dotbot]);

  // Return live state (if available) or fallback to snapshot or legacy state
  return liveExecutionState || executionMessage?.executionArray || legacyState || null;
}
