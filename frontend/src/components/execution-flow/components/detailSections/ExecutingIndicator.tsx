/**
 * Executing Indicator
 *
 * Displays processing indicator for an executing item with step-specific labels:
 * - Broadcasting... (tx submitted to mempool)
 * - Confirming... (tx in block, waiting for finality)
 * - Processing... (signing or other)
 */

import React from 'react';
import { Loader2 } from 'lucide-react';
import type { ExecutionItem } from '@dotbot/core/executionEngine/types';

export interface ExecutingIndicatorProps {
  isItemExecuting: boolean;
  /** When provided, shows step-specific message (e.g. "Broadcasting...", "Confirming..."). */
  status?: ExecutionItem['status'];
}

function getExecutingMessage(status?: ExecutionItem['status']): string {
  switch (status) {
    case 'broadcasting':
      return 'Broadcasting...';
    case 'in_block':
      return 'Confirming...';
    case 'signing':
      return 'Signing...';
    case 'executing':
    default:
      return 'Processing...';
  }
}

export const ExecutingIndicator: React.FC<ExecutingIndicatorProps> = ({
  isItemExecuting,
  status,
}) => {
  if (!isItemExecuting) {
    return null;
  }

  return (
    <div className="execution-item-executing">
      <Loader2 className="animate-spin" size={16} />
      <span>{getExecutingMessage(status)}</span>
    </div>
  );
};
