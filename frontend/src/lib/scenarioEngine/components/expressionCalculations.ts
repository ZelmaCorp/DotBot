/**
 * Expression Calculation Functions
 * 
 * These functions are used by ScenarioExecutor to evaluate dynamic expressions
 * in scenario steps (e.g., {{calc:insufficientBalance(0.1, 0.01)}}).
 * 
 * All functions query the chain at runtime to get actual balances.
 */

import type { ApiPromise } from '@polkadot/api';

export interface CalculationContext {
  api: ApiPromise;
  getUserAddress: () => Promise<string>;
  emit?: (event: { type: 'log'; level: 'debug' | 'info' | 'warn' | 'error'; message: string }) => void;
}

/**
 * Query account balance from chain and convert to human-readable format
 */
async function queryBalance(
  api: ApiPromise,
  address: string
): Promise<{ planck: string; balance: number; decimals: number }> {
  const accountInfo = await api.query.system.account(address);
  const data = accountInfo.toJSON() as any;
  const freePlanck = data.data?.free || '0';
  
  const decimals = api.registry.chainDecimals?.[0];
  if (decimals === undefined) {
    throw new Error('chainDecimals not found in API registry - cannot safely convert Planck to human-readable format');
  }
  
  const freeBalance = parseInt(freePlanck) / Math.pow(10, decimals);
  
  return { planck: freePlanck, balance: freeBalance, decimals };
}

/**
 * Calculate amount that would cause insufficient balance error after first transfer
 * 
 * Args: [reserveAmount, estimatedFee]
 * - reserveAmount: Amount to reserve for first transfer (default: 0.5) - must match safeTransferAmount
 * - estimatedFee: Estimated fee for each transfer (default: 0.01)
 * 
 * This function:
 * 1. Calculates the first transfer amount using the same logic as safeTransferAmount
 * 2. Calculates remaining balance after first transfer
 * 3. Returns an amount that exceeds remaining balance (will fail after first transfer)
 * 
 * This ensures the first transfer would succeed individually, but the second fails.
 */
export async function calculateInsufficientBalance(
  args: string[],
  context: CalculationContext
): Promise<string> {
  const reserveAmount = parseFloat(args[0] || '0.5');
  const estimatedFee = parseFloat(args[1] || '0.01');
  
  const userAddress = await context.getUserAddress();
  const { balance: freeBalance } = await queryBalance(context.api, userAddress);
  
  // Calculate first transfer amount using same logic as safeTransferAmount
  // This ensures consistency with the first transfer in the prompt
  const firstTransferAmount = Math.max(0.01, freeBalance - reserveAmount - estimatedFee - 0.01);
  
  // Calculate remaining balance after first transfer
  const remainingAfterFirstTx = freeBalance - firstTransferAmount - estimatedFee;
  
  // Calculate insufficient amount: remaining + buffer
  // If remaining <= 0, first transfer would already fail, so use 0.01
  const insufficientAmount = remainingAfterFirstTx > 0 
    ? remainingAfterFirstTx + 0.01  // Normal case: add buffer to remaining
    : 0.01;  // Edge case: first transfer would fail, use small amount
  
  const chainName = context.api.runtimeChain?.toString() || 'unknown';
  context.emit?.({
    type: 'log',
    level: 'info',
    message: `[${chainName}] Balance: ${freeBalance.toFixed(4)}, First: ${firstTransferAmount.toFixed(2)}, After 1st tx: ${remainingAfterFirstTx.toFixed(4)}, Insufficient: ${insufficientAmount.toFixed(2)}`
  });
  
  return insufficientAmount.toFixed(2);
}

/**
 * Get current balance
 * 
 * Returns: Current free balance in token units
 */
export async function getCurrentBalance(
  args: string[],
  context: CalculationContext
): Promise<string> {
  const userAddress = await context.getUserAddress();
  const { balance } = await queryBalance(context.api, userAddress);
  
  context.emit?.({
    type: 'log',
    level: 'debug',
    message: `Current balance: ${balance.toFixed(4)}`
  });
  
  return balance.toFixed(4);
}

/**
 * Calculate: current balance - amount
 * 
 * Args: [amount]
 * Returns: currentBalance - amount
 */
export async function calculateBalanceMinusAmount(
  args: string[],
  context: CalculationContext
): Promise<string> {
  const amount = parseFloat(args[0] || '0');
  const userAddress = await context.getUserAddress();
  const { balance } = await queryBalance(context.api, userAddress);
  
  const result = balance - amount;
  
  context.emit?.({
    type: 'log',
    level: 'debug',
    message: `Balance minus amount: ${balance.toFixed(4)} - ${amount} = ${result.toFixed(4)}`
  });
  
  return result.toFixed(4);
}

/**
 * Calculate: current balance + amount
 * 
 * Args: [amount]
 * Returns: currentBalance + amount
 */
export async function calculateBalancePlusAmount(
  args: string[],
  context: CalculationContext
): Promise<string> {
  const amount = parseFloat(args[0] || '0');
  const userAddress = await context.getUserAddress();
  const { balance } = await queryBalance(context.api, userAddress);
  
  const result = balance + amount;
  
  context.emit?.({
    type: 'log',
    level: 'debug',
    message: `Balance plus amount: ${balance.toFixed(4)} + ${amount} = ${result.toFixed(4)}`
  });
  
  return result.toFixed(4);
}

/**
 * Calculate a safe transfer amount that would succeed individually
 * 
 * Args: [reserveAmount, estimatedFee]
 * - reserveAmount: Amount to reserve for fees and buffer (default: 0.5)
 * - estimatedFee: Estimated fee for the transfer (default: 0.01)
 * 
 * Returns: A safe amount that's less than (balance - reserveAmount - fee)
 * This ensures the transfer would succeed if run individually.
 */
export async function calculateSafeTransferAmount(
  args: string[],
  context: CalculationContext
): Promise<string> {
  const reserveAmount = parseFloat(args[0] || '0.5');
  const estimatedFee = parseFloat(args[1] || '0.01');
  
  const userAddress = await context.getUserAddress();
  const { balance } = await queryBalance(context.api, userAddress);
  
  // Calculate safe amount: balance - reserve - fee - small buffer
  // This ensures the transfer would succeed individually
  const safeAmount = Math.max(0.01, balance - reserveAmount - estimatedFee - 0.01);
  
  context.emit?.({
    type: 'log',
    level: 'info',
    message: `Safe transfer amount: ${balance.toFixed(4)} - ${reserveAmount} - ${estimatedFee} - 0.01 = ${safeAmount.toFixed(2)}`
  });
  
  return safeAmount.toFixed(2);
}

/**
 * Registry of all calculation functions
 */
export const CALCULATION_FUNCTIONS: Record<
  string,
  (args: string[], context: CalculationContext) => Promise<string>
> = {
  insufficientBalance: calculateInsufficientBalance,
  currentBalance: getCurrentBalance,
  balanceMinusAmount: calculateBalanceMinusAmount,
  balancePlusAmount: calculateBalancePlusAmount,
  safeTransferAmount: calculateSafeTransferAmount,
};

