/**
 * Unit tests for Sequential Transaction Simulation
 */

// Mock the client-server architecture
const mockSimulateSequentialTransactionsClient = jest.fn();
const mockIsChopsticksServerAvailable = jest.fn();

jest.mock('../../../../services/simulation/chopsticksClient', () => ({
  simulateSequentialTransactions: (...args: any[]) => mockSimulateSequentialTransactionsClient(...args),
  isChopsticksAvailable: () => mockIsChopsticksServerAvailable(),
}));

jest.mock('@polkadot/util-crypto', () => ({
  encodeAddress: jest.fn(),
  decodeAddress: jest.fn(),
}));

import { simulateSequentialTransactions } from '../../../../services/simulation/sequentialSimulation';
import { ApiPromise } from '@polkadot/api';
import { SubmittableExtrinsic } from '@polkadot/api/types';
import { BN } from '@polkadot/util';
import { encodeAddress, decodeAddress } from '@polkadot/util-crypto';

describe('Sequential Transaction Simulation', () => {
  let mockApi: Partial<ApiPromise>;
  let mockChain: any;
  let mockExtrinsics: jest.Mocked<SubmittableExtrinsic<'promise'>>[];
  let statusCallback: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    statusCallback = jest.fn();
    
    // Default: server is available
    mockIsChopsticksServerAvailable.mockResolvedValue(true);

    // Create a shared registry object so extrinsic.registry === api.registry
    const sharedRegistry = {
      chainSS58: 0,
      findMetaError: jest.fn(),
    };

    mockExtrinsics = [
      {
        method: {
          toHex: jest.fn().mockReturnValue('0xabcd1'),
        },
        toHex: jest.fn().mockReturnValue('0xfull1'),
        registry: sharedRegistry,
        paymentInfo: jest.fn().mockResolvedValue({
          partialFee: { toString: () => '1000000000' },
        }),
      },
      {
        method: {
          toHex: jest.fn().mockReturnValue('0xabcd2'),
        },
        toHex: jest.fn().mockReturnValue('0xfull2'),
        registry: sharedRegistry,
        paymentInfo: jest.fn().mockResolvedValue({
          partialFee: { toString: () => '2000000000' },
        }),
      },
    ] as any;

    mockApi = {
      isReady: Promise.resolve({} as ApiPromise),
      genesisHash: {
        toHex: jest.fn().mockReturnValue('0xgenesis'),
      } as any,
      registry: sharedRegistry,
      rpc: {
        chain: {
          getFinalizedHead: jest.fn().mockResolvedValue({
            toHex: jest.fn().mockReturnValue('0xfinalized'),
          }),
        },
      },
      query: {
        system: {
          account: Object.assign(
            jest.fn().mockResolvedValue({
              data: {
                free: new BN(0),
                reserved: new BN(0),
              },
            }),
            {
              key: jest.fn().mockReturnValue('0xaccountkey'),
            }
          ),
        },
      },
      createType: jest.fn().mockReturnValue({
        data: {
          free: new BN(0),
          reserved: new BN(0),
        },
      }),
    } as any;

    (decodeAddress as jest.Mock).mockReturnValue(new Uint8Array([1, 2, 3]));
    (encodeAddress as jest.Mock).mockReturnValue('15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5');
  });

  describe('simulateSequentialTransactions()', () => {
    it('should simulate multiple transactions sequentially', async () => {
      mockSimulateSequentialTransactionsClient.mockResolvedValue({
        success: true,
        results: [
          { description: 'Transfer 100 DOT', result: { success: true, estimatedFee: '1000000000' } },
          { description: 'Stake 50 DOT', result: { success: true, estimatedFee: '2000000000' } },
        ],
        totalEstimatedFee: '3000000000',
      });

      const items = [
        {
          extrinsic: mockExtrinsics[0],
          description: 'Transfer 100 DOT',
          senderAddress: '15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5',
        },
        {
          extrinsic: mockExtrinsics[1],
          description: 'Stake 50 DOT',
          senderAddress: '15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5',
        },
      ];

      const result = await simulateSequentialTransactions(
        mockApi as ApiPromise,
        'wss://rpc.polkadot.io',
        items,
        statusCallback
      );

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(2);
      expect(result.results[0].description).toBe('Transfer 100 DOT');
      expect(result.results[1].description).toBe('Stake 50 DOT');
    });

    it('should stop on first failure', async () => {
      mockSimulateSequentialTransactionsClient.mockResolvedValue({
        success: false,
        error: 'Transaction 2 failed: InvalidTransaction',
        results: [
          { description: 'Transfer 100 DOT', result: { success: true, estimatedFee: '1000000000' } },
          { description: 'Stake 50 DOT', result: { success: false, error: 'InvalidTransaction' } },
        ],
        totalEstimatedFee: '1000000000',
      });

      const items = [
        {
          extrinsic: mockExtrinsics[0],
          description: 'Transfer 100 DOT',
          senderAddress: '15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5',
        },
        {
          extrinsic: mockExtrinsics[1],
          description: 'Stake 50 DOT',
          senderAddress: '15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5',
        },
      ];

      const result = await simulateSequentialTransactions(
        mockApi as ApiPromise,
        'wss://rpc.polkadot.io',
        items
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Transaction 2');
      expect(result.results).toHaveLength(2);
      expect(result.results[0].result.success).toBe(true);
      expect(result.results[1].result.success).toBe(false);
    });

    it('should calculate total fee across all transactions', async () => {
      mockSimulateSequentialTransactionsClient.mockResolvedValue({
        success: true,
        results: [
          { description: 'Transfer 100 DOT', result: { success: true, estimatedFee: '1000000000' } },
          { description: 'Stake 50 DOT', result: { success: true, estimatedFee: '2000000000' } },
        ],
        totalEstimatedFee: '3000000000',
      });

      const items = [
        {
          extrinsic: mockExtrinsics[0],
          description: 'Transfer 100 DOT',
          senderAddress: '15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5',
        },
        {
          extrinsic: mockExtrinsics[1],
          description: 'Stake 50 DOT',
          senderAddress: '15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5',
        },
      ];

      const result = await simulateSequentialTransactions(
        mockApi as ApiPromise,
        'wss://rpc.polkadot.io',
        items
      );

      expect(result.totalEstimatedFee).toBe('3000000000'); // 1 + 2 DOT
    });

    it('should pass all endpoints to client (server filters them)', async () => {
      mockSimulateSequentialTransactionsClient.mockResolvedValue({
        success: true,
        results: [
          { description: 'Transfer 100 DOT', result: { success: true, estimatedFee: '1000000000' } },
        ],
        totalEstimatedFee: '1000000000',
      });

      const items = [
        {
          extrinsic: mockExtrinsics[0],
          description: 'Transfer 100 DOT',
          senderAddress: '15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5',
        },
      ];

      await simulateSequentialTransactions(
        mockApi as ApiPromise,
        ['wss://rpc.polkadot.io', 'https://rpc.polkadot.io'],
        items
      );

      // Client passes all endpoints to server; server filters them
      expect(mockSimulateSequentialTransactionsClient).toHaveBeenCalledWith(
        mockApi,
        ['wss://rpc.polkadot.io', 'https://rpc.polkadot.io'],
        items,
        undefined
      );
    });

    it('should return error result if no WebSocket endpoints', async () => {
      mockSimulateSequentialTransactionsClient.mockResolvedValue({
        success: false,
        error: 'No valid WebSocket endpoints found',
        results: [],
        totalEstimatedFee: '0',
      });

      const items = [
        {
          extrinsic: mockExtrinsics[0],
          description: 'Transfer 100 DOT',
          senderAddress: '15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5',
        },
      ];

      const result = await simulateSequentialTransactions(
        mockApi as ApiPromise,
        ['https://rpc.polkadot.io'],
        items
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('No valid WebSocket endpoints');
    });

    it('should call status callback with progress updates', async () => {
      mockSimulateSequentialTransactionsClient.mockImplementation(async (api, endpoints, items, onStatus) => {
        if (onStatus) {
          onStatus({ phase: 'initializing', message: 'Initializing', progress: 0 });
          onStatus({ phase: 'complete', message: 'Complete', progress: 100 });
        }
        return {
          success: true,
          results: [
            { description: 'Transfer 100 DOT', result: { success: true, estimatedFee: '1000000000' } },
          ],
          totalEstimatedFee: '1000000000',
        };
      });

      const items = [
        {
          extrinsic: mockExtrinsics[0],
          description: 'Transfer 100 DOT',
          senderAddress: '15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5',
        },
      ];

      await simulateSequentialTransactions(
        mockApi as ApiPromise,
        'wss://rpc.polkadot.io',
        items,
        statusCallback
      );

      expect(statusCallback).toHaveBeenCalled();
      expect(statusCallback.mock.calls.some(call => 
        call[0]?.phase === 'initializing'
      )).toBe(true);
    });

    it('should handle fee calculation failures gracefully', async () => {
      mockSimulateSequentialTransactionsClient.mockResolvedValue({
        success: true,
        results: [
          { description: 'Transfer 100 DOT', result: { success: true, estimatedFee: '0' } },
        ],
        totalEstimatedFee: '0',
      });

      const items = [
        {
          extrinsic: mockExtrinsics[0],
          description: 'Transfer 100 DOT',
          senderAddress: '15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5',
        },
      ];

      const result = await simulateSequentialTransactions(
        mockApi as ApiPromise,
        'wss://rpc.polkadot.io',
        items
      );

      // Should still succeed even if fee calculation fails
      expect(result.success).toBe(true);
      expect(result.results[0].result.estimatedFee).toBe('0');
    });

    it('should use same fork for all transactions', async () => {
      mockSimulateSequentialTransactionsClient.mockResolvedValue({
        success: true,
        results: [
          { description: 'Transfer 100 DOT', result: { success: true, estimatedFee: '1000000000' } },
          { description: 'Stake 50 DOT', result: { success: true, estimatedFee: '2000000000' } },
        ],
        totalEstimatedFee: '3000000000',
      });

      const items = [
        {
          extrinsic: mockExtrinsics[0],
          description: 'Transfer 100 DOT',
          senderAddress: '15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5',
        },
        {
          extrinsic: mockExtrinsics[1],
          description: 'Stake 50 DOT',
          senderAddress: '15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5',
        },
      ];

      await simulateSequentialTransactions(
        mockApi as ApiPromise,
        'wss://rpc.polkadot.io',
        items
      );

      // Client should be called once with all items
      expect(mockSimulateSequentialTransactionsClient).toHaveBeenCalledTimes(1);
      expect(mockSimulateSequentialTransactionsClient).toHaveBeenCalledWith(
        mockApi,
        'wss://rpc.polkadot.io',
        items,
        undefined
      );
    });
  });
});

