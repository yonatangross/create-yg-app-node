# Chat Message Parts - Usage Guide

## Overview

React 19 components for rendering AI chat messages with tool invocations, results, and streaming support.

## Components

### MessageParts

Main component that renders an array of content blocks with type-safe discriminated unions.

```typescript
import { MessageParts, type ContentBlock } from '@/components/Chat';

const parts: ContentBlock[] = [
  { type: 'text', content: 'Hello! Let me help you with that.' },
  {
    type: 'tool_use',
    toolCallId: 'call_123',
    toolName: 'search',
    toolInput: { query: 'React 19 patterns' },
    status: 'running',
  },
  {
    type: 'tool_result',
    toolCallId: 'call_123',
    result: 'Found 10 results',
    isError: false,
  },
];

<MessageParts parts={parts} isStreaming={false} />;
```

### ContentBlock Types

```typescript
type ContentBlock =
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
```

### Message Component (Updated)

Now supports both legacy and new formats:

```typescript
// Legacy format (backward compatible)
<Message role="assistant" content="Hello!" />

// New format with parts
<Message
  role="assistant"
  parts={[
    { type: 'text', content: 'Searching...' },
    {
      type: 'tool_use',
      toolCallId: 'call_1',
      toolName: 'search',
      toolInput: { q: 'test' },
      status: 'running',
    },
  ]}
  isStreaming={true}
/>
```

## Streaming Support

Show a blinking cursor on the last text block when streaming:

```typescript
<MessageParts
  parts={[{ type: 'text', content: 'This is streaming text' }]}
  isStreaming={true} // Shows cursor after last text block
/>
```

## Tool Invocation Statuses

- **pending**: Tool is queued but not yet running
- **running**: Tool is actively executing (shows spinner + pulse animation)
- **complete**: Tool has finished execution

```typescript
{
  type: 'tool_use',
  toolCallId: 'call_123',
  toolName: 'database_query',
  toolInput: { table: 'users', limit: 10 },
  status: 'running', // Shows spinner
}
```

## Tool Results

Success and error states use different colors:

```typescript
// Success
{
  type: 'tool_result',
  toolCallId: 'call_123',
  result: 'Query returned 10 rows',
  isError: false, // Green styling
}

// Error
{
  type: 'tool_result',
  toolCallId: 'call_123',
  result: 'Connection timeout',
  isError: true, // Red styling
}
```

## Thinking Blocks

Display internal reasoning or planning:

```typescript
{
  type: 'thinking',
  content: 'I need to first search the documentation, then summarize the findings...',
}
```

## Design Tokens

All components use CSS variables from `/packages/frontend/src/index.css`:

- Tool colors: `--color-tool-invoke-bg`, `--color-tool-invoke-border`, etc.
- Result colors: `--color-tool-success-bg`, `--color-tool-error-bg`, etc.
- Spacing: `--spacing-tool-inset`, `--spacing-bubble-padding-x`, etc.
- Radius: `--radius-tool`, `--radius-bubble`
- Animations: `--duration-cursor-blink`, `--duration-tool-pulse`

## Animations

- **Cursor blink**: `animate-cursor-blink` (streaming text)
- **Tool pulse**: `animate-tool-pulse` (running tools)
- **Bubble appear**: `animate-bubble-appear` (message entry)
- **Tool expand**: `animate-tool-expand` (result reveal)

## Best Practices

### 1. Use discriminated unions for type safety

```typescript
switch (part.type) {
  case 'text':
    return <TextContent content={part.content} />;
  case 'tool_use':
    return <ToolInvocation {...part} />;
  case 'tool_result':
    return <ToolResult {...part} />;
  case 'thinking':
    return <ThinkingBlock {...part} />;
  default:
    return assertNever(part); // TypeScript exhaustiveness check
}
```

### 2. Format tool input for display

```typescript
// Simple string
toolInput: "search query"

// JSON object (will be formatted)
toolInput: { query: "test", limit: 10 }

// Empty input
toolInput: null
```

### 3. Match tool_use and tool_result by toolCallId

```typescript
const parts = [
  { type: 'tool_use', toolCallId: 'call_1', ... },
  { type: 'tool_result', toolCallId: 'call_1', ... }, // Same ID
];
```

### 4. Stream responses progressively

```typescript
// Start with empty parts
const [parts, setParts] = useState<ContentBlock[]>([]);

// Add text as it streams
setParts([{ type: 'text', content: 'Hello...' }]);

// Add tool invocation
setParts((prev) => [
  ...prev,
  { type: 'tool_use', toolCallId: 'call_1', status: 'running', ... },
]);

// Update to complete
setParts((prev) =>
  prev.map((p) =>
    p.type === 'tool_use' && p.toolCallId === 'call_1'
      ? { ...p, status: 'complete' }
      : p
  )
);

// Add result
setParts((prev) => [
  ...prev,
  { type: 'tool_result', toolCallId: 'call_1', result: '...', isError: false },
]);
```

## Accessibility

- Tool status changes are visually indicated (spinner, pulse)
- Cursor has `aria-label="Typing..."`
- Error states use both color and icon for clarity
- All interactive elements support keyboard navigation
- Reduced motion support via `@media (prefers-reduced-motion: reduce)`

## Dark Mode

All components automatically adapt to dark mode using CSS variables defined in `index.css`:

```css
@media (prefers-color-scheme: dark) {
  @theme {
    --color-tool-invoke-bg: oklch(0.22 0.05 280);
    --color-tool-success-bg: oklch(0.2 0.06 150);
    /* ... */
  }
}
```
