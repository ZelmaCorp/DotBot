/**
 * ScenarioEngine Overlay
 * 
 * Matrix/console-styled interface for scenario testing and evaluation.
 * Appears as an overlay on the right side of the screen.
 */

import React, { useState, useEffect } from 'react';
import { ScenarioEngine, DotBot, Scenario, TestEntity } from '../../lib';
import { 
  HAPPY_PATH_TESTS,
  ADVERSARIAL_TESTS,
  JAILBREAK_TESTS,
  AMBIGUITY_TESTS,
  EDGE_CASE_TESTS,
  STRESS_TESTS,
  CONTEXT_AWARENESS_TESTS,
  KNOWLEDGE_TESTS,
} from '../../lib/scenarioEngine';
import { X, Play, Pause, RotateCcw, ChevronDown, ChevronRight, Plus } from 'lucide-react';
import '../../styles/scenario-engine-overlay.css';

// Convert test prompts to scenario categories
const TEST_CATEGORIES = [
  { category: 'happy-path', name: 'Happy Path Tests', tests: HAPPY_PATH_TESTS },
  { category: 'adversarial', name: 'Security Tests', tests: ADVERSARIAL_TESTS },
  { category: 'jailbreak', name: 'Jailbreak Attempts', tests: JAILBREAK_TESTS },
  { category: 'ambiguity', name: 'Ambiguity Tests', tests: AMBIGUITY_TESTS },
  { category: 'edge-case', name: 'Edge Cases', tests: EDGE_CASE_TESTS },
  { category: 'stress', name: 'Stress Tests', tests: STRESS_TESTS },
  { category: 'context', name: 'Context Awareness', tests: CONTEXT_AWARENESS_TESTS },
  { category: 'knowledge', name: 'Knowledge Base', tests: KNOWLEDGE_TESTS },
];

// Entities will be created by the user
const EMPTY_ENTITIES: any[] = [];

interface ScenarioEngineOverlayProps {
  engine: ScenarioEngine;
  dotbot: DotBot;
  onClose: () => void;
  onSendMessage: (message: string) => Promise<void>;
}

const ScenarioEngineOverlay: React.FC<ScenarioEngineOverlayProps> = ({ 
  engine, 
  dotbot, 
  onClose,
  onSendMessage 
}) => {
  const [activeTab, setActiveTab] = useState<'entities' | 'scenarios' | 'report'>('entities');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['happy-path']));
  const [report, setReport] = useState<string>('');
  const [isTyping, setIsTyping] = useState(false);
  const [entities, setEntities] = useState<any[]>(EMPTY_ENTITIES);
  const [runningScenario, setRunningScenario] = useState<string | null>(null);
  const [isCreatingEntities, setIsCreatingEntities] = useState(false);
  const [executionMode, setExecutionMode] = useState<'synthetic' | 'emulated' | 'live'>('synthetic');
  
  // Subscribe to engine events
  useEffect(() => {
    const handleEvent = (event: any) => {
      if (event.type === 'inject-prompt') {
        handlePromptInjection(event.prompt);
      } else if (event.type === 'log') {
        appendToReport(`[${event.level.toUpperCase()}] ${event.message}\n`);
      } else if (event.type === 'state-change' && event.state.entities) {
        const engineEntities = Array.from(event.state.entities.values()) as TestEntity[];
        setEntities(engineEntities.map((e: TestEntity) => ({
          name: e.name,
          address: e.address,
          type: e.type,
          mnemonic: e.mnemonic,
          balance: '0 DOT'
        })));
      } else if (event.type === 'scenario-complete') {
        setRunningScenario(null);
        const result = event.result;
        appendToReport(
          `\n[COMPLETE] ${result.success ? '✅ PASSED' : '❌ FAILED'}\n` +
          `[SCORE] ${result.evaluation.score}/100\n` +
          `[DURATION] ${result.duration}ms\n`
        );
      }
    };
    
    engine.addEventListener(handleEvent);
    return () => engine.removeEventListener(handleEvent);
  }, [engine]);
  
  /**
   * Get the last bot response from DotBot chat
   */
  const getLastBotResponse = (): string | null => {
    if (!dotbot.currentChat) return null;
    const messages = dotbot.currentChat.messages;
    const lastMessage = messages[messages.length - 1];
    return (lastMessage && (lastMessage.type === 'bot' || lastMessage.type === 'user')) 
      ? lastMessage.content 
      : null;
  };

  /**
   * Handle prompt injection from ScenarioEngine
   * All modes use real DotBot - differences are in blockchain state handling
   */
  const handlePromptInjection = async (prompt: string) => {
    const executor = engine.getExecutor();
    executor?.notifyPromptProcessed();
    
    await onSendMessage(prompt);
    
    const response = getLastBotResponse();
    if (executor && response) {
      executor.notifyResponseReceived({ response, plan: null });
    }
  };
  

  const getModeDescription = (mode: string): string => {
    const descriptions: Record<string, string> = {
      synthetic: '→ Fast mocked tests (no blockchain)',
      emulated: '→ Realistic Chopsticks fork (simulated chain)',
      live: '→ Real Westend transactions (actual testnet)',
    };
    return descriptions[mode] || '';
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      next.has(category) ? next.delete(category) : next.add(category);
      return next;
    });
  };

  const appendToReport = (text: string) => {
    setReport(prev => prev + text);
  };
  
  // Tests are now full Scenario objects, no conversion needed

  /**
   * Verify entity creation was successful
   */
  const verifyEntities = (entities: any[], mode: string): void => {
    const requiredNames = ['Alice', 'Bob', 'Charlie'];
    const createdNames = entities.map(e => e.name);
    const missing = requiredNames.filter(n => !createdNames.includes(n));
    
    if (missing.length > 0) {
      appendToReport(`[VERIFY] ❌ Missing: ${missing.join(', ')}\n`);
      return;
    }
    
    const invalidAddresses = entities.filter(e => 
      !e.address || !e.address.startsWith('5') || e.address.length < 40 || e.address.length > 50
    );
    
    if (invalidAddresses.length > 0) {
      appendToReport(`[VERIFY] ❌ Invalid addresses: ${invalidAddresses.map(e => e.name).join(', ')}\n`);
      return;
    }
    
    if (mode === 'live') {
      const withMnemonics = entities.filter(e => e.mnemonic);
      if (withMnemonics.length > 0) {
        appendToReport(`[VERIFY] ⚠️ Live mode should not have mnemonics\n`);
      }
    } else {
      const withoutMnemonics = entities.filter(e => !e.mnemonic);
      if (withoutMnemonics.length > 0) {
        appendToReport(`[VERIFY] ⚠️ Missing mnemonics: ${withoutMnemonics.map(e => e.name).join(', ')}\n`);
      }
    }
    
    appendToReport(`[VERIFY] ✅ All ${entities.length} entities valid\n`);
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
        { chain: chain as 'westend' | 'polkadot', mode: executionMode }
      );
      
      const engineEntities = Array.from(engine.getEntities().values());
      const entityData = engineEntities.map(e => ({
        name: e.name,
        address: e.address,
        type: e.type,
        mnemonic: e.mnemonic,
        balance: '0 DOT'
      }));
      
      setEntities(entityData);
      
      appendToReport(`[CREATE] ${engineEntities.length} entities created (${executionMode} mode)\n`);
      engineEntities.forEach(e => {
        const mnemonicInfo = executionMode === 'live' ? ' (no mnemonic)' : (e.mnemonic ? ' (mnemonic)' : '');
        appendToReport(`  ${e.name}: ${e.address}${mnemonicInfo}\n`);
      });
      
      verifyEntities(entityData, executionMode);
      
    } catch (error) {
      appendToReport(`[ERROR] ${error}\n`);
      console.error('Entity creation failed:', error);
    } finally {
      setIsCreatingEntities(false);
    }
  };

  const runScenario = async (scenario: Scenario) => {
    setActiveTab('report');
    setRunningScenario(scenario.name);
    
    try {
      const state = engine.getState();
      const engineEntities = Array.from(engine.getEntities().values());
      
      if (engineEntities.length > 0 && state.entityMode !== executionMode) {
        appendToReport(`[WARN] Entity mode mismatch: ${state.entityMode} → ${executionMode}\n`);
      }
      
      const environment = dotbot.getEnvironment();
      const chain = environment === 'mainnet' ? 'polkadot' : 'westend';
      
      const modifiedScenario: Scenario = {
        ...scenario,
        environment: {
          chain: scenario.environment?.chain || (chain as 'westend' | 'polkadot'),
          mode: executionMode,
          ...scenario.environment?.chopsticksConfig && { chopsticksConfig: scenario.environment.chopsticksConfig },
        }
      };
      
      appendToReport(`[SCENARIO] ${scenario.name} (${executionMode})\n\n`);
      
      await engine.runScenario(modifiedScenario);
      
    } catch (error) {
      appendToReport(`[ERROR] ${error}\n`);
      console.error('Scenario execution failed:', error);
      setRunningScenario(null);
    }
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
          <button onClick={onClose} className="scenario-close">
            <X size={18} />
          </button>
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

        {/* Content */}
        <div className="scenario-content">
          {/* Entities Tab */}
          {activeTab === 'entities' && (
            <div className="scenario-panel">
              <div className="scenario-panel-header">
                {'>'} TEST ENTITIES
              </div>
              
              {/* Entity Mode Selector */}
              <div className="scenario-mode-selector">
                <div className="scenario-mode-label">{'>'} ENTITY MODE:</div>
                <div className="scenario-mode-options">
                  <button
                    className={`scenario-mode-button ${executionMode === 'synthetic' ? 'active' : ''}`}
                    onClick={() => setExecutionMode('synthetic')}
                    title="Synthetic: Mocked blockchain (fast, no real transactions)"
                  >
                    SYNTHETIC
                  </button>
                  <button
                    className={`scenario-mode-button ${executionMode === 'emulated' ? 'active' : ''}`}
                    onClick={() => setExecutionMode('emulated')}
                    title="Emulated: Chopsticks (realistic simulation with fork)"
                  >
                    CHOPSTICKS
                  </button>
                  <button
                    className={`scenario-mode-button ${executionMode === 'live' ? 'active' : ''}`}
                    onClick={() => setExecutionMode('live')}
                    title="Live: Real Westend testnet (actual transactions)"
                  >
                    LIVE
                  </button>
                </div>
                <div className="scenario-mode-description">
                  {getModeDescription(executionMode)}
                </div>
                {entities.length > 0 && (
                  <div className="scenario-entity-mode-info">
                    {'>'} Entities created for: <strong>{executionMode.toUpperCase()}</strong> mode
                  </div>
                )}
              </div>
              
              <div className="scenario-entities">
                {entities.length === 0 ? (
                  <div className="scenario-empty-state">
                    <div className="scenario-empty-icon">▸▸▸</div>
                    <div className="scenario-empty-text">
                      No entities created yet.
                    </div>
                    <div className="scenario-empty-hint">
                      Click "CREATE ENTITIES" below to generate test accounts.
                    </div>
                  </div>
                ) : (
                  entities.map((entity) => (
                    <div key={entity.name} className="scenario-entity">
                      <div className="scenario-entity-name">
                        <span className="scenario-entity-bullet">▸</span>
                        {entity.name}
                      </div>
                      <div className="scenario-entity-details">
                        <div className="scenario-entity-address">{entity.address}</div>
                        <div className="scenario-entity-meta">
                          <span className="scenario-entity-type">{entity.type}</span>
                          <span className="scenario-entity-balance">{entity.balance}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="scenario-panel-footer">
                <button 
                  className="scenario-btn scenario-btn-primary"
                  onClick={createEntities}
                  disabled={isCreatingEntities}
                >
                  {isCreatingEntities 
                    ? 'CREATING...' 
                    : entities.length > 0 
                      ? `RECREATE ENTITIES (${executionMode.toUpperCase()})` 
                      : 'CREATE ENTITIES'}
                </button>
                {entities.length > 0 && (
                  <div className="scenario-entity-warning">
                    {'>'} Entities will be cleared if mode changes
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Scenarios Tab */}
          {activeTab === 'scenarios' && (
            <div className="scenario-panel">
              <div className="scenario-panel-header">
                {'>'} TEST SCENARIOS
              </div>
              
              {/* Execution Mode Selector */}
              <div className="scenario-mode-selector">
                <div className="scenario-mode-label">{'>'} EXECUTION MODE:</div>
                <div className="scenario-mode-options">
                  <button
                    className={`scenario-mode-button ${executionMode === 'synthetic' ? 'active' : ''}`}
                    onClick={() => setExecutionMode('synthetic')}
                    title="Synthetic: Mocked blockchain (fast, no real transactions)"
                  >
                    SYNTHETIC
                  </button>
                  <button
                    className={`scenario-mode-button ${executionMode === 'emulated' ? 'active' : ''}`}
                    onClick={() => setExecutionMode('emulated')}
                    title="Emulated: Chopsticks (realistic simulation with fork)"
                  >
                    CHOPSTICKS
                  </button>
                  <button
                    className={`scenario-mode-button ${executionMode === 'live' ? 'active' : ''}`}
                    onClick={() => setExecutionMode('live')}
                    title="Live: Real Westend testnet (actual transactions)"
                  >
                    LIVE
                  </button>
                </div>
                <div className="scenario-mode-description">
                  {getModeDescription(executionMode)}
                </div>
              </div>
              
              <div className="scenario-list">
                {TEST_CATEGORIES.map((category) => (
                  <div key={category.category} className="scenario-category">
                    <button
                      className="scenario-category-header"
                      onClick={() => toggleCategory(category.category)}
                    >
                      {expandedCategories.has(category.category) ? (
                        <ChevronDown size={16} />
                      ) : (
                        <ChevronRight size={16} />
                      )}
                      <span className="scenario-category-name">{category.name}</span>
                      <span className="scenario-category-count">
                        [{category.tests.length}]
                      </span>
                    </button>
                    
                    {expandedCategories.has(category.category) && (
                      <div className="scenario-category-items">
                        {category.tests.map((test, index) => (
                          <div key={`${category.category}-${index}`} className="scenario-item">
                            <div className="scenario-item-info">
                              <span className="scenario-item-bullet">▸</span>
                              <span className="scenario-item-name">{test.name}</span>
                            </div>
                            <button
                              className="scenario-item-run"
                              onClick={() => runScenario(test)}
                              disabled={runningScenario !== null}
                            >
                              <Play size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Report Tab */}
          {activeTab === 'report' && (
            <div className="scenario-panel">
              <div className="scenario-panel-header">
                {'>'} EXECUTION REPORT
              </div>
              <div className="scenario-report">
                <pre className="scenario-report-text">
                  {report || '> Awaiting scenario execution...\n> Run a scenario to see results.'}
                  {isTyping && <span className="scenario-cursor">█</span>}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScenarioEngineOverlay;

