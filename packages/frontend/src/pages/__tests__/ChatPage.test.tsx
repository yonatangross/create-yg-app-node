/**
 * ChatPage Integration Tests
 * Tests the full chat flow with MSW mocked backend
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatPage } from '../ChatPage';
import { server } from '../../test/mocks/server';
import { errorHandlers } from '../../test/mocks/handlers';

// Mock scrollIntoView for jsdom
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

describe('ChatPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('renders page title', () => {
      render(<ChatPage />);
      expect(screen.getByText('AI Chat')).toBeInTheDocument();
    });

    it('shows empty state message initially', () => {
      render(<ChatPage />);
      expect(screen.getByText('Start a conversation')).toBeInTheDocument();
    });

    it('renders message input', () => {
      render(<ChatPage />);
      expect(
        screen.getByPlaceholderText('Type your message...')
      ).toBeInTheDocument();
    });

    it('renders streaming toggle button', () => {
      render(<ChatPage />);
      // Button has aria-label for accessibility (starts in streaming mode)
      expect(
        screen.getByRole('button', { name: /switch to regular mode/i })
      ).toBeInTheDocument();
    });

    it('renders clear chat button', () => {
      render(<ChatPage />);
      // Button has aria-label for accessibility
      expect(
        screen.getByRole('button', { name: /clear all chat messages/i })
      ).toBeInTheDocument();
    });
  });

  describe('Message Submission', () => {
    it('adds user message to the list on submit', async () => {
      const user = userEvent.setup();
      render(<ChatPage />);

      const input = screen.getByPlaceholderText('Type your message...');
      await user.type(input, 'Hello AI!');
      await user.click(screen.getByRole('button', { name: /send/i }));

      // User message should appear
      await waitFor(() => {
        expect(screen.getByText('Hello AI!')).toBeInTheDocument();
      });
    });

    it('clears input after submission', async () => {
      const user = userEvent.setup();
      render(<ChatPage />);

      const input = screen.getByPlaceholderText('Type your message...');
      await user.type(input, 'Test message');
      await user.click(screen.getByRole('button', { name: /send/i }));

      // Form resets via key change, which remounts MessageInput
      // Query for the new input element after remount
      await waitFor(() => {
        const newInput = screen.getByPlaceholderText('Type your message...');
        expect(newInput).toHaveValue('');
      });
    });

    it('re-enables input after streaming completes', async () => {
      const user = userEvent.setup();
      render(<ChatPage />);

      const input = screen.getByPlaceholderText('Type your message...');
      await user.type(input, 'Test');
      await user.click(screen.getByRole('button', { name: /send/i }));

      // Wait for streaming to complete and input to be re-enabled
      // (MSW mock responds immediately, so we verify the final state)
      await waitFor(
        () => {
          expect(input).not.toBeDisabled();
        },
        { timeout: 5000 }
      );
    });
  });

  describe('Streaming Response', () => {
    it('shows assistant response after streaming completes', async () => {
      const user = userEvent.setup();
      render(<ChatPage />);

      const input = screen.getByPlaceholderText('Type your message...');
      await user.type(input, 'Hello');
      await user.click(screen.getByRole('button', { name: /send/i }));

      // Wait for streaming response
      await waitFor(
        () => {
          expect(screen.getByText(/Hello!/)).toBeInTheDocument();
        },
        { timeout: 5000 }
      );
    });

    it('hides empty state after first message', async () => {
      const user = userEvent.setup();
      render(<ChatPage />);

      const input = screen.getByPlaceholderText('Type your message...');
      await user.type(input, 'Test');
      await user.click(screen.getByRole('button', { name: /send/i }));

      await waitFor(() => {
        expect(
          screen.queryByText('Start a conversation')
        ).not.toBeInTheDocument();
      });
    });
  });

  describe('Tool Calls', () => {
    it('displays tool call and result when present', async () => {
      // Override handler to include tool calls
      server.use(errorHandlers.withToolCall);

      const user = userEvent.setup();
      render(<ChatPage />);

      const input = screen.getByPlaceholderText('Type your message...');
      await user.type(input, 'What is the weather?');
      await user.click(screen.getByRole('button', { name: /send/i }));

      // Wait for tool call to appear
      await waitFor(
        () => {
          expect(screen.getByText('web_search')).toBeInTheDocument();
        },
        { timeout: 5000 }
      );

      // Wait for tool result
      await waitFor(
        () => {
          expect(screen.getByText('Sunny, 72°F')).toBeInTheDocument();
        },
        { timeout: 5000 }
      );
    });
  });

  describe('Error Handling', () => {
    it('shows error message on stream error', async () => {
      server.use(errorHandlers.streamError);

      const user = userEvent.setup();
      render(<ChatPage />);

      const input = screen.getByPlaceholderText('Type your message...');
      await user.type(input, 'Test error');
      await user.click(screen.getByRole('button', { name: /send/i }));

      // Error should be displayed
      await waitFor(
        () => {
          expect(screen.getByText(/error occurred/i)).toBeInTheDocument();
        },
        { timeout: 5000 }
      );
    });

    it('shows error on network failure', async () => {
      server.use(errorHandlers.networkError);

      const user = userEvent.setup();
      render(<ChatPage />);

      const input = screen.getByPlaceholderText('Type your message...');
      await user.type(input, 'Network test');
      await user.click(screen.getByRole('button', { name: /send/i }));

      await waitFor(
        () => {
          expect(screen.getByText(/error occurred/i)).toBeInTheDocument();
        },
        { timeout: 5000 }
      );
    });
  });

  describe('Clear Chat', () => {
    it('clears all messages when Clear Chat is clicked', async () => {
      const user = userEvent.setup();
      render(<ChatPage />);

      // Send a message
      const input = screen.getByPlaceholderText('Type your message...');
      await user.type(input, 'Message to clear');
      await user.click(screen.getByRole('button', { name: /send/i }));

      // Wait for message to appear
      await waitFor(() => {
        expect(screen.getByText('Message to clear')).toBeInTheDocument();
      });

      // Clear chat (using aria-label)
      await user.click(
        screen.getByRole('button', { name: /clear all chat messages/i })
      );

      // Verify messages are cleared
      expect(screen.queryByText('Message to clear')).not.toBeInTheDocument();
      expect(screen.getByText('Start a conversation')).toBeInTheDocument();
    });
  });

  describe('Streaming Toggle', () => {
    it('toggles between Streaming and Regular modes', async () => {
      const user = userEvent.setup();
      render(<ChatPage />);

      // Initially in streaming mode (aria-label indicates action to switch to regular)
      const streamingButton = screen.getByRole('button', {
        name: /switch to regular mode/i,
      });
      expect(streamingButton).toBeInTheDocument();
      expect(streamingButton).toHaveAttribute('aria-pressed', 'true');

      // Click to toggle
      await user.click(streamingButton);

      // Now in regular mode (aria-label indicates action to switch to streaming)
      const regularButton = screen.getByRole('button', {
        name: /switch to streaming mode/i,
      });
      expect(regularButton).toBeInTheDocument();
      expect(regularButton).toHaveAttribute('aria-pressed', 'false');
    });
  });

  describe('Keyboard Navigation', () => {
    it('submits form on Enter key', async () => {
      const user = userEvent.setup();
      render(<ChatPage />);

      const input = screen.getByPlaceholderText('Type your message...');
      await user.type(input, 'Enter key test{enter}');

      // Should submit and add message
      await waitFor(() => {
        expect(screen.getByText('Enter key test')).toBeInTheDocument();
      });
    });

    it('does not submit on Shift+Enter (multiline)', async () => {
      const user = userEvent.setup();
      render(<ChatPage />);

      const input = screen.getByPlaceholderText('Type your message...');
      await user.type(input, 'Line 1');
      await user.keyboard('{Shift>}{Enter}{/Shift}');
      await user.type(input, 'Line 2');

      // Message should NOT be sent yet
      expect(screen.queryByText('Line 1')).not.toBeInTheDocument();

      // Input should still contain text (accounting for newline)
      expect(input).toHaveValue('Line 1\nLine 2');
    });
  });

  describe('Validation', () => {
    it('does not submit empty message', async () => {
      const user = userEvent.setup();
      render(<ChatPage />);

      const submitButton = screen.getByRole('button', { name: /send/i });
      await user.click(submitButton);

      // Empty state should still be visible
      expect(screen.getByText('Start a conversation')).toBeInTheDocument();
    });

    it('does not submit whitespace-only message', async () => {
      const user = userEvent.setup();
      render(<ChatPage />);

      const input = screen.getByPlaceholderText('Type your message...');
      await user.type(input, '   ');
      await user.click(screen.getByRole('button', { name: /send/i }));

      // Empty state should still be visible
      expect(screen.getByText('Start a conversation')).toBeInTheDocument();
    });
  });
});
