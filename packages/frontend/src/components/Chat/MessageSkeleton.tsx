/**
 * MessageSkeleton Component
 * Loading skeleton for messages (NO spinners - React 19 pattern)
 */

export function MessageSkeleton() {
  return (
    <div className="flex justify-start mb-4">
      <div className="max-w-[80%] rounded-lg px-4 py-2 bg-gray-200 dark:bg-gray-700">
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-48" />
          <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-36" />
        </div>
      </div>
    </div>
  );
}
