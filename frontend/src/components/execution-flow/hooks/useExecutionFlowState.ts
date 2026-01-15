/**
 * Custom hook for managing execution flow state
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { ExecutionArrayState } from '@dotbot/core/executionEngine/types';
import { ExecutionMessage, DotBot } from '@dotbot/core';
import { setupExecutionSubscription } from '../executionFlowUtils';
import { useWebSocket } from '../../../contexts/WebSocketContext';

/**
 * Hook to manage execution flow state with subscription
 * Supports both stateful (local) and stateless (backend polling/WebSocket) modes
 */
export function useExecutionFlowState(
  executionMessage: ExecutionMessage | undefined,
  dotbot: DotBot | undefined,
  legacyState: ExecutionArrayState | null | undefined,
  backendSessionId?: string | null
): ExecutionArrayState | null {
  const [liveExecutionState, setLiveExecutionState] = useState<ExecutionArrayState | null>(null);
  
  // Track previous executionId to detect changes
  const prevExecutionIdRef = useRef<string | undefined>(executionMessage?.executionId);
  
  // Get WebSocket subscription function (optional - might not be connected)
  // Use try-catch to handle case where WebSocketContext is not available
  let subscribeToExecution: ((executionId: string, callback: (state: ExecutionArrayState) => void) => (() => void)) | undefined;
  let isConnected = false;
  try {
    const wsContext = useWebSocket();
    subscribeToExecution = wsContext.subscribeToExecution;
    isConnected = wsContext.isConnected;
  } catch (error) {
    // WebSocket context not available (not wrapped in provider)
    // This is OK - we'll fall back to polling
  }

  // Memoize wsSubscribe to avoid unnecessary re-subscriptions
  // Only include subscribeToExecution if WebSocket is connected
  const wsSubscribe = useMemo(() => {
    return isConnected ? subscribeToExecution : undefined;
  }, [isConnected, subscribeToExecution]);

  // Reset state when executionId changes
  useEffect(() => {
    const currentExecutionId = executionMessage?.executionId;
    if (prevExecutionIdRef.current !== currentExecutionId) {
      // Reset live state when switching to a different execution
      setLiveExecutionState(null);
      prevExecutionIdRef.current = currentExecutionId;
    }
  }, [executionMessage?.executionId]);

  // Subscribe to execution updates when using new API
  useEffect(() => {
    if (!executionMessage || !dotbot) {
      return;
    }

    const cleanup = setupExecutionSubscription(
      executionMessage,
      dotbot,
      setLiveExecutionState,
      backendSessionId,
      wsSubscribe
    );

    return cleanup;
  }, [executionMessage?.executionId, dotbot, backendSessionId, wsSubscribe]);

  // Use live state if available, otherwise fall back to snapshot or legacy state
  return liveExecutionState || executionMessage?.executionArray || legacyState || null;
}
