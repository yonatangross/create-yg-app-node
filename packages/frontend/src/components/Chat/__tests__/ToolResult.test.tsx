/**
 * ToolResult Component Tests
 * Tests result rendering with success/error states
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ToolResult } from '../ToolResult';

describe('ToolResult', () => {
  const defaultProps = {
    toolCallId: 'call-123',
    result: 'Search completed successfully',
  };

  it('renders result content', () => {
    render(<ToolResult {...defaultProps} />);
    expect(
      screen.getByText('Search completed successfully')
    ).toBeInTheDocument();
  });

  it('shows "Result" label for success', () => {
    render(<ToolResult {...defaultProps} />);
    expect(screen.getByText('Result')).toBeInTheDocument();
  });

  it('shows "Error" label when isError is true', () => {
    render(<ToolResult {...defaultProps} isError={true} />);
    expect(screen.getByText('Error')).toBeInTheDocument();
  });

  it('does not show "Result" label when isError is true', () => {
    render(<ToolResult {...defaultProps} isError={true} />);
    expect(screen.queryByText('Result')).not.toBeInTheDocument();
  });

  it('renders multiline result content', () => {
    render(<ToolResult {...defaultProps} result={'Line 1\nLine 2\nLine 3'} />);
    // Content with newlines is rendered
    expect(screen.getByText(/Line 1/)).toBeInTheDocument();
    expect(screen.getByText(/Line 3/)).toBeInTheDocument();
  });

  it('sets data-tool-call-id attribute', () => {
    const { container } = render(<ToolResult {...defaultProps} />);
    expect(container.firstChild).toHaveAttribute(
      'data-tool-call-id',
      'call-123'
    );
  });

  it('has expand animation class', () => {
    const { container } = render(<ToolResult {...defaultProps} />);
    expect(container.firstChild).toHaveClass('animate-tool-expand');
  });

  it('defaults isError to false', () => {
    render(<ToolResult {...defaultProps} />);
    // Should show "Result" not "Error"
    expect(screen.getByText('Result')).toBeInTheDocument();
  });
});
