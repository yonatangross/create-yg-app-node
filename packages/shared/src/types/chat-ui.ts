/**
 * Type-safe schemas for AI chat UI content blocks
 * Used for rendering streaming LLM responses with tool calls, thinking, and results
 */

import { z } from 'zod';

// ============================================================================
// Content Block Types (Discriminated Union)
// ============================================================================

/**
 * Text content from the assistant
 */
export const TextPartSchema = z.object({
  type: z.literal('text'),
  content: z.string(),
});

export type TextPart = z.infer<typeof TextPartSchema>;

/**
 * Tool use/call initiated by the assistant
 */
export const ToolUsePartSchema = z.object({
  type: z.literal('tool_use'),
  toolCallId: z.string(),
  toolName: z.string(),
  toolInput: z.record(z.unknown()),
  status: z.enum(['pending', 'running', 'complete']),
});

export type ToolUsePart = z.infer<typeof ToolUsePartSchema>;

/**
 * Result from a tool execution
 */
export const ToolResultPartSchema = z.object({
  type: z.literal('tool_result'),
  toolCallId: z.string(),
  result: z.string(),
  isError: z.boolean(),
});

export type ToolResultPart = z.infer<typeof ToolResultPartSchema>;

/**
 * Thinking/reasoning content (e.g., from extended thinking models)
 */
export const ThinkingPartSchema = z.object({
  type: z.literal('thinking'),
  content: z.string(),
});

export type ThinkingPart = z.infer<typeof ThinkingPartSchema>;

/**
 * Discriminated union of all content block types
 */
export const ContentBlockSchema = z.discriminatedUnion('type', [
  TextPartSchema,
  ToolUsePartSchema,
  ToolResultPartSchema,
  ThinkingPartSchema,
]);

export type ContentBlock = z.infer<typeof ContentBlockSchema>;

// ============================================================================
// UI Message Schema
// ============================================================================

/**
 * Complete message structure for chat UI
 * Supports streaming, tool calls, and Langfuse tracing
 */
export const UIMessageSchema = z.object({
  /** Unique message identifier */
  id: z.string(),
  /** Message role */
  role: z.enum(['user', 'assistant']),
  /** Array of content blocks (text, tool calls, results, thinking) */
  parts: z.array(ContentBlockSchema),
  /** Current streaming/processing status */
  status: z.enum(['pending', 'streaming', 'complete', 'error']),
  /** ISO 8601 timestamp */
  timestamp: z.string().datetime(),
  /** Langfuse trace ID for observability */
  traceId: z.string().optional(),
});

export type UIMessage = z.infer<typeof UIMessageSchema>;

// ============================================================================
// Stream Event Types (Server-Sent Events)
// ============================================================================

/**
 * Text delta event during streaming
 */
export const TextDeltaEventSchema = z.object({
  type: z.literal('text_delta'),
  content: z.string(),
});

export type TextDeltaEvent = z.infer<typeof TextDeltaEventSchema>;

/**
 * Tool use event (assistant requesting to use a tool)
 */
export const ToolUseEventSchema = z.object({
  type: z.literal('tool_use'),
  toolCallId: z.string(),
  toolName: z.string(),
  toolInput: z.record(z.unknown()),
});

export type ToolUseEvent = z.infer<typeof ToolUseEventSchema>;

/**
 * Tool call event (alternative naming for tool_use)
 */
export const ToolCallEventSchema = z.object({
  type: z.literal('tool_call'),
  toolCallId: z.string(),
  toolName: z.string(),
  toolInput: z.record(z.unknown()),
});

export type ToolCallEvent = z.infer<typeof ToolCallEventSchema>;

/**
 * Tool result event (result of tool execution)
 */
export const ToolResultEventSchema = z.object({
  type: z.literal('tool_result'),
  toolCallId: z.string(),
  result: z.string(),
  isError: z.boolean().optional(),
});

export type ToolResultEvent = z.infer<typeof ToolResultEventSchema>;

/**
 * Done event (streaming complete)
 */
export const DoneEventSchema = z.object({
  type: z.literal('done'),
  traceId: z.string().optional(),
});

export type DoneEvent = z.infer<typeof DoneEventSchema>;

/**
 * Error event during streaming
 */
export const ErrorEventSchema = z.object({
  type: z.literal('error'),
  message: z.string(),
});

export type ErrorEvent = z.infer<typeof ErrorEventSchema>;

/**
 * Discriminated union of all SSE event types
 */
export const StreamEventSchema = z.discriminatedUnion('type', [
  TextDeltaEventSchema,
  ToolUseEventSchema,
  ToolCallEventSchema,
  ToolResultEventSchema,
  DoneEventSchema,
  ErrorEventSchema,
]);

export type StreamEvent = z.infer<typeof StreamEventSchema>;

// ============================================================================
// Helper Type Guards
// ============================================================================

/**
 * Type guard to check if content block is text
 */
export const isTextPart = (block: ContentBlock): block is TextPart =>
  block.type === 'text';

/**
 * Type guard to check if content block is tool use
 */
export const isToolUsePart = (block: ContentBlock): block is ToolUsePart =>
  block.type === 'tool_use';

/**
 * Type guard to check if content block is tool result
 */
export const isToolResultPart = (
  block: ContentBlock
): block is ToolResultPart => block.type === 'tool_result';

/**
 * Type guard to check if content block is thinking
 */
export const isThinkingPart = (block: ContentBlock): block is ThinkingPart =>
  block.type === 'thinking';
