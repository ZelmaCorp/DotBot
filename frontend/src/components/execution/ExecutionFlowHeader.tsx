/**
 * Execution Flow Header Component
 * 
 * Displays the title, step count, and summary badges
 */

import React from 'react';
import { Loader2 } from 'lucide-react';
import { ExecutionArrayState } from '../../lib/executionEngine/types';

export interface ExecutionFlowHeaderProps {
  executionState: ExecutionArrayState;
  isWaitingForApproval: boolean;
  isExecuting: boolean;
}

const ExecutionFlowHeader: React.FC<ExecutionFlowHeaderProps> = ({
  executionState,
  isWaitingForApproval,
  isExecuting
}) => {
  return (
    <div className="execution-flow-header">
      <div className="execution-flow-title">
        <h3>{isWaitingForApproval ? 'Review Transaction Flow' : 'Execution Flow'}</h3>
        <span className="execution-flow-count">
          {executionState.totalItems} step{executionState.totalItems !== 1 ? 's' : ''}
        </span>
      </div>
      
      {!isWaitingForApproval && (
        <div className="execution-flow-summary">
          {executionState.completedItems > 0 && (
            <span className="summary-badge summary-success">
              {executionState.completedItems} completed
            </span>
          )}
          {isExecuting && (
            <span className="summary-badge summary-executing">
              <Loader2 className="animate-spin inline mr-1" size={12} />
              executing
            </span>
          )}
          {executionState.failedItems > 0 && (
            <span className="summary-badge summary-error">
              {executionState.failedItems} failed
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default ExecutionFlowHeader;

