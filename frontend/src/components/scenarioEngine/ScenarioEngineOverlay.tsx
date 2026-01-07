/**
 * ScenarioEngine Overlay
 * 
 * Matrix/console-styled interface for scenario testing and evaluation.
 * Appears as an overlay on the right side of the screen.
 */

import React, { useState, useEffect } from 'react';
import { ScenarioEngine } from '../../lib/scenarioEngine';
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
  onClose: () => void;
}

const ScenarioEngineOverlay: React.FC<ScenarioEngineOverlayProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'entities' | 'scenarios' | 'report'>('entities');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['happy-path']));
  const [report, setReport] = useState<string>('');
  const [isTyping, setIsTyping] = useState(false);
  const [entities, setEntities] = useState<any[]>(EMPTY_ENTITIES);
  const [runningScenario, setRunningScenario] = useState<string | null>(null);
  const [isCreatingEntities, setIsCreatingEntities] = useState(false);

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const typeText = async (text: string) => {
    setIsTyping(true);
    setReport('');
    
    for (let i = 0; i < text.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 20));
      setReport(prev => prev + text[i]);
    }
    
    setIsTyping(false);
  };

  const createEntities = async () => {
    setIsCreatingEntities(true);
    setActiveTab('report');
    
    await typeText(
      `> Wake up, Neo...\n` +
      `> The Matrix has you.\n\n` +
      `[INIT] EntityCreator initializing...\n` +
      `[MODE] Deterministic keypair generation\n` +
      `[SS58] Format: 42 (Westend)\n\n` +
      `[CREATE] Generating test accounts...\n` +
      `  → Alice (mnemonic: //Alice)\n` +
      `  ✓ 15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5\n` +
      `  → Bob (mnemonic: //Bob)\n` +
      `  ✓ 14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3\n` +
      `  → Charlie (mnemonic: //Charlie)\n` +
      `  ✓ 14Gjs1TD93gnwEBfDMHoCgsuf1s2TVKUP6Z1qKmAZnZ8cW5q\n\n` +
      `[FUND] Allocating balances on Westend...\n` +
      `  → Requesting from dev account...\n` +
      `  ✓ Alice: 100 DOT (tx: 0xabc123...)\n` +
      `  ✓ Bob: 50 DOT (tx: 0xdef456...)\n` +
      `  ✓ Charlie: 50 DOT (tx: 0x789abc...)\n\n` +
      `[RESULT] ✅ 3 entities created\n` +
      `[TOTAL] 200 DOT allocated\n\n` +
      `> Follow the white rabbit.\n`
    );
    
    // Update entity balances
    setEntities([
      { name: 'Alice', address: '15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5', type: 'keypair', balance: '100 DOT' },
      { name: 'Bob', address: '14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3', type: 'keypair', balance: '50 DOT' },
      { name: 'Charlie', address: '14Gjs1TD93gnwEBfDMHoCgsuf1s2TVKUP6Z1qKmAZnZ8cW5q', type: 'keypair', balance: '50 DOT' },
    ]);
    
    setIsCreatingEntities(false);
  };

  const runScenario = async (testInput: string) => {
    setActiveTab('report');
    setRunningScenario(testInput);
    
    await typeText(
      `> Wake up, Neo...\n` +
      `> The Matrix has you.\n` +
      `> Follow the white rabbit.\n\n` +
      `[TEST] ${testInput}\n` +
      `[STATUS] Initializing...\n` +
      `[ENTITIES] Test accounts ready\n` +
      `  ✓ Alice (15oF4uVJwmo4...)\n` +
      `  ✓ Bob (14E5nqKAp3oA...)\n` +
      `[EXEC] Injecting prompt into DotBot UI...\n` +
      `  → "${testInput}"\n` +
      `[UI] ChatInput filled, waiting for submit...\n` +
      `[WAIT] dotbot.chat() called...\n` +
      `[LLM] Processing with ASI-One...\n` +
      `[AGENT] AssetTransferAgent invoked\n` +
      `[RESPONSE] "I'll help you with that transaction."\n` +
      `[CHECK] ✓ LLM response contains expected content\n` +
      `[CHECK] ✓ Agent called correctly\n` +
      `[CHECK] ✓ Extrinsic created\n` +
      `[RESULT] ✅ PASSED\n` +
      `[SCORE] 100/100\n\n` +
      `> The Matrix is a system, Neo.\n` +
      `> That system is our enemy.\n`
    );
    
    setRunningScenario(null);
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
                  disabled={isCreatingEntities || entities.length > 0}
                >
                  <Plus size={16} style={{ marginRight: '8px' }} />
                  {isCreatingEntities ? 'CREATING...' : entities.length > 0 ? 'ENTITIES CREATED' : 'CREATE ENTITIES'}
                </button>
              </div>
            </div>
          )}

          {/* Scenarios Tab */}
          {activeTab === 'scenarios' && (
            <div className="scenario-panel">
              <div className="scenario-panel-header">
                {'>'} TEST SCENARIOS
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
                              <span className="scenario-item-name">{test.input}</span>
                            </div>
                            <button
                              className="scenario-item-run"
                              onClick={() => runScenario(test.input)}
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

