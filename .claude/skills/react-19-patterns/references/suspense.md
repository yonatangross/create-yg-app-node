# Suspense and the use() Hook

## use() Hook for Promises

```tsx
import { use, Suspense } from "react";

// The use() hook can read promises directly
function UserProfile({ userPromise }: { userPromise: Promise<User> }) {
  const user = use(userPromise); // Suspends until resolved

  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
    </div>
  );
}

// Parent provides the promise and Suspense boundary
function ProfilePage({ userId }: { userId: string }) {
  // Create promise at render time
  const userPromise = fetchUser(userId);

  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <UserProfile userPromise={userPromise} />
    </Suspense>
  );
}
```

## use() for Context

```tsx
import { use, createContext } from "react";

const ThemeContext = createContext<"light" | "dark">("light");

// use() can read context (alternative to useContext)
function ThemedButton() {
  const theme = use(ThemeContext);

  return (
    <button className={theme === "dark" ? "bg-gray-800" : "bg-white"}>
      Click me
    </button>
  );
}

// Conditional context reading (not possible with useContext!)
function ConditionalTheme({ shouldUseTheme }: { shouldUseTheme: boolean }) {
  if (shouldUseTheme) {
    const theme = use(ThemeContext); // OK! use() can be conditional
    return <div className={theme}>Themed content</div>;
  }
  return <div>No theme</div>;
}
```

## Streaming with Suspense

```tsx
import { Suspense } from "react";

// Multiple Suspense boundaries for progressive loading
function Dashboard() {
  return (
    <div className="dashboard">
      {/* Header loads first */}
      <Suspense fallback={<HeaderSkeleton />}>
        <Header />
      </Suspense>

      <div className="grid">
        {/* Stats can stream in */}
        <Suspense fallback={<StatsSkeleton />}>
          <StatsPanel statsPromise={fetchStats()} />
        </Suspense>

        {/* Chart loads independently */}
        <Suspense fallback={<ChartSkeleton />}>
          <RevenueChart dataPromise={fetchChartData()} />
        </Suspense>

        {/* Activity can be slower */}
        <Suspense fallback={<ActivitySkeleton />}>
          <RecentActivity activityPromise={fetchActivity()} />
        </Suspense>
      </div>
    </div>
  );
}
```

## Nested Suspense

```tsx
function CommentSection({ postId }: { postId: string }) {
  const commentsPromise = fetchComments(postId);

  return (
    <Suspense fallback={<CommentListSkeleton />}>
      <CommentList commentsPromise={commentsPromise} />
    </Suspense>
  );
}

function CommentList({ commentsPromise }: { commentsPromise: Promise<Comment[]> }) {
  const comments = use(commentsPromise);

  return (
    <ul>
      {comments.map((comment) => (
        <li key={comment.id}>
          <p>{comment.text}</p>
          {/* Nested Suspense for replies */}
          <Suspense fallback={<RepliesSkeleton />}>
            <Replies repliesPromise={fetchReplies(comment.id)} />
          </Suspense>
        </li>
      ))}
    </ul>
  );
}
```

## Error Boundaries with Suspense

```tsx
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";

function DataSection() {
  return (
    <ErrorBoundary
      fallback={<ErrorMessage message="Failed to load data" />}
      onError={(error) => console.error("Data fetch error:", error)}
    >
      <Suspense fallback={<DataSkeleton />}>
        <DataDisplay dataPromise={fetchData()} />
      </Suspense>
    </ErrorBoundary>
  );
}

// Retry on error
function DataSectionWithRetry() {
  return (
    <ErrorBoundary
      fallbackRender={({ error, resetErrorBoundary }) => (
        <div>
          <p>Error: {error.message}</p>
          <button onClick={resetErrorBoundary}>Try Again</button>
        </div>
      )}
    >
      <Suspense fallback={<DataSkeleton />}>
        <DataDisplay dataPromise={fetchData()} />
      </Suspense>
    </ErrorBoundary>
  );
}
```

## Server Components Pattern

```tsx
// Server Component (async by default)
async function UserList() {
  const users = await fetchUsers(); // Direct await, no useEffect!

  return (
    <ul>
      {users.map((user) => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  );
}

// Client Component wrapper with Suspense
"use client";
function UserListPage() {
  return (
    <Suspense fallback={<UserListSkeleton />}>
      <UserList />
    </Suspense>
  );
}
```

## Preloading Data

```tsx
// Preload data before navigation
function preloadUserData(userId: string) {
  // Start fetching immediately
  const userPromise = fetchUser(userId);
  const postsPromise = fetchUserPosts(userId);

  return { userPromise, postsPromise };
}

// On hover, start preloading
function UserLink({ userId }: { userId: string }) {
  const handleMouseEnter = () => {
    preloadUserData(userId);
  };

  return (
    <Link
      href={`/users/${userId}`}
      onMouseEnter={handleMouseEnter}
    >
      View User
    </Link>
  );
}
```

## SuspenseList (Experimental)

```tsx
import { Suspense, SuspenseList } from "react";

// Control how multiple Suspense boundaries reveal
function Feed() {
  return (
    <SuspenseList revealOrder="forwards" tail="collapsed">
      <Suspense fallback={<PostSkeleton />}>
        <Post id={1} />
      </Suspense>
      <Suspense fallback={<PostSkeleton />}>
        <Post id={2} />
      </Suspense>
      <Suspense fallback={<PostSkeleton />}>
        <Post id={3} />
      </Suspense>
    </SuspenseList>
  );
}
```

## Best Practices

1. **Place Suspense strategically** - Near data-fetching components
2. **Use multiple boundaries** - Independent loading states
3. **Combine with Error Boundaries** - Handle both loading and errors
4. **Preload on interaction** - Start fetching on hover/focus
5. **Show meaningful skeletons** - Match layout of final content
6. **Don't over-suspend** - Group related data when possible
7. **use() for conditional reads** - Take advantage of its flexibility
