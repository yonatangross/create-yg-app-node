/**
 * ChatPage Component
 * Full-featured chat UI with React 19 patterns:
 * - useActionState for form submission
 * - SSE streaming with typed ContentBlock parts
 * - Direct state updates avoid duplicate key issues
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageList, type MessageData } from '../components/Chat/MessageList';
import { MessageInput } from '../components/Chat/MessageInput';
import type { ContentBlock } from '../components/Chat/MessageParts';
import { api } from '../lib/api';

/** Type-safe exhaustive check for discriminated unions */
function assertNever(x: never): never {
  throw new Error(`Unexpected value: ${JSON.stringify(x)}`);
}

interface FormState {
  errors?:
    | {
        message?: string | undefined;
        form?: string | undefined;
      }
    | undefined;
  success?: boolean | undefined;
}

export function ChatPage() {
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [threadId, setThreadId] = useState<string | undefined>();
  const [isStreaming, setIsStreaming] = useState(false);
  const [useStreaming, setUseStreaming] = useState(true);
  const [statusAnnouncement, setStatusAnnouncement] = useState('');
  const formResetKey = useRef(0);
  const wasStreamingRef = useRef(false);

  // Announce streaming status for screen readers
  // Only react to isStreaming changes to avoid infinite loops during message updates
  useEffect(() => {
    if (isStreaming) {
      wasStreamingRef.current = true;
      setStatusAnnouncement('AI is responding...');
      return undefined;
    }

    // Only announce "Response complete" when transitioning from streaming to not streaming
    if (wasStreamingRef.current) {
      wasStreamingRef.current = false;
      setStatusAnnouncement('Response complete');
      // Clear after announcement
      const timer = setTimeout(() => setStatusAnnouncement(''), 2000);
      return () => clearTimeout(timer);
    }

    return undefined;
  }, [isStreaming]);

  /**
   * Handle streaming chat with typed ContentBlock parts
   * Parses StreamEvent into ContentBlock[] for rich UI rendering
   */
  const handleStreamingChat = useCallback(
    async (userMessage: string) => {
      const userMsg: MessageData = {
        id: crypto.randomUUID(),
        role: 'user',
        content: userMessage,
        timestamp: new Date().toISOString(),
      };

      // Add user message to real state immediately (not optimistic - avoids duplicate keys)
      setMessages((prev) => [...prev, userMsg]);
      setIsStreaming(true);

      // Track parts being built up during streaming
      let currentParts: ContentBlock[] = [];
      const assistantMsgId = crypto.randomUUID();

      try {
        // Stream the response with typed events
        for await (const event of api.chatStream(
          userMessage,
          threadId,
          undefined
        )) {
          // Handle each event type with type-safe switch
          switch (event.type) {
            case 'text_delta':
              // Append text to existing text block or create new one
              if (
                currentParts.length > 0 &&
                currentParts[currentParts.length - 1]?.type === 'text'
              ) {
                // Append to existing text block
                const lastPart = currentParts[
                  currentParts.length - 1
                ] as Extract<ContentBlock, { type: 'text' }>;
                currentParts = [
                  ...currentParts.slice(0, -1),
                  { ...lastPart, content: lastPart.content + event.content },
                ];
              } else {
                // Create new text block
                currentParts = [
                  ...currentParts,
                  { type: 'text', content: event.content },
                ];
              }
              break;

            case 'tool_call':
            case 'tool_use':
              // Add tool invocation block (running state)
              currentParts = [
                ...currentParts,
                {
                  type: 'tool_use',
                  toolCallId: event.toolCallId,
                  toolName: event.toolName,
                  toolInput: event.toolInput,
                  status: 'running' as const,
                },
              ];
              break;

            case 'tool_result':
              // Update tool to complete and add result
              currentParts = currentParts.map((part) =>
                part.type === 'tool_use' && part.toolCallId === event.toolCallId
                  ? { ...part, status: 'complete' as const }
                  : part
              );
              currentParts = [
                ...currentParts,
                {
                  type: 'tool_result',
                  toolCallId: event.toolCallId,
                  result: event.result,
                },
              ];
              break;

            case 'done':
              // Streaming complete
              break;

            case 'error':
              // Backend error - throw to trigger error handling
              throw new Error(event.message || 'Stream error occurred');

            default:
              // Exhaustive check for any new event types
              assertNever(event);
          }

          // Update message with current parts
          setMessages((prev) => {
            const hasAssistantMsg = prev.some((m) => m.id === assistantMsgId);

            if (hasAssistantMsg) {
              // Update existing assistant message
              return prev.map((msg) =>
                msg.id === assistantMsgId
                  ? { ...msg, parts: currentParts, isStreaming: true }
                  : msg
              );
            } else {
              // First update: create assistant message (user message already added)
              return [
                ...prev,
                {
                  id: assistantMsgId,
                  role: 'assistant' as const,
                  parts: currentParts,
                  timestamp: new Date().toISOString(),
                  isStreaming: true,
                },
              ];
            }
          });
        }

        // Mark streaming as complete
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId ? { ...msg, isStreaming: false } : msg
          )
        );
      } catch {
        // Error is logged server-side; show user-friendly message (user message already added)
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            parts: [
              {
                type: 'text',
                content:
                  'Sorry, an error occurred while processing your message.',
              },
            ],
            timestamp: new Date().toISOString(),
          },
        ]);
      } finally {
        setIsStreaming(false);
        formResetKey.current += 1;
      }
    },
    [threadId]
  );

  /**
   * Handle non-streaming chat (fallback mode)
   * Uses parts format for consistency with streaming
   */
  const handleRegularChat = async (userMessage: string) => {
    const userMsg: MessageData = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString(),
    };

    // Add user message to real state immediately (not optimistic - avoids duplicate keys)
    setMessages((prev) => [...prev, userMsg]);

    try {
      const response = await api.sendChatMessage(
        userMessage,
        threadId,
        undefined
      );

      // Update thread ID if this is the first message
      if (!threadId && response.threadId) {
        setThreadId(response.threadId);
      }

      // Build parts array from response (with tool info if available)
      const parts: ContentBlock[] = [];

      // Add tool invocations if tools were used
      if (response.toolsUsed && response.toolsUsed.length > 0) {
        for (const tool of response.toolsUsed) {
          parts.push({
            type: 'tool_use',
            toolCallId: crypto.randomUUID(),
            toolName: tool.name,
            toolInput: tool.arguments,
            status: 'complete' as const,
          });
        }
      }

      // Add the response text
      parts.push({ type: 'text', content: response.response });

      // Add user message and assistant response together
      const assistantMsg: MessageData = {
        id: crypto.randomUUID(),
        role: 'assistant',
        parts,
        timestamp: new Date().toISOString(),
      };

      // Add assistant response (user message already added)
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      // Error is logged server-side; show user-friendly message (user message already added)
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          parts: [
            {
              type: 'text',
              content:
                'Sorry, an error occurred while processing your message.',
            },
          ],
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      formResetKey.current += 1;
    }
  };

  /**
   * React 19: useActionState action function
   * Note: Do NOT wrap in useCallback - React 19 handles action identity internally
   */
  const submitAction = async (
    _prevState: FormState,
    formData: FormData
  ): Promise<FormState> => {
    const message = formData.get('message') as string;

    if (!message?.trim()) {
      return {
        errors: { message: 'Message cannot be empty' },
      };
    }

    try {
      if (useStreaming) {
        await handleStreamingChat(message.trim());
      } else {
        await handleRegularChat(message.trim());
      }

      return { success: true };
    } catch (error) {
      return {
        errors: {
          form:
            error instanceof Error ? error.message : 'Failed to send message',
        },
      };
    }
  };

  const handleClearChat = () => {
    setMessages([]);
    setThreadId(undefined);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] bg-white dark:bg-gray-900 rounded-lg shadow-lg">
      {/* Live region for screen reader announcements */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {statusAnnouncement}
      </div>

      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-700 p-4 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            AI Chat
          </h1>
          {threadId && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              <span className="sr-only">Current </span>Thread:{' '}
              {threadId.slice(0, 8)}
            </p>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setUseStreaming(!useStreaming)}
            aria-label={`Switch to ${useStreaming ? 'regular' : 'streaming'} mode`}
            aria-pressed={useStreaming}
            disabled={isStreaming}
            className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {useStreaming ? 'Streaming' : 'Regular'}
          </button>
          <button
            onClick={handleClearChat}
            aria-label="Clear all chat messages"
            disabled={isStreaming || messages.length === 0}
            className="px-3 py-1 text-sm bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Clear Chat
          </button>
        </div>
      </header>

      {/* Messages */}
      <MessageList messages={messages} isStreaming={isStreaming} />

      {/* Input - key forces form reset after submission */}
      <MessageInput
        key={formResetKey.current}
        onSubmit={submitAction}
        disabled={isStreaming}
      />
    </div>
  );
}
