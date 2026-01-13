/**
 * Error Handling Utilities
 * 
 * Centralized error handling for execution engine.
 * Provides consistent error marking and result creation.
 */

import { ExecutionArray } from './executionArray';
import { ExecutionResult } from './types';

/**
 * Mark an execution item as failed with consistent error handling
 * 
 * @param executionArray Execution array containing the item
 * @param itemId ID of the item to mark as failed
 * @param error Error message or Error object
 * @param errorCode Error code for categorization
 * @param rawError Optional raw error data for debugging
 */
export function markItemAsFailed(
  executionArray: ExecutionArray,
  itemId: string,
  error: string | Error,
  errorCode: string,
  rawError?: any
): void {
  const errorMessage = error instanceof Error ? error.message : error;
  executionArray.updateStatus(itemId, 'failed', errorMessage);
  executionArray.updateResult(itemId, {
    success: false,
    error: errorMessage,
    errorCode,
    rawError,
  });
}

/**
 * Create an error result object
 * 
 * @param error Error message or Error object
 * @param errorCode Error code for categorization
 * @param rawError Optional raw error data for debugging
 * @returns ExecutionResult with error information
 */
export function createErrorResult(
  error: string | Error,
  errorCode: string,
  rawError?: any
): ExecutionResult {
  const errorMessage = error instanceof Error ? error.message : error;
  return {
    success: false,
    error: errorMessage,
    errorCode,
    rawError,
  };
}

/**
 * Extract error message from unknown error type
 * 
 * @param error Unknown error (Error, string, or other)
 * @returns String error message
 */
export function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error';
}

/**
 * Mark item as failed and throw error
 * 
 * Useful for error handling that needs to both mark the item and throw
 * 
 * @param executionArray Execution array containing the item
 * @param itemId ID of the item to mark as failed
 * @param error Error message or Error object
 * @param errorCode Error code for categorization
 * @param rawError Optional raw error data for debugging
 * @throws Error with the error message
 */
export function markItemAsFailedAndThrow(
  executionArray: ExecutionArray,
  itemId: string,
  error: string | Error,
  errorCode: string,
  rawError?: any
): never {
  markItemAsFailed(executionArray, itemId, error, errorCode, rawError);
  const errorMessage = error instanceof Error ? error.message : error;
  throw new Error(errorMessage);
}

