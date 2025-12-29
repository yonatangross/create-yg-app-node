---
name: form-with-actions
description: Build forms using React 19 form actions pattern
skills: [react-19-patterns, api-design-framework, testing-strategy-builder]
agents: [frontend-ui-developer, backend-system-architect]
---

# React 19 Form Actions Workflow

## Overview
Create type-safe forms with useActionState, optimistic updates, and proper validation.

## Pattern

```
┌─────────────────────────────────────────────────────────────┐
│                    Form Requirement                          │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌──────────────────────────┐   ┌──────────────────────────────┐
│  BACKEND API             │   │  FRONTEND FORM               │
│                          │   │                              │
│  ├─ Zod schema           │   │  ├─ Form state type          │
│  ├─ Hono endpoint        │   │  ├─ useActionState hook      │
│  └─ Error responses      │   │  ├─ SubmitButton component   │
│                          │   │  └─ Field error display      │
└──────────────────────────┘   └──────────────────────────────┘
              │                               │
              └───────────────┬───────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  INTEGRATION                                                 │
│     ├─ RPC client type inference                             │
│     ├─ Optimistic updates (if list mutation)                 │
│     └─ Form reset on success                                 │
└─────────────────────────────────────────────────────────────┘
```

## React 19 Form Template

```tsx
// frontend/src/components/CreateUserForm.tsx
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

// 1. Define form state type
interface FormState {
  success: boolean;
  message: string;
  errors: {
    email?: string;
    name?: string;
    form?: string;
  };
}

const initialState: FormState = {
  success: false,
  message: "",
  errors: {},
};

// 2. Create action function
async function createUserAction(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const email = formData.get("email") as string;
  const name = formData.get("name") as string;

  // Client-side validation
  const errors: FormState["errors"] = {};
  if (!email.includes("@")) {
    errors.email = "Invalid email address";
  }
  if (name.length < 2) {
    errors.name = "Name must be at least 2 characters";
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, message: "", errors };
  }

  // API call
  try {
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name }),
    });

    if (!res.ok) {
      const error = await res.json();
      return {
        success: false,
        message: "",
        errors: { form: error.message || "Failed to create user" },
      };
    }

    return {
      success: true,
      message: "User created successfully!",
      errors: {},
    };
  } catch {
    return {
      success: false,
      message: "",
      errors: { form: "Network error. Please try again." },
    };
  }
}

// 3. Submit button with useFormStatus
function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
    >
      {pending ? "Creating..." : "Create User"}
    </button>
  );
}

// 4. Form component with useActionState
export function CreateUserForm() {
  const [state, formAction, isPending] = useActionState(
    createUserAction,
    initialState
  );

  return (
    <form action={formAction} className="space-y-4">
      {state.success && (
        <div className="p-3 bg-green-100 text-green-800 rounded">
          {state.message}
        </div>
      )}

      {state.errors.form && (
        <div className="p-3 bg-red-100 text-red-800 rounded">
          {state.errors.form}
        </div>
      )}

      <div>
        <label htmlFor="email" className="block text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          disabled={isPending}
          className="mt-1 block w-full rounded border p-2"
        />
        {state.errors.email && (
          <p className="mt-1 text-sm text-red-600">{state.errors.email}</p>
        )}
      </div>

      <div>
        <label htmlFor="name" className="block text-sm font-medium">
          Name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          disabled={isPending}
          className="mt-1 block w-full rounded border p-2"
        />
        {state.errors.name && (
          <p className="mt-1 text-sm text-red-600">{state.errors.name}</p>
        )}
      </div>

      <SubmitButton />
    </form>
  );
}
```

## With Optimistic Updates

```tsx
import { useOptimistic, useTransition } from "react";

interface User {
  id: string;
  email: string;
  name: string;
}

function UserList({ users }: { users: User[] }) {
  const [optimisticUsers, addOptimisticUser] = useOptimistic(
    users,
    (state, newUser: User) => [...state, { ...newUser, pending: true }]
  );
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(formData: FormData) {
    const optimisticUser = {
      id: crypto.randomUUID(),
      email: formData.get("email") as string,
      name: formData.get("name") as string,
    };

    startTransition(async () => {
      addOptimisticUser(optimisticUser);

      await fetch("/api/users", {
        method: "POST",
        body: JSON.stringify(optimisticUser),
        headers: { "Content-Type": "application/json" },
      });
    });
  }

  return (
    <div>
      <form action={handleSubmit}>
        <input name="email" type="email" required />
        <input name="name" required />
        <button type="submit">Add User</button>
      </form>

      <ul>
        {optimisticUsers.map((user) => (
          <li
            key={user.id}
            style={{ opacity: user.pending ? 0.5 : 1 }}
          >
            {user.name} ({user.email})
          </li>
        ))}
      </ul>
    </div>
  );
}
```

## Testing Template

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { CreateUserForm } from "./CreateUserForm";

const server = setupServer(
  http.post("/api/users", async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ id: "1", ...body });
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

test("submits form successfully", async () => {
  const user = userEvent.setup();
  render(<CreateUserForm />);

  await user.type(screen.getByLabelText(/email/i), "test@example.com");
  await user.type(screen.getByLabelText(/name/i), "John Doe");
  await user.click(screen.getByRole("button", { name: /create/i }));

  expect(await screen.findByText(/success/i)).toBeInTheDocument();
});

test("shows validation errors", async () => {
  const user = userEvent.setup();
  render(<CreateUserForm />);

  await user.type(screen.getByLabelText(/email/i), "invalid");
  await user.type(screen.getByLabelText(/name/i), "J");
  await user.click(screen.getByRole("button", { name: /create/i }));

  expect(await screen.findByText(/invalid email/i)).toBeInTheDocument();
  expect(screen.getByText(/at least 2 characters/i)).toBeInTheDocument();
});
```

## Checklist

- [ ] FormState type with errors object
- [ ] useActionState with initial state
- [ ] SubmitButton with useFormStatus
- [ ] Field-level error display
- [ ] Form-level error display
- [ ] Success message display
- [ ] isPending state for input disabled
- [ ] Optional: useOptimistic for list mutations
- [ ] MSW tests for success and error cases
