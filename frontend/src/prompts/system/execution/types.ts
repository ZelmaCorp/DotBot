/**
 * Execution Array Types
 * 
 * Types for the Execution Array system that allows sequential
 * operations to be planned and executed in order.
 */

export type ExecutionStatus = 
  | 'pending'      // Not yet executed
  | 'ready'        // Ready to execute
  | 'executing'    // Currently executing
  | 'completed'    // Successfully completed
  | 'failed'       // Execution failed
  | 'cancelled';   // User cancelled

export type ExecutionType = 
  | 'extrinsic'    // A blockchain extrinsic
  | 'data_fetch'   // Fetching data (no execution needed)
  | 'validation'   // Validate something before proceeding
  | 'user_input';  // Request user input/confirmation

export interface ExecutionStep {
  /** Unique identifier for this step */
  id: string;
  
  /** Step number in the execution array */
  stepNumber: number;
  
  /** Agent class name that will execute this step */
  agentClassName: string;
  
  /** Function name to call */
  functionName: string;
  
  /** Parameters for the function call */
  parameters: Record<string, any>;
  
  /** Type of execution */
  executionType: ExecutionType;
  
  /** Current status */
  status: ExecutionStatus;
  
  /** Result after execution (if completed) */
  result?: any;
  
  /** Error message (if failed) */
  error?: string;
  
  /** Whether this step depends on previous steps */
  dependsOn?: string[]; // IDs of steps this depends on
  
  /** Human-readable description of what this step does */
  description: string;
  
  /** Whether user confirmation is required before execution */
  requiresConfirmation: boolean;
  
  /** Timestamp when step was created */
  createdAt: number;
  
  /** Timestamp when step was executed */
  executedAt?: number;
  
  /** Error recovery guidance */
  onFailure?: {
    /** Whether to retry this step on failure */
    retry?: boolean;
    
    /** Maximum number of retry attempts */
    maxRetries?: number;
    
    /** Alternative step to execute if this one fails */
    fallbackStep?: string; // ID of alternative step
    
    /** User-friendly error message to display */
    errorMessage?: string;
  };
}

export interface ExecutionArray {
  /** Unique identifier for this execution array */
  id: string;
  
  /** User's original request that generated this execution array */
  originalRequest: string;
  
  /** All steps in the execution sequence */
  steps: ExecutionStep[];
  
  /** Current execution status */
  status: ExecutionStatus;
  
  /** Current step being executed */
  currentStepIndex?: number;
  
  /** Whether the entire array requires user approval */
  requiresApproval: boolean;
  
  /** Timestamp when array was created */
  createdAt: number;
  
  /** Timestamp when array was completed */
  completedAt?: number;
  
  /** Overall result/outcome */
  result?: any;
  
  /** Any errors encountered */
  errors?: string[];
}

export interface ExecutionContext {
  /** User's wallet address (if connected) */
  walletAddress?: string;
  
  /** Current network */
  network: 'polkadot' | 'kusama' | string;
  
  /** User's account balance */
  balance?: {
    free: string;
    reserved: string;
    frozen: string;
  };
  
  /** Additional context data */
  metadata?: Record<string, any>;
}

