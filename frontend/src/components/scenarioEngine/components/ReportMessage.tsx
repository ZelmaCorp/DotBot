/**
 * Report Message Component
 * 
 * Individual message/event component for the report console
 */

import React, { memo } from 'react';

export interface ReportMessageData {
  id: string;
  content: string;
  timestamp: number;
  type?: 'info' | 'error' | 'warning' | 'success' | 'phase' | 'default';
}

interface ReportMessageProps {
  message: ReportMessageData;
}

export const ReportMessage: React.FC<ReportMessageProps> = memo(({ message }) => {
  // Determine styling based on message type
  const getClassName = () => {
    switch (message.type) {
      case 'error':
        return 'scenario-message-error';
      case 'warning':
        return 'scenario-message-warning';
      case 'success':
        return 'scenario-message-success';
      case 'phase':
        return 'scenario-message-phase';
      case 'info':
        return 'scenario-message-info';
      default:
        return 'scenario-message-default';
    }
  };

  return (
    <div className={`scenario-message ${getClassName()}`} data-message-id={message.id}>
      <pre className="scenario-message-content">{message.content}</pre>
    </div>
  );
});

ReportMessage.displayName = 'ReportMessage';
