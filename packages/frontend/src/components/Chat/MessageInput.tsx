/**
 * MessageInput Component
 * Form with React 19's useActionState pattern
 */

import { useActionState } from 'react';
import { SubmitButton } from './SubmitButton';

interface FormState {
  errors?:
    | {
        message?: string | undefined;
        form?: string | undefined;
      }
    | undefined;
  success?: boolean | undefined;
}

interface MessageInputProps {
  onSubmit: (prevState: FormState, formData: FormData) => Promise<FormState>;
  disabled?: boolean | undefined;
}

export function MessageInput({ onSubmit, disabled }: MessageInputProps) {
  const [state, formAction] = useActionState(onSubmit, { errors: {} });
  const hasMessageError = !!state.errors?.message;
  const hasFormError = !!state.errors?.form;

  return (
    <form
      action={formAction}
      className="border-t border-gray-200 dark:border-gray-700 p-4"
      aria-label="Send a message"
    >
      <div className="flex gap-2">
        <div className="flex-1">
          <label htmlFor="message-input" className="sr-only">
            Type your message. Press Enter to send, Shift+Enter for new line.
          </label>
          <textarea
            id="message-input"
            name="message"
            rows={1}
            placeholder="Type your message..."
            disabled={disabled}
            aria-required="true"
            aria-invalid={hasMessageError}
            aria-describedby={
              hasMessageError ? 'message-error' : 'keyboard-hint'
            }
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white resize-none"
            onKeyDown={(e) => {
              // Submit on Enter (without Shift)
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <div id="keyboard-hint" className="sr-only">
            Press Enter to send, or Shift plus Enter for a new line
          </div>
          {hasMessageError && (
            <p
              id="message-error"
              className="text-red-500 text-sm mt-1"
              role="alert"
              aria-live="polite"
            >
              {state.errors?.message}
            </p>
          )}
        </div>
        <SubmitButton disabled={disabled ?? undefined} />
      </div>
      {hasFormError && (
        <p
          className="text-red-500 text-sm mt-2"
          role="alert"
          aria-live="assertive"
        >
          {state.errors?.form}
        </p>
      )}
    </form>
  );
}
