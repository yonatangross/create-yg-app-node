# Frontend Code Quality Rules (React 19)

## Pre-Commit Checklist

Before any commit, ensure ALL checks pass:

```bash
# From /frontend directory
pnpm run check

# Individual checks
pnpm run format:check   # Prettier
pnpm run lint           # ESLint
pnpm run typecheck      # TypeScript
pnpm run test:run       # Vitest
```

---

## React 19 Patterns

### Server Components vs Client Components
```typescript
// Default: Server Component (no directive needed)
export function UserList() {
  // Can use async/await directly
  const users = await fetchUsers();
  return <ul>{users.map(u => <li key={u.id}>{u.name}</li>)}</ul>;
}

// Client Component (needs directive)
'use client';
export function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>;
}
```

### Use Hook (React 19)
```typescript
// ✅ New React 19 pattern
import { use } from 'react';

function UserProfile({ userPromise }: { userPromise: Promise<User> }) {
  const user = use(userPromise);
  return <div>{user.name}</div>;
}
```

### Actions (React 19)
```typescript
'use client';
import { useActionState } from 'react';

function CreateForm() {
  const [state, formAction, isPending] = useActionState(createUser, null);

  return (
    <form action={formAction}>
      <input name="email" type="email" />
      <button disabled={isPending}>
        {isPending ? 'Creating...' : 'Create'}
      </button>
      {state?.error && <p className="error">{state.error}</p>}
    </form>
  );
}
```

---

## Component Structure

### File Organization
```
src/
├── components/
│   ├── ui/              # Reusable UI primitives
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   └── index.ts
│   ├── features/        # Feature-specific components
│   │   └── UserCard.tsx
│   └── layouts/         # Layout components
│       └── MainLayout.tsx
├── pages/               # Route pages
├── hooks/               # Custom hooks
├── lib/                 # Utilities
└── types/               # TypeScript types
```

### Component Template
```typescript
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends ComponentProps<'button'> {
  variant?: 'primary' | 'secondary';
  isLoading?: boolean;
}

export function Button({
  variant = 'primary',
  isLoading,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'px-4 py-2 rounded font-medium',
        variant === 'primary' && 'bg-blue-600 text-white',
        variant === 'secondary' && 'bg-gray-200 text-gray-800',
        className
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? 'Loading...' : children}
    </button>
  );
}
```

---

## TypeScript Standards

### Props Typing
```typescript
// ✅ Good - Interface for props
interface UserCardProps {
  user: User;
  onEdit?: (id: string) => void;
}

// ✅ Good - Extending native elements
interface InputProps extends ComponentProps<'input'> {
  label: string;
  error?: string;
}

// ❌ Bad - Using any
function Component(props: any) {}
```

### Event Handlers
```typescript
// ✅ Good - Typed event handlers
function handleSubmit(e: FormEvent<HTMLFormElement>) {
  e.preventDefault();
  const formData = new FormData(e.currentTarget);
}

function handleChange(e: ChangeEvent<HTMLInputElement>) {
  setValue(e.target.value);
}
```

---

## TanStack Query Patterns

### Query Setup
```typescript
// lib/queryClient.ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});
```

### Custom Hooks
```typescript
// hooks/useUsers.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: () => api.get<User[]>('/api/users'),
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateUserInput) => api.post('/api/users', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}
```

### Usage in Components
```typescript
function UserList() {
  const { data: users, isLoading, error } = useUsers();

  if (isLoading) return <Skeleton />;
  if (error) return <ErrorMessage error={error} />;

  return (
    <ul>
      {users?.map(user => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  );
}
```

---

## TailwindCSS Patterns

### Utility Function
```typescript
// lib/utils.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

### Responsive Design
```typescript
<div className="
  grid
  grid-cols-1
  md:grid-cols-2
  lg:grid-cols-3
  gap-4
">
  {items.map(item => <Card key={item.id} {...item} />)}
</div>
```

### Dark Mode
```typescript
<div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
  Content
</div>
```

---

## Testing Standards

### Component Testing
```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

describe('Button', () => {
  it('calls onClick when clicked', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click me</Button>);

    await userEvent.click(screen.getByRole('button'));

    expect(onClick).toHaveBeenCalledOnce();
  });

  it('is disabled when isLoading', () => {
    render(<Button isLoading>Submit</Button>);

    expect(screen.getByRole('button')).toBeDisabled();
  });
});
```

### Hook Testing
```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';

describe('useUsers', () => {
  it('fetches users', async () => {
    const { result } = renderHook(() => useUsers(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      ),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(3);
  });
});
```

---

## Accessibility (a11y) Rules

1. **Use semantic HTML**: `<button>`, `<nav>`, `<main>`, `<article>`
2. **Add alt text**: All images must have descriptive alt
3. **Keyboard navigation**: All interactive elements must be keyboard accessible
4. **Focus management**: Visible focus indicators, logical tab order
5. **ARIA labels**: Use when semantic HTML isn't sufficient
6. **Color contrast**: Minimum 4.5:1 ratio for text

```typescript
// ✅ Good - Accessible modal
<dialog
  aria-labelledby="modal-title"
  aria-describedby="modal-description"
  role="dialog"
>
  <h2 id="modal-title">Confirm Action</h2>
  <p id="modal-description">Are you sure?</p>
</dialog>
```

---

## Performance Guidelines

1. **Lazy load routes**: Use `React.lazy()` for route-based code splitting
2. **Memoize expensive computations**: `useMemo`, `useCallback` where needed
3. **Virtualize long lists**: Use `@tanstack/react-virtual`
4. **Optimize images**: Use `loading="lazy"`, proper sizing
5. **Avoid unnecessary re-renders**: Check with React DevTools

---

**Last Updated**: December 2025
