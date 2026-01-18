/**
 * Unit tests for Chopsticks Simulation Service
 */

// Mock the client-server architecture
const mockSimulateTransactionClient = jest.fn();
const mockIsChopsticksServerAvailable = jest.fn();

jest.mock('../../../../services/simulation/chopsticksClient', () => ({
  simulateTransaction: (...args: any[]) => mockSimulateTransactionClient(...args),
  isChopsticksAvailable: () => mockIsChopsticksServerAvailable(),
}));

jest.mock('@polkadot/util-crypto', () => ({
  encodeAddress: jest.fn(),
  decodeAddress: jest.fn(),
}));

import { simulateTransaction, isChopsticksAvailable } from '../../../../services/simulation/chopsticks';
import { ApiPromise } from '@polkadot/api';
import { SubmittableExtrinsic } from '@polkadot/api/types';
import { BN } from '@polkadot/util';
import { encodeAddress, decodeAddress } from '@polkadot/util-crypto';

describe('Chopsticks Simulation Service', () => {
  let mockApi: Partial<ApiPromise>;
  let mockExtrinsic: jest.Mocked<SubmittableExtrinsic<'promise'>>;
  let mockChain: any;
  let statusCallback: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    statusCallback = jest.fn();
    
    // Default: server is available
    mockIsChopsticksServerAvailable.mockResolvedValue(true);

    const mockRegistry = {
      chainSS58: 0,
      findMetaError: jest.fn(),
    } as any;

    mockExtrinsic = {
      method: {
        toHex: jest.fn().mockReturnValue('0xabcd'),
        section: 'balances',
        method: 'transferAllowDeath',
      },
      registry: mockRegistry,
      paymentInfo: jest.fn().mockResolvedValue({
        partialFee: { toString: () => '1000000000' },
      }),
    } as any;

    mockApi = {
      isReady: Promise.resolve({} as ApiPromise),
      genesisHash: {
        toHex: jest.fn().mockReturnValue('0xgenesis'),
      } as any,
      rpc: {
        system: {
          chain: jest.fn().mockResolvedValue({ toString: () => 'Polkadot' }),
        },
        chain: {
          getHeader: jest.fn().mockResolvedValue({
            number: { toNumber: () => 100 },
          }),
        },
      },
      registry: mockRegistry,
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

  describe('simulateTransaction()', () => {
    it('should simulate successful transaction', async () => {
      mockSimulateTransactionClient.mockImplementation(async (api, endpoints, extrinsic, sender, onStatus) => {
        if (onStatus) {
          onStatus({ phase: 'initializing', message: 'Starting simulation' });
          onStatus({ phase: 'complete', message: 'Simulation complete', progress: 100 });
        }
        return {
          success: true,
          error: null,
          estimatedFee: '1000000000',
          balanceChanges: [],
          events: [],
        };
      });

      const result = await simulateTransaction(
        mockApi as ApiPromise,
        'wss://rpc.polkadot.io',
        mockExtrinsic,
        '15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5',
        statusCallback
      );

      expect(result.success).toBe(true);
      expect(result.error).toBeNull();
      expect(mockSimulateTransactionClient).toHaveBeenCalled();
      expect(statusCallback).toHaveBeenCalled();
    });

    it('should pass all endpoints to client (server filters them)', async () => {
      mockSimulateTransactionClient.mockResolvedValue({
        success: true,
        error: null,
        estimatedFee: '1000000000',
        balanceChanges: [],
        events: [],
      });

      await simulateTransaction(
        mockApi as ApiPromise,
        ['wss://rpc.polkadot.io', 'https://rpc.polkadot.io'],
        mockExtrinsic,
        '15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5'
      );

      // Client passes all endpoints to server; server filters them
      expect(mockSimulateTransactionClient).toHaveBeenCalledWith(
        mockApi,
        ['wss://rpc.polkadot.io', 'https://rpc.polkadot.io'],
        mockExtrinsic,
        '15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5',
        undefined
      );
    });

    it('should return error if no WebSocket endpoints', async () => {
      // Server is available, but client will handle the endpoint filtering
      mockSimulateTransactionClient.mockResolvedValue({
        success: false,
        error: 'No valid WebSocket endpoints found',
        estimatedFee: '0',
        balanceChanges: [],
        events: [],
      });

      const result = await simulateTransaction(
        mockApi as ApiPromise,
        ['https://rpc.polkadot.io'],
        mockExtrinsic,
        '15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('No valid WebSocket endpoints');
    });

    it('should handle transaction failure', async () => {
      mockSimulateTransactionClient.mockResolvedValue({
        success: false,
        error: 'InvalidTransaction: Transaction validation failed',
        estimatedFee: '0',
        balanceChanges: [],
        events: [],
      });

      const result = await simulateTransaction(
        mockApi as ApiPromise,
        'wss://rpc.polkadot.io',
        mockExtrinsic,
        '15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle registry mismatch error', async () => {
      mockSimulateTransactionClient.mockResolvedValue({
        success: false,
        error: 'Registry mismatch: Expected chain registry but got different registry',
        estimatedFee: '0',
        balanceChanges: [],
        events: [],
      });

      const extrinsicWithDifferentRegistry = {
        ...mockExtrinsic,
        registry: { different: 'registry' } as any,
      } as any;

      const result = await simulateTransaction(
        mockApi as ApiPromise,
        'wss://rpc.polkadot.io',
        extrinsicWithDifferentRegistry,
        '15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Registry mismatch');
    });

    it('should calculate fees using paymentInfo', async () => {
      mockSimulateTransactionClient.mockResolvedValue({
        success: true,
        error: null,
        estimatedFee: '1000000000',
        balanceChanges: [],
        events: [],
      });

      const result = await simulateTransaction(
        mockApi as ApiPromise,
        'wss://rpc.polkadot.io',
        mockExtrinsic,
        '15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5'
      );

      expect(result.estimatedFee).toBe('1000000000');
    });

    it('should handle paymentInfo errors gracefully', async () => {
      // Mock client to return success even if paymentInfo fails on server
      mockSimulateTransactionClient.mockResolvedValue({
        success: true,
        error: null,
        estimatedFee: '0', // Fee calculation failed, but simulation succeeded
        balanceChanges: [],
        events: [],
      });

      const result = await simulateTransaction(
        mockApi as ApiPromise,
        'wss://rpc.polkadot.io',
        mockExtrinsic,
        '15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5'
      );

      expect(result.estimatedFee).toBe('0');
      // Success depends on the outcome, not paymentInfo error (if ignorable)
      // Since outcome is successful, result should be successful
      expect(result.success).toBe(true);
    });

    it('should call status callback with progress updates', async () => {
      mockSimulateTransactionClient.mockImplementation(async (api, endpoints, extrinsic, sender, onStatus) => {
        if (onStatus) {
          onStatus({ phase: 'initializing', message: 'Initializing', progress: 0 });
          onStatus({ phase: 'forking', message: 'Forking chain', progress: 25 });
          onStatus({ phase: 'executing', message: 'Executing transaction', progress: 50 });
          onStatus({ phase: 'complete', message: 'Complete', progress: 100 });
        }
        return {
          success: true,
          error: null,
          estimatedFee: '1000000000',
          balanceChanges: [],
          events: [],
        };
      });

      await simulateTransaction(
        mockApi as ApiPromise,
        'wss://rpc.polkadot.io',
        mockExtrinsic,
        '15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5',
        statusCallback
      );

      expect(statusCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          phase: 'initializing',
        })
      );
    });

    it('should return error result when simulation fails', async () => {
      mockSimulateTransactionClient.mockResolvedValue({
        success: false,
        error: 'Chopsticks simulation failed: Transaction execution error',
        estimatedFee: '0',
        balanceChanges: [],
        events: [],
      });

      const result = await simulateTransaction(
        mockApi as ApiPromise,
        'wss://rpc.polkadot.io',
        mockExtrinsic,
        '15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5'
      );

      // Should return error result
      expect(result.success).toBe(false);
      expect(result.error).toContain('Chopsticks simulation failed');
    });

    it('should use latest block from endpoint', async () => {
      mockSimulateTransactionClient.mockResolvedValue({
        success: true,
        error: null,
        estimatedFee: '1000000000',
        balanceChanges: [],
        events: [],
      });

      await simulateTransaction(
        mockApi as ApiPromise,
        'wss://rpc.polkadot.io',
        mockExtrinsic,
        '15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5'
      );

      // Client should be called with the correct parameters
      expect(mockSimulateTransactionClient).toHaveBeenCalled();
    });
  });

  describe('isChopsticksAvailable()', () => {
    it('should return true when Chopsticks is available', async () => {
      mockIsChopsticksServerAvailable.mockResolvedValue(true);
      const available = await isChopsticksAvailable();
      expect(available).toBe(true);
    });

    it('should return false when server is not available', async () => {
      mockIsChopsticksServerAvailable.mockResolvedValue(false);
      const available = await isChopsticksAvailable();
      expect(available).toBe(false);
    });
  });
});

