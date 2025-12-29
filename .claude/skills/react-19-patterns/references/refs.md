# React 19 Refs

## ref as a Prop (No forwardRef!)

```tsx
// React 19: ref is just a prop!
function Input({ ref, ...props }: { ref?: React.Ref<HTMLInputElement> }) {
  return <input ref={ref} {...props} />;
}

// Usage - works like any other prop
function Form() {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <form>
      <Input ref={inputRef} placeholder="Enter text" />
      <button onClick={() => inputRef.current?.focus()}>Focus</button>
    </form>
  );
}

// Compare to React 18 (no longer needed!)
// const Input = forwardRef<HTMLInputElement, InputProps>((props, ref) => {
//   return <input ref={ref} {...props} />;
// });
```

## Ref Cleanup Functions

```tsx
// React 19: Cleanup function in ref callback
function VideoPlayer({ src }: { src: string }) {
  return (
    <video
      ref={(element) => {
        if (element) {
          // Setup
          element.play();
        }

        // Cleanup function (NEW in React 19!)
        return () => {
          element?.pause();
          element?.load(); // Reset to beginning
        };
      }}
      src={src}
    />
  );
}
```

## Ref Callbacks with Cleanup

```tsx
function IntersectionComponent() {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div
      ref={(element) => {
        if (!element) return;

        const observer = new IntersectionObserver(
          ([entry]) => setIsVisible(entry.isIntersecting),
          { threshold: 0.5 }
        );

        observer.observe(element);

        // Cleanup: disconnect observer
        return () => observer.disconnect();
      }}
    >
      {isVisible ? "Visible!" : "Not visible"}
    </div>
  );
}
```

## useImperativeHandle with ref as Prop

```tsx
interface InputHandle {
  focus: () => void;
  clear: () => void;
  getValue: () => string;
}

function FancyInput({
  ref,
  ...props
}: {
  ref?: React.Ref<InputHandle>;
  placeholder?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
    clear: () => {
      if (inputRef.current) inputRef.current.value = "";
    },
    getValue: () => inputRef.current?.value ?? "",
  }));

  return <input ref={inputRef} {...props} />;
}

// Usage
function Form() {
  const inputHandle = useRef<InputHandle>(null);

  const handleSubmit = () => {
    console.log(inputHandle.current?.getValue());
    inputHandle.current?.clear();
  };

  return (
    <form onSubmit={handleSubmit}>
      <FancyInput ref={inputHandle} placeholder="Enter value" />
      <button type="submit">Submit</button>
    </form>
  );
}
```

## Complex Ref Pattern

```tsx
function MultiRefComponent({
  containerRef,
  inputRef,
}: {
  containerRef?: React.Ref<HTMLDivElement>;
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  return (
    <div ref={containerRef} className="container">
      <input ref={inputRef} />
    </div>
  );
}

// Usage
function Parent() {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <MultiRefComponent
      containerRef={containerRef}
      inputRef={inputRef}
    />
  );
}
```

## Callback Refs with State

```tsx
// Measure element size with callback ref
function MeasuredComponent() {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  return (
    <div
      ref={(element) => {
        if (!element) return;

        const resizeObserver = new ResizeObserver(([entry]) => {
          setDimensions({
            width: entry.contentRect.width,
            height: entry.contentRect.height,
          });
        });

        resizeObserver.observe(element);

        return () => resizeObserver.disconnect();
      }}
    >
      <p>Width: {dimensions.width}px</p>
      <p>Height: {dimensions.height}px</p>
    </div>
  );
}
```

## List Refs

```tsx
function ScrollableList({ items }: { items: Item[] }) {
  const itemRefs = useRef<Map<string, HTMLLIElement>>(new Map());

  const scrollToItem = (id: string) => {
    itemRefs.current.get(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <ul>
      {items.map((item) => (
        <li
          key={item.id}
          ref={(element) => {
            if (element) {
              itemRefs.current.set(item.id, element);
            } else {
              itemRefs.current.delete(item.id);
            }
            // No cleanup needed - Map handles it
          }}
        >
          {item.name}
        </li>
      ))}
    </ul>
  );
}
```

## Animation Refs

```tsx
function AnimatedBox() {
  return (
    <div
      ref={(element) => {
        if (!element) return;

        const animation = element.animate(
          [{ opacity: 0 }, { opacity: 1 }],
          { duration: 1000, fill: "forwards" }
        );

        // Cleanup: cancel animation
        return () => animation.cancel();
      }}
      className="box"
    />
  );
}
```

## Migration from forwardRef

```tsx
// React 18 (old way)
const Button = forwardRef<HTMLButtonElement, ButtonProps>((props, ref) => {
  return <button ref={ref} {...props} />;
});

// React 19 (new way)
function Button({
  ref,
  ...props
}: ButtonProps & { ref?: React.Ref<HTMLButtonElement> }) {
  return <button ref={ref} {...props} />;
}

// Type helper for easier migration
type RefProp<T> = { ref?: React.Ref<T> };

function Button({ ref, ...props }: ButtonProps & RefProp<HTMLButtonElement>) {
  return <button ref={ref} {...props} />;
}
```

## Best Practices

1. **Use ref as prop** - No more forwardRef wrapper needed
2. **Add cleanup functions** - Return cleanup from ref callbacks
3. **Type refs properly** - Use `React.Ref<T>` for prop types
4. **useImperativeHandle still works** - For exposing custom handles
5. **Callback refs for effects** - When you need setup/cleanup
6. **Map for dynamic refs** - Manage lists of refs efficiently
