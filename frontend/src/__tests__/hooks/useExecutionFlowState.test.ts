/**
 * useExecutionFlowState Hook Tests
 * 
 * Tests state management and subscription setup
 */

import { renderHook, waitFor } from '@testing-library/react';
import { useExecutionFlowState } from '../../components/execution-flow/hooks/useExecutionFlowState';
import { createMockDotBot, createMockExecutionMessage, createMockExecutionArrayState } from '../../test-utils/mocks';
import { setupExecutionSubscription } from '../../components/execution-flow/executionFlowUtils';

// Mock dependencies
jest.mock('../../components/execution-flow/executionFlowUtils');
jest.mock('../../contexts/WebSocketContext', () => ({
  useWebSocket: jest.fn(),
}));

const mockSetupExecutionSubscription = setupExecutionSubscription as jest.MockedFunction<typeof setupExecutionSubscription>;
const mockUseWebSocket = require('../../contexts/WebSocketContext').useWebSocket;

describe('useExecutionFlowState', () => {
  let mockDotBot: ReturnType<typeof createMockDotBot>;
  let mockUnsubscribe: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockDotBot = createMockDotBot();
    mockUnsubscribe = jest.fn();
    mockSetupExecutionSubscription.mockReturnValue(mockUnsubscribe);
    
    // Default WebSocket mock (not connected)
    mockUseWebSocket.mockReturnValue({
      isConnected: false,
      subscribeToExecution: jest.fn(),
    });
  });

  describe('subscription setup', () => {
    it('should call setupExecutionSubscription on mount', () => {
      const executionMessage = createMockExecutionMessage();

      renderHook(() =>
        useExecutionFlowState(executionMessage, mockDotBot, undefined, 'test-session')
      );

      expect(mockSetupExecutionSubscription).toHaveBeenCalledWith(
        executionMessage,
        mockDotBot,
        expect.any(Function), // setLiveExecutionState
        'test-session',
        undefined // wsSubscribe (not connected)
      );
    });

    it('should return correct initial state from executionMessage', () => {
      const executionMessage = createMockExecutionMessage();
      const executionState = createMockExecutionArrayState();
      executionMessage.executionArray = executionState;

      const { result } = renderHook(() =>
        useExecutionFlowState(executionMessage, mockDotBot, undefined, undefined)
      );

      // Should return state from executionMessage
      expect(result.current).toBe(executionState);
    });

    it('should return legacy state when provided', () => {
      const legacyState = createMockExecutionArrayState();

      const { result } = renderHook(() =>
        useExecutionFlowState(undefined, mockDotBot, legacyState, undefined)
      );

      expect(result.current).toBe(legacyState);
    });

    it('should cleanup subscription on unmount', () => {
      const executionMessage = createMockExecutionMessage();

      const { unmount } = renderHook(() =>
        useExecutionFlowState(executionMessage, mockDotBot, undefined, undefined)
      );

      unmount();

      expect(mockUnsubscribe).toHaveBeenCalled();
    });

    it('should re-subscribe when executionId changes', () => {
      const executionMessage1 = createMockExecutionMessage({
        executionId: 'exec-1',
      });
      const state1 = createMockExecutionArrayState({ id: 'exec-1' });
      executionMessage1.executionArray = state1;

      const { result, rerender } = renderHook(
        ({ executionMessage }) =>
          useExecutionFlowState(executionMessage, mockDotBot, undefined, undefined),
        {
          initialProps: { executionMessage: executionMessage1 },
        }
      );

      // Initial state should be from executionMessage1
      expect(result.current).toBe(state1);
      expect(mockSetupExecutionSubscription).toHaveBeenCalledTimes(1);

      const executionMessage2 = createMockExecutionMessage({
        executionId: 'exec-2',
      });
      const state2 = createMockExecutionArrayState({ id: 'exec-2' });
      executionMessage2.executionArray = state2;

      // Reset mock to track new subscription
      mockSetupExecutionSubscription.mockClear();
      mockUnsubscribe.mockClear();

      // rerender automatically handles act() wrapping
      rerender({ executionMessage: executionMessage2 });

      // Should have been called again for new executionId
      expect(mockSetupExecutionSubscription).toHaveBeenCalledTimes(1);
      // Cleanup from first subscription should have been called
      expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
      
      // State should use executionMessage2 state (fallback when live state is null)
      expect(result.current).toBe(state2);
    });

    it('should reset live state when executionId changes', async () => {
      const executionMessage1 = createMockExecutionMessage({
        executionId: 'exec-1',
      });
      const liveState1 = createMockExecutionArrayState({ id: 'exec-1', items: [{ id: 'item-1', status: 'executing' }] as any });

      let setStateCallback: ((state: any) => void) | null = null;
      
      mockSetupExecutionSubscription.mockImplementation((_, __, setState: (state: any) => void) => {
        setStateCallback = setState;
        return mockUnsubscribe;
      });

      const { result, rerender } = renderHook(
        ({ executionMessage }) =>
          useExecutionFlowState(executionMessage, mockDotBot, undefined, undefined),
        {
          initialProps: { executionMessage: executionMessage1 },
        }
      );

      // Set live state for execution-1
      // waitFor automatically handles act() wrapping
      if (setStateCallback) {
        (setStateCallback as (state: any) => void)(liveState1);
      }

      await waitFor(() => {
        expect(result.current).toBe(liveState1);
      });

      // Change to execution-2
      const executionMessage2 = createMockExecutionMessage({
        executionId: 'exec-2',
      });
      const state2 = createMockExecutionArrayState({ id: 'exec-2' });
      executionMessage2.executionArray = state2;

      // Reset callback capture
      setStateCallback = null;
      mockSetupExecutionSubscription.mockClear();
      mockUnsubscribe.mockClear();

      // rerender automatically handles act() wrapping
      rerender({ executionMessage: executionMessage2 });

      // Live state should be reset, so it should fall back to executionMessage2 state
      // (not the old liveState1)
      expect(result.current).toBe(state2);
      expect(result.current).not.toBe(liveState1);
    });
  });

  describe('state updates', () => {
    it('should update state when setLiveExecutionState is called', async () => {
      const executionMessage = createMockExecutionMessage();
      const newState = createMockExecutionArrayState({
        id: 'exec-123',
        items: [{ id: 'item-1', type: 'transfer', status: 'executing' }] as any,
      });

      let setStateCallback: ((state: any) => void) | null = null;
      
      mockSetupExecutionSubscription.mockImplementation((_, __, setState: (state: any) => void) => {
        setStateCallback = setState;
        return mockUnsubscribe;
      });

      const { result } = renderHook(() =>
        useExecutionFlowState(executionMessage, mockDotBot, undefined, undefined)
      );

      // Simulate state update from subscription
      // waitFor automatically handles act() wrapping
      if (setStateCallback) {
        (setStateCallback as (state: any) => void)(newState);
      }

      await waitFor(() => {
        expect(result.current).toBe(newState);
      });
    });

    it('should prioritize liveExecutionState over executionMessage state', async () => {
      const executionMessage = createMockExecutionMessage();
      const messageState = createMockExecutionArrayState({ id: 'from-message' });
      const liveState = createMockExecutionArrayState({ id: 'live-state' });
      
      executionMessage.executionArray = messageState;

      let setStateCallback: ((state: any) => void) | null = null;
      
      mockSetupExecutionSubscription.mockImplementation((_, __, setState: (state: any) => void) => {
        setStateCallback = setState;
        return mockUnsubscribe;
      });

      const { result } = renderHook(() =>
        useExecutionFlowState(executionMessage, mockDotBot, undefined, undefined)
      );

      // Initially should return message state
      expect(result.current).toBe(messageState);

      // Update with live state
      // waitFor automatically handles act() wrapping
      if (setStateCallback) {
        (setStateCallback as (state: any) => void)(liveState);
      }

      await waitFor(() => {
        expect(result.current).toBe(liveState);
      });
    });
  });

  describe('WebSocket integration', () => {
    it('should use WebSocket subscription when connected', () => {
      const executionMessage = createMockExecutionMessage();
      const mockSubscribeToExecution = jest.fn().mockReturnValue(() => {});
      
      mockUseWebSocket.mockReturnValue({
        isConnected: true,
        subscribeToExecution: mockSubscribeToExecution,
      });

      renderHook(() =>
        useExecutionFlowState(executionMessage, mockDotBot, undefined, 'test-session')
      );

      expect(mockSetupExecutionSubscription).toHaveBeenCalledWith(
        executionMessage,
        mockDotBot,
        expect.any(Function),
        'test-session',
        mockSubscribeToExecution
      );
    });

    it('should fall back to polling when WebSocket not connected', () => {
      const executionMessage = createMockExecutionMessage();
      
      mockUseWebSocket.mockReturnValue({
        isConnected: false,
        subscribeToExecution: jest.fn(),
      });

      renderHook(() =>
        useExecutionFlowState(executionMessage, mockDotBot, undefined, 'test-session')
      );

      expect(mockSetupExecutionSubscription).toHaveBeenCalledWith(
        executionMessage,
        mockDotBot,
        expect.any(Function),
        'test-session',
        undefined // No WebSocket subscription
      );
    });

    it('should handle WebSocket context not available gracefully', () => {
      const executionMessage = createMockExecutionMessage();
      
      mockUseWebSocket.mockImplementation(() => {
        throw new Error('useWebSocket must be used within a WebSocketProvider');
      });

      // Should not throw - hook should handle gracefully
      expect(() => {
        renderHook(() =>
          useExecutionFlowState(executionMessage, mockDotBot, undefined, 'test-session')
        );
      }).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should return null when no state sources available', () => {
      const { result } = renderHook(() =>
        useExecutionFlowState(undefined, mockDotBot, null, undefined)
      );

      expect(result.current).toBeNull();
    });

    it('should handle missing executionMessage gracefully', () => {
      const { result } = renderHook(() =>
        useExecutionFlowState(undefined, mockDotBot, undefined, undefined)
      );

      expect(mockSetupExecutionSubscription).not.toHaveBeenCalled();
      expect(result.current).toBeNull();
    });

    it('should handle missing dotbot gracefully', () => {
      const executionMessage = createMockExecutionMessage();

      const { result } = renderHook(() =>
        useExecutionFlowState(executionMessage, undefined, undefined, undefined)
      );

      expect(mockSetupExecutionSubscription).not.toHaveBeenCalled();
      expect(result.current).toBeNull();
    });
  });
});
