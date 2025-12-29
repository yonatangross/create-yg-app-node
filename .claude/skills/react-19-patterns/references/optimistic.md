# Optimistic Updates with useOptimistic

## Basic Pattern

```tsx
import { useOptimistic, useTransition } from "react";

interface Message {
  id: string;
  text: string;
  sending?: boolean;
}

function Chat({ messages }: { messages: Message[] }) {
  const [optimisticMessages, addOptimisticMessage] = useOptimistic(
    messages,
    (state, newMessage: Message) => [...state, { ...newMessage, sending: true }]
  );

  const [isPending, startTransition] = useTransition();

  async function sendMessage(formData: FormData) {
    const text = formData.get("text") as string;

    startTransition(async () => {
      // Show optimistic update immediately
      addOptimisticMessage({
        id: crypto.randomUUID(),
        text,
        sending: true,
      });

      // Actual API call
      await fetch("/api/messages", {
        method: "POST",
        body: JSON.stringify({ text }),
      });
    });
  }

  return (
    <div>
      {optimisticMessages.map((message) => (
        <div key={message.id} className={message.sending ? "opacity-50" : ""}>
          {message.text}
          {message.sending && <span> (Sending...)</span>}
        </div>
      ))}

      <form action={sendMessage}>
        <input name="text" placeholder="Type a message..." />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}
```

## Optimistic Todo List

```tsx
import { useOptimistic } from "react";

interface Todo {
  id: string;
  text: string;
  completed: boolean;
  pending?: boolean;
}

function TodoList({ todos }: { todos: Todo[] }) {
  const [optimisticTodos, setOptimisticTodo] = useOptimistic(
    todos,
    (state, update: { id: string; completed: boolean }) =>
      state.map((todo) =>
        todo.id === update.id
          ? { ...todo, completed: update.completed, pending: true }
          : todo
      )
  );

  async function toggleTodo(id: string, completed: boolean) {
    // Optimistic update
    setOptimisticTodo({ id, completed });

    // Server update
    await fetch(`/api/todos/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ completed }),
    });
  }

  return (
    <ul>
      {optimisticTodos.map((todo) => (
        <li
          key={todo.id}
          className={todo.pending ? "opacity-60" : ""}
          onClick={() => toggleTodo(todo.id, !todo.completed)}
        >
          <input type="checkbox" checked={todo.completed} readOnly />
          <span className={todo.completed ? "line-through" : ""}>
            {todo.text}
          </span>
        </li>
      ))}
    </ul>
  );
}
```

## Optimistic Delete

```tsx
import { useOptimistic, useTransition } from "react";

interface Item {
  id: string;
  name: string;
  deleting?: boolean;
}

function ItemList({ items }: { items: Item[] }) {
  const [optimisticItems, removeOptimisticItem] = useOptimistic(
    items,
    (state, deletedId: string) =>
      state.map((item) =>
        item.id === deletedId ? { ...item, deleting: true } : item
      )
  );

  const [isPending, startTransition] = useTransition();

  async function deleteItem(id: string) {
    startTransition(async () => {
      // Mark as deleting (fade out)
      removeOptimisticItem(id);

      // Actually delete
      await fetch(`/api/items/${id}`, { method: "DELETE" });
    });
  }

  return (
    <ul>
      {optimisticItems
        .filter((item) => !item.deleting)
        .map((item) => (
          <li key={item.id}>
            {item.name}
            <button onClick={() => deleteItem(item.id)}>Delete</button>
          </li>
        ))}
    </ul>
  );
}
```

## Optimistic with Rollback

```tsx
import { useOptimistic, useState, useTransition } from "react";

function LikeButton({ initialLikes, postId }: { initialLikes: number; postId: string }) {
  const [likes, setLikes] = useState(initialLikes);
  const [optimisticLikes, addOptimisticLike] = useOptimistic(
    likes,
    (state, delta: number) => state + delta
  );

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleLike() {
    setError(null);

    startTransition(async () => {
      // Optimistic +1
      addOptimisticLike(1);

      try {
        const response = await fetch(`/api/posts/${postId}/like`, {
          method: "POST",
        });

        if (!response.ok) throw new Error("Failed to like");

        const data = await response.json();
        setLikes(data.likes); // Update with server truth
      } catch (e) {
        // Rollback happens automatically (optimistic state reverts)
        setError("Failed to like. Please try again.");
      }
    });
  }

  return (
    <div>
      <button onClick={handleLike} disabled={isPending}>
        ❤️ {optimisticLikes}
      </button>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
```

## Combining with useActionState

```tsx
import { useOptimistic, useActionState } from "react";

interface Comment {
  id: string;
  text: string;
  pending?: boolean;
}

function Comments({ postId, initialComments }: { postId: string; initialComments: Comment[] }) {
  const [optimisticComments, addOptimisticComment] = useOptimistic(
    initialComments,
    (state, newComment: Comment) => [...state, { ...newComment, pending: true }]
  );

  async function submitComment(prevState: any, formData: FormData) {
    const text = formData.get("text") as string;
    const tempId = crypto.randomUUID();

    // Optimistic add
    addOptimisticComment({ id: tempId, text, pending: true });

    // Server submission
    const response = await fetch(`/api/posts/${postId}/comments`, {
      method: "POST",
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      return { error: "Failed to add comment" };
    }

    return { success: true };
  }

  const [state, formAction, isPending] = useActionState(submitComment, null);

  return (
    <div>
      <ul>
        {optimisticComments.map((comment) => (
          <li key={comment.id} className={comment.pending ? "opacity-50" : ""}>
            {comment.text}
          </li>
        ))}
      </ul>

      <form action={formAction}>
        <input name="text" placeholder="Add a comment..." />
        <button disabled={isPending}>Post</button>
      </form>

      {state?.error && <p className="error">{state.error}</p>}
    </div>
  );
}
```

## Best Practices

1. **Visual feedback** - Show pending state (opacity, spinner, "Sending...")
2. **Wrap in useTransition** - Allows automatic rollback on error
3. **Combine with useActionState** - For form-based optimistic updates
4. **Handle errors gracefully** - Show error message, state reverts automatically
5. **Use for non-critical updates** - Likes, comments, toggles work well
6. **Avoid for financial/critical** - Payments should wait for confirmation
