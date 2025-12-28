# React 19 Forms

## useActionState (replaces useFormState)

```tsx
import { useActionState } from "react";

// Server Action
async function createUser(prevState: FormState, formData: FormData) {
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;

  // Validation
  if (!email.includes("@")) {
    return { error: "Invalid email", success: false };
  }

  // API call
  const response = await fetch("/api/users", {
    method: "POST",
    body: JSON.stringify({ name, email }),
  });

  if (!response.ok) {
    return { error: "Failed to create user", success: false };
  }

  return { error: null, success: true };
}

// Component
function UserForm() {
  const [state, formAction, isPending] = useActionState(createUser, {
    error: null,
    success: false,
  });

  return (
    <form action={formAction}>
      <input name="name" placeholder="Name" required />
      <input name="email" type="email" placeholder="Email" required />

      {state.error && <p className="error">{state.error}</p>}
      {state.success && <p className="success">User created!</p>}

      <button type="submit" disabled={isPending}>
        {isPending ? "Creating..." : "Create User"}
      </button>
    </form>
  );
}
```

## useFormStatus

```tsx
import { useFormStatus } from "react-dom";

// Must be used inside a form - reads status from parent form
function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending, data, method, action } = useFormStatus();

  return (
    <button type="submit" disabled={pending}>
      {pending ? "Submitting..." : children}
    </button>
  );
}

// Usage
function ContactForm() {
  async function handleSubmit(formData: FormData) {
    "use server";
    // Process form...
  }

  return (
    <form action={handleSubmit}>
      <input name="message" />
      <SubmitButton>Send Message</SubmitButton>
    </form>
  );
}
```

## Form with Validation

```tsx
import { useActionState } from "react";
import { z } from "zod";

const schema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Password must be 8+ characters"),
});

type FormState = {
  errors: Record<string, string[]>;
  success: boolean;
};

async function loginAction(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const rawData = {
    email: formData.get("email"),
    password: formData.get("password"),
  };

  const result = schema.safeParse(rawData);

  if (!result.success) {
    return {
      errors: result.error.flatten().fieldErrors,
      success: false,
    };
  }

  // Proceed with login...
  return { errors: {}, success: true };
}

function LoginForm() {
  const [state, action, isPending] = useActionState(loginAction, {
    errors: {},
    success: false,
  });

  return (
    <form action={action}>
      <div>
        <input name="email" type="email" placeholder="Email" />
        {state.errors.email?.map((error) => (
          <p key={error} className="error">
            {error}
          </p>
        ))}
      </div>

      <div>
        <input name="password" type="password" placeholder="Password" />
        {state.errors.password?.map((error) => (
          <p key={error} className="error">
            {error}
          </p>
        ))}
      </div>

      <button disabled={isPending}>
        {isPending ? "Logging in..." : "Login"}
      </button>
    </form>
  );
}
```

## Progressive Enhancement

```tsx
// Form works without JavaScript (progressive enhancement)
function EnhancedForm() {
  const [state, formAction, isPending] = useActionState(submitAction, null);

  return (
    <form action={formAction}>
      {/* Works as regular form submission without JS */}
      <input name="query" defaultValue="" />

      {/* Enhanced with JS */}
      <button type="submit" disabled={isPending}>
        {isPending ? <Spinner /> : "Search"}
      </button>

      {/* Results only show with JS */}
      {state?.results && <SearchResults results={state.results} />}
    </form>
  );
}
```

## Form Reset After Success

```tsx
import { useActionState, useRef, useEffect } from "react";

function FormWithReset() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, isPending] = useActionState(submitAction, {
    success: false,
  });

  // Reset form on success
  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
    }
  }, [state.success]);

  return (
    <form ref={formRef} action={action}>
      <input name="message" />
      <button disabled={isPending}>Send</button>
    </form>
  );
}
```

## Key Differences from React 18

| React 18                  | React 19                  |
| ------------------------- | ------------------------- |
| `useFormState` (react-dom)| `useActionState` (react)  |
| Returns `[state, action]` | Returns `[state, action, isPending]` |
| Need separate `useFormStatus` for pending | Built-in `isPending` |
| `formAction` prop         | `action` prop on form     |

## Best Practices

1. **Use Zod for validation** - Type-safe schema validation
2. **Handle errors gracefully** - Show field-level errors
3. **Disable during pending** - Prevent double submissions
4. **Progressive enhancement** - Forms work without JS
5. **Reset on success** - Clear form after successful submission
