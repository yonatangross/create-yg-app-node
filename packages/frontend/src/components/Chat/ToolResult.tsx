/**
 * ToolResult Component
 * Renders tool execution result with success/error states
 */

interface ToolResultProps {
  toolCallId: string;
  result: string;
  isError?: boolean;
}

export function ToolResult({
  toolCallId,
  result,
  isError = false,
}: ToolResultProps) {
  return (
    <div
      className="mt-2 rounded-[var(--radius-tool)] border animate-tool-expand"
      style={{
        backgroundColor: isError
          ? 'var(--color-tool-error-bg)'
          : 'var(--color-tool-success-bg)',
        borderColor: isError
          ? 'var(--color-tool-error-border)'
          : 'var(--color-tool-success-border)',
        padding: 'var(--spacing-tool-inset)',
      }}
      data-tool-call-id={toolCallId}
    >
      <div className="flex items-start gap-2">
        {/* Status Icon */}
        <div
          className="flex-shrink-0 w-5 h-5 flex items-center justify-center"
          style={{
            color: isError
              ? 'var(--color-tool-error-icon)'
              : 'var(--color-tool-success-icon)',
          }}
        >
          {isError ? (
            <svg
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
          ) : (
            <svg
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          )}
        </div>

        {/* Result Content */}
        <div className="flex-1 min-w-0">
          <div
            className="font-medium text-sm mb-1"
            style={{
              color: isError
                ? 'var(--color-tool-error-text)'
                : 'var(--color-tool-result-text)',
            }}
          >
            {isError ? 'Error' : 'Result'}
          </div>

          <pre
            className="text-xs overflow-x-auto whitespace-pre-wrap break-words"
            style={{
              fontFamily: 'var(--font-family-mono)',
              color: isError
                ? 'var(--color-tool-error-text)'
                : 'var(--color-tool-result-text)',
              opacity: 0.9,
            }}
          >
            {result}
          </pre>
        </div>
      </div>
    </div>
  );
}
