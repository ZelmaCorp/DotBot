/**
 * DotBot Route Utilities
 * 
 * Extracted utilities for DotBot route handlers.
 */

import { Request, Response } from 'express';
import { ChatOptions, ChatResult, Environment, Network, AIProviderType, ChatInstance } from '@dotbot/core';
import { DotBotSession } from '../sessionManager';
import { broadcastExecutionUpdates } from '../websocket/executionBroadcaster';
import { WebSocketManager } from '../websocket/WebSocketManager';
import { dotbotLogger, errorLogger } from './logger';

export interface DotBotChatRequest {
  message: string;
  sessionId?: string;
  wallet: {
    address: string;
    name?: string;
    source: string;
  };
  environment?: Environment;
  network?: Network;
  options?: {
    systemPrompt?: string;
    conversationHistory?: Array<{ role: 'user' | 'assistant' | 'system'; content: string; timestamp?: number }>;
    executionOptions?: any;
  };
  provider?: AIProviderType;
}

/**
 * Validate chat request
 */
export function validateChatRequest(req: Request): { valid: boolean; error?: string } {
  const { message, wallet } = req.body as DotBotChatRequest;

  if (!message || typeof message !== 'string') {
    return {
      valid: false,
      error: 'Message field is required and must be a string'
    };
  }

  if (!wallet || !wallet.address) {
    return {
      valid: false,
      error: 'Wallet address is required'
    };
  }

  return { valid: true };
}

/**
 * Generate effective session ID
 */
export function generateSessionId(
  sessionId: string | undefined,
  walletAddress: string,
  environment: Environment
): string {
  return sessionId || `wallet:${walletAddress}:${environment}`;
}

/**
 * Setup WebSocket broadcasting for execution
 */
export function setupWebSocketBroadcasting(
  dotbot: any,
  wsManager: WebSocketManager | undefined,
  effectiveSessionId: string
): void {
  if (!wsManager || !dotbot.currentChat) {
    return;
  }

  const dotbotInternal = dotbot as any;
  if (!dotbotInternal.config) {
    return;
  }

  const originalOnExecutionReady = dotbotInternal.config.onExecutionReady;
  
  dotbotInternal.config.onExecutionReady = (executionId: string, chat: ChatInstance) => {
    if (originalOnExecutionReady) {
      originalOnExecutionReady(executionId, chat);
    }
    
    broadcastExecutionUpdates(chat, executionId, wsManager, effectiveSessionId);
    
    dotbotLogger.debug({
      executionId,
      sessionId: effectiveSessionId
    }, 'WebSocket broadcasting enabled for execution (before simulation)');
  };
}

/**
 * Create chat instance if needed
 */
export async function ensureChatInstance(
  dotbot: any,
  walletAddress: string
): Promise<void> {
  if (dotbot.currentChat) {
    return;
  }

  const chatManager = dotbot.getChatManager();
  const chatData = await chatManager.createInstance({
    environment: dotbot.getEnvironment(),
    network: dotbot.getNetwork(),
    walletAddress,
    title: `Chat - ${dotbot.getNetwork()}`,
  });

  dotbot.currentChat = new ChatInstance(
    chatData,
    chatManager,
    dotbot.stateful
  );

  dotbotLogger.debug({
    chatId: dotbot.currentChat.id,
    stateful: dotbot.stateful
  }, 'Created temporary chat instance for stateless mode');
}

/**
 * Prepare chat request (setup WebSocket, ensure chat instance)
 */
async function prepareChatRequest(
  dotbot: any,
  wsManager: WebSocketManager | undefined,
  effectiveSessionId: string,
  walletAddress: string
): Promise<void> {
  setupWebSocketBroadcasting(dotbot, wsManager, effectiveSessionId);
  await ensureChatInstance(dotbot, walletAddress);
}

/**
 * Execute chat and handle result
 */
async function executeChat(
  dotbot: any,
  message: string,
  chatOptions: ChatOptions,
  effectiveSessionId: string
): Promise<ChatResult> {
  dotbotLogger.info({
    sessionId: effectiveSessionId,
    messageLength: message.length,
    messagePreview: message.substring(0, 100),
    hasConversationHistory: !!chatOptions.conversationHistory,
    historyLength: chatOptions.conversationHistory?.length || 0,
    currentChatId: dotbot.currentChat?.id || null
  }, 'Processing DotBot chat request');

  try {
    const result = await dotbot.chat(message, chatOptions);
    
    dotbotLogger.info({
      sessionId: effectiveSessionId,
      executed: result.executed,
      success: result.success,
      executionId: result.executionId
    }, 'DotBot chat completed successfully');
    
    return result;
  } catch (chatError: any) {
    errorLogger.error({
      error: chatError.message,
      stack: chatError.stack,
      sessionId: effectiveSessionId
    }, 'DotBot.chat() failed');
    throw chatError;
  }
}

/**
 * Handle chat request
 */
export async function handleChatRequest(
  req: Request,
  res: Response,
  session: DotBotSession
): Promise<void> {
  const {
    message,
    options = {},
    provider
  }: DotBotChatRequest = req.body;

  const effectiveSessionId = generateSessionId(
    req.body.sessionId,
    session.wallet.address,
    session.environment
  );

  const dotbot = session.dotbot;
  const wsManager: WebSocketManager | undefined = req.app.locals.wsManager;

  await prepareChatRequest(dotbot, wsManager, effectiveSessionId, session.wallet.address);

  const chatOptions: ChatOptions = { ...options };
  const result = await executeChat(dotbot, message, chatOptions, effectiveSessionId);

  res.json({
    success: true,
    result,
    sessionId: effectiveSessionId,
    chatId: dotbot.currentChat?.id || null,
    timestamp: new Date().toISOString()
  });
}

/**
 * Handle error and send error response
 */
export function handleError(
  res: Response,
  error: any,
  sessionId?: string
): void {
  errorLogger.error({
    error: error.message,
    stack: error.stack,
    sessionId,
    errorName: error.name,
    errorCode: error.code
  }, 'Error processing request');

  res.status(500).json({
    error: 'Internal server error',
    message: error.message || 'Failed to process request',
    timestamp: new Date().toISOString()
  });
}
