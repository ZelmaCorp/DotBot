/**
 * Chat Route Utilities
 */

import { Response } from 'express';
import { DotBotSession } from '../sessionManager';
import { sendSuccess, sendNotFound } from './routeUtils';

/**
 * Verify chat belongs to session (same wallet, environment, and network)
 */
export function verifyChatBelongsToSession(
  chat: any,
  session: DotBotSession
): boolean {
  return (
    chat.walletAddress === session.wallet.address &&
    chat.environment === session.environment &&
    chat.network === session.network
  );
}

/**
 * Handle get chat instance route
 */
export async function handleGetChatInstance(
  res: Response,
  session: DotBotSession,
  chatId: string
): Promise<void> {
  const chatManager = session.dotbot.getChatManager();
  const chat = await chatManager.loadInstance(chatId);

  if (!chat) {
    sendNotFound(res, 'Chat instance', chatId);
    return;
  }

  if (!verifyChatBelongsToSession(chat, session)) {
    sendNotFound(res, 'Chat instance', chatId);
    return;
  }

  sendSuccess(res, { chat });
}

/**
 * Handle list chat instances route
 */
export async function handleListChatInstances(
  res: Response,
  session: DotBotSession
): Promise<void> {
  const chatManager = session.dotbot.getChatManager();
  const chats = await chatManager.queryInstances({
    walletAddress: session.wallet.address,
    environment: session.environment,
    network: session.network,
    archived: false,
  });

  sendSuccess(res, { chats });
}

/**
 * Handle delete chat instance route
 */
export async function handleDeleteChatInstance(
  res: Response,
  session: DotBotSession,
  chatId: string
): Promise<void> {
  const chatManager = session.dotbot.getChatManager();
  const chat = await chatManager.loadInstance(chatId);
  const existed = chat !== null;

  if (existed) {
    if (!verifyChatBelongsToSession(chat!, session)) {
      sendNotFound(res, 'Chat instance', chatId);
      return;
    }
    await chatManager.deleteInstance(chatId);
  }

  sendSuccess(res, {
    success: existed,
    message: existed ? 'Chat instance deleted' : 'Chat instance not found',
  });
}

/**
 * Handle load chat instance route
 */
export async function handleLoadChatInstance(
  res: Response,
  session: DotBotSession,
  chatId: string
): Promise<void> {
  await session.dotbot.loadChatInstance(chatId);

  const chatManager = session.dotbot.getChatManager();
  const chat = await chatManager.loadInstance(chatId);

  if (!chat) {
    sendNotFound(res, 'Chat instance', chatId);
    return;
  }

  sendSuccess(res, { chat });
}
