/**
 * Execution Flow Handlers
 * 
 * Simple handlers for stateful mode (frontend simulation)
 */

import { ExecutionMessage, DotBot } from '@dotbot/core';

/**
 * Handle accept and start execution
 * Simple: just call DotBot.startExecution (stateful mode)
 */
export async function handleAcceptAndStart(
  executionMessage: ExecutionMessage | undefined,
  dotbot: DotBot | undefined,
  onAcceptAndStart?: () => void
): Promise<void> {
  if (executionMessage && dotbot) {
    try {
      await dotbot.startExecution(executionMessage.executionId, { autoApprove: false });
    } catch (error) {
      console.error('[ExecutionFlow] Execution failed:', error);
    }
  } else if (onAcceptAndStart) {
    onAcceptAndStart();
  }
}
