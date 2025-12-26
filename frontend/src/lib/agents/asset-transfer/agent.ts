/**
 * Asset Transfer Agent
 * 
 * Creates extrinsics for transferring assets (DOT, tokens) across chains.
 * Handles standard transfers, keep-alive transfers, and batch transfers.
 */

import { BaseAgent } from '../base-agent';
import { AgentResult, AgentError } from '../types';
import { TransferParams, BatchTransferParams } from './types';
import { createTransferExtrinsic } from './extrinsics/transfer';
import { createTransferKeepAliveExtrinsic } from './extrinsics/transfer-keep-alive';
import { createBatchTransferExtrinsic } from './extrinsics/batch-transfer';
import { BN } from '@polkadot/util';

/**
 * Agent for handling asset transfers
 * 
 * @example
 * const agent = new AssetTransferAgent();
 * agent.initialize(api);
 * const result = await agent.transfer({
 *   address: '1A2B3C4D5E6F7G8H9I0J1K2L3M4N5O6P7Q8R9S0T1U2V3W4X5Y6Z7A8B9C0D1',
 *   recipient: '1Z9B8C7D6E5F4G3H2I1J0K9L8M7N6O5P4Q3R2S1T0U9V8W7X6Y5Z4A3B2C1',
 *   amount: '1.5', // 1.5 DOT (will be converted to Planck)
 * });
 */
export class AssetTransferAgent extends BaseAgent {
  getAgentName(): string {
    return 'AssetTransferAgent';
  }

  /**
   * Transfer DOT or tokens
   * 
   * @param params Transfer parameters
   * @returns AgentResult with transfer extrinsic
   */
  async transfer(params: TransferParams): Promise<AgentResult> {
    this.ensureInitialized();
    const api = this.getApi();

    console.log('💸 AssetTransferAgent.transfer() called with params:', {
      sender: params.address,
      recipient: params.recipient,
      amount: params.amount
    });

    try {
      this.validateTransferAddresses(params.address, params.recipient);
      const amountBN = this.parseAndValidateAmount(params.amount);
      await this.validateTransferBalance(params.address, amountBN, params.validateBalance);

      const keepAlive = params.keepAlive === true;
      const extrinsic = this.createTransferExtrinsic(api, params.recipient, amountBN, keepAlive);
      const estimatedFee = await this.estimateFee(extrinsic, params.address);
      const warnings = await this.collectTransferWarnings(api, params.recipient, keepAlive);

      const description = `Transfer ${this.formatAmount(amountBN)} DOT from ${params.address.slice(0, 8)}...${params.address.slice(-8)} to ${params.recipient.slice(0, 8)}...${params.recipient.slice(-8)}`;

      return this.createResult(
        description,
        extrinsic,
        {
          estimatedFee,
          warnings: warnings.length > 0 ? warnings : undefined,
          metadata: {
            amount: amountBN.toString(),
            formattedAmount: this.formatAmount(amountBN),
            recipient: params.recipient,
            sender: params.address,
            keepAlive,
          },
          resultType: 'extrinsic',
          requiresConfirmation: true,
          executionType: 'extrinsic',
        }
      );
    } catch (error) {
      return this.handleTransferError(error, 'Transfer');
    }
  }

  /**
   * Batch transfer - transfer to multiple recipients in a single transaction
   */
  async batchTransfer(params: BatchTransferParams): Promise<AgentResult> {
    this.ensureInitialized();
    const api = this.getApi();

    try {
      this.validateSenderAddress(params.address);
      this.validateTransfersArray(params.transfers);

      const { validatedTransfers, totalAmount } = this.validateAndParseTransfers(
        params.address,
        params.transfers
      );

      await this.validateTransferBalance(params.address, totalAmount, params.validateBalance);

      const extrinsic = createBatchTransferExtrinsic(api, {
        transfers: validatedTransfers.map(t => ({
          recipient: t.recipient,
          amount: t.amount,
        })),
      });

      const estimatedFee = await this.estimateFee(extrinsic, params.address);
      const warnings = this.collectBatchWarnings(params.transfers.length);
      const description = `Batch transfer: ${params.transfers.length} transfers totaling ${this.formatAmount(totalAmount)} DOT from ${params.address.slice(0, 8)}...${params.address.slice(-8)}`;

      return this.createResult(
        description,
        extrinsic,
        {
          estimatedFee,
          warnings: warnings.length > 0 ? warnings : undefined,
          metadata: {
            transferCount: params.transfers.length,
            totalAmount: totalAmount.toString(),
            formattedTotalAmount: this.formatAmount(totalAmount),
            sender: params.address,
            transfers: validatedTransfers.map(t => ({
              recipient: t.recipient,
              amount: t.amount,
              formattedAmount: this.formatAmount(new BN(t.amount)),
            })),
          },
          resultType: 'extrinsic',
          requiresConfirmation: true,
          executionType: 'extrinsic',
        }
      );
    } catch (error) {
      return this.handleTransferError(error, 'Batch transfer');
    }
  }

  // Helper methods

  private validateTransferAddresses(sender: string, recipient: string): void {
    const senderValidation = this.validateAddress(sender);
    if (!senderValidation.valid) {
      throw new AgentError(
        `Invalid sender address: ${senderValidation.errors.join(', ')}`,
        'INVALID_SENDER_ADDRESS',
        { errors: senderValidation.errors }
      );
    }

    const recipientValidation = this.validateAddress(recipient);
    if (!recipientValidation.valid) {
      throw new AgentError(
        `Invalid recipient address: ${recipientValidation.errors.join(', ')}`,
        'INVALID_RECIPIENT_ADDRESS',
        { errors: recipientValidation.errors }
      );
    }

    if (sender === recipient) {
      throw new AgentError(
        'Sender and recipient addresses cannot be the same',
        'SAME_SENDER_RECIPIENT'
      );
    }
  }

  private validateSenderAddress(address: string): void {
    const validation = this.validateAddress(address);
    if (!validation.valid) {
      throw new AgentError(
        `Invalid sender address: ${validation.errors.join(', ')}`,
        'INVALID_SENDER_ADDRESS',
        { errors: validation.errors }
      );
    }
  }

  private validateTransfersArray(transfers?: Array<{ recipient: string; amount: string | number }>): void {
    if (!transfers || transfers.length === 0) {
      throw new AgentError('At least one transfer is required', 'NO_TRANSFERS');
    }
    if (transfers.length > 100) {
      throw new AgentError('Batch transfer cannot exceed 100 transfers', 'TOO_MANY_TRANSFERS');
    }
  }

  private validateAndParseTransfers(
    senderAddress: string,
    transfers: Array<{ recipient: string; amount: string | number }>
  ): { validatedTransfers: Array<{ recipient: string; amount: string }>; totalAmount: BN } {
    const totalAmount = new BN(0);
    const validatedTransfers = transfers.map((transfer, index) => {
      const recipientValidation = this.validateAddress(transfer.recipient);
      if (!recipientValidation.valid) {
        throw new AgentError(
          `Invalid recipient address at index ${index}: ${recipientValidation.errors.join(', ')}`,
          'INVALID_RECIPIENT_ADDRESS',
          { index, errors: recipientValidation.errors }
        );
      }

      if (senderAddress === transfer.recipient) {
        throw new AgentError(
          `Transfer ${index + 1}: Sender and recipient addresses cannot be the same`,
          'SAME_SENDER_RECIPIENT',
          { index }
        );
      }

      const amountBN = this.parseAndValidateAmount(transfer.amount, index);
      totalAmount.iadd(amountBN);

      return {
        recipient: transfer.recipient,
        amount: amountBN.toString(),
      };
    });

    return { validatedTransfers, totalAmount };
  }

  private parseAndValidateAmount(amount: string | number, index?: number): BN {
    const amountBN = typeof amount === 'string' && amount.includes('.')
      ? this.parseAmount(amount)
      : new BN(amount);

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

  private async validateTransferBalance(
    address: string,
    amount: BN,
    validateBalance?: boolean
  ): Promise<void> {
    if (validateBalance === false) return;

    const balanceCheck = await this.hasSufficientBalance(address, amount, true);
    if (!balanceCheck.sufficient) {
      throw new AgentError(
        `Insufficient balance. Available: ${this.formatAmount(balanceCheck.available)} DOT, Required: ${this.formatAmount(balanceCheck.required)} DOT`,
        'INSUFFICIENT_BALANCE',
        {
          available: balanceCheck.available,
          required: balanceCheck.required,
          shortfall: balanceCheck.shortfall,
        }
      );
    }
  }

  private createTransferExtrinsic(
    api: any,
    recipient: string,
    amount: BN,
    keepAlive: boolean
  ): any {
    const extrinsicParams = {
      recipient,
      amount: amount.toString(),
    };
    return keepAlive
      ? createTransferKeepAliveExtrinsic(api, extrinsicParams)
      : createTransferExtrinsic(api, extrinsicParams);
  }

  private async collectTransferWarnings(
    api: any,
    recipient: string,
    keepAlive: boolean
  ): Promise<string[]> {
    const warnings: string[] = [];

    if (keepAlive) {
      warnings.push('Using transferKeepAlive - this ensures the sender account remains alive after transfer');
    }

    try {
      const recipientInfo = await api.query.system.account(recipient);
      const recipientData = recipientInfo as any;
      const recipientBalance = recipientData.data?.free?.toString() || '0';
      if (recipientBalance === '0') {
        warnings.push('Recipient account appears to be new or empty');
      }
    } catch {
      // Ignore errors when checking recipient
    }

    return warnings;
  }

  private collectBatchWarnings(transferCount: number): string[] {
    const warnings: string[] = [
      `Batch transfer with ${transferCount} recipients`
    ];
    if (transferCount > 10) {
      warnings.push('Large batch transfer - ensure all recipients are correct');
    }
    return warnings;
  }

  private handleTransferError(error: unknown, operation: string): never {
    if (error instanceof AgentError) {
      throw error;
    }
    throw new AgentError(
      `${operation} failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      `${operation.toUpperCase().replace(' ', '_')}_ERROR`,
      { originalError: error instanceof Error ? error.message : String(error) }
    );
  }
}
