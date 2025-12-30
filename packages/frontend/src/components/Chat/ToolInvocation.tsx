/**
 * ToolInvocation Component
 * Renders a tool call with name, input, and status
 */

interface ToolInvocationProps {
  toolCallId: string;
  toolName: string;
  toolInput: unknown;
  status: 'pending' | 'running' | 'complete';
}

export function ToolInvocation({
  toolCallId,
  toolName,
  toolInput,
  status,
}: ToolInvocationProps) {
  const isRunning = status === 'running';

  // Format input for display
  const formatInput = (input: unknown): string => {
    if (input === null || input === undefined) return '';
    if (typeof input === 'string') return input;
    try {
      return JSON.stringify(input, null, 2);
    } catch {
      return String(input);
    }
  };

  const formattedInput = formatInput(toolInput);
  const hasInput = formattedInput.length > 0;

  return (
    <div
      className={`
        mt-2 rounded-[var(--radius-tool)]
        border transition-all duration-[var(--duration-normal)]
        ${isRunning ? 'animate-tool-pulse' : ''}
      `}
      style={{
        backgroundColor: 'var(--color-tool-invoke-bg)',
        borderColor: 'var(--color-tool-invoke-border)',
        padding: 'var(--spacing-tool-inset)',
      }}
      data-tool-call-id={toolCallId}
    >
      <div className="flex items-start gap-2">
        {/* Tool Icon */}
        <div
          className="flex-shrink-0 w-5 h-5 flex items-center justify-center"
          style={{ color: 'var(--color-tool-invoke-icon)' }}
        >
          {isRunning ? (
            <svg
              className="animate-spin"
              fill="none"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                fill="currentColor"
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
                d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z"
              />
            </svg>
          )}
        </div>

        {/* Tool Content */}
        <div className="flex-1 min-w-0">
          <div
            className="font-medium text-sm"
            style={{ color: 'var(--color-tool-invoke-text)' }}
          >
            <span className="opacity-60">Calling</span>{' '}
            <span className="font-semibold">{toolName}</span>
          </div>

          {hasInput && (
            <pre
              className="mt-1 text-xs overflow-x-auto"
              style={{
                fontFamily: 'var(--font-family-mono)',
                color: 'var(--color-tool-invoke-text)',
                opacity: 0.8,
              }}
            >
              {formattedInput}
            </pre>
          )}

          {isRunning && (
            <div
              className="mt-1 text-xs italic"
              style={{ color: 'var(--color-tool-invoke-text)', opacity: 0.7 }}
            >
              Running...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
