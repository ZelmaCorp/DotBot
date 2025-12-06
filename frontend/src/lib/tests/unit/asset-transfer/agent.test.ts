/**
 * Unit tests for AssetTransferAgent
 */

import { AssetTransferAgent } from '../../../agents/asset-transfer/agent';
import { AgentError } from '../../../agents/types';
import { ApiPromise } from '@polkadot/api';
import { BN } from '@polkadot/util';
import {
  TEST_ADDRESSES,
  INVALID_ADDRESSES,
  TEST_AMOUNTS,
  TEST_AMOUNTS_HUMAN,
  createMockApi,
  createMockExtrinsic,
  createMockBalanceData,
  createMockInsufficientBalance,
} from './fixtures.test-helpers';

describe('AssetTransferAgent', () => {
  let agent: AssetTransferAgent;
  let mockApi: Partial<ApiPromise>;

  beforeEach(() => {
    agent = new AssetTransferAgent();
    mockApi = createMockApi();
    agent.initialize(mockApi as ApiPromise);
  });

  describe('transfer()', () => {
    describe('Happy Paths', () => {
      it('should create a standard DOT transfer extrinsic', async () => {
        const result = await agent.transfer({
          address: TEST_ADDRESSES.ALICE,
          recipient: TEST_ADDRESSES.BOB,
          amount: TEST_AMOUNTS.ONE_DOT,
        });

        expect(result.extrinsic).toBeDefined();
        expect(result.resultType).toBe('extrinsic');
        expect(result.requiresConfirmation).toBe(true);
        expect(result.executionType).toBe('extrinsic');
        expect(result.description).toContain('Transfer');
        expect(result.description).toContain('DOT');
        expect(result.metadata?.amount).toBe(TEST_AMOUNTS.ONE_DOT);
        expect(result.metadata?.sender).toBe(TEST_ADDRESSES.ALICE);
        expect(result.metadata?.recipient).toBe(TEST_ADDRESSES.BOB);
        expect(result.metadata?.keepAlive).toBe(false);
        expect(mockApi.tx?.balances?.transfer).toHaveBeenCalledWith(
          TEST_ADDRESSES.BOB,
          TEST_AMOUNTS.ONE_DOT
        );
      });

      it('should create a transferKeepAlive extrinsic when keepAlive is true', async () => {
        const result = await agent.transfer({
          address: TEST_ADDRESSES.ALICE,
          recipient: TEST_ADDRESSES.BOB,
          amount: TEST_AMOUNTS.ONE_DOT,
          keepAlive: true,
        });

        expect(result.extrinsic).toBeDefined();
        expect(result.metadata?.keepAlive).toBe(true);
        expect(result.warnings).toContain('transferKeepAlive');
        expect(mockApi.tx?.balances?.transferKeepAlive).toHaveBeenCalledWith(
          TEST_ADDRESSES.BOB,
          TEST_AMOUNTS.ONE_DOT
        );
      });

      it('should parse human-readable amounts correctly', async () => {
        const result = await agent.transfer({
          address: TEST_ADDRESSES.ALICE,
          recipient: TEST_ADDRESSES.BOB,
          amount: TEST_AMOUNTS_HUMAN.ONE_DOT,
        });

        // 1.0 DOT = 10000000000 Planck
        expect(result.metadata?.amount).toBe(TEST_AMOUNTS.ONE_DOT);
        expect(result.metadata?.formattedAmount).toBe('1.0');
      });

      it('should include estimated fee in result', async () => {
        const result = await agent.transfer({
          address: TEST_ADDRESSES.ALICE,
          recipient: TEST_ADDRESSES.BOB,
          amount: TEST_AMOUNTS.ONE_DOT,
        });

        expect(result.estimatedFee).toBeDefined();
        expect(result.estimatedFee).toBeTruthy();
      });
    });

    describe('Validation Failures', () => {
      it('should throw AgentError for invalid sender address', async () => {
        await expect(
          agent.transfer({
            address: INVALID_ADDRESSES.EMPTY,
            recipient: TEST_ADDRESSES.BOB,
            amount: TEST_AMOUNTS.ONE_DOT,
          })
        ).rejects.toThrow(AgentError);

        await expect(
          agent.transfer({
            address: INVALID_ADDRESSES.EMPTY,
            recipient: TEST_ADDRESSES.BOB,
            amount: TEST_AMOUNTS.ONE_DOT,
          })
        ).rejects.toThrow('INVALID_SENDER_ADDRESS');
      });

      it('should throw AgentError for invalid recipient address', async () => {
        await expect(
          agent.transfer({
            address: TEST_ADDRESSES.ALICE,
            recipient: INVALID_ADDRESSES.EMPTY,
            amount: TEST_AMOUNTS.ONE_DOT,
          })
        ).rejects.toThrow(AgentError);

        await expect(
          agent.transfer({
            address: TEST_ADDRESSES.ALICE,
            recipient: INVALID_ADDRESSES.EMPTY,
            amount: TEST_AMOUNTS.ONE_DOT,
          })
        ).rejects.toThrow('INVALID_RECIPIENT_ADDRESS');
      });

      it('should throw AgentError when sender and recipient are the same', async () => {
        await expect(
          agent.transfer({
            address: TEST_ADDRESSES.ALICE,
            recipient: TEST_ADDRESSES.ALICE,
            amount: TEST_AMOUNTS.ONE_DOT,
          })
        ).rejects.toThrow(AgentError);

        await expect(
          agent.transfer({
            address: TEST_ADDRESSES.ALICE,
            recipient: TEST_ADDRESSES.ALICE,
            amount: TEST_AMOUNTS.ONE_DOT,
          })
        ).rejects.toThrow('SAME_SENDER_RECIPIENT');
      });

      it('should throw AgentError for zero amount', async () => {
        await expect(
          agent.transfer({
            address: TEST_ADDRESSES.ALICE,
            recipient: TEST_ADDRESSES.BOB,
            amount: TEST_AMOUNTS.ZERO,
          })
        ).rejects.toThrow(AgentError);

        await expect(
          agent.transfer({
            address: TEST_ADDRESSES.ALICE,
            recipient: TEST_ADDRESSES.BOB,
            amount: TEST_AMOUNTS.ZERO,
          })
        ).rejects.toThrow('INVALID_AMOUNT');
      });

      it('should throw AgentError for negative amount', async () => {
        await expect(
          agent.transfer({
            address: TEST_ADDRESSES.ALICE,
            recipient: TEST_ADDRESSES.BOB,
            amount: TEST_AMOUNTS.NEGATIVE,
          })
        ).rejects.toThrow(AgentError);

        await expect(
          agent.transfer({
            address: TEST_ADDRESSES.ALICE,
            recipient: TEST_ADDRESSES.BOB,
            amount: TEST_AMOUNTS.NEGATIVE,
          })
        ).rejects.toThrow('INVALID_AMOUNT');
      });

      it('should throw AgentError for insufficient balance', async () => {
        // Mock insufficient balance
        const mockAccountQuery = mockApi.query?.system?.account as jest.MockedFunction<any>;
        mockAccountQuery.mockResolvedValue(createMockInsufficientBalance());

        await expect(
          agent.transfer({
            address: TEST_ADDRESSES.ALICE,
            recipient: TEST_ADDRESSES.BOB,
            amount: TEST_AMOUNTS.ONE_DOT, // 1 DOT, but only 0.1 DOT available
          })
        ).rejects.toThrow(AgentError);

        await expect(
          agent.transfer({
            address: TEST_ADDRESSES.ALICE,
            recipient: TEST_ADDRESSES.BOB,
            amount: TEST_AMOUNTS.ONE_DOT,
          })
        ).rejects.toThrow('INSUFFICIENT_BALANCE');
      });

      it('should skip balance validation when validateBalance is false', async () => {
        // Mock insufficient balance
        const mockAccountQuery = mockApi.query?.system?.account as jest.MockedFunction<any>;
        mockAccountQuery.mockResolvedValue(createMockInsufficientBalance());

        // Should not throw when validateBalance is false
        const result = await agent.transfer({
          address: TEST_ADDRESSES.ALICE,
          recipient: TEST_ADDRESSES.BOB,
          amount: TEST_AMOUNTS.ONE_DOT,
          validateBalance: false,
        });

        expect(result.extrinsic).toBeDefined();
      });
    });

    describe('Error Handling', () => {
      it('should throw AgentError if agent is not initialized', async () => {
        const uninitializedAgent = new AssetTransferAgent();

        await expect(
          uninitializedAgent.transfer({
            address: TEST_ADDRESSES.ALICE,
            recipient: TEST_ADDRESSES.BOB,
            amount: TEST_AMOUNTS.ONE_DOT,
          })
        ).rejects.toThrow(AgentError);

        await expect(
          uninitializedAgent.transfer({
            address: TEST_ADDRESSES.ALICE,
            recipient: TEST_ADDRESSES.BOB,
            amount: TEST_AMOUNTS.ONE_DOT,
          })
        ).rejects.toThrow('NOT_INITIALIZED');
      });

      it('should handle API query errors gracefully', async () => {
        // Mock API query to throw error
        const mockAccountQuery = mockApi.query?.system?.account as jest.MockedFunction<any>;
        mockAccountQuery.mockRejectedValue(new Error('RPC connection failed'));

        await expect(
          agent.transfer({
            address: TEST_ADDRESSES.ALICE,
            recipient: TEST_ADDRESSES.BOB,
            amount: TEST_AMOUNTS.ONE_DOT,
          })
        ).rejects.toThrow(AgentError);

        await expect(
          agent.transfer({
            address: TEST_ADDRESSES.ALICE,
            recipient: TEST_ADDRESSES.BOB,
            amount: TEST_AMOUNTS.ONE_DOT,
          })
        ).rejects.toThrow('TRANSFER_ERROR');
      });
    });
  });

  describe('batchTransfer()', () => {
    describe('Happy Path', () => {
      it('should create a batch transfer extrinsic with multiple recipients', async () => {
        const result = await agent.batchTransfer({
          address: TEST_ADDRESSES.ALICE,
          transfers: [
            { recipient: TEST_ADDRESSES.BOB, amount: TEST_AMOUNTS.ONE_DOT },
            { recipient: TEST_ADDRESSES.CHARLIE, amount: TEST_AMOUNTS.HALF_DOT },
          ],
        });

        expect(result.extrinsic).toBeDefined();
        expect(result.resultType).toBe('extrinsic');
        expect(result.metadata?.transferCount).toBe(2);
        expect(result.metadata?.transfers).toHaveLength(2);
        expect(result.warnings).toContain('Batch transfer');
        expect(mockApi.tx?.utility?.batch).toHaveBeenCalled();
      });

      it('should calculate total amount correctly', async () => {
        const result = await agent.batchTransfer({
          address: TEST_ADDRESSES.ALICE,
          transfers: [
            { recipient: TEST_ADDRESSES.BOB, amount: TEST_AMOUNTS.ONE_DOT },
            { recipient: TEST_ADDRESSES.CHARLIE, amount: TEST_AMOUNTS.HALF_DOT },
          ],
        });

        // 1 DOT + 0.5 DOT = 1.5 DOT = 15000000000 Planck
        const expectedTotal = new BN(TEST_AMOUNTS.ONE_DOT)
          .add(new BN(TEST_AMOUNTS.HALF_DOT))
          .toString();
        expect(result.metadata?.totalAmount).toBe(expectedTotal);
      });
    });

    describe('Validation Failures', () => {
      it('should throw AgentError for empty transfers array', async () => {
        await expect(
          agent.batchTransfer({
            address: TEST_ADDRESSES.ALICE,
            transfers: [],
          })
        ).rejects.toThrow(AgentError);

        await expect(
          agent.batchTransfer({
            address: TEST_ADDRESSES.ALICE,
            transfers: [],
          })
        ).rejects.toThrow('NO_TRANSFERS');
      });

      it('should throw AgentError for more than 100 transfers', async () => {
        const tooManyTransfers = Array.from({ length: 101 }, (_, i) => ({
          recipient: TEST_ADDRESSES.BOB,
          amount: TEST_AMOUNTS.ONE_PLANCK,
        }));

        await expect(
          agent.batchTransfer({
            address: TEST_ADDRESSES.ALICE,
            transfers: tooManyTransfers,
          })
        ).rejects.toThrow(AgentError);

        await expect(
          agent.batchTransfer({
            address: TEST_ADDRESSES.ALICE,
            transfers: tooManyTransfers,
          })
        ).rejects.toThrow('TOO_MANY_TRANSFERS');
      });

      it('should throw AgentError for invalid recipient in batch with index', async () => {
        await expect(
          agent.batchTransfer({
            address: TEST_ADDRESSES.ALICE,
            transfers: [
              { recipient: TEST_ADDRESSES.BOB, amount: TEST_AMOUNTS.ONE_DOT },
              { recipient: INVALID_ADDRESSES.EMPTY, amount: TEST_AMOUNTS.ONE_DOT },
            ],
          })
        ).rejects.toThrow(AgentError);

        await expect(
          agent.batchTransfer({
            address: TEST_ADDRESSES.ALICE,
            transfers: [
              { recipient: TEST_ADDRESSES.BOB, amount: TEST_AMOUNTS.ONE_DOT },
              { recipient: INVALID_ADDRESSES.EMPTY, amount: TEST_AMOUNTS.ONE_DOT },
            ],
          })
        ).rejects.toThrow('INVALID_RECIPIENT_ADDRESS');
      });

      it('should throw AgentError when sender equals recipient in batch', async () => {
        await expect(
          agent.batchTransfer({
            address: TEST_ADDRESSES.ALICE,
            transfers: [
              { recipient: TEST_ADDRESSES.BOB, amount: TEST_AMOUNTS.ONE_DOT },
              { recipient: TEST_ADDRESSES.ALICE, amount: TEST_AMOUNTS.ONE_DOT },
            ],
          })
        ).rejects.toThrow(AgentError);

        await expect(
          agent.batchTransfer({
            address: TEST_ADDRESSES.ALICE,
            transfers: [
              { recipient: TEST_ADDRESSES.BOB, amount: TEST_AMOUNTS.ONE_DOT },
              { recipient: TEST_ADDRESSES.ALICE, amount: TEST_AMOUNTS.ONE_DOT },
            ],
          })
        ).rejects.toThrow('SAME_SENDER_RECIPIENT');
      });

      it('should throw AgentError for zero amount in batch', async () => {
        await expect(
          agent.batchTransfer({
            address: TEST_ADDRESSES.ALICE,
            transfers: [
              { recipient: TEST_ADDRESSES.BOB, amount: TEST_AMOUNTS.ZERO },
            ],
          })
        ).rejects.toThrow(AgentError);

        await expect(
          agent.batchTransfer({
            address: TEST_ADDRESSES.ALICE,
            transfers: [
              { recipient: TEST_ADDRESSES.BOB, amount: TEST_AMOUNTS.ZERO },
            ],
          })
        ).rejects.toThrow('INVALID_AMOUNT');
      });

      it('should throw AgentError for insufficient balance for total batch amount', async () => {
        // Mock insufficient balance
        const mockAccountQuery = mockApi.query?.system?.account as jest.MockedFunction<any>;
        mockAccountQuery.mockResolvedValue(createMockInsufficientBalance());

        await expect(
          agent.batchTransfer({
            address: TEST_ADDRESSES.ALICE,
            transfers: [
              { recipient: TEST_ADDRESSES.BOB, amount: TEST_AMOUNTS.ONE_DOT },
              { recipient: TEST_ADDRESSES.CHARLIE, amount: TEST_AMOUNTS.ONE_DOT },
            ],
          })
        ).rejects.toThrow(AgentError);

        await expect(
          agent.batchTransfer({
            address: TEST_ADDRESSES.ALICE,
            transfers: [
              { recipient: TEST_ADDRESSES.BOB, amount: TEST_AMOUNTS.ONE_DOT },
              { recipient: TEST_ADDRESSES.CHARLIE, amount: TEST_AMOUNTS.ONE_DOT },
            ],
          })
        ).rejects.toThrow('INSUFFICIENT_BALANCE');
      });
    });

    describe('Error Handling', () => {
      it('should throw AgentError if agent is not initialized', async () => {
        const uninitializedAgent = new AssetTransferAgent();

        await expect(
          uninitializedAgent.batchTransfer({
            address: TEST_ADDRESSES.ALICE,
            transfers: [
              { recipient: TEST_ADDRESSES.BOB, amount: TEST_AMOUNTS.ONE_DOT },
            ],
          })
        ).rejects.toThrow(AgentError);

        await expect(
          uninitializedAgent.batchTransfer({
            address: TEST_ADDRESSES.ALICE,
            transfers: [
              { recipient: TEST_ADDRESSES.BOB, amount: TEST_AMOUNTS.ONE_DOT },
            ],
          })
        ).rejects.toThrow('NOT_INITIALIZED');
      });

      it('should handle batch extrinsic creation failure', async () => {
        // Mock batch creation to throw error
        const mockBatch = mockApi.tx?.utility?.batch as jest.MockedFunction<any>;
        mockBatch.mockImplementation(() => {
          throw new Error('Batch creation failed');
        });

        await expect(
          agent.batchTransfer({
            address: TEST_ADDRESSES.ALICE,
            transfers: [
              { recipient: TEST_ADDRESSES.BOB, amount: TEST_AMOUNTS.ONE_DOT },
            ],
          })
        ).rejects.toThrow(AgentError);

        await expect(
          agent.batchTransfer({
            address: TEST_ADDRESSES.ALICE,
            transfers: [
              { recipient: TEST_ADDRESSES.BOB, amount: TEST_AMOUNTS.ONE_DOT },
            ],
          })
        ).rejects.toThrow('BATCH_TRANSFER_ERROR');
      });
    });
  });
});
