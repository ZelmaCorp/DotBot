/**
 * ScenarioEngine Context
 * 
 * Centralized state management for ScenarioEngine UI components.
 * Prevents render loops by batching updates and providing single source of truth.
 */

import React, { createContext, useContext, useReducer, useCallback, useRef, useEffect, startTransition } from 'react';
import type { ReportMessageData } from '../components/ReportMessage';

interface ExecutionPhase {
  phase: 'beginning' | 'cycle' | 'final-report' | null;
  messages: string[];
  stepCount: number;
  dotbotActivity?: string;
}

interface ScenarioEngineState {
  // Report state
  reportMessages: ReportMessageData[];
  
  // Execution state
  executionPhase: ExecutionPhase | null;
  statusMessage: string;
  isRunning: boolean;
  runningScenario: string | null;
  
  // Entity state
  entities: any[];
  
  // UI state
  activeTab: 'entities' | 'scenarios' | 'report';
  executionMode: 'synthetic' | 'emulated' | 'live';
  autoSubmit: boolean;
}

type ScenarioEngineAction =
  | { type: 'ADD_MESSAGE'; message: ReportMessageData }
  | { type: 'ADD_MESSAGES_BATCH'; messages: ReportMessageData[] } // Batch multiple messages at once
  | { type: 'CLEAR_REPORT' }
  | { type: 'SET_EXECUTION_PHASE'; phase: ExecutionPhase | null }
  | { type: 'UPDATE_EXECUTION_PHASE'; updater: (prev: ExecutionPhase) => ExecutionPhase }
  | { type: 'SET_STATUS_MESSAGE'; message: string }
  | { type: 'SET_RUNNING_SCENARIO'; scenario: string | null }
  | { type: 'SET_ENTITIES'; entities: any[] }
  | { type: 'SET_ACTIVE_TAB'; tab: 'entities' | 'scenarios' | 'report' }
  | { type: 'SET_EXECUTION_MODE'; mode: 'synthetic' | 'emulated' | 'live' }
  | { type: 'SET_AUTO_SUBMIT'; autoSubmit: boolean };

const initialState: ScenarioEngineState = {
  reportMessages: [],
  executionPhase: null,
  statusMessage: '',
  isRunning: false,
  runningScenario: null,
  entities: [],
  activeTab: 'entities',
  executionMode: 'live',
  autoSubmit: true,
};

function scenarioEngineReducer(
  state: ScenarioEngineState,
  action: ScenarioEngineAction
): ScenarioEngineState {
  switch (action.type) {
    case 'ADD_MESSAGE':
      // Check for duplicates
      const exists = state.reportMessages.some(m => m.id === action.message.id);
      if (exists) {
        return state;
      }
      return {
        ...state,
        reportMessages: [...state.reportMessages, action.message],
      };
    
    case 'ADD_MESSAGES_BATCH':
      // Add multiple messages at once (more efficient than individual dispatches)
      // Optimized: use Set for O(1) duplicate checking instead of O(n) array search
      if (action.messages.length === 0) {
        return state;
      }
      
      // Create Set of existing IDs for fast lookup
      const existingIds = new Set(state.reportMessages.map(m => m.id));
      
      // Filter out duplicates (O(n) where n is batch size, not total messages)
      const newMessages = action.messages.filter(m => !existingIds.has(m.id));
      
      if (newMessages.length === 0) {
        return state; // No new messages, avoid re-render
      }
      
      // Append new messages (creates new array reference for React)
      return {
        ...state,
        reportMessages: [...state.reportMessages, ...newMessages],
      };
    
    case 'CLEAR_REPORT':
      return {
        ...state,
        reportMessages: [],
      };
    
    case 'SET_EXECUTION_PHASE':
      return {
        ...state,
        executionPhase: action.phase,
      };
    
    case 'UPDATE_EXECUTION_PHASE':
      return {
        ...state,
        executionPhase: action.updater(state.executionPhase || {
          phase: null,
          messages: [],
          stepCount: 0,
        }),
      };
    
    case 'SET_STATUS_MESSAGE':
      return {
        ...state,
        statusMessage: action.message,
      };
    
    case 'SET_RUNNING_SCENARIO':
      // Use startTransition for non-urgent state updates to prevent blocking
      return {
        ...state,
        runningScenario: action.scenario,
        isRunning: action.scenario !== null,
      };
    
    case 'SET_ENTITIES':
      return {
        ...state,
        entities: action.entities,
      };
    
    case 'SET_ACTIVE_TAB':
      return {
        ...state,
        activeTab: action.tab,
      };
    
    case 'SET_EXECUTION_MODE':
      return {
        ...state,
        executionMode: action.mode,
      };
    
    case 'SET_AUTO_SUBMIT':
      return {
        ...state,
        autoSubmit: action.autoSubmit,
      };
    
    default:
      return state;
  }
}

interface ScenarioEngineContextValue {
  state: ScenarioEngineState;
  dispatch: React.Dispatch<ScenarioEngineAction>;
  
  // Convenience actions (batched/optimized)
  addMessage: (message: ReportMessageData) => void;
  clearReport: () => void;
  setExecutionPhase: (phase: ExecutionPhase | null) => void;
  updateExecutionPhase: (updater: (prev: ExecutionPhase) => ExecutionPhase) => void;
  setStatusMessage: (message: string) => void;
  setRunningScenario: (scenario: string | null) => void;
  setEntities: (entities: any[]) => void;
  setActiveTab: (tab: 'entities' | 'scenarios' | 'report') => void;
  setExecutionMode: (mode: 'synthetic' | 'emulated' | 'live') => void;
  setAutoSubmit: (autoSubmit: boolean) => void;
}

const ScenarioEngineContext = createContext<ScenarioEngineContextValue | null>(null);

export function ScenarioEngineProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(scenarioEngineReducer, initialState);
  
  // Batch executionPhase updates using requestAnimationFrame
  const phaseUpdateRafRef = useRef<number | null>(null);
  const pendingPhaseUpdateRef = useRef<((prev: ExecutionPhase) => ExecutionPhase) | null>(null);
  
  // Batch addMessage calls to prevent UI freeze from rapid report updates
  const messageBatchRef = useRef<ReportMessageData[]>([]);
  const messageBatchRafRef = useRef<number | null>(null); // Actually a setTimeout ID, not RAF
  
  const updateExecutionPhase = useCallback((updater: (prev: ExecutionPhase) => ExecutionPhase) => {
    // Cancel any pending RAF
    if (phaseUpdateRafRef.current !== null) {
      cancelAnimationFrame(phaseUpdateRafRef.current);
    }
    
    // Store the updater
    pendingPhaseUpdateRef.current = updater;
    
    // Schedule batched update
    phaseUpdateRafRef.current = requestAnimationFrame(() => {
      if (pendingPhaseUpdateRef.current) {
        dispatch({
          type: 'UPDATE_EXECUTION_PHASE',
          updater: pendingPhaseUpdateRef.current,
        });
        pendingPhaseUpdateRef.current = null;
      }
      phaseUpdateRafRef.current = null;
    });
  }, []);
  
  // Batched addMessage to prevent UI freeze from rapid report-update events
  // Batches multiple messages and defers processing to let UI breathe
  const addMessageBatched = useCallback((message: ReportMessageData) => {
    // Add to batch
    messageBatchRef.current.push(message);
    
    // Cancel any pending timeout
    if (messageBatchRafRef.current !== null) {
      clearTimeout(messageBatchRafRef.current);
    }
    
    // Schedule batched update with a small delay to defer heavy work
    // This allows the UI to remain responsive during rapid-fire events
    // Process in chunks: wait 50ms, then process up to 20 messages at a time
    messageBatchRafRef.current = window.setTimeout(() => {
      const batch = [...messageBatchRef.current];
      messageBatchRef.current = [];
      
      // Process in chunks to prevent huge state updates
      const CHUNK_SIZE = 20;
      const chunks: ReportMessageData[][] = [];
      
      for (let i = 0; i < batch.length; i += CHUNK_SIZE) {
        chunks.push(batch.slice(i, i + CHUNK_SIZE));
      }
      
      // Process first chunk immediately
      if (chunks.length > 0) {
        startTransition(() => {
          dispatch({ type: 'ADD_MESSAGES_BATCH', messages: chunks[0] });
        });
      }
      
      // Process remaining chunks with small delays between them
      for (let i = 1; i < chunks.length; i++) {
        setTimeout(() => {
          startTransition(() => {
            dispatch({ type: 'ADD_MESSAGES_BATCH', messages: chunks[i] });
          });
        }, i * 30); // 30ms delay between chunks
      }
      
      messageBatchRafRef.current = null;
    }, 50); // 50ms delay before processing first batch
  }, []);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (phaseUpdateRafRef.current !== null) {
        cancelAnimationFrame(phaseUpdateRafRef.current);
      }
      if (messageBatchRafRef.current !== null) {
        clearTimeout(messageBatchRafRef.current);
      }
    };
  }, []);
  
  const contextValue: ScenarioEngineContextValue = {
    state,
    dispatch,
    addMessage: addMessageBatched, // Use batched version to prevent UI freeze
    clearReport: useCallback(() => {
      // Use startTransition to prevent blocking when clearing report at scenario start
      startTransition(() => {
        dispatch({ type: 'CLEAR_REPORT' });
      });
    }, []),
    setExecutionPhase: useCallback((phase: ExecutionPhase | null) => {
      // Clear any pending updates for phase changes
      if (phaseUpdateRafRef.current !== null) {
        cancelAnimationFrame(phaseUpdateRafRef.current);
        phaseUpdateRafRef.current = null;
      }
      // Use startTransition to prevent blocking on phase changes
      startTransition(() => {
        dispatch({ type: 'SET_EXECUTION_PHASE', phase });
      });
    }, []),
    updateExecutionPhase,
    setStatusMessage: useCallback((message: string) => {
      // Status messages are non-urgent, use startTransition
      startTransition(() => {
        dispatch({ type: 'SET_STATUS_MESSAGE', message });
      });
    }, []),
    setRunningScenario: useCallback((scenario: string | null) => {
      // Use startTransition to prevent blocking when starting scenario
      startTransition(() => {
        dispatch({ type: 'SET_RUNNING_SCENARIO', scenario });
      });
    }, []),
    setEntities: useCallback((entities: any[]) => {
      // Entity updates can be large, use startTransition
      startTransition(() => {
        dispatch({ type: 'SET_ENTITIES', entities });
      });
    }, []),
    setActiveTab: useCallback((tab: 'entities' | 'scenarios' | 'report') => {
      // Tab changes should not block UI
      startTransition(() => {
        dispatch({ type: 'SET_ACTIVE_TAB', tab });
      });
    }, []),
    setExecutionMode: useCallback((mode: 'synthetic' | 'emulated' | 'live') => {
      dispatch({ type: 'SET_EXECUTION_MODE', mode });
    }, []),
    setAutoSubmit: useCallback((autoSubmit: boolean) => {
      dispatch({ type: 'SET_AUTO_SUBMIT', autoSubmit });
    }, []),
  };
  
  return (
    <ScenarioEngineContext.Provider value={contextValue}>
      {children}
    </ScenarioEngineContext.Provider>
  );
}

export function useScenarioEngineState() {
  const context = useContext(ScenarioEngineContext);
  if (!context) {
    throw new Error('useScenarioEngineState must be used within ScenarioEngineProvider');
  }
  return context;
}

// Selective hooks for performance (only re-render when specific state changes)
export function useReportMessages() {
  const { state } = useScenarioEngineState();
  return state.reportMessages;
}

export function useExecutionPhase() {
  const { state } = useScenarioEngineState();
  return state.executionPhase;
}

export function useStatusMessage() {
  const { state } = useScenarioEngineState();
  return state.statusMessage;
}

export function useRunningScenario() {
  const { state } = useScenarioEngineState();
  return [state.runningScenario, state.isRunning] as const;
}

export function useEntities() {
  const { state } = useScenarioEngineState();
  return state.entities;
}

export type { ExecutionPhase, ScenarioEngineState };
