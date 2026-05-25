/**
 * Property-Based Test: 对话历史累积
 *
 * **Validates: Requirements 10.4**
 *
 * Property 6: 对话历史累积
 * For any AI assistant session with message sequence [m1, m2, ..., mn],
 * when sending the n+1th message, the request payload's conversationHistory
 * should contain all prior n messages (user + assistant) in chronological order.
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { ConversationState, type ConversationEntry } from '../../lib/conversation-state';

// --- Generators ---

/**
 * Generates random message content simulating user or AI messages.
 * Includes Chinese characters to simulate real conversation content.
 */
const messageContentArb: fc.Arbitrary<string> = fc.array(
  fc.constantFrom(
    '优化', '表达', '补充', '数据', '调整', '结构', '润色', '文本',
    '请帮我', '分析', '这段', '内容', '建议', '修改', '如何',
    'KPI', '增长', '趋势', '品牌', '投流', '效果',
    '好的', '以下是', '修改建议', '可以考虑', '数据显示',
    'a', 'b', 'c', '1', '2', '3', ' ', ',', '。'
  ),
  { minLength: 1, maxLength: 20 }
).map(arr => arr.join(''));

/**
 * Represents a conversation turn: a user message followed by an assistant response.
 */
interface ConversationTurn {
  userMessage: string;
  assistantResponse: string;
}

/**
 * Generates a single conversation turn (user message + assistant response).
 */
const conversationTurnArb: fc.Arbitrary<ConversationTurn> = fc.record({
  userMessage: messageContentArb,
  assistantResponse: messageContentArb,
});

/**
 * Generates a sequence of conversation turns (alternating user/assistant).
 */
const conversationSequenceArb: fc.Arbitrary<ConversationTurn[]> = fc.array(
  conversationTurnArb,
  { minLength: 1, maxLength: 15 }
);

// --- Tests ---

describe('Property 6: 对话历史累积 (Conversation History Accumulation)', () => {
  it('the n+1th message request contains exactly the first n messages in history', () => {
    /**
     * **Validates: Requirements 10.4**
     *
     * Simulate a sequence of conversation turns. For each user message sent,
     * verify that the conversationHistory in the payload contains exactly
     * all prior messages (both user and assistant) in chronological order.
     */
    fc.assert(
      fc.property(conversationSequenceArb, (turns) => {
        const state = new ConversationState();
        const expectedHistory: ConversationEntry[] = [];

        for (const turn of turns) {
          // Send user message - payload should contain all prior messages
          const payload = state.addUserMessage(turn.userMessage);

          // Verify conversationHistory matches expected (all prior messages)
          expect(payload.conversationHistory).toEqual(expectedHistory);
          expect(payload.message).toBe(turn.userMessage);

          // Update expected history with the user message
          expectedHistory.push({ role: 'user', content: turn.userMessage });

          // Add assistant response
          state.addAssistantResponse(turn.assistantResponse);
          expectedHistory.push({ role: 'assistant', content: turn.assistantResponse });
        }

        // Final verification: internal history matches all messages
        expect(state.getHistory()).toEqual(expectedHistory);
      }),
      { numRuns: 100 }
    );
  });

  it('messages are in chronological order (alternating user/assistant)', () => {
    /**
     * **Validates: Requirements 10.4**
     *
     * For any conversation sequence, the history should maintain
     * strict chronological order: user, assistant, user, assistant, ...
     */
    fc.assert(
      fc.property(conversationSequenceArb, (turns) => {
        const state = new ConversationState();

        for (const turn of turns) {
          state.addUserMessage(turn.userMessage);
          state.addAssistantResponse(turn.assistantResponse);
        }

        const history = state.getHistory();

        // Verify alternating pattern: even indices are user, odd are assistant
        for (let i = 0; i < history.length; i++) {
          if (i % 2 === 0) {
            expect(history[i].role).toBe('user');
          } else {
            expect(history[i].role).toBe('assistant');
          }
        }

        // Verify total count matches 2 * number of turns
        expect(history.length).toBe(turns.length * 2);
      }),
      { numRuns: 100 }
    );
  });

  it('no messages are lost or duplicated during accumulation', () => {
    /**
     * **Validates: Requirements 10.4**
     *
     * For any conversation sequence, every message that was added
     * should appear exactly once in the final history, and no extra
     * messages should be present.
     */
    fc.assert(
      fc.property(conversationSequenceArb, (turns) => {
        const state = new ConversationState();
        const allMessages: ConversationEntry[] = [];

        for (const turn of turns) {
          state.addUserMessage(turn.userMessage);
          allMessages.push({ role: 'user', content: turn.userMessage });

          state.addAssistantResponse(turn.assistantResponse);
          allMessages.push({ role: 'assistant', content: turn.assistantResponse });
        }

        const history = state.getHistory();

        // Same length - no messages lost or added
        expect(history.length).toBe(allMessages.length);

        // Each message matches exactly (order and content)
        for (let i = 0; i < history.length; i++) {
          expect(history[i].role).toBe(allMessages[i].role);
          expect(history[i].content).toBe(allMessages[i].content);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('conversationHistory grows by exactly 2 entries per turn', () => {
    /**
     * **Validates: Requirements 10.4**
     *
     * After each complete turn (user message + assistant response),
     * the next user message's conversationHistory should be exactly
     * 2 entries longer than the previous one.
     */
    fc.assert(
      fc.property(conversationSequenceArb, (turns) => {
        const state = new ConversationState();
        let previousHistoryLength = 0;

        for (let i = 0; i < turns.length; i++) {
          const payload = state.addUserMessage(turns[i].userMessage);

          // The history in the payload should have exactly 2*i entries
          // (i complete turns before this message)
          expect(payload.conversationHistory.length).toBe(i * 2);
          expect(payload.conversationHistory.length).toBe(previousHistoryLength);

          state.addAssistantResponse(turns[i].assistantResponse);
          previousHistoryLength += 2;
        }
      }),
      { numRuns: 100 }
    );
  });

  it('getHistory returns a defensive copy (mutations do not affect internal state)', () => {
    /**
     * **Validates: Requirements 10.4**
     *
     * Modifying the returned history array should not affect the
     * internal state of ConversationState.
     */
    fc.assert(
      fc.property(conversationSequenceArb, (turns) => {
        const state = new ConversationState();

        for (const turn of turns) {
          state.addUserMessage(turn.userMessage);
          state.addAssistantResponse(turn.assistantResponse);
        }

        // Get history and mutate it
        const history = state.getHistory();
        const originalLength = history.length;
        history.push({ role: 'user', content: 'INJECTED' });
        history[0] = { role: 'assistant', content: 'MUTATED' };

        // Internal state should be unaffected
        const freshHistory = state.getHistory();
        expect(freshHistory.length).toBe(originalLength);
        if (freshHistory.length > 0) {
          expect(freshHistory[0].content).not.toBe('MUTATED');
        }
        expect(freshHistory).not.toContainEqual({ role: 'user', content: 'INJECTED' });
      }),
      { numRuns: 100 }
    );
  });

  it('addUserMessage returns a defensive copy of history (mutations do not affect state)', () => {
    /**
     * **Validates: Requirements 10.4**
     *
     * Modifying the conversationHistory in the returned payload
     * should not affect the internal state.
     */
    fc.assert(
      fc.property(conversationSequenceArb, (turns) => {
        const state = new ConversationState();

        // Add first turn
        if (turns.length > 0) {
          state.addUserMessage(turns[0].userMessage);
          state.addAssistantResponse(turns[0].assistantResponse);
        }

        // Send second message and mutate the returned history
        const payload = state.addUserMessage('test message');
        const payloadHistoryLength = payload.conversationHistory.length;
        payload.conversationHistory.push({ role: 'user', content: 'INJECTED' });

        // Internal state should be unaffected - next call should still work correctly
        state.addAssistantResponse('test response');
        const nextPayload = state.addUserMessage('another message');

        // The next payload should have payloadHistoryLength + 2 entries
        // (the 'test message' + 'test response' were added)
        expect(nextPayload.conversationHistory.length).toBe(payloadHistoryLength + 2);
        expect(nextPayload.conversationHistory).not.toContainEqual({
          role: 'user',
          content: 'INJECTED',
        });
      }),
      { numRuns: 100 }
    );
  });
});
