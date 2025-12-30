/**
 * ErrorBoundary Component Tests
 * Tests error catching, fallback rendering, and reset functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary, withErrorBoundary } from '../ErrorBoundary';

// Suppress console.error during tests since we're testing error handling
const originalConsoleError = console.error;
beforeEach(() => {
  console.error = vi.fn();
});
afterEach(() => {
  console.error = originalConsoleError;
});

// Component that throws an error
function ThrowingComponent({ shouldThrow = true }: { shouldThrow?: boolean }) {
  if (shouldThrow) {
    throw new Error('Test error message');
  }
  return <div>No error</div>;
}

describe('ErrorBoundary', () => {
  it('renders children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <div>Child content</div>
      </ErrorBoundary>
    );

    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  it('renders fallback UI when error occurs', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(
      screen.getByText(/An unexpected error occurred/)
    ).toBeInTheDocument();
  });

  it('renders custom fallback when provided', () => {
    render(
      <ErrorBoundary fallback={<div>Custom error page</div>}>
        <ThrowingComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Custom error page')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });

  it('shows Try Again button', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    );

    expect(
      screen.getByRole('button', { name: 'Try Again' })
    ).toBeInTheDocument();
  });

  it('calls onError callback when error occurs', () => {
    const onError = vi.fn();

    render(
      <ErrorBoundary onError={onError}>
        <ThrowingComponent />
      </ErrorBoundary>
    );

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        componentStack: expect.any(String),
      })
    );
  });

  it('resets error state when Try Again is clicked', () => {
    // Use a controllable component
    let shouldThrow = true;
    function ControlledComponent() {
      if (shouldThrow) {
        throw new Error('Controlled error');
      }
      return <div>Recovered content</div>;
    }

    const { rerender } = render(
      <ErrorBoundary>
        <ControlledComponent />
      </ErrorBoundary>
    );

    // Verify error state
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    // Fix the error condition
    shouldThrow = false;

    // Click Try Again
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));

    // Force re-render
    rerender(
      <ErrorBoundary>
        <ControlledComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Recovered content')).toBeInTheDocument();
  });

  it('shows error details in development mode', () => {
    // Vite sets import.meta.env.DEV = true in test environment
    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    );

    // Look for the details element
    const details = screen.getByText('Error Details (Dev Mode)');
    expect(details).toBeInTheDocument();
  });
});

describe('withErrorBoundary HOC', () => {
  it('wraps component with error boundary', () => {
    function SafeComponent() {
      return <div>Safe content</div>;
    }

    const WrappedComponent = withErrorBoundary(SafeComponent);
    render(<WrappedComponent />);

    expect(screen.getByText('Safe content')).toBeInTheDocument();
  });

  it('catches errors from wrapped component', () => {
    const WrappedThrower = withErrorBoundary(ThrowingComponent);
    render(<WrappedThrower />);

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('uses custom fallback when provided', () => {
    const WrappedThrower = withErrorBoundary(
      ThrowingComponent,
      <div>HOC custom fallback</div>
    );
    render(<WrappedThrower />);

    expect(screen.getByText('HOC custom fallback')).toBeInTheDocument();
  });

  it('calls onError from HOC', () => {
    const onError = vi.fn();
    const WrappedThrower = withErrorBoundary(
      ThrowingComponent,
      undefined,
      onError
    );
    render(<WrappedThrower />);

    expect(onError).toHaveBeenCalled();
  });

  it('sets correct displayName', () => {
    function NamedComponent() {
      return <div>Named</div>;
    }

    const Wrapped = withErrorBoundary(NamedComponent);
    expect(Wrapped.displayName).toBe('WithErrorBoundary(NamedComponent)');
  });
});
