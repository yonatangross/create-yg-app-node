/**
 * React 19 Form Component Template
 * With useActionState, validation, and error handling
 */

import { useActionState, useRef, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { z } from "zod";

// =============================================================================
// Types
// =============================================================================

const formSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  message: z.string().min(10, "Message must be at least 10 characters"),
});

type FormData = z.infer<typeof formSchema>;

interface FormState {
  errors: Partial<Record<keyof FormData, string[]>>;
  message: string | null;
  success: boolean;
}

// =============================================================================
// Server Action
// =============================================================================

async function submitForm(
  prevState: FormState,
  formData: globalThis.FormData
): Promise<FormState> {
  // Parse form data
  const rawData = {
    name: formData.get("name"),
    email: formData.get("email"),
    message: formData.get("message"),
  };

  // Validate with Zod
  const result = formSchema.safeParse(rawData);

  if (!result.success) {
    return {
      errors: result.error.flatten().fieldErrors as FormState["errors"],
      message: "Please fix the errors below",
      success: false,
    };
  }

  // Simulate API call
  try {
    const response = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result.data),
    });

    if (!response.ok) {
      throw new Error("Failed to submit");
    }

    return {
      errors: {},
      message: "Form submitted successfully!",
      success: true,
    };
  } catch {
    return {
      errors: {},
      message: "An error occurred. Please try again.",
      success: false,
    };
  }
}

// =============================================================================
// Submit Button (uses useFormStatus)
// =============================================================================

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? (
        <span className="flex items-center justify-center gap-2">
          <Spinner />
          Submitting...
        </span>
      ) : (
        "Submit"
      )}
    </button>
  );
}

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        strokeWidth="4"
        className="opacity-25"
      />
      <path
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        fill="currentColor"
        className="opacity-75"
      />
    </svg>
  );
}

// =============================================================================
// Form Field Component
// =============================================================================

interface FormFieldProps {
  name: string;
  label: string;
  type?: "text" | "email" | "textarea";
  placeholder?: string;
  errors?: string[];
  required?: boolean;
}

function FormField({
  name,
  label,
  type = "text",
  placeholder,
  errors,
  required = false,
}: FormFieldProps) {
  const inputClasses = `
    w-full rounded-lg border px-3 py-2 transition-colors
    focus:outline-none focus:ring-2 focus:ring-blue-500
    ${errors?.length ? "border-red-500" : "border-gray-300"}
  `;

  return (
    <div className="space-y-1">
      <label htmlFor={name} className="block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500">*</span>}
      </label>

      {type === "textarea" ? (
        <textarea
          id={name}
          name={name}
          placeholder={placeholder}
          required={required}
          rows={4}
          className={inputClasses}
        />
      ) : (
        <input
          id={name}
          name={name}
          type={type}
          placeholder={placeholder}
          required={required}
          className={inputClasses}
        />
      )}

      {errors?.map((error) => (
        <p key={error} className="text-sm text-red-600">
          {error}
        </p>
      ))}
    </div>
  );
}

// =============================================================================
// Main Form Component
// =============================================================================

const initialState: FormState = {
  errors: {},
  message: null,
  success: false,
};

export function ContactForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState(
    submitForm,
    initialState
  );

  // Reset form on success
  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
    }
  }, [state.success]);

  return (
    <div className="mx-auto max-w-md rounded-xl bg-white p-6 shadow-lg">
      <h2 className="mb-6 text-2xl font-bold text-gray-900">Contact Us</h2>

      {/* Status Message */}
      {state.message && (
        <div
          className={`mb-4 rounded-lg p-3 ${
            state.success
              ? "bg-green-100 text-green-800"
              : "bg-red-100 text-red-800"
          }`}
        >
          {state.message}
        </div>
      )}

      <form ref={formRef} action={formAction} className="space-y-4">
        <FormField
          name="name"
          label="Name"
          placeholder="John Doe"
          errors={state.errors.name}
          required
        />

        <FormField
          name="email"
          label="Email"
          type="email"
          placeholder="john@example.com"
          errors={state.errors.email}
          required
        />

        <FormField
          name="message"
          label="Message"
          type="textarea"
          placeholder="How can we help you?"
          errors={state.errors.message}
          required
        />

        <SubmitButton />
      </form>

      {/* Form works without JS (progressive enhancement) */}
      <noscript>
        <p className="mt-4 text-sm text-gray-500">
          JavaScript is required for the best experience.
        </p>
      </noscript>
    </div>
  );
}

// =============================================================================
// Usage Example
// =============================================================================

/*
import { ContactForm } from "./ContactForm";

function ContactPage() {
  return (
    <main className="min-h-screen bg-gray-100 py-12">
      <ContactForm />
    </main>
  );
}
*/
