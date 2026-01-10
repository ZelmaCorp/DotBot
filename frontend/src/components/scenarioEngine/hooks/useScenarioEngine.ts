/**
 * Scenario Engine Hook
 * 
 * Manages scenario engine event handling and state
 */

import { useState, useEffect } from 'react';
import { ScenarioEngine, DotBot, Scenario, TestEntity } from '../../../lib';
import { useChatInput } from '../../../contexts/ChatInputContext';

interface ExecutionPhase {
  phase: 'beginning' | 'cycle' | 'final-report' | null;
  messages: string[];
  stepCount: number;
  dotbotActivity?: string;
}

interface UseScenarioEngineProps {
  engine: ScenarioEngine;
  dotbot: DotBot;
  onSendMessage: (message: string) => Promise<void>;
  onAppendReport: (text: string) => void;
  onStatusChange?: (message: string) => void;
  onPhaseChange?: (phase: ExecutionPhase) => void;
}

export const useScenarioEngine = ({
  engine,
  dotbot,
  onSendMessage,
  onAppendReport,
  onStatusChange,
  onPhaseChange,
}: UseScenarioEngineProps) => {
  const [entities, setEntities] = useState<any[]>([]);
  const [runningScenario, setRunningScenario] = useState<string | null>(null);
  const [executionPhase, setExecutionPhase] = useState<ExecutionPhase>({
    phase: null,
    messages: [],
    stepCount: 0,
  });
  const { setInputValue, setPendingPrompt, setExecutor } = useChatInput();

  const handlePromptInjection = async (prompt: string) => {
    const executor = engine.getExecutor();
    executor?.notifyPromptProcessed();
    
    // Fill the ChatInput but DON'T send the message
    // User can review and submit manually
    setInputValue(prompt);
    
    // Store the prompt and executor reference for App.tsx to detect submission
    setPendingPrompt(prompt);
    setExecutor(executor);
  };

  // Generate analysis of scenario results
  const generateAnalysis = (result: any): string => {
    let analysis = '[ANALYSIS]\n';
    analysis += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    
    // Overall result
    if (result.success) {
      analysis += '✅ Scenario PASSED\n';
    } else {
      analysis += '❌ Scenario FAILED\n';
    }
    
    // What DotBot said/did
    if (result.stepResults && result.stepResults.length > 0) {
      const lastStep = result.stepResults[result.stepResults.length - 1];
      if (lastStep.response) {
        analysis += `\n📝 DotBot Response:\n`;
        analysis += `   Type: ${lastStep.response.type}\n`;
        if (lastStep.response.content) {
          const preview = lastStep.response.content.substring(0, 200);
          analysis += `   Content: ${preview}${lastStep.response.content.length > 200 ? '...' : ''}\n`;
        }
      }
    }
    
    // What was expected vs what happened
    if (result.evaluation && result.evaluation.expectations) {
      analysis += `\n🎯 Expectations:\n`;
      result.evaluation.expectations.forEach((exp: any, idx: number) => {
        analysis += `   ${idx + 1}. ${exp.met ? '✅' : '❌'} ${exp.expectation.description || 'Unknown expectation'}\n`;
        if (!exp.met && exp.details) {
          analysis += `      Details: ${exp.details}\n`;
        }
      });
    }
    
    // Why it failed/passed
    if (!result.success && result.evaluation) {
      analysis += `\n🔍 Failure Analysis:\n`;
      if (result.evaluation.score < 50) {
        analysis += `   • Critical failure: Score below 50/100\n`;
      }
      if (result.evaluation.expectations) {
        const failed = result.evaluation.expectations.filter((e: any) => !e.met);
        if (failed.length > 0) {
          analysis += `   • ${failed.length} expectation(s) not met\n`;
          failed.forEach((exp: any) => {
            if (exp.details) {
              analysis += `     - ${exp.details}\n`;
            }
          });
        }
      }
    } else if (result.success) {
      analysis += `\n✅ Success Analysis:\n`;
      analysis += `   • All expectations met\n`;
      analysis += `   • Score: ${result.evaluation?.score || 'N/A'}/100\n`;
    }
    
    // Summary (if available)
    if (result.evaluation?.summary) {
      analysis += `\n📋 Summary:\n`;
      analysis += `   ${result.evaluation.summary}\n`;
    }
    
    // Recommendations
    if (result.evaluation?.recommendations && result.evaluation.recommendations.length > 0) {
      analysis += `\n💡 Recommendations:\n`;
      result.evaluation.recommendations.forEach((rec: string) => {
        analysis += `   • ${rec}\n`;
      });
    }
    
    analysis += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    return analysis;
  };

  // Query balance for an entity address
  // For Westend/Polkadot, balances are typically on Asset Hub after migration
  const queryEntityBalance = async (address: string): Promise<string> => {
    try {
      const network = dotbot.getNetwork();
      const decimals = network === 'polkadot' ? 10 : 12;
      const token = network === 'polkadot' ? 'DOT' : network === 'kusama' ? 'KSM' : 'WND';
      
      // Try Asset Hub first (where balances are after migration)
      const assetHubApi = dotbot.getAssetHubApi();
      if (assetHubApi) {
        try {
          await assetHubApi.isReady;
          const accountInfo = await assetHubApi.query.system.account(address);
          const accountData = (accountInfo as any).data;
          const free = accountData?.free?.toString() || '0';
          
          const freeBN = BigInt(free);
          const divisor = BigInt(10 ** decimals);
          const whole = freeBN / divisor;
          const fractional = freeBN % divisor;
          
          // If Asset Hub has balance, use it
          if (whole > BigInt(0) || fractional > BigInt(0)) {
            if (whole === BigInt(0) && fractional === BigInt(0)) {
              // Fall through to check Relay Chain
            } else {
              // Format with up to 4 decimal places
              const fractionalStr = fractional.toString().padStart(decimals, '0');
              const trimmed = fractionalStr.replace(/0+$/, '').slice(0, 4);
              const formatted = trimmed ? `${whole}.${trimmed}` : whole.toString();
              return `${formatted} ${token}`;
            }
          }
        } catch (error) {
          // Asset Hub query failed, try Relay Chain
          console.debug(`Asset Hub balance query failed for ${address}, trying Relay Chain:`, error);
        }
      }
      
      // Fallback to Relay Chain
      const api = await dotbot.getApi();
      await api.isReady;
      
      const accountInfo = await api.query.system.account(address);
      const accountData = (accountInfo as any).data;
      const free = accountData?.free?.toString() || '0';
      
      const freeBN = BigInt(free);
      const divisor = BigInt(10 ** decimals);
      const whole = freeBN / divisor;
      const fractional = freeBN % divisor;
      
      if (whole === BigInt(0) && fractional === BigInt(0)) {
        return `0 ${token}`;
      }
      
      // Format with up to 4 decimal places
      const fractionalStr = fractional.toString().padStart(decimals, '0');
      const trimmed = fractionalStr.replace(/0+$/, '').slice(0, 4);
      const formatted = trimmed ? `${whole}.${trimmed}` : whole.toString();
      
      return `${formatted} ${token}`;
    } catch (error) {
      console.warn(`Failed to query balance for ${address}:`, error);
      return '—';
    }
  };

  useEffect(() => {
    const handleEvent = (event: any) => {
      // Report is now built inside ScenarioEngine - just pass through updates
      if (event.type === 'report-update') {
        onAppendReport(event.content);
        return;
      }
      
      if (event.type === 'report-clear') {
        // Report cleared - UI should clear its display
        // (ScenarioEngine handles the actual clearing)
        return;
      }
      
      if (event.type === 'phase-start') {
        const newPhase: ExecutionPhase = {
          phase: event.phase,
          messages: [],
          stepCount: 0,
        };
        setExecutionPhase(newPhase);
        onPhaseChange?.(newPhase);
        // Report content is handled by ScenarioEngine - no need to append here
      } else if (event.type === 'phase-update') {
        setExecutionPhase(prev => {
          const updated = {
            ...prev,
            messages: [...prev.messages, event.message],
          };
          onPhaseChange?.(updated);
          return updated;
        });
        // Report content is handled by ScenarioEngine - no need to append here
      } else if (event.type === 'dotbot-activity') {
        setExecutionPhase(prev => {
          const updated = {
            ...prev,
            dotbotActivity: event.activity,
          };
          onPhaseChange?.(updated);
          return updated;
        });
        // Report content is handled by ScenarioEngine - no need to append here
      } else if (event.type === 'inject-prompt') {
        handlePromptInjection(event.prompt);
        onStatusChange?.('Waiting for user to submit prompt...');
        // Track DotBot activity
        setExecutionPhase(prev => {
          const updated = {
            ...prev,
            dotbotActivity: `Prompt injected: "${event.prompt.substring(0, 50)}${event.prompt.length > 50 ? '...' : ''}"`,
          };
          onPhaseChange?.(updated);
          return updated;
        });
      } else if (event.type === 'log') {
        // Report content is handled by ScenarioEngine - no need to append here
        // Update status based on log messages
        const message = event.message.toLowerCase();
        if (message.includes('setting up entities')) {
          onStatusChange?.('Setting up entities...');
        } else if (message.includes('setting up state') || message.includes('state setup')) {
          onStatusChange?.('Setting up state...');
        } else if (message.includes('executing prompt')) {
          onStatusChange?.('Executing prompt...');
        } else if (message.includes('starting evaluation') || message.includes('evaluating')) {
          onStatusChange?.('Evaluating results...');
        } else if (message.includes('scenario completed')) {
          onStatusChange?.('');
        }
      } else if (event.type === 'state-change' && event.state.entities) {
        const engineEntities = Array.from(event.state.entities.values()) as TestEntity[];
        
        // Query balances for all entities
        Promise.all(
          engineEntities.map(async (e: TestEntity) => {
            const balance = await queryEntityBalance(e.address);
            return {
              name: e.name,
              address: e.address,
              type: e.type,
              uri: e.uri,
              balance,
            };
          })
        ).then(setEntities);
      } else if (event.type === 'scenario-complete') {
        setRunningScenario(null);
        onStatusChange?.('');
        // Report content is handled by ScenarioEngine - no need to append here
      } else if (event.type === 'step-start') {
        const stepNum = (event.index || 0) + 1;
        setExecutionPhase(prev => {
          const updated = {
            ...prev,
            stepCount: stepNum,
            messages: [...prev.messages, `Step ${stepNum} started`],
          };
          onPhaseChange?.(updated);
          return updated;
        });
        // Report content is handled by ScenarioEngine - no need to append here
        onStatusChange?.(`Executing step ${stepNum}...`);
      } else if (event.type === 'step-complete') {
        setExecutionPhase(prev => {
          const updated = {
            ...prev,
            messages: [...prev.messages, `Step completed`],
          };
          onPhaseChange?.(updated);
          return updated;
        });
        
        // Track DotBot's response for status display
        if (event.result.response) {
          const responseType = event.result.response.type;
          const responseContent = event.result.response.content || '';
          const responsePreview = responseContent.substring(0, 150);
          
          setExecutionPhase(prev => {
            const updated = {
              ...prev,
              dotbotActivity: `Responded with ${responseType}: ${responsePreview}${responseContent.length > 150 ? '...' : ''}`,
            };
            onPhaseChange?.(updated);
            return updated;
          });
        }
        
        // Report content is handled by ScenarioEngine - no need to append here
        onStatusChange?.('Processing step result...');
      }
    };
    
    engine.addEventListener(handleEvent);
    return () => engine.removeEventListener(handleEvent);
  }, [engine, dotbot, onSendMessage, onAppendReport]);

  return {
    entities,
    runningScenario,
    setRunningScenario,
  };
};

