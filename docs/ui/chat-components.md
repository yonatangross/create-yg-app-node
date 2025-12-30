# Chat UI Component Specifications

**Design System**: Tailwind CSS 4 + oklch color space
**File**: `/packages/frontend/src/index.css`
**Stack**: React 19 + LangGraph + Langfuse

---

## Component: Chat Message Bubble

### User Message
```tsx
<div class="
  bg-[var(--color-chat-user-bg)]
  text-[var(--color-chat-user-text)]
  rounded-[var(--radius-bubble)]
  px-[var(--spacing-bubble-padding-x)]
  py-[var(--spacing-bubble-padding-y)]
  shadow-[var(--shadow-bubble)]
  max-w-[70%]
  ml-auto
  animate-bubble-appear
  hover:bg-[var(--color-chat-user-hover)]
  transition-colors
  duration-[var(--duration-fast)]
">
  <p class="text-base leading-[var(--line-height-relaxed)]">
    Your message here
  </p>
</div>
```

### Assistant Message
```tsx
<div class="
  bg-[var(--color-chat-assistant-bg)]
  text-[var(--color-chat-assistant-text)]
  rounded-[var(--radius-bubble)]
  px-[var(--spacing-bubble-padding-x)]
  py-[var(--spacing-bubble-padding-y)]
  shadow-[var(--shadow-bubble)]
  max-w-[70%]
  mr-auto
  animate-bubble-appear
  hover:bg-[var(--color-chat-assistant-hover)]
  transition-colors
  duration-[var(--duration-fast)]
">
  <p class="text-base leading-[var(--line-height-relaxed)]">
    AI response here
  </p>
</div>
```

### System Message
```tsx
<div class="
  bg-[var(--color-chat-system-bg)]
  text-[var(--color-chat-system-text)]
  rounded-[var(--radius-md)]
  px-[var(--spacing-4)]
  py-[var(--spacing-2)]
  text-sm
  text-center
  mx-auto
  max-w-[80%]
  animate-fade-in
">
  System notification
</div>
```

---

## Component: Tool Invocation

### Tool Call (LangGraph)
```tsx
<div class="
  bg-[var(--color-tool-invoke-bg)]
  border
  border-[var(--color-tool-invoke-border)]
  rounded-[var(--radius-tool)]
  p-[var(--spacing-4)]
  ml-[var(--spacing-tool-inset)]
  shadow-[var(--shadow-tool)]
  animate-tool-expand
">
  {/* Tool Header */}
  <div class="flex items-center gap-[var(--spacing-2)] mb-[var(--spacing-3)]">
    <svg class="w-4 h-4 text-[var(--color-tool-invoke-icon)] animate-tool-pulse">
      {/* Icon */}
    </svg>
    <span class="
      text-sm
      font-medium
      text-[var(--color-tool-invoke-text)]
    ">
      Calling tool: search_documents
    </span>
  </div>

  {/* Tool Arguments */}
  <pre class="
    bg-[var(--color-code-inline-bg)]
    text-[var(--color-code-inline-text)]
    text-xs
    rounded-[var(--radius-sm)]
    p-[var(--spacing-2)]
    overflow-x-auto
    font-mono
  ">
    {JSON.stringify(args, null, 2)}
  </pre>
</div>
```

### Tool Result (Success)
```tsx
<div class="
  bg-[var(--color-tool-success-bg)]
  border
  border-[var(--color-tool-success-border)]
  rounded-[var(--radius-tool)]
  p-[var(--spacing-4)]
  ml-[var(--spacing-tool-inset)]
  animate-tool-expand
">
  <div class="flex items-center gap-[var(--spacing-2)] mb-[var(--spacing-2)]">
    <svg class="w-4 h-4 text-[var(--color-tool-success-icon)]">
      {/* Checkmark icon */}
    </svg>
    <span class="text-sm font-medium text-[var(--color-tool-result-text)]">
      Tool executed successfully
    </span>
  </div>

  <div class="text-sm text-[var(--color-tool-result-text)]">
    Found 5 documents
  </div>
</div>
```

### Tool Result (Error)
```tsx
<div class="
  bg-[var(--color-tool-error-bg)]
  border
  border-[var(--color-tool-error-border)]
  rounded-[var(--radius-tool)]
  p-[var(--spacing-4)]
  ml-[var(--spacing-tool-inset)]
  animate-tool-expand
">
  <div class="flex items-center gap-[var(--spacing-2)] mb-[var(--spacing-2)]">
    <svg class="w-4 h-4 text-[var(--color-tool-error-icon)]">
      {/* Error icon */}
    </svg>
    <span class="text-sm font-medium text-[var(--color-tool-error-text)]">
      Tool execution failed
    </span>
  </div>

  <div class="text-sm text-[var(--color-tool-error-text)]">
    {error.message}
  </div>
</div>
```

---

## Component: Streaming Indicator

### Typing Cursor
```tsx
<span class="
  inline-block
  w-[2px]
  h-[1.2em]
  bg-[var(--color-stream-cursor)]
  animate-cursor-blink
  ml-1
"></span>
```

### Typing Dots
```tsx
<div class="flex gap-[var(--spacing-1)] items-center p-[var(--spacing-3)]">
  <span class="
    w-2 h-2
    bg-[var(--color-text-secondary)]
    rounded-full
    animate-typing-indicator
  "></span>
  <span class="
    w-2 h-2
    bg-[var(--color-text-secondary)]
    rounded-full
    animate-typing-indicator
    [animation-delay:0.2s]
  "></span>
  <span class="
    w-2 h-2
    bg-[var(--color-text-secondary)]
    rounded-full
    animate-typing-indicator
    [animation-delay:0.4s]
  "></span>
</div>
```

---

## Component: Code Block

### Multi-line Code (Langfuse Trace)
```tsx
<div class="
  bg-[var(--color-code-bg)]
  border
  border-[var(--color-code-border)]
  rounded-[var(--radius-code)]
  overflow-hidden
  my-[var(--spacing-4)]
">
  {/* Header */}
  <div class="
    flex items-center justify-between
    px-[var(--spacing-4)]
    py-[var(--spacing-2)]
    bg-[var(--color-code-border)]
  ">
    <span class="text-xs text-[var(--color-code-text)] font-mono">
      python
    </span>
    <button class="
      text-xs text-[var(--color-code-text)]
      hover:text-[var(--color-interactive-primary)]
      transition-colors
    ">
      Copy
    </button>
  </div>

  {/* Code Content */}
  <pre class="
    p-[var(--spacing-code-padding)]
    text-[var(--color-code-text)]
    text-sm
    font-mono
    leading-[var(--line-height-loose)]
    overflow-x-auto
  "><code>{codeContent}</code></pre>
</div>
```

### Inline Code
```tsx
<code class="
  bg-[var(--color-code-inline-bg)]
  text-[var(--color-code-inline-text)]
  px-[var(--spacing-1)]
  py-[0.5px]
  rounded-[var(--radius-sm)]
  text-[0.9em]
  font-mono
">
  variable_name
</code>
```

---

## Layout: Chat Container

### Main Chat View
```tsx
<div class="
  flex flex-col
  h-screen
  bg-[var(--color-background)]
">
  {/* Messages Container */}
  <div class="
    flex-1
    overflow-y-auto
    chat-scrollbar
    px-[var(--spacing-6)]
    py-[var(--spacing-8)]
  ">
    <div class="
      max-w-4xl
      mx-auto
      space-y-[var(--spacing-message-gap)]
    ">
      {messages.map(msg => <ChatMessage key={msg.id} {...msg} />)}
    </div>
  </div>

  {/* Input Area */}
  <div class="
    border-t
    border-[var(--color-border)]
    bg-[var(--color-surface)]
    p-[var(--spacing-6)]
  ">
    <div class="max-w-4xl mx-auto">
      {/* Input component */}
    </div>
  </div>
</div>
```

---

## Component: Message Input

```tsx
<div class="relative">
  <textarea
    class="
      w-full
      min-h-[80px]
      max-h-[200px]
      px-[var(--spacing-4)]
      py-[var(--spacing-3)]
      bg-[var(--color-surface)]
      border
      border-[var(--color-border)]
      rounded-[var(--radius-xl)]
      text-[var(--color-text-primary)]
      resize-none
      focus:outline-none
      focus:border-[var(--color-interactive-primary)]
      focus:ring-2
      focus:ring-[var(--color-interactive-primary)]
      focus:ring-opacity-20
      transition-all
      duration-[var(--duration-fast)]
      placeholder:text-[var(--color-text-tertiary)]
    "
    placeholder="Ask a question..."
  />

  {/* Send Button */}
  <button class="
    absolute
    bottom-[var(--spacing-3)]
    right-[var(--spacing-3)]
    w-8 h-8
    flex items-center justify-center
    bg-[var(--color-interactive-primary)]
    hover:bg-[var(--color-interactive-hover)]
    active:bg-[var(--color-interactive-active)]
    disabled:bg-[var(--color-interactive-disabled)]
    rounded-[var(--radius-md)]
    transition-colors
    duration-[var(--duration-fast)]
    focus:outline-none
    focus:ring-2
    focus:ring-[var(--color-interactive-primary)]
    focus:ring-offset-2
  ">
    <svg class="w-4 h-4 text-white">
      {/* Send icon */}
    </svg>
  </button>
</div>
```

---

## Component: Langfuse Trace Badge

### Active Trace Indicator
```tsx
<div class="
  inline-flex items-center gap-[var(--spacing-2)]
  px-[var(--spacing-3)]
  py-[var(--spacing-1)]
  bg-[var(--color-status-info)]
  bg-opacity-10
  border
  border-[var(--color-status-info)]
  border-opacity-30
  rounded-full
  text-xs
  font-medium
  text-[var(--color-status-info)]
">
  <span class="
    w-2 h-2
    bg-[var(--color-status-info)]
    rounded-full
    animate-pulse
  "></span>
  Trace ID: {traceId.slice(0, 8)}
</div>
```

---

## Responsive Breakpoints

```tsx
/* Mobile (default) */
<div class="max-w-full px-4">

/* Tablet */
<div class="md:max-w-2xl md:px-6">

/* Desktop */
<div class="lg:max-w-4xl lg:px-8">

/* Large Desktop */
<div class="xl:max-w-6xl xl:px-12">
```

---

## State Variants

### Message States
- **Default**: Standard colors from design tokens
- **Hover**: Use `*-hover` color variants
- **Selected**: Add `ring-2 ring-[var(--color-interactive-primary)]`
- **Loading**: Add `animate-tool-pulse` or `animate-typing-indicator`
- **Error**: Use `tool-error-*` color tokens

### Accessibility States
- **Focus**: `focus:ring-2 focus:ring-[var(--color-interactive-primary)]`
- **Disabled**: `opacity-50 cursor-not-allowed`
- **Reduced Motion**: Animations disabled via `@media (prefers-reduced-motion)`
- **High Contrast**: Enhanced borders via `@media (prefers-contrast: high)`

---

## Animation Usage

### Available Animations
1. `animate-cursor-blink` - Streaming cursor (1s)
2. `animate-tool-pulse` - Tool execution indicator (2s)
3. `animate-bubble-appear` - Message entrance (200ms)
4. `animate-tool-expand` - Tool panel expansion (300ms)
5. `animate-typing-indicator` - Typing dots (1.4s)
6. `animate-fade-in` - Generic fade in (200ms)
7. `animate-slide-up` - Bottom sheet entrance (300ms)

### Custom Animation Delays
```tsx
<div class="animate-typing-indicator [animation-delay:200ms]">
```

---

## Dark Mode Support

All color tokens automatically switch via `@media (prefers-color-scheme: dark)`.

No manual dark mode classes needed - design system handles it.

---

## Implementation Checklist

- [ ] Install Inter font via Google Fonts or local
- [ ] Install JetBrains Mono for code blocks
- [ ] Verify Tailwind CSS 4 is configured
- [ ] Test color contrast ratios (WCAG AA: 4.5:1 text, 3:1 UI)
- [ ] Test animations with `prefers-reduced-motion`
- [ ] Verify oklch color support in target browsers (fallback to rgb if needed)
- [ ] Add `chat-scrollbar` class to scrollable containers
- [ ] Test responsive layouts on mobile/tablet/desktop

---

**Handoff to**: `frontend-developer`
**Design System File**: `/packages/frontend/src/index.css`
**Last Updated**: 2025-12-30
