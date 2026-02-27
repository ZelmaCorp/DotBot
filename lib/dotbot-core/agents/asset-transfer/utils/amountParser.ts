/**
 * Amount Parsing Utilities
 *
 * All amounts from user/LLM/scenarios are in human token units (DOT, KSM, etc.).
 * They are converted to Planck using chain decimals; raw Planck is never accepted unless explicitly opted in elsewhere.
 */

import { BN } from '@polkadot/util';
import { TransferCapabilities } from './transferCapabilities';
import { AgentError } from '../../types';

/**
 * Convert an integer amount (string or number) from human token units to Planck.
 * User/LLM always use token units (DOT, KSM, etc.); they never pass raw Planck unless explicitly specified.
 * So "1" always means 1 DOT, not 1 Planck.
 */
export function integerAmountToPlanck(value: string | number, decimals: number): BN {
  const whole = typeof value === 'number' ? new BN(value) : new BN(value);
  const multiplier = new BN(10).pow(new BN(decimals));
  return whole.mul(multiplier);
}

/**
 * Parse and validate amount with chain-specific decimals
 * 
 * CRITICAL: This method MUST use the chain's actual decimals, not hardcoded 10!
 * Integer strings (e.g. "1", "5") are treated as human token units, not Planck, so "1" = 1 DOT.
 */
export function parseAndValidateAmountWithCapabilities(
  amount: string | number,
  capabilities: TransferCapabilities,
  index?: number
): BN {
  const amountStr = typeof amount === 'number' ? amount.toString() : amount;
  const amountBN = amountStr.includes('.')
    ? parseAmount(amountStr, capabilities.nativeDecimals)
    : integerAmountToPlanck(amountStr, capabilities.nativeDecimals);

  if (amountBN.lte(new BN(0))) {
    const prefix = index !== undefined ? `Transfer ${index + 1}: ` : '';
    throw new AgentError(
      `${prefix}Transfer amount must be greater than zero`,
      'INVALID_AMOUNT',
      index !== undefined ? { index } : undefined
    );
  }

  return amountBN;
}

/**
 * Parse amount from human-readable format (with decimal point) to Planck.
 * For integer strings/numbers use integerAmountToPlanck.
 */
export function parseAmount(amount: string | number, decimals = 10): BN {
  const amountStr = typeof amount === 'number' ? amount.toString() : amount;
  const [whole, fraction = ''] = amountStr.split('.');
  const fractionPadded = fraction.padEnd(decimals, '0').slice(0, decimals);
  const wholeBN = new BN(whole || '0');
  const fractionBN = new BN(fractionPadded || '0');
  const divisor = new BN(10).pow(new BN(decimals));
  return wholeBN.mul(divisor).add(fractionBN);
}

/**
 * Format amount for display (convert from Planck to human-readable)
 * 
 * CRITICAL: Always pass decimals from capabilities.nativeDecimals!
 * Different networks have different decimals:
 * - Polkadot: 10 decimals (DOT)
 * - Kusama: 12 decimals (KSM)
 * - Westend: 12 decimals (WND)
 * 
 * @param amountBN Amount in Planck (smallest unit)
 * @param decimals Number of decimals (should come from capabilities.nativeDecimals)
 */
export function formatAmount(amountBN: BN, decimals?: number): string {
  if (decimals === undefined) {
    // WARNING: Defaulting to 10 is incorrect for Kusama/Westend!
    // This should only happen in tests or when decimals are truly unknown
    console.warn('[formatAmount] No decimals provided, defaulting to 10. This may be incorrect for Kusama/Westend!');
    decimals = 10;
  }
  const divisor = new BN(10).pow(new BN(decimals));
  const whole = amountBN.div(divisor).toString();
  const fraction = amountBN.mod(divisor).toString().padStart(decimals, '0');
  
  // Remove trailing zeros for cleaner display
  const trimmedFraction = fraction.replace(/0+$/, '');
  if (trimmedFraction === '') {
    return whole;
  }
  return `${whole}.${trimmedFraction}`;
}

