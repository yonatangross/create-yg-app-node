/**
 * MessageParts Component Tests
 * Tests rendering of different content block types
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MessageParts, type ContentBlock } from '../MessageParts';

describe('MessageParts', () => {
  it('renders text content block', () => {
    const parts: ContentBlock[] = [{ type: 'text', content: 'Hello, world!' }];
    render(<MessageParts parts={parts} />);
    expect(screen.getByText('Hello, world!')).toBeInTheDocument();
  });

  it('renders multiple text blocks', () => {
    const parts: ContentBlock[] = [
      { type: 'text', content: 'First message' },
      { type: 'text', content: 'Second message' },
    ];
    render(<MessageParts parts={parts} />);
    expect(screen.getByText('First message')).toBeInTheDocument();
    expect(screen.getByText('Second message')).toBeInTheDocument();
  });

  it('renders tool_use content block', () => {
    const parts: ContentBlock[] = [
      {
        type: 'tool_use',
        toolCallId: 'call-123',
        toolName: 'search',
        toolInput: { query: 'test' },
        status: 'running',
      },
    ];
    render(<MessageParts parts={parts} />);
    expect(screen.getByText('search')).toBeInTheDocument();
    expect(screen.getByText('Calling')).toBeInTheDocument();
  });

  it('renders tool_result content block', () => {
    const parts: ContentBlock[] = [
      {
        type: 'tool_result',
        toolCallId: 'call-123',
        result: 'Search result: Found 5 items',
      },
    ];
    render(<MessageParts parts={parts} />);
    expect(
      screen.getByText('Search result: Found 5 items')
    ).toBeInTheDocument();
    expect(screen.getByText('Result')).toBeInTheDocument();
  });

  it('renders tool_result with error', () => {
    const parts: ContentBlock[] = [
      {
        type: 'tool_result',
        toolCallId: 'call-123',
        result: 'Connection failed',
        isError: true,
      },
    ];
    render(<MessageParts parts={parts} />);
    expect(screen.getByText('Connection failed')).toBeInTheDocument();
    expect(screen.getByText('Error')).toBeInTheDocument();
  });

  it('renders thinking content block', () => {
    const parts: ContentBlock[] = [
      { type: 'thinking', content: 'Processing the request...' },
    ];
    render(<MessageParts parts={parts} />);
    expect(screen.getByText('Thinking...')).toBeInTheDocument();
    expect(screen.getByText('Processing the request...')).toBeInTheDocument();
  });

  it('renders mixed content blocks in order', () => {
    const parts: ContentBlock[] = [
      { type: 'text', content: 'Let me search for that.' },
      {
        type: 'tool_use',
        toolCallId: 'call-1',
        toolName: 'web_search',
        toolInput: { query: 'weather' },
        status: 'complete',
      },
      {
        type: 'tool_result',
        toolCallId: 'call-1',
        result: 'Sunny, 72°F',
      },
      { type: 'text', content: 'The weather is sunny and 72°F.' },
    ];
    render(<MessageParts parts={parts} />);

    expect(screen.getByText('Let me search for that.')).toBeInTheDocument();
    expect(screen.getByText('web_search')).toBeInTheDocument();
    expect(screen.getByText('Sunny, 72°F')).toBeInTheDocument();
    expect(
      screen.getByText('The weather is sunny and 72°F.')
    ).toBeInTheDocument();
  });

  it('shows cursor on last text part when streaming', () => {
    const parts: ContentBlock[] = [
      { type: 'text', content: 'First part' },
      { type: 'text', content: 'Second part' },
    ];
    render(<MessageParts parts={parts} isStreaming={true} />);
    // Cursor should only be on the last part
    expect(screen.getByLabelText('Typing...')).toBeInTheDocument();
  });

  it('does not show cursor when not streaming', () => {
    const parts: ContentBlock[] = [
      { type: 'text', content: 'Complete message' },
    ];
    render(<MessageParts parts={parts} isStreaming={false} />);
    expect(screen.queryByLabelText('Typing...')).not.toBeInTheDocument();
  });

  it('does not show cursor on non-text last part', () => {
    const parts: ContentBlock[] = [
      { type: 'text', content: 'Text' },
      {
        type: 'tool_use',
        toolCallId: 'call-1',
        toolName: 'search',
        toolInput: {},
        status: 'running',
      },
    ];
    render(<MessageParts parts={parts} isStreaming={true} />);
    expect(screen.queryByLabelText('Typing...')).not.toBeInTheDocument();
  });

  it('renders empty parts array', () => {
    const { container } = render(<MessageParts parts={[]} />);
    expect(container.firstChild).toBeInTheDocument();
  });
});
