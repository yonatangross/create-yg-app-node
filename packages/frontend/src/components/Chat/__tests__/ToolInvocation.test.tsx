/**
 * ToolInvocation Component Tests
 * Tests tool call rendering with different states
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ToolInvocation } from '../ToolInvocation';

describe('ToolInvocation', () => {
  const defaultProps = {
    toolCallId: 'call-123',
    toolName: 'search',
    toolInput: { query: 'test' },
    status: 'pending' as const,
  };

  it('renders tool name', () => {
    render(<ToolInvocation {...defaultProps} />);
    expect(screen.getByText('search')).toBeInTheDocument();
  });

  it('renders "Calling" prefix', () => {
    render(<ToolInvocation {...defaultProps} />);
    expect(screen.getByText('Calling')).toBeInTheDocument();
  });

  it('renders tool input as JSON', () => {
    render(<ToolInvocation {...defaultProps} />);
    // JSON.stringify formats with newlines and indentation
    expect(screen.getByText(/"query"/)).toBeInTheDocument();
    expect(screen.getByText(/"test"/)).toBeInTheDocument();
  });

  it('renders empty input gracefully', () => {
    render(<ToolInvocation {...defaultProps} toolInput={null} />);
    expect(screen.getByText('search')).toBeInTheDocument();
  });

  it('renders string input directly', () => {
    render(<ToolInvocation {...defaultProps} toolInput="simple string" />);
    expect(screen.getByText('simple string')).toBeInTheDocument();
  });

  it('shows "Running..." when status is running', () => {
    render(<ToolInvocation {...defaultProps} status="running" />);
    expect(screen.getByText('Running...')).toBeInTheDocument();
  });

  it('does not show "Running..." when status is pending', () => {
    render(<ToolInvocation {...defaultProps} status="pending" />);
    expect(screen.queryByText('Running...')).not.toBeInTheDocument();
  });

  it('does not show "Running..." when status is complete', () => {
    render(<ToolInvocation {...defaultProps} status="complete" />);
    expect(screen.queryByText('Running...')).not.toBeInTheDocument();
  });

  it('has pulse animation when running', () => {
    const { container } = render(
      <ToolInvocation {...defaultProps} status="running" />
    );
    expect(container.firstChild).toHaveClass('animate-tool-pulse');
  });

  it('sets data-tool-call-id attribute', () => {
    const { container } = render(<ToolInvocation {...defaultProps} />);
    expect(container.firstChild).toHaveAttribute(
      'data-tool-call-id',
      'call-123'
    );
  });
});
