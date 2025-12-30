/**
 * Message Component
 * Displays a single chat message with user/assistant styling
 * Supports both legacy (content string) and new (parts array) formats
 */

import { MessageParts, type ContentBlock } from './MessageParts';

interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

interface MessageProps {
  role: 'user' | 'assistant';
  content?: string | undefined;
  parts?: ContentBlock[] | undefined;
  timestamp?: string | undefined;
  toolCalls?: ToolCall[] | undefined;
  isStreaming?: boolean | undefined;
}

export function Message({
  role,
  content,
  parts,
  timestamp,
  toolCalls,
  isStreaming = false,
}: MessageProps) {
  const isUser = role === 'user';

  // Convert legacy format to parts format if needed
  const messageParts: ContentBlock[] = parts || [
    { type: 'text', content: content || '' },
  ];

  return (
    <div
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4 animate-bubble-appear`}
    >
      <div
        className={`max-w-[80%] rounded-[var(--radius-bubble)] transition-all duration-[var(--duration-normal)]`}
        style={{
          backgroundColor: isUser
            ? 'var(--color-chat-user-bg)'
            : 'var(--color-chat-assistant-bg)',
          color: isUser
            ? 'var(--color-chat-user-text)'
            : 'var(--color-chat-assistant-text)',
          padding:
            'var(--spacing-bubble-padding-y) var(--spacing-bubble-padding-x)',
          boxShadow: 'var(--shadow-bubble)',
        }}
      >
        {/* Render message content using MessageParts */}
        <MessageParts parts={messageParts} isStreaming={isStreaming} />

        {/* Legacy toolCalls support (deprecated - use parts instead) */}
        {toolCalls && toolCalls.length > 0 && (
          <div
            className="mt-2 pt-2 border-t"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <div className="text-xs opacity-75 mb-1">Tools used:</div>
            {toolCalls.map((tool, idx) => (
              <div
                key={idx}
                className="text-xs opacity-75 rounded px-2 py-1 mb-1"
                style={{
                  fontFamily: 'var(--font-family-mono)',
                  backgroundColor: isUser
                    ? 'oklch(0 0 0 / 0.1)'
                    : 'var(--color-code-inline-bg)',
                }}
              >
                {tool.name}(
                {Object.keys(tool.arguments).length > 0
                  ? JSON.stringify(tool.arguments).slice(0, 50)
                  : ''}
                )
              </div>
            ))}
          </div>
        )}

        {/* Timestamp */}
        {timestamp && (
          <div
            className="text-xs mt-1"
            style={{ opacity: 0.75, color: 'var(--color-text-secondary)' }}
          >
            {new Date(timestamp).toLocaleTimeString()}
          </div>
        )}
      </div>
    </div>
  );
}
