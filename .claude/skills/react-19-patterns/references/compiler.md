# React Compiler (React 19.2+)

## Overview

React Compiler automatically optimizes your React code by adding memoization. It eliminates the need for manual `useMemo`, `useCallback`, and `React.memo` in most cases.

## Installation

```bash
# Install babel plugin
pnpm add -D babel-plugin-react-compiler

# For ESLint integration
pnpm add -D eslint-plugin-react-compiler
```

## Vite Configuration

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

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

## ESLint Configuration

```javascript
// eslint.config.js
import reactCompiler from "eslint-plugin-react-compiler";

export default [
  {
    plugins: {
      "react-compiler": reactCompiler,
    },
    rules: {
      "react-compiler/react-compiler": "error",
    },
  },
];
```

## What the Compiler Optimizes

```tsx
// BEFORE: Manual memoization
function ProductList({ products, filter }: Props) {
  const filteredProducts = useMemo(
    () => products.filter((p) => p.category === filter),
    [products, filter]
  );

  const handleClick = useCallback(
    (id: string) => {
      console.log(`Clicked ${id}`);
    },
    []
  );

  return (
    <ul>
      {filteredProducts.map((product) => (
        <ProductItem
          key={product.id}
          product={product}
          onClick={handleClick}
        />
      ))}
    </ul>
  );
}

const ProductItem = React.memo(({ product, onClick }: ItemProps) => {
  return (
    <li onClick={() => onClick(product.id)}>
      {product.name}
    </li>
  );
});

// AFTER: Compiler handles memoization automatically
function ProductList({ products, filter }: Props) {
  const filteredProducts = products.filter((p) => p.category === filter);

  const handleClick = (id: string) => {
    console.log(`Clicked ${id}`);
  };

  return (
    <ul>
      {filteredProducts.map((product) => (
        <ProductItem
          key={product.id}
          product={product}
          onClick={handleClick}
        />
      ))}
    </ul>
  );
}

function ProductItem({ product, onClick }: ItemProps) {
  return (
    <li onClick={() => onClick(product.id)}>
      {product.name}
    </li>
  );
}
```

## Rules of React (Compiler Enforced)

The compiler requires code to follow React's rules:

```tsx
// ❌ BAD: Mutating props
function BadComponent({ items }: { items: string[] }) {
  items.push("new item"); // Compiler will flag this!
  return <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>;
}

// ✅ GOOD: Create new array
function GoodComponent({ items }: { items: string[] }) {
  const newItems = [...items, "new item"];
  return <ul>{newItems.map((item) => <li key={item}>{item}</li>)}</ul>;
}

// ❌ BAD: Reading ref during render
function BadRefComponent() {
  const ref = useRef(null);
  const value = ref.current?.value; // Don't read refs during render!
  return <input ref={ref} />;
}

// ❌ BAD: Calling hooks conditionally
function BadHooksComponent({ condition }: { condition: boolean }) {
  if (condition) {
    const [state, setState] = useState(0); // Hooks must be at top level!
  }
  return <div>...</div>;
}
```

## Opting Out

```tsx
// Opt out specific component
"use no memo";
function UnoptimizedComponent() {
  // This component won't be optimized
  return <div>Legacy code...</div>;
}

// Opt out specific value
function PartialOptOut() {
  // eslint-disable-next-line react-compiler/react-compiler
  const expensiveValue = computeExpensive();

  return <div>{expensiveValue}</div>;
}
```

## Gradual Adoption

```javascript
// babel-plugin-react-compiler options
{
  plugins: [
    ["babel-plugin-react-compiler", {
      // Only compile specific directories
      sources: (filename) => {
        return filename.includes("src/components");
      },
    }],
  ],
}
```

## Debugging

```tsx
// See what the compiler does
// Add to vite.config.ts for development:
react({
  babel: {
    plugins: [
      ["babel-plugin-react-compiler", {
        // Log compilation details
        logger: {
          logEvent(filename, event) {
            console.log(`[React Compiler] ${filename}:`, event);
          },
        },
      }],
    ],
  },
});
```

## Compiler vs Manual Memoization

| Aspect | Manual | Compiler |
|--------|--------|----------|
| Bundle size | Larger (memo calls) | Smaller (optimized) |
| Maintenance | Dependency arrays | Automatic |
| Correctness | Easy to get wrong | Always correct |
| Performance | Good when done right | Consistently optimal |
| Learning curve | High | Low |

## When Manual Memo Still Helps

```tsx
// Complex custom hooks with external dependencies
function useExpensiveCalculation(data: Data[]) {
  // Compiler handles this automatically now
  return data.reduce((acc, item) => acc + item.value, 0);
}

// However, for very heavy computations, explicit memoization
// with useMemo can still be useful for documentation:
function useVeryExpensiveCalculation(data: Data[]) {
  return useMemo(() => {
    // 1000ms+ computation - explicit memo documents intent
    return heavyComputation(data);
  }, [data]);
}
```

## Best Practices

1. **Write idiomatic React** - Follow Rules of React
2. **Remove manual memos** - Let compiler handle it
3. **Use ESLint plugin** - Catch violations early
4. **Gradual adoption** - Enable per-directory first
5. **Don't fight the compiler** - If it warns, fix the code
6. **Keep useMemo for docs** - Very expensive operations benefit from explicit documentation
