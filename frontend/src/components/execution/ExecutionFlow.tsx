/**
 * Execution Flow Component
 * 
 * Visual representation of the ExecutionArray.
 * Shows each operation, its status, and handles approvals visually.
 */

import React, { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, Clock, Loader2, AlertTriangle, ChevronRight } from 'lucide-react';
import { ExecutionItem, ExecutionArrayState } from '../../lib/executionEngine/types';
import '../../styles/execution-flow.css';

export interface ExecutionFlowProps {
  state: ExecutionArrayState | null;
    onApprove?: (itemId: string) => void;
    onReject?: (itemId: string) => void;
    onApproveAll?: () => void;
    onCancel?: () => void;
    show?: boolean;
}

const ExecutionFlow: React.FC<ExecutionFlowProps> = ({
  state,
  onApprove,
  onReject,
  onApproveAll,
  onCancel,
  show = true
}) => {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  // Auto-expand first pending item
  useEffect(() => {
    if (state && state.items.length > 0) {
      const firstPending = state.items.find(item => 
        item.status === 'pending' || item.status === 'ready'
      );
      if (firstPending) {
        setExpandedItems(new Set([firstPending.id]));
      }
    }
  }, [state]);

  if (!show || !state || state.items.length === 0) {
    return null;
  }

  const toggleExpand = (itemId: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedItems(newExpanded);
  };

  const getStatusIcon = (status: ExecutionItem['status']) => {
    switch (status) {
      case 'completed':
      case 'finalized':
        return <CheckCircle2 className="status-icon status-success" />;
      case 'failed':
        return <XCircle className="status-icon status-error" />;
      case 'cancelled':
        return <XCircle className="status-icon status-cancelled" />;
      case 'signing':
      case 'broadcasting':
      case 'executing':
        return <Loader2 className="status-icon status-executing animate-spin" />;
      case 'ready':
        return <Clock className="status-icon status-ready" />;
      case 'pending':
      default:
        return <Clock className="status-icon status-pending" />;
    }
  };

  const getStatusLabel = (status: ExecutionItem['status']) => {
    switch (status) {
      case 'pending': return 'Pending';
      case 'ready': return 'Ready';
      case 'executing': return 'Executing';
      case 'signing': return 'Signing...';
      case 'broadcasting': return 'Broadcasting...';
      case 'in_block': return 'In Block';
      case 'finalized': return 'Finalized';
      case 'completed': return 'Completed';
      case 'failed': return 'Failed';
      case 'cancelled': return 'Cancelled';
      default: return status;
    }
  };

  const getStatusColor = (status: ExecutionItem['status']) => {
    switch (status) {
      case 'completed':
      case 'finalized':
        return 'var(--status-success)';
      case 'failed':
        return 'var(--status-error)';
      case 'cancelled':
        return 'var(--status-cancelled)';
      case 'signing':
      case 'broadcasting':
      case 'executing':
        return 'var(--status-executing)';
      case 'ready':
        return 'var(--status-ready)';
      default:
        return 'var(--status-pending)';
    }
  };

  const pendingItems = state.items.filter(item => 
    item.status === 'pending' || item.status === 'ready'
  );
  const executingItems = state.items.filter(item => 
    item.status === 'executing' || item.status === 'signing' || item.status === 'broadcasting'
  );
  const completedItems = state.items.filter(item => 
    item.status === 'completed' || item.status === 'finalized'
  );
  const failedItems = state.items.filter(item => item.status === 'failed');

  return (
    <div className="execution-flow-container">
      {/* Header */}
      <div className="execution-flow-header">
        <div className="execution-flow-title">
          <h3>Execution Flow</h3>
          <span className="execution-flow-count">
            {state.totalItems} operation{state.totalItems !== 1 ? 's' : ''}
          </span>
        </div>
        
        {/* Summary */}
        <div className="execution-flow-summary">
          {pendingItems.length > 0 && (
            <span className="summary-badge summary-pending">
              {pendingItems.length} pending
            </span>
          )}
          {executingItems.length > 0 && (
            <span className="summary-badge summary-executing">
              {executingItems.length} executing
            </span>
          )}
          {completedItems.length > 0 && (
            <span className="summary-badge summary-success">
              {completedItems.length} completed
            </span>
          )}
          {failedItems.length > 0 && (
            <span className="summary-badge summary-error">
              {failedItems.length} failed
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      {pendingItems.length > 0 && (
        <div className="execution-flow-actions">
          {onApproveAll && pendingItems.length > 1 && (
            <button
              onClick={onApproveAll}
              className="execution-action-btn execution-approve-all-btn"
            >
              Approve All ({pendingItems.length})
            </button>
          )}
          {onCancel && (
            <button
              onClick={onCancel}
              className="execution-action-btn execution-cancel-btn"
            >
              Cancel
            </button>
          )}
        </div>
      )}

      {/* Items List */}
      <div className="execution-flow-items">
        {state.items.map((item, index) => {
          const isExpanded = expandedItems.has(item.id);
          const needsApproval = item.status === 'pending' || item.status === 'ready';
          const isExecuting = item.status === 'executing' || item.status === 'signing' || item.status === 'broadcasting';
          const isCompleted = item.status === 'completed' || item.status === 'finalized';
          const isFailed = item.status === 'failed';

          return (
            <div
              key={item.id}
              className={`execution-item ${item.status} ${isExpanded ? 'expanded' : ''}`}
            >
              {/* Item Header */}
              <div
                className="execution-item-header"
                onClick={() => toggleExpand(item.id)}
              >
                <div className="execution-item-main">
                  <div className="execution-item-number">{index + 1}</div>
                  {getStatusIcon(item.status)}
                  <div className="execution-item-content">
                    <div className="execution-item-description">{item.description}</div>
                    <div className="execution-item-meta">
                      <span className="execution-item-type">{item.executionType}</span>
                      <span
                        className="execution-item-status"
                        style={{ color: getStatusColor(item.status) }}
                      >
                        {getStatusLabel(item.status)}
                      </span>
                    </div>
                  </div>
                </div>
                <ChevronRight
                  className={`execution-item-chevron ${isExpanded ? 'expanded' : ''}`}
                />
              </div>

              {/* Item Details (Expanded) */}
              {isExpanded && (
                <div className="execution-item-details">
                  {/* Description */}
                  <div className="execution-detail-section">
                    <div className="execution-detail-label">Description</div>
                    <div className="execution-detail-value">{item.description}</div>
                  </div>

                  {/* Estimated Fee */}
                  {item.estimatedFee && (
                    <div className="execution-detail-section">
                      <div className="execution-detail-label">Estimated Fee</div>
                      <div className="execution-detail-value">{item.estimatedFee}</div>
                    </div>
                  )}

                  {/* Warnings */}
                  {item.warnings && item.warnings.length > 0 && (
                    <div className="execution-detail-section">
                      <div className="execution-detail-label">
                        <AlertTriangle className="warning-icon" />
                        Warnings
                      </div>
                      <ul className="execution-warnings-list">
                        {item.warnings.map((warning, idx) => (
                          <li key={idx}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Error */}
                  {isFailed && item.error && (
                    <div className="execution-detail-section">
                      <div className="execution-detail-label">Error</div>
                      <div className="execution-detail-value execution-error">{item.error}</div>
                    </div>
                  )}

                  {/* Result */}
                  {isCompleted && item.result && (
                    <div className="execution-detail-section">
                      <div className="execution-detail-label">Result</div>
                      <div className="execution-detail-value">
                        {item.result.txHash && (
                          <div>Transaction Hash: {item.result.txHash}</div>
                        )}
                        {item.result.blockHash && (
                          <div>Block Hash: {item.result.blockHash}</div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  {needsApproval && (
                    <div className="execution-item-actions">
                      {onApprove && (
                        <button
                          onClick={() => onApprove(item.id)}
                          className="execution-approve-btn"
                        >
                          Approve
                        </button>
                      )}
                      {onReject && (
                        <button
                          onClick={() => onReject(item.id)}
                          className="execution-reject-btn"
                        >
                          Reject
                        </button>
                      )}
                    </div>
                  )}

                  {/* Executing indicator */}
                  {isExecuting && (
                    <div className="execution-item-executing">
                      <Loader2 className="animate-spin" />
                      <span>Processing...</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="execution-flow-footer">
        <div className="execution-flow-progress">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{
                width: `${(state.completedItems / state.totalItems) * 100}%`
              }}
            />
          </div>
          <div className="progress-text">
            {state.completedItems} / {state.totalItems} completed
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExecutionFlow;

