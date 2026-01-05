/**
 * DotBot Frontend - Out of the Box Integration
 * 
 * This demonstrates how simple the lib is to use.
 * Total integration code: ~20 lines
 */

import React, { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { ThemeProvider } from './contexts/ThemeContext';
import CollapsibleSidebar from './components/layout/CollapsibleSidebar';
import MainContent from './components/layout/MainContent';
import ExecutionFlow from './components/execution/ExecutionFlow';
import { DotBot, ExecutionArrayState } from './lib';
import { useWalletStore } from './stores/walletStore';
import { ASIOneService } from './lib/services/asiOneService';
import { SigningRequest, BatchSigningRequest } from './lib';
import './styles/globals.css';
import './styles/execution-flow.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

interface Message {
  id: string;
  type: 'user' | 'bot';
  content: string;
  timestamp: number;
}

const App: React.FC = () => {
  // UI State
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [showWelcomeScreen, setShowWelcomeScreen] = useState(true);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [signingRequest, setSigningRequest] = useState<SigningRequest | BatchSigningRequest | null>(null);
  const [executionArrayState, setExecutionArrayState] = useState<ExecutionArrayState | null>(null);
  const [autoApprovePending, setAutoApprovePending] = useState(false);
  const [simulationStatus, setSimulationStatus] = useState<{
    phase: string;
    message: string;
    progress?: number;
    details?: string;
    chain?: string;
    result?: {
      success: boolean;
      estimatedFee?: string;
      validationMethod?: 'chopsticks' | 'paymentInfo';
      balanceChanges?: Array<{ value: string; change: 'send' | 'receive' }>;
      runtimeInfo?: Record<string, any>;
      error?: string;
      wouldSucceed?: boolean;
    };
  } | null>(null);
  
  // DotBot integration (SIMPLE!)
  const [dotbot, setDotbot] = useState<DotBot | null>(null);
  const [asiOne] = useState(() => new ASIOneService());
  const [isInitializing, setIsInitializing] = useState(false);
  
  const { isConnected, selectedAccount } = useWalletStore();

  // Initialize DotBot when wallet connects
  useEffect(() => {
    if (isConnected && selectedAccount && !dotbot && !isInitializing) {
      initializeDotBot();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, selectedAccount]);

  // Sync UI messages from DotBot's chat history
  useEffect(() => {
    if (dotbot?.currentChat) {
      // Use ChatInstance's built-in method to get display-friendly messages
      const uiMessages = dotbot.currentChat.getDisplayMessages();
      setMessages(uiMessages);
      setShowWelcomeScreen(dotbot.currentChat.isEmpty);
    }
  }, [dotbot, dotbot?.currentChat]);

  useEffect(() => {
    if (!dotbot) return;

    const unsubscribe = dotbot.onExecutionArrayUpdate((state) => {
      setExecutionArrayState(state);
    });

    return () => {
      unsubscribe();
    };
  }, [dotbot]);

  useEffect(() => {
    if (autoApprovePending && signingRequest) {
      signingRequest.resolve(true);
      setSigningRequest(null);
      setAutoApprovePending(false);
    }
  }, [signingRequest, autoApprovePending]);

  const initializeDotBot = async () => {
    setIsInitializing(true);
    try {
      const dotbotInstance = await DotBot.create({
        wallet: selectedAccount!,
        // Uses 'mainnet' by default
        onSigningRequest: (request) => setSigningRequest(request),
        onBatchSigningRequest: (request) => setSigningRequest(request),
        onSimulationStatus: (status) => {
          setSimulationStatus(status);
          // Clear status after 3 seconds if complete or error
          if (status.phase === 'complete' || status.phase === 'error') {
            setTimeout(() => setSimulationStatus(null), 3000);
          }
        }
      });
      
      setDotbot(dotbotInstance);
    } catch (error) {
      console.error('Failed to initialize DotBot:', error);
      
      const errorMessage: Message = {
        id: Date.now().toString(),
        type: 'bot',
        content: 'Failed to connect to the network. Please check your connection and try again.',
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsInitializing(false);
    }
  };

  /**
   * Send message - SIMPLE!
   */
  const handleSendMessage = async (message: string) => {
    if (showWelcomeScreen) {
      setShowWelcomeScreen(false);
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: message,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, userMessage]);
    setIsTyping(true);

    try {
      if (!dotbot) {
        throw new Error('Please connect your wallet first');
      }

      const result = await dotbot.chat(message, {
        llm: async (msg, systemPrompt, llmContext) => {
          const response = await asiOne.sendMessage(msg, {
            systemPrompt,
            ...llmContext,
            walletAddress: selectedAccount?.address,
            network: dotbot.getNetwork().charAt(0).toUpperCase() + dotbot.getNetwork().slice(1)
          });
          return response;
        }
      });

      const botMessage: Message = {
        id: Date.now().toString(),
        type: 'bot',
        content: result.response,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, botMessage]);

      if (result.executed) {
        const statusMessage: Message = {
          id: Date.now().toString() + '_status',
          type: 'bot',
          content: result.success 
            ? `✅ Successfully executed ${result.completed} operation(s).`
            : `⚠️ Completed ${result.completed}, failed ${result.failed} operation(s).`,
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, statusMessage]);
      }
    } catch (error) {
      console.error('Error:', error);
      
      const errorMessage: Message = {
        id: Date.now().toString(),
        type: 'bot',
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleNewChat = async () => {
    if (!dotbot) return;

    try {
      await dotbot.clearHistory();
      setMessages([]);
      setShowWelcomeScreen(true);
      setExecutionArrayState(null);
    } catch (error) {
      console.error('Failed to create new chat:', error);
    }
  };

  const handleCheckBalance = () => handleSendMessage("Please check my DOT balance");
  const handleTransfer = () => handleSendMessage("I want to transfer some DOT");
  const handleStatus = () => handleSendMessage("Show me my transaction status");
  const handleSearchChat = () => {};
  const handleTransactions = () => {};

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <div className={`app-container ${isSidebarExpanded ? '' : 'sidebar-collapsed'}`}>
          <CollapsibleSidebar
            onNewChat={handleNewChat}
            onSearchChat={handleSearchChat}
            onTransactions={handleTransactions}
            isExpanded={isSidebarExpanded}
            onToggle={setIsSidebarExpanded}
          />

          <MainContent
            onCheckBalance={handleCheckBalance}
            onTransfer={handleTransfer}
            onStatus={handleStatus}
            onSendMessage={handleSendMessage}
            messages={messages}
            isTyping={isTyping}
            showWelcomeScreen={showWelcomeScreen}
            disabled={!dotbot}
            placeholder={
              !isConnected 
                ? "Connect your wallet to start chatting..."
                : isInitializing
                ? "Initializing DotBot..."
                : "Type your message..."
            }
            simulationStatus={simulationStatus}
            executionFlow={
              /* Execution Flow - Shows immediately with simulation status */
              <ExecutionFlow
                state={executionArrayState}
                onAcceptAndStart={async () => {
                  if (signingRequest) {
                    signingRequest.resolve(true);
                    setSigningRequest(null);
                    setAutoApprovePending(false);
                  } else {
                    setAutoApprovePending(true);
                  }

                  if (dotbot?.currentChat) {
                    // Access execution through chat instance (clean API!)
                    if (dotbot.currentChat.currentExecution && !dotbot.currentChat.isPlanExecuting) {
                      try {
                        const executionSystem = (dotbot as any).executionSystem;
                        const executioner = (executionSystem as any).executioner;
                        if (executioner) {
                          executioner.execute(dotbot.currentChat.currentExecution, { autoApprove: false }).catch(() => {
                            setAutoApprovePending(false);
                          });
                        }
                      } catch {
                        setAutoApprovePending(false);
                      }
                    } else if (!dotbot.currentChat.isPlanExecuting) {
                      setAutoApprovePending(false);
                    }
                  }
            }}
            onCancel={() => {
              setAutoApprovePending(false);
              if (signingRequest) {
                signingRequest.resolve(false);
                setSigningRequest(null);
              }
              setExecutionArrayState(null);
            }}
            show={!!executionArrayState && executionArrayState.items.length > 0}
          />
            }
          />
        </div>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
