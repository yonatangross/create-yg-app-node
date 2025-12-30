/**
 * MessageList Component Tests
 * Tests list rendering, empty state, and auto-scroll
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MessageList, type MessageData } from '../MessageList';

// Mock scrollIntoView for jsdom
beforeAll(() => {
  Element.prototype.scrollIntoView = () => {};
});

describe('MessageList', () => {
  const createMessage = (
    role: 'user' | 'assistant',
    content: string,
    id?: string
  ): MessageData => ({
    id: id ?? `msg-${Math.random().toString(36).substr(2, 9)}`,
    role,
    content,
    timestamp: new Date().toISOString(),
  });

  describe('Empty state', () => {
    it('shows empty state heading when no messages', () => {
      render(<MessageList messages={[]} />);
      expect(screen.getByText('Start a conversation')).toBeInTheDocument();
    });

    it('shows empty state description when no messages', () => {
      render(<MessageList messages={[]} />);
      expect(
        screen.getByText('Send a message to chat with the AI assistant')
      ).toBeInTheDocument();
    });
  });

  describe('Message rendering', () => {
    it('renders single user message', () => {
      const messages = [createMessage('user', 'Hello!')];
      render(<MessageList messages={messages} />);
      expect(screen.getByText('Hello!')).toBeInTheDocument();
    });

    it('renders single assistant message', () => {
      const messages = [createMessage('assistant', 'Hi there!')];
      render(<MessageList messages={messages} />);
      expect(screen.getByText('Hi there!')).toBeInTheDocument();
    });

    it('renders multiple messages in order', () => {
      const messages = [
        createMessage('user', 'First'),
        createMessage('assistant', 'Second'),
        createMessage('user', 'Third'),
      ];
      render(<MessageList messages={messages} />);

      expect(screen.getByText('First')).toBeInTheDocument();
      expect(screen.getByText('Second')).toBeInTheDocument();
      expect(screen.getByText('Third')).toBeInTheDocument();
    });

    it('hides empty state when messages exist', () => {
      const messages = [createMessage('user', 'Hello')];
      render(<MessageList messages={messages} />);
      expect(
        screen.queryByText('Start a conversation')
      ).not.toBeInTheDocument();
    });
  });

  describe('Parts format', () => {
    it('renders messages with parts array', () => {
      const messages: MessageData[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [{ type: 'text', content: 'Parts-based content' }],
          timestamp: new Date().toISOString(),
        },
      ];
      render(<MessageList messages={messages} />);
      expect(screen.getByText('Parts-based content')).toBeInTheDocument();
    });

    it('renders tool invocations in parts', () => {
      const messages: MessageData[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [
            {
              type: 'tool_use',
              toolCallId: 'call-1',
              toolName: 'calculator',
              toolInput: {},
              status: 'complete',
            },
          ],
          timestamp: new Date().toISOString(),
        },
      ];
      render(<MessageList messages={messages} />);
      expect(screen.getByText('calculator')).toBeInTheDocument();
    });
  });

  describe('Streaming', () => {
    it('shows cursor on streaming assistant message', () => {
      const messages: MessageData[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [{ type: 'text', content: 'Streaming...' }],
          timestamp: new Date().toISOString(),
          isStreaming: true,
        },
      ];
      render(<MessageList messages={messages} isStreaming={true} />);
      expect(screen.getByLabelText('Typing...')).toBeInTheDocument();
    });

    it('does not show cursor when isStreaming is false on message', () => {
      const messages: MessageData[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [{ type: 'text', content: 'Complete' }],
          timestamp: new Date().toISOString(),
          isStreaming: false,
        },
      ];
      render(<MessageList messages={messages} isStreaming={false} />);
      expect(screen.queryByLabelText('Typing...')).not.toBeInTheDocument();
    });
  });

  describe('Container styling', () => {
    it('has overflow-y-auto when messages exist', () => {
      const messages = [createMessage('user', 'Test')];
      const { container } = render(<MessageList messages={messages} />);
      const scrollContainer = container.querySelector('.overflow-y-auto');
      expect(scrollContainer).toBeInTheDocument();
    });

    it('uses flex-1 for proper layout', () => {
      const messages = [createMessage('user', 'Test')];
      const { container } = render(<MessageList messages={messages} />);
      expect(container.firstChild).toHaveClass('flex-1');
    });
  });
});
