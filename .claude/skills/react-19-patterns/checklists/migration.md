# React 19 Migration Checklist

## Pre-Migration

- [ ] **Review breaking changes** - Read React 19 release notes
- [ ] **Check dependencies** - Ensure libraries support React 19
- [ ] **Test coverage** - Have tests before migrating
- [ ] **Backup branch** - Create pre-migration branch

## Package Updates

```bash
# Update React packages
pnpm update react@^19 react-dom@^19

# Update types
pnpm update -D @types/react@^19 @types/react-dom@^19

# Check for peer dependency issues
pnpm why react
```

## Breaking Changes

### forwardRef → ref as Prop

- [ ] **Find forwardRef usage**

```bash
grep -r "forwardRef" src/
```

- [ ] **Convert pattern**

```tsx
// Before (React 18)
const Button = forwardRef<HTMLButtonElement, ButtonProps>((props, ref) => {
  return <button ref={ref} {...props} />;
});

// After (React 19)
function Button({
  ref,
  ...props
}: ButtonProps & { ref?: React.Ref<HTMLButtonElement> }) {
  return <button ref={ref} {...props} />;
}
```

### useFormState → useActionState

- [ ] **Find useFormState usage**

```bash
grep -r "useFormState" src/
```

- [ ] **Update imports**

```tsx
// Before
import { useFormState } from "react-dom";
const [state, action] = useFormState(fn, initial);

// After
import { useActionState } from "react";
const [state, action, isPending] = useActionState(fn, initial);
```

### Context Changes

- [ ] **Remove Context.Provider wrapper** (if using default value)

```tsx
// Before
<ThemeContext.Provider value={theme}>
  {children}
</ThemeContext.Provider>

// After (if default is sufficient)
<ThemeContext value={theme}>
  {children}
</ThemeContext>
```

### Ref Cleanup Functions

- [ ] **Add cleanup to ref callbacks**

```tsx
// Before (might leak)
<div ref={(el) => observer.observe(el)} />

// After (with cleanup)
<div
  ref={(el) => {
    if (el) observer.observe(el);
    return () => observer.disconnect();
  }}
/>
```

## New Features to Adopt

### useOptimistic

- [ ] **Identify optimistic update candidates**
  - Like/unlike buttons
  - Todo toggles
  - Comment submissions
  - Cart updates

- [ ] **Implement pattern**

```tsx
const [optimisticLikes, addOptimisticLike] = useOptimistic(
  likes,
  (state, delta: number) => state + delta
);
```

### use() Hook

- [ ] **Replace promise-in-useEffect patterns**

```tsx
// Before
const [data, setData] = useState(null);
useEffect(() => {
  dataPromise.then(setData);
}, [dataPromise]);

// After
const data = use(dataPromise);
```

### Document Metadata

- [ ] **Move meta tags to components**

```tsx
// Before (in _document.tsx or helmet)
<Helmet>
  <title>Page Title</title>
</Helmet>

// After (in component)
function Page() {
  return (
    <>
      <title>Page Title</title>
      <meta name="description" content="..." />
      {/* content */}
    </>
  );
}
```

## React Compiler (Optional)

- [ ] **Install compiler**

```bash
pnpm add -D babel-plugin-react-compiler eslint-plugin-react-compiler
```

- [ ] **Configure Vite**

```typescript
// vite.config.ts
react({
  babel: {
    plugins: [["babel-plugin-react-compiler", {}]],
  },
});
```

- [ ] **Remove manual memoization** (after compiler is stable)
  - Remove `useMemo` for simple calculations
  - Remove `useCallback` for event handlers
  - Remove `React.memo` wrappers

- [ ] **Add ESLint rules**

## Testing

- [ ] **Run existing tests**

```bash
pnpm test
```

- [ ] **Test forms** - Verify useActionState works
- [ ] **Test refs** - Verify ref forwarding still works
- [ ] **Test Suspense** - Verify loading states
- [ ] **Test optimistic updates** - Verify rollback on error

## Type Updates

- [ ] **Fix ref type errors**

```tsx
// Common fix
function Component({ ref }: { ref?: React.Ref<HTMLDivElement> }) {
  return <div ref={ref} />;
}
```

- [ ] **Update form action types**

```tsx
async function action(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  // ...
}
```

## Performance Verification

- [ ] **Profile before/after** - Use React DevTools Profiler
- [ ] **Check bundle size** - Verify no increase
- [ ] **Verify hydration** - No mismatch warnings

## Rollback Plan

```bash
# If issues arise
git checkout pre-react-19-migration

# Downgrade packages
pnpm add react@^18 react-dom@^18
pnpm add -D @types/react@^18 @types/react-dom@^18
```

## Sign-off

| Step                  | Completed | By  | Date |
| --------------------- | --------- | --- | ---- |
| Package updates       | ☐         |     |      |
| forwardRef migration  | ☐         |     |      |
| useFormState → useActionState | ☐ |     |      |
| Ref cleanup added     | ☐         |     |      |
| Tests passing         | ☐         |     |      |
| Performance verified  | ☐         |     |      |
| Deployed to staging   | ☐         |     |      |
| Production deployment | ☐         |     |      |

## Common Issues

### TypeScript Errors

```typescript
// Error: Property 'ref' does not exist
// Fix: Add ref to props type
type Props = {
  ref?: React.Ref<HTMLElement>;
  // ... other props
};
```

### useFormStatus Not Working

```tsx
// ❌ Won't work - not inside form
function Page() {
  const { pending } = useFormStatus(); // Always false
  return <form>...</form>;
}

// ✅ Must be inside form component
function SubmitButton() {
  const { pending } = useFormStatus(); // Works!
  return <button disabled={pending}>Submit</button>;
}
```

### Optimistic Updates Not Reverting

```tsx
// ❌ Missing transition wrapper
addOptimisticItem(item);
await api.create(item); // Error won't trigger rollback

// ✅ Wrap in transition
startTransition(async () => {
  addOptimisticItem(item);
  await api.create(item); // Rollback on error
});
```
