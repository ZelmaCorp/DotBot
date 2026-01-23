/**
 * Execution Flow Component
 * 
 * Visual representation of the ExecutionArray.
 * Shows all steps that will happen and provides a single "Accept and Start" button.
 */

import React from 'react';
import type { ExecutionMessage, DotBot } from '@dotbot/core';
import type { ExecutionArrayState } from '@dotbot/core/executionEngine/types';
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
import { handleAcceptAndStart } from './executionHandlers';
import './execution-flow.css';

export interface ExecutionFlowProps {
  // New API: Pass ExecutionMessage + DotBot instance
  executionMessage?: ExecutionMessage;
  dotbot?: DotBot;
  
  // Legacy API: Pass state directly
  state?: ExecutionArrayState | null;
  onAcceptAndStart?: () => void;
  onCancel?: () => void;
  show?: boolean;
}

const ExecutionFlow: React.FC<ExecutionFlowProps> = ({
  executionMessage,
  dotbot,
  state,
  onAcceptAndStart,
  onCancel,
  show = true
}) => {
  // Use custom hooks for state management
  const executionState = useExecutionFlowState(executionMessage, dotbot, state);
  const { isExpanded, toggleExpand } = useExpandedItems();

  // Determine if we should show the component
  const shouldShow = executionMessage ? true : show;
  if (!shouldShow) {
    return null;
  }

  // Render loading state helper
  const renderLoadingState = (state: typeof executionState) => (
    <div className="execution-flow-container">
      <ExecutionFlowHeader
        executionState={state}
        isWaitingForApproval={false}
        isExecuting={false}
      />
      <LoadingState />
    </div>
  );

  // Show loading if no state or no items
  if (!executionState) {
    return executionMessage ? renderLoadingState(null) : null;
  }

  if (executionState.items.length === 0) {
    return renderLoadingState(executionState);
  }

  // Handle execution through DotBot if using new API
  const onAcceptAndStartHandler = () => {
    handleAcceptAndStart(executionMessage, dotbot, onAcceptAndStart);
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
        {executionState.items.map((item, index) => {
          // Memoize expanded state to prevent unnecessary re-renders
          const itemIsExpanded = isExpanded(item.id);
          return (
            <ExecutionFlowItem
              key={item.id}
              item={item}
              index={index}
              isExpanded={itemIsExpanded}
              onToggleExpand={toggleExpand}
            />
          );
        })}
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
        onAcceptAndStart={onAcceptAndStartHandler}
        onCancel={handleCancel}
      />
    </div>
  );
};

export default ExecutionFlow;
