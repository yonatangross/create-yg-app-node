/**
 * Error Boundary Component
 * Catches JavaScript errors in child component tree and displays fallback UI
 *
 * Follows React 19 patterns with proper TypeScript types
 */

import { Component, type ReactNode, type ErrorInfo } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional fallback UI to display when error occurs */
  fallback?: ReactNode | undefined;
  /** Callback when error is caught (for logging to Langfuse, Sentry, etc.) */
  onError?: ((error: Error, errorInfo: ErrorInfo) => void) | undefined;
}

// Check for development mode using process.env for broader compatibility
const isDev = import.meta.env?.DEV ?? process.env.NODE_ENV === 'development';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Production-ready Error Boundary with customizable fallback
 *
 * @example
 * <ErrorBoundary
 *   fallback={<ErrorPage />}
 *   onError={(error) => langfuse.captureException(error)}
 * >
 *   <App />
 * </ErrorBoundary>
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Update state so the next render shows the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error to external service
    this.setState({ errorInfo });

    // Call optional error handler (for Langfuse, Sentry, etc.)
    this.props.onError?.(error, errorInfo);

    // In development, error details are shown in the UI (see render method)
    // In production, use the onError callback for external logging (Langfuse, Sentry)
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="min-h-[400px] flex flex-col items-center justify-center p-8 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <div className="text-center max-w-md">
            <div className="text-6xl mb-4">⚠️</div>
            <h2 className="text-2xl font-bold text-red-700 dark:text-red-300 mb-2">
              Something went wrong
            </h2>
            <p className="text-red-600 dark:text-red-400 mb-4">
              An unexpected error occurred. Please try again.
            </p>

            {/* Show error details in development */}
            {isDev && this.state.error && (
              <details className="text-left mb-4 p-4 bg-red-100 dark:bg-red-900/30 rounded text-sm">
                <summary className="cursor-pointer font-medium text-red-800 dark:text-red-200">
                  Error Details (Dev Mode)
                </summary>
                <pre className="mt-2 overflow-auto text-xs text-red-700 dark:text-red-300">
                  {this.state.error.message}
                  {'\n\n'}
                  {this.state.error.stack}
                </pre>
              </details>
            )}

            <button
              onClick={this.handleReset}
              className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Hook-friendly wrapper for Error Boundary
 * Provides error state that can be used with React hooks
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  fallback?: ReactNode,
  onError?: (error: Error, errorInfo: ErrorInfo) => void
): React.FC<P> {
  const WithErrorBoundary: React.FC<P> = (props) => (
    <ErrorBoundary fallback={fallback} onError={onError}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  );

  WithErrorBoundary.displayName = `WithErrorBoundary(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;

  return WithErrorBoundary;
}
