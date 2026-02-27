/**
 * Amount Normalization Utilities
 * 
 * Provides amount conversion functions for different input formats.
 * Integer amounts (e.g. "1", 5) are interpreted as human token units (1 DOT, 5 DOT), not Planck.
 */

import { BN } from '@polkadot/util';
import { TransferCapabilities } from './transferCapabilities';
import { integerAmountToPlanck } from './amountParser';

/**
 * Normalize amount to BN (Planck), handling different input formats.
 *
 * All string/number inputs are treated as human token units (DOT, KSM, etc.);
 * they are converted to Planck using chain decimals. BN inputs are passed through.
 *
 * @param amount Amount in various formats (human string/number or BN already in Planck)
 * @param capabilities Chain capabilities for decimal conversion
 * @returns Amount as BN in smallest unit (Planck)
 */
export function normalizeAmountToBN(
  amount: string | number | BN,
  capabilities: TransferCapabilities
): BN {
  if (BN.isBN(amount)) {
    return amount;
  }

  if (typeof amount === 'number') {
    if (!Number.isInteger(amount) || amount < 0) {
      throw new Error(`Invalid amount: ${amount}. Must be a positive integer.`);
    }
    return integerAmountToPlanck(amount, capabilities.nativeDecimals);
  }

  if (typeof amount === 'string') {
    if (amount.includes('.')) {
      const [whole, decimal] = amount.split('.');
      const decimalPlaces = decimal.length;

      if (decimalPlaces > capabilities.nativeDecimals) {
        throw new Error(
          `Too many decimal places in amount: ${amount}. ` +
          `Maximum for ${capabilities.nativeTokenSymbol}: ${capabilities.nativeDecimals}`
        );
      }

      const multiplier = new BN(10).pow(new BN(capabilities.nativeDecimals));
      const wholeBN = new BN(whole || '0').mul(multiplier);
      const decimalBN = new BN(decimal).mul(
        new BN(10).pow(new BN(capabilities.nativeDecimals - decimalPlaces))
      );

      return wholeBN.add(decimalBN);
    }

    if (!/^\d+$/.test(amount)) {
      throw new Error(`Invalid amount format: ${amount}. Must be integer or decimal string.`);
    }

    return integerAmountToPlanck(amount, capabilities.nativeDecimals);
  }

  throw new Error(`Unsupported amount type: ${typeof amount}`);
}

