/**
 * ChatInstance Class
 * 
 * A conversation instance with built-in behavior.
 * This is the object that React components interact with.
 * 
 * Includes execution state - executions happen DURING conversations!
 */

import type {
  ChatInstance as ChatInstanceData,
  ChatMessage,
  Environment,
  CreateChatInstanceParams,
} from './types/chatInstance';
import { toConversationHistory } from './types/chatInstance';
import type { ConversationMessage } from './dotbot';
import { ChatInstanceManager } from './chatInstanceManager';
import type { ExecutionArray } from './executionEngine/executionArray';
import type { ExecutionArrayState } from './executionEngine/types';

/**
 * ChatInstance - A conversation with built-in methods and execution state
 * 
 * This wraps the data type with behavior, making it easy for
 * React components to work with chats.
 */
export class ChatInstance {
  private data: ChatInstanceData;
  private manager: ChatInstanceManager;
  private persistenceEnabled: boolean;
  
  // Execution state (part of the conversation!)
  public currentExecution: ExecutionArray | null = null;
  private executionCallbacks: Set<(state: ExecutionArrayState) => void> = new Set();

  constructor(
    data: ChatInstanceData,
    manager: ChatInstanceManager,
    persistenceEnabled: boolean = true
  ) {
    this.data = data;
    this.manager = manager;
    this.persistenceEnabled = persistenceEnabled;
  }

  /**
   * Get the underlying data (for serialization)
   */
  getData(): ChatInstanceData {
    return this.data;
  }

  /**
   * Get conversation ID
   */
  get id(): string {
    return this.data.id;
  }

  /**
   * Get environment
   */
  get environment(): Environment {
    return this.data.environment;
  }

  /**
   * Get network
   */
  get network() {
    return this.data.network;
  }

  /**
   * Get title
   */
  get title(): string | undefined {
    return this.data.title;
  }

  /**
   * Get all messages
   */
  get messages(): ChatMessage[] {
    return this.data.messages;
  }

  /**
   * Add a message to this conversation
   */
  async addMessage(message: ChatMessage): Promise<void> {
    this.data.messages.push(message);
    
    if (this.persistenceEnabled) {
      await this.manager.addMessage(this.data.id, message);
      await this.reload();
    }
  }

  /**
   * Add a user message (convenience method)
   */
  async addUserMessage(content: string): Promise<ChatMessage> {
    const message: ChatMessage = {
      id: this.generateMessageId(),
      type: 'user',
      content,
      timestamp: Date.now(),
    };
    
    await this.addMessage(message);
    return message;
  }

  /**
   * Add a bot message (convenience method)
   */
  async addBotMessage(content: string): Promise<ChatMessage> {
    const message: ChatMessage = {
      id: this.generateMessageId(),
      type: 'bot',
      content,
      timestamp: Date.now(),
    };
    
    await this.addMessage(message);
    return message;
  }

  /**
   * Add a system message (convenience method)
   */
  async addSystemMessage(
    content: string,
    variant?: 'info' | 'warning' | 'error' | 'success'
  ): Promise<ChatMessage> {
    const message: ChatMessage = {
      id: this.generateMessageId(),
      type: 'system',
      content,
      timestamp: Date.now(),
      variant,
    };
    
    await this.addMessage(message);
    return message;
  }

  /**
   * Get conversation history (for LLM context)
   */
  getHistory(): ConversationMessage[] {
    return toConversationHistory(this.data.messages);
  }

  /**
   * Get messages filtered by type
   */
  getMessagesByType(type: ChatMessage['type']): ChatMessage[] {
    return this.data.messages.filter(msg => msg.type === type);
  }

  /**
   * Get UI-friendly messages (only user/bot/system with content)
   */
  getDisplayMessages(): Array<{ id: string; type: 'user' | 'bot'; content: string; timestamp: number }> {
    return this.data.messages
      .filter(msg => (msg.type === 'user' || msg.type === 'bot' || msg.type === 'system') && 'content' in msg)
      .map(msg => {
        const msgWithContent = msg as { id: string; type: 'user' | 'bot' | 'system'; content: string; timestamp: number };
        return {
          id: msgWithContent.id,
          type: msgWithContent.type === 'system' ? 'bot' : msgWithContent.type,
          content: msgWithContent.content,
          timestamp: msgWithContent.timestamp
        };
      });
  }

  /**
   * Auto-generate title from first message
   */
  async autoGenerateTitle(): Promise<string> {
    if (!this.persistenceEnabled) {
      return this.data.title || 'New Chat';
    }

    const title = await this.manager.autoGenerateTitle(this.data.id);
    await this.reload();
    return title;
  }

  /**
   * Update title
   */
  async setTitle(title: string): Promise<void> {
    this.data.title = title;
    
    if (this.persistenceEnabled) {
      await this.manager.updateInstance(this.data.id, { title });
      await this.reload();
    }
  }

  /**
   * Archive this conversation
   */
  async archive(): Promise<void> {
    if (this.persistenceEnabled) {
      await this.manager.updateInstance(this.data.id, { archived: true });
      await this.reload();
    }
  }

  /**
   * Unarchive this conversation
   */
  async unarchive(): Promise<void> {
    if (this.persistenceEnabled) {
      await this.manager.updateInstance(this.data.id, { archived: false });
      await this.reload();
    }
  }

  /**
   * Delete this conversation
   */
  async delete(): Promise<void> {
    if (this.persistenceEnabled) {
      await this.manager.deleteInstance(this.data.id);
    }
  }

  /**
   * Reload data from storage
   */
  private async reload(): Promise<void> {
    if (this.persistenceEnabled) {
      const updated = await this.manager.loadInstance(this.data.id);
      if (updated) {
        this.data = updated;
      }
    }
  }

  /**
   * Generate a unique message ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create a new ChatInstance
   */
  static async create(
    params: CreateChatInstanceParams,
    manager: ChatInstanceManager,
    persistenceEnabled: boolean = true
  ): Promise<ChatInstance> {
    const data = await manager.createInstance(params);
    return new ChatInstance(data, manager, persistenceEnabled);
  }

  /**
   * Load an existing ChatInstance
   */
  static async load(
    id: string,
    manager: ChatInstanceManager,
    persistenceEnabled: boolean = true
  ): Promise<ChatInstance | null> {
    const data = await manager.loadInstance(id);
    if (!data) return null;
    return new ChatInstance(data, manager, persistenceEnabled);
  }

  /**
   * Get message count
   */
  get messageCount(): number {
    return this.data.messages.length;
  }

  /**
   * Check if chat is empty
   */
  get isEmpty(): boolean {
    return this.data.messages.length === 0;
  }

  /**
   * Get last message timestamp
   */
  get lastActivity(): number {
    return this.data.updatedAt;
  }

  /**
   * Check if archived
   */
  get isArchived(): boolean {
    return this.data.archived || false;
  }

  // ============================================================================
  // Execution State (High-level API for React components)
  // ============================================================================

  /**
   * Check if a plan is currently executing
   */
  get isPlanExecuting(): boolean {
    return this.currentExecution?.getState().isExecuting || false;
  }

  /**
   * Check if execution is paused
   */
  get isPaused(): boolean {
    return this.currentExecution?.getState().isPaused || false;
  }

  /**
   * Get current execution progress (0-100)
   */
  get executionProgress(): number {
    if (!this.currentExecution) return 0;
    const state = this.currentExecution.getState();
    if (state.totalItems === 0) return 0;
    return Math.round((state.completedItems / state.totalItems) * 100);
  }

  /**
   * Get number of items in current plan
   */
  get planLength(): number {
    return this.currentExecution?.getState().totalItems || 0;
  }

  /**
   * Get number of completed items
   */
  get completedItems(): number {
    return this.currentExecution?.getState().completedItems || 0;
  }

  /**
   * Get number of failed items
   */
  get failedItems(): number {
    return this.currentExecution?.getState().failedItems || 0;
  }

  /**
   * Get full execution state (for detailed UI)
   */
  get executionState(): ExecutionArrayState | null {
    return this.currentExecution?.getState() || null;
  }

  /**
   * Set current execution array (called by DotBot internally)
   */
  setExecution(execution: ExecutionArray | null): void {
    this.currentExecution = execution;
    
    // Notify subscribers
    if (execution) {
      const state = execution.getState();
      this.executionCallbacks.forEach(cb => cb(state));
    }
  }

  /**
   * Subscribe to execution state changes
   */
  onExecutionUpdate(callback: (state: ExecutionArrayState) => void): () => void {
    this.executionCallbacks.add(callback);

    // Subscribe to execution array if it exists
    if (this.currentExecution) {
      const unsubscribe = this.currentExecution.onStatusUpdate(() => {
        const state = this.currentExecution!.getState();
        this.executionCallbacks.forEach(cb => cb(state));
      });

      // Call immediately with current state
      callback(this.currentExecution.getState());

      return () => {
        this.executionCallbacks.delete(callback);
        unsubscribe();
      };
    }

    return () => {
      this.executionCallbacks.delete(callback);
    };
  }
}

