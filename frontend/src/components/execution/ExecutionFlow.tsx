/**
 * Execution Flow Component
 * 
 * Visual representation of the ExecutionArray.
 * Shows all steps that will happen and provides a single "Accept and Start" button.
 */

import React, { useState } from 'react';
import { CheckCircle2, XCircle, Clock, Loader2, AlertTriangle, ChevronRight, Play, X } from 'lucide-react';
import { ExecutionItem, ExecutionArrayState } from '../../lib/executionEngine/types';
import '../../styles/execution-flow.css';

export interface ExecutionFlowProps {
  state: ExecutionArrayState | null;
  onAcceptAndStart?: () => void;
    onCancel?: () => void;
    show?: boolean;
}

const ExecutionFlow: React.FC<ExecutionFlowProps> = ({
  state,
  onAcceptAndStart,
  onCancel,
  show = true
}) => {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  if (!show || !state || state.items.length === 0) {
    return null;
  }

  // Check if any items are being simulated (pending status)
  const isSimulating = state.items.some(item => item.status === 'pending');
  const simulatingCount = state.items.filter(item => item.status === 'pending').length;
  
  // Check if flow is waiting for user approval (all items are pending/ready)
  const isWaitingForApproval = state.items.every(item => 
    item.status === 'pending' || item.status === 'ready'
  );
  
  // Check if flow is executing
  const isExecuting = state.isExecuting || state.items.some(item => 
    item.status === 'executing' || item.status === 'signing' || item.status === 'broadcasting'
  );
  
  // Check if flow is complete
  const isComplete = !isExecuting && state.items.every(item => 
    item.status === 'completed' || item.status === 'finalized' || item.status === 'failed' || item.status === 'cancelled'
  );

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
        return <Loader2 className="status-icon status-pending animate-spin" />;
      default:
        return <Clock className="status-icon status-pending" />;
    }
  };

  const getStatusLabel = (status: ExecutionItem['status']) => {
    switch (status) {
      case 'pending': return 'Simulating...';
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

  return (
    <div className="execution-flow-container">
      {/* Header */}
      <div className="execution-flow-header">
        <div className="execution-flow-title">
          <h3>{isWaitingForApproval ? 'Review Transaction Flow' : 'Execution Flow'}</h3>
          <span className="execution-flow-count">
            {state.totalItems} step{state.totalItems !== 1 ? 's' : ''}
          </span>
        </div>
        
        {!isWaitingForApproval && (
        <div className="execution-flow-summary">
            {state.completedItems > 0 && (
              <span className="summary-badge summary-success">
                {state.completedItems} completed
            </span>
          )}
            {isExecuting && (
            <span className="summary-badge summary-executing">
                <Loader2 className="animate-spin inline mr-1" size={12} />
                executing
            </span>
          )}
            {state.failedItems > 0 && (
            <span className="summary-badge summary-error">
                {state.failedItems} failed
            </span>
          )}
        </div>
        )}
      </div>

      {/* Simulation in Progress Banner */}
      {isSimulating && (
        <div className="simulation-banner">
          <Loader2 className="animate-spin" size={16} />
          <span>
            Simulating {simulatingCount} transaction{simulatingCount !== 1 ? 's' : ''} to verify {simulatingCount !== 1 ? 'they' : 'it'} will succeed...
          </span>
        </div>
      )}

      {/* Approval message */}
      {isWaitingForApproval && !isSimulating && (
        <div className="execution-flow-intro">
          <p>Review the steps below. Once you accept, your wallet will ask you to sign each transaction.</p>
        </div>
      )}

      {/* Items List */}
      <div className="execution-flow-items">
        {state.items.map((item, index) => {
          const isExpanded = expandedItems.has(item.id);
          const isItemExecuting = item.status === 'executing' || item.status === 'signing' || item.status === 'broadcasting';
          const isItemCompleted = item.status === 'completed' || item.status === 'finalized';
          const isItemFailed = item.status === 'failed';

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
                      {item.estimatedFee && (
                        <span className="execution-item-fee">Fee: {item.estimatedFee}</span>
                      )}
                      <span
                        className="execution-item-status"
                        style={{ color: getStatusColor(item.status) }}
                      >
                        {getStatusLabel(item.status)}
                      </span>
                    </div>
                  </div>
                </div>
                {(item.warnings?.length || item.metadata) && (
                <ChevronRight
                  className={`execution-item-chevron ${isExpanded ? 'expanded' : ''}`}
                />
                )}
              </div>

              {/* Item Details (Expanded) */}
              {isExpanded && (
                <div className="execution-item-details">
                  {/* Warnings */}
                  {item.warnings && item.warnings.length > 0 && (
                    <div className="execution-detail-section">
                      <div className="execution-detail-label">
                        <AlertTriangle className="warning-icon" size={14} />
                        Information
                      </div>
                      <ul className="execution-warnings-list">
                        {item.warnings.map((warning, idx) => (
                          <li key={idx}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Metadata */}
                  {item.metadata && Object.keys(item.metadata).length > 0 && (
                    <div className="execution-detail-section">
                      <div className="execution-detail-label">Details</div>
                      <div className="execution-metadata">
                        {Object.entries(item.metadata).map(([key, value]) => {
                          // Skip internal fields and API instance
                          if (['amount', 'formattedAmount', 'transferCount', 'apiInstance'].includes(key)) {
                            return null;
                          }
                          // Skip complex objects that might have circular references
                          if (value && typeof value === 'object' && value.constructor && value.constructor.name !== 'Object' && value.constructor.name !== 'Array') {
                            return null;
                          }
                          
                          // Safe stringify
                          let displayValue: string;
                          try {
                            displayValue = typeof value === 'string' ? value : JSON.stringify(value);
                          } catch (e) {
                            displayValue = '[Complex Object]';
                          }
                          
                          return (
                            <div key={key} className="metadata-row">
                              <span className="metadata-key">{key}:</span>
                              <span className="metadata-value">{displayValue}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Error */}
                  {isItemFailed && item.error && (
                    <div className="execution-detail-section execution-detail-error">
                      <div className="execution-detail-label">Error</div>
                      <div className="execution-detail-value">{item.error}</div>
                    </div>
                  )}

                  {/* Result */}
                  {isItemCompleted && item.result && (
                    <div className="execution-detail-section execution-detail-success">
                      <div className="execution-detail-label">Result</div>
                      <div className="execution-detail-value">
                        {item.result.txHash && (
                          <div className="result-hash">
                            <span>Tx:</span> {item.result.txHash.slice(0, 10)}...{item.result.txHash.slice(-8)}
                          </div>
                        )}
                        {item.result.blockHash && (
                          <div className="result-hash">
                            <span>Block:</span> {item.result.blockHash.slice(0, 10)}...{item.result.blockHash.slice(-8)}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Executing indicator */}
                  {isItemExecuting && (
                    <div className="execution-item-executing">
                      <Loader2 className="animate-spin" size={16} />
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
        {isWaitingForApproval ? (
          /* Approval Actions */
          <div className="execution-flow-approval-actions">
            {onCancel && (
              <button
                onClick={onCancel}
                className="execution-cancel-btn"
              >
                <X size={16} />
                Cancel
              </button>
            )}
            {onAcceptAndStart && (
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
        ) : (
          /* Progress Bar */
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
              {isComplete && state.failedItems === 0 && ' ✓'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExecutionFlow;

