/**
 * ConversationState - 对话历史状态管理
 *
 * A pure, testable state machine that encapsulates conversation history logic.
 * Maintains an ordered list of conversation entries (user/assistant messages),
 * and ensures that each new user message request includes the full prior history.
 *
 * When adding a user message:
 * 1. Captures the current history as the conversationHistory payload
 * 2. Appends the user message to the internal history
 * 3. Returns the request payload with the message and prior history
 *
 * When adding an assistant response:
 * 1. Appends the assistant message to the internal history
 */

export interface ConversationEntry {
  role: 'user' | 'assistant';
  content: string;
}

export class ConversationState {
  private history: ConversationEntry[] = [];

  /**
   * Add a user message and get the request payload (including full history).
   * The returned conversationHistory contains all messages BEFORE this one.
   */
  addUserMessage(content: string): { message: string; conversationHistory: ConversationEntry[] } {
    const payload = {
      message: content,
      conversationHistory: [...this.history],
    };
    this.history.push({ role: 'user', content });
    return payload;
  }

  /**
   * Add an assistant response to history.
   */
  addAssistantResponse(content: string): void {
    this.history.push({ role: 'assistant', content });
  }

  /**
   * Get a copy of the current conversation history.
   */
  getHistory(): ConversationEntry[] {
    return [...this.history];
  }
}
