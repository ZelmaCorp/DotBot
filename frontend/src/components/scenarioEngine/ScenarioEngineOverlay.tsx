/**
 * ScenarioEngine Overlay
 * 
 * Matrix/console-styled interface for scenario testing and evaluation.
 * Appears as an overlay on the right side of the screen.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { ScenarioEngine, DotBot, Scenario } from '@dotbot/core';
import { X } from 'lucide-react';
import { EntitiesTab } from './components/EntitiesTab';
import { ScenariosTab } from './components/ScenariosTab';
import { ReportTab } from './components/ReportTab';
import { useScenarioEngine } from './hooks/useScenarioEngine';
import { 
  useScenarioEngineState, 
  useReportMessages, 
  useExecutionPhase, 
  useStatusMessage, 
  useRunningScenario,
  useEntities 
} from './context/ScenarioEngineContext';
import { verifyEntities } from './utils/entityUtils';
import { 
  getScenarioChain, 
  getChainTypeDescription, 
  createModifiedScenario 
} from './utils/scenarioRunner';
import { TEST_CATEGORIES, TabType } from './constants';
import { ExecutionMode } from './components/ModeSelector';
import '../../styles/scenario-engine-overlay.css';

interface ScenarioEngineOverlayProps {
  engine: ScenarioEngine;
  dotbot: DotBot;
  onClose: () => void;
  onSendMessage: (message: string) => Promise<any>;
  onAutoSubmitChange?: (autoSubmit: boolean) => void;
  autoSubmit?: boolean;
  isInitializing?: boolean;
  isReady?: boolean;
}

const ScenarioEngineOverlay: React.FC<ScenarioEngineOverlayProps> = ({ 
  engine, 
  dotbot, 
  onClose,
  onSendMessage,
  onAutoSubmitChange,
  autoSubmit: propAutoSubmit,
  isInitializing = false,
  isReady = false
}) => {
  // Close on ESC key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);
  // Use centralized state from context
  const { 
    state, 
    addMessage, 
    clearReport, 
    setExecutionPhase, 
    updateExecutionPhase,
    setStatusMessage, 
    setRunningScenario,
    setEntities,
    setActiveTab: setActiveTabContext,
    setExecutionMode: setExecutionModeContext,
    setAutoSubmit: setAutoSubmitContext
  } = useScenarioEngineState();
  
  const reportMessages = useReportMessages();
  const executionPhase = useExecutionPhase();
  const statusMessage = useStatusMessage();
  const [runningScenario, isRunning] = useRunningScenario();
  const entities = useEntities();
  
  // Local UI state (not part of scenario engine state)
  const [activeTab, setActiveTab] = useState<TabType>('entities');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['state-allocation', 'happy-path']));
  const [isCreatingEntities, setIsCreatingEntities] = useState(false);
  
  // Sync activeTab with context
  useEffect(() => {
    setActiveTabContext(activeTab);
  }, [activeTab, setActiveTabContext]);
  
  // Sync executionMode with context
  useEffect(() => {
    setExecutionModeContext(state.executionMode);
  }, [state.executionMode, setExecutionModeContext]);
  
  // Sync autoSubmit with context and prop
  const [autoSubmit, setAutoSubmit] = useState<boolean>(propAutoSubmit ?? true);
  useEffect(() => {
    if (propAutoSubmit !== undefined) {
      setAutoSubmit(propAutoSubmit);
      setAutoSubmitContext(propAutoSubmit);
    }
  }, [propAutoSubmit, setAutoSubmitContext]);
  
  const handleAutoSubmitToggle = (value: boolean) => {
    setAutoSubmit(value);
    setAutoSubmitContext(value);
    onAutoSubmitChange?.(value);
  };

  const clearEntities = () => {
    engine.clearEntities();
    // Note: This will be handled by the hook via report-update events
    // But we can add a direct message if needed for immediate feedback
  };

  // Only initialize hook when engine is ready
  // Hook now uses context methods instead of local state
  useScenarioEngine({
    engine: isReady ? engine : null,
    dotbot: isReady ? dotbot : null,
    onSendMessage,
    onAddMessage: addMessage,
    onClearReport: clearReport,
    onStatusChange: setStatusMessage,
    onPhaseChange: setExecutionPhase,
    onUpdatePhase: updateExecutionPhase, // Context method with built-in batching
    onSetEntities: setEntities,
    onSetRunningScenario: setRunningScenario,
  });
  
  const handleEndScenario = async () => {
    if (!engine.isScenarioRunning()) {
      return;
    }
    
    try {
      await engine.endScenarioEarly();
      setRunningScenario(null);
      setStatusMessage('');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
          // Error will be handled by report-update events
      console.error('Failed to end scenario:', error);
    }
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      next.has(category) ? next.delete(category) : next.add(category);
      return next;
    });
  };

  const createEntities = async () => {
    setIsCreatingEntities(true);
    
    try {
      const environment = dotbot.getEnvironment();
      const chain = environment === 'mainnet' ? 'polkadot' : 'westend';
      
      await engine.createEntities(
        [
          { name: 'Alice', type: 'keypair' },
          { name: 'Bob', type: 'keypair' },
          { name: 'Charlie', type: 'keypair' },
        ],
        { chain: chain as 'westend' | 'polkadot', mode: state.executionMode }
      );
      
      const engineEntities = Array.from(engine.getEntities().values());
      const entityData = engineEntities.map(e => ({
        name: e.name,
        address: e.address,
        type: e.type,
        uri: e.uri,
        balance: '0 DOT'
      }));
      
      // Entity creation messages will be handled by report-update events
      verifyEntities(entityData, state.executionMode, (text: string) => {
        // This callback is for legacy verifyEntities, but messages will come via events
      });
      
    } catch (error) {
      // Error will be handled by report-update events
      console.error('Entity creation failed:', error);
    } finally {
      setIsCreatingEntities(false);
    }
  };

  const runScenario = (scenario: Scenario) => {
    // Update UI state first (wrapped in startTransition, so non-blocking)
    setActiveTab('report');
    setRunningScenario(scenario.name);
    
    // Defer scenario execution to let UI render first
    // engine.runScenario() does a lot of synchronous work before first await
    // (validation, setup, event emissions) which can block the UI
    setTimeout(() => {
      (async () => {
        try {
          // All report messages will be handled by report-update events from ScenarioEngine
          const chain = getScenarioChain(scenario, dotbot);
          const chainType = getChainTypeDescription(chain);
          const modifiedScenario = createModifiedScenario(scenario, chain, state.executionMode);
          
          // Run scenario - this does synchronous work at start, but we've deferred it
          // The events it emits will be handled by batched/transitioned updates
          await engine.runScenario(modifiedScenario);
          
        } catch (error) {
          // Error will be handled by report-update events
          console.error('Scenario execution failed:', error);
        } finally {
          setRunningScenario(null);
        }
      })();
    }, 100); // Delay to let UI render before heavy synchronous work
  };

  return (
    <div className="scenario-overlay">
      <div className="scenario-overlay-content">
        {/* Header */}
        <div className="scenario-header">
          <div className="scenario-title">
            <span className="scenario-title-brackets">{'['}</span>
            <span className="scenario-title-text">SCENARIO_ENGINE</span>
            <span className="scenario-title-brackets">{']'}</span>
          </div>
          <div className="scenario-header-controls">
            <label className="scenario-toggle" title={autoSubmit ? "Auto-submit enabled (prompts sent automatically)" : "Manual submit (review prompts before sending)"}>
              <span className="scenario-toggle-label">AUTO:</span>
              <input
                type="checkbox"
                checked={autoSubmit}
                onChange={(e) => handleAutoSubmitToggle(e.target.checked)}
                className="scenario-toggle-input"
              />
              <span className="scenario-toggle-slider"></span>
            </label>
          <button onClick={onClose} className="scenario-close">
            <X size={18} />
          </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="scenario-tabs">
          <button
            className={`scenario-tab ${activeTab === 'entities' ? 'active' : ''}`}
            onClick={() => setActiveTab('entities')}
          >
            {'>'} ENTITIES
          </button>
          <button
            className={`scenario-tab ${activeTab === 'scenarios' ? 'active' : ''}`}
            onClick={() => setActiveTab('scenarios')}
          >
            {'>'} SCENARIOS
          </button>
          <button
            className={`scenario-tab ${activeTab === 'report' ? 'active' : ''}`}
            onClick={() => setActiveTab('report')}
          >
            {'>'} REPORT
          </button>
        </div>

        {/* Loading Screen */}
        {isInitializing && (
          <div className="scenario-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
            <div className="scenario-loading">
              <div className="scenario-loading-spinner"></div>
              <div className="scenario-loading-text">
                <span className="scenario-title-brackets">{'['}</span>
                <span>INITIALIZING_SCENARIO_ENGINE</span>
                <span className="scenario-title-brackets">{']'}</span>
              </div>
              <div className="scenario-loading-subtext">
                Setting up scenario execution engine...
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        {!isInitializing && (
          <div className="scenario-content">
            {activeTab === 'entities' && (
              <EntitiesTab
                engine={engine}
                dotbot={dotbot}
                mode={state.executionMode}
                onModeChange={(mode) => setExecutionModeContext(mode)}
                entities={entities}
                isCreating={isCreatingEntities}
                onAppendReport={(text: string) => {
                  // Legacy callback for EntitiesTab - messages will come via events
                }}
                onCreateEntities={createEntities}
                onClearEntities={clearEntities}
              />
            )}

            {activeTab === 'scenarios' && (
              <ScenariosTab
                categories={TEST_CATEGORIES}
                expandedCategories={expandedCategories}
                onToggleCategory={toggleCategory}
                mode={state.executionMode}
                onModeChange={(mode) => setExecutionModeContext(mode)}
                onRunScenario={runScenario}
                runningScenario={runningScenario}
              />
            )}

            {activeTab === 'report' && (
              <ReportTab
                messages={reportMessages}
                isRunning={isRunning}
                statusMessage={statusMessage}
                executionPhase={executionPhase}
                onClear={clearReport}
                onEndScenario={handleEndScenario}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ScenarioEngineOverlay;
