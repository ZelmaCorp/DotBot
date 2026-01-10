/**
 * Execution Flow Footer Component
 * 
 * Displays approval actions or progress bar
 */

import React from 'react';
import { Play, X, Loader2 } from 'lucide-react';
import { ExecutionArrayState } from '../../lib/executionEngine/types';

export interface ExecutionFlowFooterProps {
  executionState: ExecutionArrayState;
  isWaitingForApproval: boolean;
  isComplete: boolean;
  isSimulating: boolean;
  showCancel: boolean;
  showAccept: boolean;
  onAcceptAndStart: () => void;
  onCancel: () => void;
}

const ExecutionFlowFooter: React.FC<ExecutionFlowFooterProps> = ({
  executionState,
  isWaitingForApproval,
  isComplete,
  isSimulating,
  showCancel,
  showAccept,
  onAcceptAndStart,
  onCancel
}) => {
  if (isWaitingForApproval) {
    return (
      <div className="execution-flow-footer">
        <div className="execution-flow-approval-actions">
          {showCancel && (
            <button
              onClick={onCancel}
              className="execution-cancel-btn"
            >
              <X size={16} />
              Cancel
            </button>
          )}
          {showAccept && (
            <button
              onClick={onAcceptAndStart}
              className="execution-accept-btn"
              disabled={isSimulating}
              title={isSimulating ? 'Waiting for simulation to complete...' : 'Accept and start execution'}
            >
              <Play size={16} />
              {isSimulating ? 'Simulating...' : 'Accept and Start'}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="execution-flow-footer">
      <div className="execution-flow-progress">
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{
              width: `${(executionState.completedItems / executionState.totalItems) * 100}%`
            }}
          />
        </div>
        <div className="progress-text">
          {executionState.completedItems} / {executionState.totalItems} completed
          {isComplete && executionState.failedItems === 0 && ' ✓'}
        </div>
      </div>
    </div>
  );
};

export default ExecutionFlowFooter;

