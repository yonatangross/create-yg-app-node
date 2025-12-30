/**
 * TextContent Component Tests
 * Tests text rendering and cursor animation
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TextContent } from '../TextContent';

describe('TextContent', () => {
  it('renders text content', () => {
    render(<TextContent content="Hello, world!" />);
    expect(screen.getByText('Hello, world!')).toBeInTheDocument();
  });

  it('renders empty content', () => {
    const { container } = render(<TextContent content="" />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('preserves whitespace and newlines', () => {
    render(<TextContent content={'Line 1\nLine 2'} />);
    // Text with newlines renders in a single element
    expect(screen.getByText(/Line 1/)).toBeInTheDocument();
    expect(screen.getByText(/Line 2/)).toBeInTheDocument();
  });

  it('does not show cursor by default', () => {
    render(<TextContent content="Test" />);
    expect(screen.queryByLabelText('Typing...')).not.toBeInTheDocument();
  });

  it('shows cursor when streaming', () => {
    render(<TextContent content="Test" showCursor={true} />);
    expect(screen.getByLabelText('Typing...')).toBeInTheDocument();
  });

  it('cursor has blink animation class', () => {
    render(<TextContent content="Test" showCursor={true} />);
    const cursor = screen.getByLabelText('Typing...');
    expect(cursor).toHaveClass('animate-cursor-blink');
  });
});
