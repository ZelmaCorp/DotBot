/**
 * Report Tab Component
 * 
 * Displays scenario execution report with typing animation and auto-scroll
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Trash2, Square, Copy, Check } from 'lucide-react';
import { ReportMessage, type ReportMessageData } from './ReportMessage';

interface ExecutionPhase {
  phase: 'beginning' | 'cycle' | 'final-report' | null;
  messages: string[];
  stepCount: number;
  dotbotActivity?: string;
}

interface ReportTabProps {
  messages: ReportMessageData[];
  isRunning?: boolean;
  statusMessage?: string;
  executionPhase?: ExecutionPhase | null;
  onClear?: () => void;
  onEndScenario?: () => void;
}

export const ReportTab: React.FC<ReportTabProps> = ({
  messages,
  isRunning = false,
  statusMessage,
  executionPhase,
  onClear,
  onEndScenario,
}) => {
  const [copied, setCopied] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);
  const prevMessagesLengthRef = useRef(0);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > prevMessagesLengthRef.current && reportRef.current) {
      // Use requestAnimationFrame for smooth scrolling
      requestAnimationFrame(() => {
        if (reportRef.current) {
          reportRef.current.scrollTop = reportRef.current.scrollHeight;
        }
      });
    }
    prevMessagesLengthRef.current = messages.length;
  }, [messages.length]);

  // Memoize the full report text for copy functionality
  const fullReportText = useMemo(() => {
    return messages.map(m => m.content).join('');
  }, [messages]);

  const handleClear = useCallback(() => {
    if (onClear) {
      onClear();
    }
  }, [onClear]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(fullReportText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy report:', err);
    }
  }, [fullReportText]);

  const handleEndScenario = useCallback(() => {
    if (onEndScenario) {
      onEndScenario();
    }
  }, [onEndScenario]);

  // Render status message component
  const statusMessageComponent = useMemo(() => {
    if (!isRunning) return null;

    if (executionPhase) {
      if (executionPhase.phase === 'beginning') {
        return <span className="scenario-status-message">Setting up...</span>;
      }
      if (executionPhase.phase === 'cycle') {
        if (executionPhase.dotbotActivity) {
          const preview = executionPhase.dotbotActivity.substring(0, 50);
          const truncated = executionPhase.dotbotActivity.length > 50 ? '...' : '';
          return (
            <span className="scenario-status-message">
              DotBot: {preview}{truncated}
            </span>
          );
        }
        return (
          <span className="scenario-status-message">
            Executing step {executionPhase.stepCount}...
          </span>
        );
      }
      if (executionPhase.phase === 'final-report') {
        return <span className="scenario-status-message">Generating final report...</span>;
      }
    }

    if (statusMessage) {
      return <span className="scenario-status-message">{statusMessage}</span>;
    }

    return <span className="scenario-loading-dots">...</span>;
  }, [isRunning, executionPhase, statusMessage]);

  const hasMessages = messages.length > 0;
  
  // Debug: Log when messages count changes (only on length change to avoid render loops)
  useEffect(() => {
    if (prevMessagesLengthRef.current !== messages.length) {
      console.log('[ReportTab] Messages count changed:', prevMessagesLengthRef.current, '->', messages.length);
      if (messages.length > 0) {
        console.log('[ReportTab] First message:', messages[0].id, messages[0].content.substring(0, 50));
        console.log('[ReportTab] Last message:', messages[messages.length - 1].id, messages[messages.length - 1].content.substring(0, 50));
      }
    }
  }, [messages.length]); // Only depend on length, not the array itself

  return (
    <div className="scenario-panel">
      <div className="scenario-panel-header">
        <span>{'>'} EXECUTION REPORT</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          {isRunning && onEndScenario && (
            <button
              onClick={handleEndScenario}
              className="scenario-end-button"
              title="End scenario early and jump to evaluation"
              style={{
                background: 'rgba(255, 165, 0, 0.2)',
                border: '1px solid rgba(255, 165, 0, 0.5)',
                color: '#ffa500',
                padding: '4px 8px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '11px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Square size={12} />
              End Scenario
            </button>
          )}
          {hasMessages && (
            <button
              onClick={handleCopy}
              className="scenario-copy-button"
              title={copied ? "Copied!" : "Copy report to clipboard"}
              style={{
                background: copied ? 'rgba(34, 197, 94, 0.2)' : 'transparent',
                border: copied ? '1px solid rgba(34, 197, 94, 0.5)' : '1px solid transparent',
                color: copied ? '#22c55e' : 'inherit',
                padding: '4px 8px',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'all 0.2s',
              }}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
          )}
          {onClear && hasMessages && (
            <button
              onClick={handleClear}
              className="scenario-clear-button"
              title="Clear console"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
      <div className="scenario-report" ref={reportRef}>
        <div className="scenario-report-content">
          {!hasMessages ? (
            <div className="scenario-report-empty">
              <pre className="scenario-report-text">
                {'> Run a scenario to see results.'}
              </pre>
            </div>
          ) : (
            <>
              {/* Debug: Show message count */}
              {process.env.NODE_ENV === 'development' && (
                <div style={{ color: '#ff0', fontSize: '10px', padding: '4px' }}>
                  DEBUG: {messages.length} messages
                </div>
              )}
              {messages.map((message) => (
                <ReportMessage key={message.id} message={message} />
              ))}
              {statusMessageComponent}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
