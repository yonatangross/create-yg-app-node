/**
 * Message Component Tests
 * Tests user/assistant message rendering
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Message } from '../Message';

describe('Message', () => {
  describe('User messages', () => {
    it('renders user message content', () => {
      render(<Message role="user" content="Hello!" />);
      expect(screen.getByText('Hello!')).toBeInTheDocument();
    });

    it('renders user message with timestamp', () => {
      const timestamp = '2025-01-15T10:30:00.000Z';
      render(<Message role="user" content="Hello!" timestamp={timestamp} />);
      // Time is formatted using locale, check for any time format
      const timeElement = screen.getByText(
        (_, element) =>
          (element?.tagName === 'DIV' &&
            element.textContent?.includes(':') &&
            element.className?.includes('text-xs')) ||
          false
      );
      expect(timeElement).toBeInTheDocument();
    });

    it('aligns user messages to the right', () => {
      const { container } = render(<Message role="user" content="Hi" />);
      expect(container.firstChild).toHaveClass('justify-end');
    });
  });

  describe('Assistant messages', () => {
    it('renders assistant message content', () => {
      render(<Message role="assistant" content="I can help with that." />);
      expect(screen.getByText('I can help with that.')).toBeInTheDocument();
    });

    it('aligns assistant messages to the left', () => {
      const { container } = render(
        <Message role="assistant" content="Response" />
      );
      expect(container.firstChild).toHaveClass('justify-start');
    });
  });

  describe('Parts format', () => {
    it('renders message with parts array', () => {
      render(
        <Message
          role="assistant"
          parts={[{ type: 'text', content: 'Parts-based message' }]}
        />
      );
      expect(screen.getByText('Parts-based message')).toBeInTheDocument();
    });

    it('prefers parts over content when both provided', () => {
      render(
        <Message
          role="assistant"
          content="Legacy content"
          parts={[{ type: 'text', content: 'Parts content' }]}
        />
      );
      expect(screen.getByText('Parts content')).toBeInTheDocument();
      // Legacy content should not be visible when parts is provided
    });

    it('renders tool_use parts in message', () => {
      render(
        <Message
          role="assistant"
          parts={[
            {
              type: 'tool_use',
              toolCallId: 'call-1',
              toolName: 'calculator',
              toolInput: { expression: '2+2' },
              status: 'running',
            },
          ]}
        />
      );
      expect(screen.getByText('calculator')).toBeInTheDocument();
      expect(screen.getByText('Running...')).toBeInTheDocument();
    });

    it('renders tool_result parts in message', () => {
      render(
        <Message
          role="assistant"
          parts={[
            {
              type: 'tool_result',
              toolCallId: 'call-1',
              result: '4',
            },
          ]}
        />
      );
      expect(screen.getByText('Result')).toBeInTheDocument();
      expect(screen.getByText('4')).toBeInTheDocument();
    });
  });

  describe('Streaming', () => {
    it('shows cursor when streaming', () => {
      render(
        <Message
          role="assistant"
          parts={[{ type: 'text', content: 'Streaming...' }]}
          isStreaming={true}
        />
      );
      expect(screen.getByLabelText('Typing...')).toBeInTheDocument();
    });

    it('does not show cursor when not streaming', () => {
      render(
        <Message
          role="assistant"
          parts={[{ type: 'text', content: 'Complete' }]}
          isStreaming={false}
        />
      );
      expect(screen.queryByLabelText('Typing...')).not.toBeInTheDocument();
    });
  });

  describe('Legacy toolCalls', () => {
    it('renders legacy toolCalls format', () => {
      render(
        <Message
          role="assistant"
          content="Using tools..."
          toolCalls={[{ name: 'search', arguments: { query: 'test' } }]}
        />
      );
      expect(screen.getByText('Tools used:')).toBeInTheDocument();
      expect(screen.getByText(/search/)).toBeInTheDocument();
    });

    it('shows multiple tool calls', () => {
      render(
        <Message
          role="assistant"
          content="Multiple tools"
          toolCalls={[
            { name: 'tool1', arguments: {} },
            { name: 'tool2', arguments: {} },
          ]}
        />
      );
      expect(screen.getByText(/tool1/)).toBeInTheDocument();
      expect(screen.getByText(/tool2/)).toBeInTheDocument();
    });
  });

  describe('Animation', () => {
    it('has bubble appear animation', () => {
      const { container } = render(<Message role="user" content="Test" />);
      expect(container.firstChild).toHaveClass('animate-bubble-appear');
    });
  });
});
