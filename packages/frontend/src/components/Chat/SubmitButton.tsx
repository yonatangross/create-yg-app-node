/**
 * SubmitButton Component
 * Uses React 19's useFormStatus for pending state
 */

import { useFormStatus } from 'react-dom';

interface SubmitButtonProps {
  disabled?: boolean | undefined;
}

export function SubmitButton({ disabled }: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      aria-label={pending ? 'Sending message, please wait' : 'Send message'}
      aria-busy={pending}
      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
    >
      {pending ? 'Sending...' : 'Send'}
    </button>
  );
}
