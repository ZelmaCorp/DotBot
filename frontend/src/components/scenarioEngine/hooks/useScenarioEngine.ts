/**
 * Scenario Engine Hook
 * 
 * Manages scenario engine event handling and state
 */

import { useState, useEffect } from 'react';
import { ScenarioEngine, DotBot, Scenario, TestEntity } from '../../../lib';
import { useChatInput } from '../../../contexts/ChatInputContext';

interface UseScenarioEngineProps {
  engine: ScenarioEngine;
  dotbot: DotBot;
  onSendMessage: (message: string) => Promise<void>;
  onAppendReport: (text: string) => void;
}

export const useScenarioEngine = ({
  engine,
  dotbot,
  onSendMessage,
  onAppendReport,
}: UseScenarioEngineProps) => {
  const [entities, setEntities] = useState<any[]>([]);
  const [runningScenario, setRunningScenario] = useState<string | null>(null);
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
      if (event.type === 'inject-prompt') {
        handlePromptInjection(event.prompt);
      } else if (event.type === 'log') {
        onAppendReport(`[${event.level.toUpperCase()}] ${event.message}\n`);
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
        const result = event.result;
        onAppendReport(
          `\n[COMPLETE] ${result.success ? '✅ PASSED' : '❌ FAILED'}\n` +
          `[SCORE] ${result.evaluation.score}/100\n` +
          `[DURATION] ${result.duration}ms\n`
        );
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

