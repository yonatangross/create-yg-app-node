/**
 * MessageParts Component
 * Renders an array of content blocks with type-safe discriminated unions
 * Supports text, tool invocations, tool results, and thinking blocks
 */

import { TextContent } from './TextContent';
import { ToolInvocation } from './ToolInvocation';
import { ToolResult } from './ToolResult';

/**
 * ContentBlock discriminated union
 * Each block type has a unique 'type' field for type-safe rendering
 */
export type ContentBlock =
  | { type: 'text'; content: string }
  | {
      type: 'tool_use';
      toolCallId: string;
      toolName: string;
      toolInput: unknown;
      status: 'pending' | 'running' | 'complete';
    }
  | {
      type: 'tool_result';
      toolCallId: string;
      result: string;
      isError?: boolean;
    }
  | { type: 'thinking'; content: string };

interface MessagePartsProps {
  parts: ContentBlock[];
  isStreaming?: boolean;
}

/**
 * Exhaustive type checking helper
 * Ensures all ContentBlock types are handled in switch statements
 */
function assertNever(x: never): never {
  throw new Error(`Unexpected content block type: ${JSON.stringify(x)}`);
}

export function MessageParts({
  parts,
  isStreaming = false,
}: MessagePartsProps) {
  return (
    <div className="space-y-2">
      {parts.map((part, index) => {
        const isLastPart = index === parts.length - 1;
        const showCursor = isStreaming && isLastPart && part.type === 'text';

        switch (part.type) {
          case 'text':
            return (
              <TextContent
                key={`text-${index}`}
                content={part.content}
                showCursor={showCursor}
              />
            );

          case 'tool_use':
            return (
              <ToolInvocation
                key={part.toolCallId}
                toolCallId={part.toolCallId}
                toolName={part.toolName}
                toolInput={part.toolInput}
                status={part.status}
              />
            );

          case 'tool_result':
            return (
              <ToolResult
                key={`result-${part.toolCallId}`}
                toolCallId={part.toolCallId}
                result={part.result}
                {...(part.isError !== undefined && { isError: part.isError })}
              />
            );

          case 'thinking':
            return (
              <div
                key={`thinking-${index}`}
                className="mt-2 rounded-[var(--radius-md)] border border-dashed p-3"
                style={{
                  backgroundColor: 'var(--color-stream-highlight)',
                  borderColor: 'var(--color-border)',
                }}
              >
                <div
                  className="text-xs font-medium mb-1"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Thinking...
                </div>
                <div
                  className="text-sm italic whitespace-pre-wrap"
                  style={{ color: 'var(--color-text-secondary)', opacity: 0.8 }}
                >
                  {part.content}
                </div>
              </div>
            );

          default:
            return assertNever(part);
        }
      })}
    </div>
  );
}
