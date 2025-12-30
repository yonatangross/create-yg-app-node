/**
 * Example Usage of Chat Message Parts Components
 * Demonstrates all ContentBlock types and features
 */

import { Message, type ContentBlock } from './index';

export function MessagePartsExample() {
  // Example 1: Simple text message
  const simpleText: ContentBlock[] = [
    { type: 'text', content: 'Hello! How can I help you today?' },
  ];

  // Example 2: Text with streaming cursor
  const streamingText: ContentBlock[] = [
    {
      type: 'text',
      content: 'I am currently typing this message...',
    },
  ];

  // Example 3: Tool invocation (running)
  const toolRunning: ContentBlock[] = [
    { type: 'text', content: 'Let me search the documentation for you.' },
    {
      type: 'tool_use',
      toolCallId: 'call_abc123',
      toolName: 'search_docs',
      toolInput: {
        query: 'React 19 patterns',
        maxResults: 10,
      },
      status: 'running',
    },
  ];

  // Example 4: Tool invocation complete with result
  const toolComplete: ContentBlock[] = [
    { type: 'text', content: 'I found some information for you.' },
    {
      type: 'tool_use',
      toolCallId: 'call_def456',
      toolName: 'search_docs',
      toolInput: {
        query: 'React 19 patterns',
        maxResults: 10,
      },
      status: 'complete',
    },
    {
      type: 'tool_result',
      toolCallId: 'call_def456',
      result: JSON.stringify(
        {
          results: [
            {
              title: 'useActionState Hook',
              url: 'https://react.dev/reference/react/useActionState',
            },
            {
              title: 'useOptimistic Hook',
              url: 'https://react.dev/reference/react/useOptimistic',
            },
          ],
        },
        null,
        2
      ),
      isError: false,
    },
  ];

  // Example 5: Tool invocation with error
  const toolError: ContentBlock[] = [
    { type: 'text', content: 'Let me check the database.' },
    {
      type: 'tool_use',
      toolCallId: 'call_ghi789',
      toolName: 'database_query',
      toolInput: {
        table: 'users',
        limit: 100,
      },
      status: 'complete',
    },
    {
      type: 'tool_result',
      toolCallId: 'call_ghi789',
      result: 'Connection timeout: Unable to reach database server',
      isError: true,
    },
  ];

  // Example 6: Multiple tools in sequence
  const multipleTools: ContentBlock[] = [
    {
      type: 'text',
      content: 'I need to gather information from multiple sources.',
    },
    {
      type: 'tool_use',
      toolCallId: 'call_001',
      toolName: 'search_web',
      toolInput: { query: 'latest news' },
      status: 'complete',
    },
    {
      type: 'tool_result',
      toolCallId: 'call_001',
      result: 'Found 50 news articles',
      isError: false,
    },
    {
      type: 'tool_use',
      toolCallId: 'call_002',
      toolName: 'summarize',
      toolInput: { text: 'article content...', maxLength: 200 },
      status: 'complete',
    },
    {
      type: 'tool_result',
      toolCallId: 'call_002',
      result: 'Summary: The latest developments show...',
      isError: false,
    },
    {
      type: 'text',
      content: 'Based on my research, here is what I found...',
    },
  ];

  // Example 7: Thinking block
  const withThinking: ContentBlock[] = [
    {
      type: 'thinking',
      content:
        'User is asking about React patterns. I should first search the documentation, then provide specific examples with code snippets.',
    },
    {
      type: 'text',
      content: 'Let me help you with React 19 patterns.',
    },
  ];

  // Example 8: Complex conversation with all features
  const complexConversation: ContentBlock[] = [
    {
      type: 'thinking',
      content:
        'User wants to analyze their database. I will need to: 1) Connect to database, 2) Run query, 3) Analyze results, 4) Generate visualization.',
    },
    {
      type: 'text',
      content: 'I will analyze your database. Let me start by connecting...',
    },
    {
      type: 'tool_use',
      toolCallId: 'call_connect',
      toolName: 'database_connect',
      toolInput: { host: 'localhost', database: 'analytics' },
      status: 'complete',
    },
    {
      type: 'tool_result',
      toolCallId: 'call_connect',
      result: 'Connected successfully to analytics database',
      isError: false,
    },
    {
      type: 'text',
      content: 'Connection established. Now running your query...',
    },
    {
      type: 'tool_use',
      toolCallId: 'call_query',
      toolName: 'execute_query',
      toolInput: {
        sql: 'SELECT category, COUNT(*) as count FROM products GROUP BY category',
      },
      status: 'running',
    },
  ];

  return (
    <div className="space-y-8 p-8">
      <h1 className="text-2xl font-bold mb-4">Message Parts Examples</h1>

      <section>
        <h2 className="text-xl font-semibold mb-2">1. Simple Text</h2>
        <Message role="assistant" parts={simpleText} />
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2">2. Streaming Text</h2>
        <Message role="assistant" parts={streamingText} isStreaming={true} />
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2">3. Tool Running</h2>
        <Message role="assistant" parts={toolRunning} />
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2">4. Tool Complete</h2>
        <Message role="assistant" parts={toolComplete} />
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2">5. Tool Error</h2>
        <Message role="assistant" parts={toolError} />
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2">6. Multiple Tools</h2>
        <Message role="assistant" parts={multipleTools} />
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2">7. With Thinking</h2>
        <Message role="assistant" parts={withThinking} />
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2">8. Complex Conversation</h2>
        <Message role="assistant" parts={complexConversation} />
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2">9. Legacy Format</h2>
        <Message role="user" content="This is the legacy format" />
        <Message
          role="assistant"
          content="Legacy format still works for backward compatibility"
        />
      </section>
    </div>
  );
}
