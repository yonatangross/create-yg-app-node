/**
 * React 19 Optimistic List Template
 * With useOptimistic, transitions, and rollback handling
 */

import {
  useOptimistic,
  useTransition,
  useState,
  useActionState,
} from "react";

// =============================================================================
// Types
// =============================================================================

interface Todo {
  id: string;
  text: string;
  completed: boolean;
  createdAt: Date;
}

interface OptimisticTodo extends Todo {
  pending?: "creating" | "updating" | "deleting";
}

type OptimisticAction =
  | { type: "add"; todo: OptimisticTodo }
  | { type: "toggle"; id: string }
  | { type: "delete"; id: string };

// =============================================================================
// API Functions (simulated)
// =============================================================================

async function createTodoAPI(text: string): Promise<Todo> {
  const response = await fetch("/api/todos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) throw new Error("Failed to create todo");
  return response.json();
}

async function toggleTodoAPI(id: string, completed: boolean): Promise<Todo> {
  const response = await fetch(`/api/todos/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ completed }),
  });

  if (!response.ok) throw new Error("Failed to update todo");
  return response.json();
}

async function deleteTodoAPI(id: string): Promise<void> {
  const response = await fetch(`/api/todos/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) throw new Error("Failed to delete todo");
}

// =============================================================================
// Optimistic Reducer
// =============================================================================

function optimisticReducer(
  state: OptimisticTodo[],
  action: OptimisticAction
): OptimisticTodo[] {
  switch (action.type) {
    case "add":
      return [...state, action.todo];

    case "toggle":
      return state.map((todo) =>
        todo.id === action.id
          ? { ...todo, completed: !todo.completed, pending: "updating" }
          : todo
      );

    case "delete":
      return state.map((todo) =>
        todo.id === action.id ? { ...todo, pending: "deleting" } : todo
      );

    default:
      return state;
  }
}

// =============================================================================
// Todo Item Component
// =============================================================================

interface TodoItemProps {
  todo: OptimisticTodo;
  onToggle: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
}

function TodoItem({ todo, onToggle, onDelete }: TodoItemProps) {
  const isPending = !!todo.pending;

  return (
    <li
      className={`flex items-center gap-3 rounded-lg border p-3 transition-all ${
        todo.pending === "deleting"
          ? "scale-95 opacity-50"
          : isPending
            ? "opacity-70"
            : ""
      }`}
    >
      <input
        type="checkbox"
        checked={todo.completed}
        onChange={() => onToggle(todo.id, !todo.completed)}
        disabled={isPending}
        className="h-5 w-5 rounded border-gray-300"
      />

      <span
        className={`flex-1 ${todo.completed ? "text-gray-400 line-through" : ""}`}
      >
        {todo.text}
      </span>

      {todo.pending === "creating" && (
        <span className="text-xs text-blue-500">Creating...</span>
      )}
      {todo.pending === "updating" && (
        <span className="text-xs text-yellow-500">Updating...</span>
      )}
      {todo.pending === "deleting" && (
        <span className="text-xs text-red-500">Deleting...</span>
      )}

      <button
        onClick={() => onDelete(todo.id)}
        disabled={isPending}
        className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
      >
        <TrashIcon />
      </button>
    </li>
  );
}

function TrashIcon() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}

// =============================================================================
// Add Todo Form
// =============================================================================

interface AddTodoFormProps {
  onAdd: (text: string) => Promise<void>;
}

function AddTodoForm({ onAdd }: AddTodoFormProps) {
  async function handleSubmit(
    _prevState: { error: string | null },
    formData: FormData
  ) {
    const text = formData.get("text") as string;

    if (!text.trim()) {
      return { error: "Todo text is required" };
    }

    try {
      await onAdd(text);
      return { error: null };
    } catch {
      return { error: "Failed to add todo" };
    }
  }

  const [state, action, isPending] = useActionState(handleSubmit, {
    error: null,
  });

  return (
    <form action={action} className="mb-6">
      <div className="flex gap-2">
        <input
          name="text"
          type="text"
          placeholder="What needs to be done?"
          className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={isPending}
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isPending ? "Adding..." : "Add"}
        </button>
      </div>
      {state.error && (
        <p className="mt-1 text-sm text-red-600">{state.error}</p>
      )}
    </form>
  );
}

// =============================================================================
// Main Todo List Component
// =============================================================================

interface TodoListProps {
  initialTodos: Todo[];
}

export function OptimisticTodoList({ initialTodos }: TodoListProps) {
  const [todos, setTodos] = useState<Todo[]>(initialTodos);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Optimistic state
  const [optimisticTodos, dispatchOptimistic] = useOptimistic(
    todos as OptimisticTodo[],
    optimisticReducer
  );

  // Add todo with optimistic update
  async function handleAdd(text: string) {
    const tempId = `temp-${Date.now()}`;
    const optimisticTodo: OptimisticTodo = {
      id: tempId,
      text,
      completed: false,
      createdAt: new Date(),
      pending: "creating",
    };

    startTransition(async () => {
      setError(null);
      dispatchOptimistic({ type: "add", todo: optimisticTodo });

      try {
        const newTodo = await createTodoAPI(text);
        setTodos((prev) => [...prev, newTodo]);
      } catch {
        setError("Failed to add todo. Please try again.");
        // Optimistic state automatically reverts on error
      }
    });
  }

  // Toggle todo with optimistic update
  function handleToggle(id: string, completed: boolean) {
    startTransition(async () => {
      setError(null);
      dispatchOptimistic({ type: "toggle", id });

      try {
        const updatedTodo = await toggleTodoAPI(id, completed);
        setTodos((prev) =>
          prev.map((todo) => (todo.id === id ? updatedTodo : todo))
        );
      } catch {
        setError("Failed to update todo. Please try again.");
      }
    });
  }

  // Delete todo with optimistic update
  function handleDelete(id: string) {
    startTransition(async () => {
      setError(null);
      dispatchOptimistic({ type: "delete", id });

      try {
        await deleteTodoAPI(id);
        setTodos((prev) => prev.filter((todo) => todo.id !== id));
      } catch {
        setError("Failed to delete todo. Please try again.");
      }
    });
  }

  // Filter out deleted items for display
  const visibleTodos = optimisticTodos.filter(
    (todo) => todo.pending !== "deleting"
  );

  const completedCount = visibleTodos.filter((t) => t.completed).length;
  const totalCount = visibleTodos.length;

  return (
    <div className="mx-auto max-w-lg rounded-xl bg-white p-6 shadow-lg">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Todo List</h2>
        <span className="text-sm text-gray-500">
          {completedCount}/{totalCount} completed
        </span>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 rounded-lg bg-red-100 p-3 text-red-800">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 text-red-600 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Add Form */}
      <AddTodoForm onAdd={handleAdd} />

      {/* Todo List */}
      {visibleTodos.length === 0 ? (
        <p className="py-8 text-center text-gray-500">
          No todos yet. Add one above!
        </p>
      ) : (
        <ul className="space-y-2">
          {visibleTodos.map((todo) => (
            <TodoItem
              key={todo.id}
              todo={todo}
              onToggle={handleToggle}
              onDelete={handleDelete}
            />
          ))}
        </ul>
      )}

      {/* Loading indicator for background operations */}
      {isPending && (
        <div className="mt-4 text-center text-sm text-gray-500">
          Syncing...
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Usage Example
// =============================================================================

/*
import { OptimisticTodoList } from "./OptimisticTodoList";

// Fetch initial todos server-side or in a parent component
async function TodoPage() {
  const initialTodos = await fetch("/api/todos").then((r) => r.json());

  return (
    <main className="min-h-screen bg-gray-100 py-12">
      <OptimisticTodoList initialTodos={initialTodos} />
    </main>
  );
}
*/
