---
name: react-19-patterns
description: Use this skill for building UIs with React 19.2. Provides patterns for useActionState, useFormStatus, useOptimistic, Server Components, and React Compiler.
version: 1.0.0
author: YG Node Starter
tags: [react, frontend, typescript, hooks, forms]
---

# React 19.2 Patterns (December 2025)

> **Version**: react 19.2.3 | react-dom 19.2.3

## New React 19 Features

### useActionState (replaces useFormState)

```tsx
import { useActionState } from "react";

interface FormState {
  message: string;
  errors: Record<string, string>;
}

async function submitAction(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  // Validate
  if (!email.includes("@")) {
    return {
      message: "",
      errors: { email: "Invalid email address" },
    };
  }

  // Submit to API
  const res = await fetch("/api/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    return {
      message: "",
      errors: { form: "Login failed" },
    };
  }

  return { message: "Success!", errors: {} };
}

function LoginForm() {
  const [state, formAction, isPending] = useActionState(submitAction, {
    message: "",
    errors: {},
  });

  return (
    <form action={formAction}>
      <input name="email" type="email" disabled={isPending} />
      {state.errors.email && <span>{state.errors.email}</span>}

      <input name="password" type="password" disabled={isPending} />

      <button type="submit" disabled={isPending}>
        {isPending ? "Logging in..." : "Login"}
      </button>

      {state.message && <p>{state.message}</p>}
      {state.errors.form && <p className="error">{state.errors.form}</p>}
    </form>
  );
}
```

### useFormStatus

```tsx
import { useFormStatus } from "react-dom";

function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending, data, method, action } = useFormStatus();

  return (
    <button type="submit" disabled={pending}>
      {pending ? (
        <span className="flex items-center gap-2">
          <Spinner />
          Submitting...
        </span>
      ) : (
        children
      )}
    </button>
  );
}

// Use in form
function ContactForm() {
  return (
    <form action={submitAction}>
      <input name="message" />
      <SubmitButton>Send Message</SubmitButton>
    </form>
  );
}
```

### useOptimistic

```tsx
import { useOptimistic, useTransition } from "react";

interface Todo {
  id: string;
  text: string;
  completed: boolean;
}

function TodoList({ todos }: { todos: Todo[] }) {
  const [optimisticTodos, addOptimisticTodo] = useOptimistic(
    todos,
    (state, newTodo: Todo) => [...state, newTodo]
  );
  const [isPending, startTransition] = useTransition();

  async function handleAdd(formData: FormData) {
    const text = formData.get("text") as string;
    const optimisticTodo = {
      id: crypto.randomUUID(),
      text,
      completed: false,
    };

    startTransition(async () => {
      addOptimisticTodo(optimisticTodo);
      await createTodo(text); // API call
    });
  }

  return (
    <div>
      <form action={handleAdd}>
        <input name="text" placeholder="New todo..." />
        <button type="submit">Add</button>
      </form>

      <ul>
        {optimisticTodos.map((todo) => (
          <li key={todo.id} style={{ opacity: todo.id.startsWith("temp") ? 0.5 : 1 }}>
            {todo.text}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

### use() Hook

```tsx
import { use, Suspense } from "react";

// Read promises directly in render
function UserProfile({ userPromise }: { userPromise: Promise<User> }) {
  const user = use(userPromise);

  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
    </div>
  );
}

// With Suspense
function App() {
  const userPromise = fetchUser(userId);

  return (
    <Suspense fallback={<UserSkeleton />}>
      <UserProfile userPromise={userPromise} />
    </Suspense>
  );
}

// Read context conditionally
function ThemeIcon({ showIcon }: { showIcon: boolean }) {
  if (!showIcon) return null;

  const theme = use(ThemeContext); // Can call conditionally!
  return <Icon name={theme === "dark" ? "moon" : "sun"} />;
}
```

### Document Metadata

```tsx
// title, meta, link now work in components
function BlogPost({ post }: { post: Post }) {
  return (
    <article>
      <title>{post.title} | My Blog</title>
      <meta name="description" content={post.excerpt} />
      <meta property="og:title" content={post.title} />
      <link rel="canonical" href={`https://myblog.com/posts/${post.slug}`} />

      <h1>{post.title}</h1>
      <p>{post.content}</p>
    </article>
  );
}
```

### ref as Prop (No forwardRef needed)

```tsx
// Before React 19 (old pattern)
const OldInput = forwardRef<HTMLInputElement, InputProps>((props, ref) => (
  <input ref={ref} {...props} />
));

// React 19 - ref is just a prop!
function Input({ ref, ...props }: { ref?: React.Ref<HTMLInputElement> } & InputProps) {
  return <input ref={ref} {...props} />;
}

// Usage
function Form() {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <form>
      <Input ref={inputRef} placeholder="Email" />
      <button onClick={() => inputRef.current?.focus()}>Focus</button>
    </form>
  );
}
```

### Cleanup in ref Callbacks

```tsx
function VideoPlayer({ src }: { src: string }) {
  return (
    <video
      ref={(video) => {
        if (video) {
          video.play();
        }
        // Cleanup function (new in React 19!)
        return () => {
          video?.pause();
        };
      }}
      src={src}
    />
  );
}
```

## React Compiler (Beta)

```typescript
// vite.config.ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [["babel-plugin-react-compiler", {}]],
      },
    }),
  ],
});
```

```tsx
// No more useMemo/useCallback needed!
// Compiler automatically memoizes

function ExpensiveList({ items, filter }: Props) {
  // Compiler memoizes this computation
  const filteredItems = items.filter((item) => item.name.includes(filter));

  // Compiler memoizes this callback
  const handleClick = (id: string) => {
    console.log("Clicked:", id);
  };

  return (
    <ul>
      {filteredItems.map((item) => (
        <li key={item.id} onClick={() => handleClick(item.id)}>
          {item.name}
        </li>
      ))}
    </ul>
  );
}
```

## TanStack Query Integration

```tsx
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useActionState } from "react";

function CreateUserForm() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (data: CreateUserData) => {
      const res = await fetch("/api/users", {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Failed to create user");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });

  const [state, formAction, isPending] = useActionState(
    async (_prev: FormState, formData: FormData) => {
      try {
        await mutation.mutateAsync({
          email: formData.get("email") as string,
          name: formData.get("name") as string,
        });
        return { success: true, errors: {} };
      } catch (error) {
        return { success: false, errors: { form: "Failed to create user" } };
      }
    },
    { success: false, errors: {} }
  );

  return (
    <form action={formAction}>
      <input name="email" type="email" required />
      <input name="name" required />
      <button type="submit" disabled={isPending}>
        {isPending ? "Creating..." : "Create User"}
      </button>
    </form>
  );
}
```

## Best Practices

1. **Use useActionState** - Replaces useFormState, better pending handling
2. **useFormStatus in buttons** - Automatic pending state
3. **useOptimistic** - Instant feedback, rollback on error
4. **use() for Suspense** - Read promises directly in render
5. **Drop forwardRef** - ref is now a regular prop
6. **React Compiler** - Remove manual memoization
7. **Document metadata** - title/meta in components, not Helmet
