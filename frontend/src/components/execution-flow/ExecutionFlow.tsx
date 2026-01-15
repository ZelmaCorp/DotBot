/**
 * Execution Flow Component
 * 
 * Visual representation of the ExecutionArray.
 * Shows all steps that will happen and provides a single "Accept and Start" button.
 */

import React from 'react';
import type { ExecutionMessage, DotBot } from '@dotbot/core';
import { ExecutionArrayState } from '@dotbot/core/executionEngine/types';
import { isSimulationEnabled } from '@dotbot/core/executionEngine/simulation/simulationConfig';
import { useExecutionFlowState, useExpandedItems } from './hooks';
import { LoadingState, ApprovalMessage } from './components';
import ExecutionFlowHeader from './ExecutionFlowHeader';
import ExecutionFlowItem from './ExecutionFlowItem';
import ExecutionFlowFooter from './ExecutionFlowFooter';
import {
  areAllSimulationsComplete,
  getSimulationStats
} from './simulationUtils';
import {
  isWaitingForApproval,
  isFlowComplete,
  isFlowExecuting,
  isFlowSuccessful,
  isFlowFailed
} from './executionFlowUtils';
import { startExecution } from '../../services/dotbotApi';
import './execution-flow.css';

export interface ExecutionFlowProps {
  // New API: Pass ExecutionMessage + DotBot instance
  executionMessage?: ExecutionMessage;
  dotbot?: DotBot;
  backendSessionId?: string | null; // Backend session ID for API calls (stateless mode)
  
  // Legacy API: Pass state directly
  state?: ExecutionArrayState | null;
  onAcceptAndStart?: () => void;
  onCancel?: () => void;
  show?: boolean;
}

const ExecutionFlow: React.FC<ExecutionFlowProps> = ({
  executionMessage,
  dotbot,
  backendSessionId,
  state,
  onAcceptAndStart,
  onCancel,
  show = true
}) => {
  console.log('[ExecutionFlow] Rendering with:', { 
    hasExecutionMessage: !!executionMessage, 
    executionId: executionMessage?.executionId,
    hasDotbot: !!dotbot, 
    hasBackendSessionId: !!backendSessionId,
    show 
  });
  
  // Use custom hooks for state management (passes backendSessionId for polling)
  const executionState = useExecutionFlowState(executionMessage, dotbot, state, backendSessionId);
  const { isExpanded, toggleExpand } = useExpandedItems();

  console.log('[ExecutionFlow] ExecutionState:', {
    hasState: !!executionState,
    itemsCount: executionState?.items.length
  });

  // Determine if we should show the component
  const shouldShow = executionMessage ? true : show;
  if (!shouldShow) {
    console.log('[ExecutionFlow] Not showing - shouldShow is false');
    return null;
  }

  // Loading states
  if (executionMessage && !executionState) {
    return (
      <div className="execution-flow-container">
        <ExecutionFlowHeader
          executionState={null}
          isWaitingForApproval={false}
          isExecuting={false}
        />
        <LoadingState />
      </div>
    );
  }

  if (executionState && executionState.items.length === 0) {
    return (
      <div className="execution-flow-container">
        <ExecutionFlowHeader
          executionState={executionState}
          isWaitingForApproval={false}
          isExecuting={false}
        />
        <LoadingState />
      </div>
    );
  }

  if (!executionState) {
    return null;
  }

  // Handle execution through DotBot if using new API
  // Execution always happens on frontend (where signing handlers are available)
  // If backend has state, use it; otherwise rebuild from executionPlan locally
  const handleAcceptAndStart = () => {
    if (executionMessage && dotbot) {
      // Check if we need to get state from backend (stateless mode) - run in background
      if (backendSessionId && (!dotbot.currentChat || !dotbot.currentChat.getExecutionArray(executionMessage.executionId))) {
        // Try to get state from backend (may fail if server restarted) - don't block UI
        console.info('Starting execution from backend');
        startExecution(backendSessionId, executionMessage.executionId, false)
          .then(response => {
            // Update execution message with state from backend
            if (response.state && executionMessage) {
              executionMessage.executionArray = response.state;
            }
            console.info('[ExecutionFlow] Got execution state from backend', response);
          })
          .catch((error: any) => {
            // Backend doesn't have state (e.g., server restarted) - that's OK
            // We'll rebuild from executionPlan locally
            if (error.message?.includes('404') || error.message?.includes('not found')) {
              console.log('[ExecutionFlow] Backend state not found (server may have restarted), rebuilding from executionPlan locally');
            } else {
              console.warn('[ExecutionFlow] Failed to get state from backend:', error);
            }
          });
        console.info('Finished starting execution from backend');
      }
      
      // Execute on frontend (both stateful and stateless modes)
      // DON'T await - let execution run in background, WebSocket subscription will update UI
      // Use setTimeout to defer execution to next event loop tick (prevents UI freezing)
      // startExecution will rebuild ExecutionArray from executionPlan if needed
      setTimeout(() => {
        dotbot.startExecution(executionMessage.executionId, { autoApprove: false })
          .catch(error => console.error('[ExecutionFlow] Execution failed:', error));
      }, 0);
      console.log('[ExecutionFlow] Started execution in background...');
    } else if (onAcceptAndStart) {
      onAcceptAndStart();
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
  };

  // Calculate flow state
  const simulationEnabled = isSimulationEnabled();
  const simulationStats = getSimulationStats(executionState);
  const isSimulating = simulationEnabled && simulationStats.totalSimulating > 0;
  const allSimulationsComplete = areAllSimulationsComplete(executionState.items, isSimulating);
  const waitingForApproval = isWaitingForApproval(executionState);
  const isComplete = isFlowComplete(executionState);
  const isExecuting = isFlowExecuting(executionState);
  const flowSuccessful = isFlowSuccessful(executionState);
  const flowFailed = isFlowFailed(executionState);
  const hasActiveSimulation = simulationEnabled && isSimulating;

  const flowStatus = flowSuccessful ? 'success' : flowFailed ? 'failed' : isExecuting ? 'executing' : 'pending';

  return (
    <div className="execution-flow-container" data-flow-status={flowStatus}>
      <ExecutionFlowHeader
        executionState={executionState}
        isWaitingForApproval={waitingForApproval}
        isExecuting={isExecuting}
        isFlowSuccessful={flowSuccessful}
        isFlowFailed={flowFailed}
      />

      {!hasActiveSimulation && !allSimulationsComplete && waitingForApproval && (
        <ApprovalMessage simulationEnabled={simulationEnabled} />
      )}

      <div className="execution-flow-items">
        {executionState.items.map((item, index) => (
          <ExecutionFlowItem
            key={item.id}
            item={item}
            index={index}
            isExpanded={isExpanded(item.id)}
            onToggleExpand={toggleExpand}
          />
        ))}
      </div>

      <ExecutionFlowFooter
        executionState={executionState}
        isWaitingForApproval={waitingForApproval}
        isComplete={isComplete}
        isFlowSuccessful={flowSuccessful}
        isFlowFailed={flowFailed}
        isSimulating={isSimulating}
        showCancel={false}
        showAccept={!!(onAcceptAndStart || executionMessage)}
        onAcceptAndStart={handleAcceptAndStart}
        onCancel={handleCancel}
      />
    </div>
  );
};

export default ExecutionFlow;
