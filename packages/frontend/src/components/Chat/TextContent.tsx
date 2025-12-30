/**
 * TextContent Component
 * Renders text content with optional streaming cursor animation
 */

interface TextContentProps {
  content: string;
  showCursor?: boolean;
}

export function TextContent({ content, showCursor = false }: TextContentProps) {
  return (
    <div className="whitespace-pre-wrap break-words">
      {content}
      {showCursor && (
        <span
          className="inline-block w-[2px] h-[1.2em] ml-1 align-middle animate-cursor-blink"
          style={{ backgroundColor: 'var(--color-stream-cursor)' }}
          aria-label="Typing..."
        />
      )}
    </div>
  );
}
