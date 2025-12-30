/**
 * MessageList Component
 * Displays list of messages with auto-scroll
 * Supports both legacy (content string) and new (parts array) message formats
 */

import { useEffect, useRef } from 'react';
import { Message } from './Message';
import { MessageSkeleton } from './MessageSkeleton';
import type { ContentBlock } from './MessageParts';

export interface MessageData {
  id: string;
  role: 'user' | 'assistant';
  /** @deprecated Use parts instead for rich content */
  content?: string;
  /** New format: Array of content blocks for tool calls, results, etc. */
  parts?: ContentBlock[];
  timestamp: string;
  /** @deprecated Use parts with tool_use blocks instead */
  toolCalls?:
    | Array<{
        name: string;
        arguments: Record<string, unknown>;
      }>
    | undefined;
  pending?: boolean | undefined;
  /** Whether this message is currently being streamed */
  isStreaming?: boolean | undefined;
}

interface MessageListProps {
  messages: MessageData[];
  isStreaming?: boolean | undefined;
}

export function MessageList({ messages, isStreaming }: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
        <div className="text-center">
          <p className="text-lg font-medium mb-2">Start a conversation</p>
          <p className="text-sm">
            Send a message to chat with the AI assistant
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
      {messages.map((msg, index) => {
        const isLastMessage = index === messages.length - 1;
        const showStreaming =
          isStreaming && isLastMessage && msg.role === 'assistant';

        return (
          <Message
            key={msg.id}
            role={msg.role}
            content={msg.content}
            parts={msg.parts}
            timestamp={msg.timestamp}
            toolCalls={msg.toolCalls ?? undefined}
            isStreaming={showStreaming || msg.isStreaming}
          />
        );
      })}

      {/* Show skeleton only when waiting for first token, not during streaming */}
      {isStreaming &&
        messages.length > 0 &&
        messages[messages.length - 1]?.role === 'user' && <MessageSkeleton />}

      <div ref={endRef} />
    </div>
  );
}
