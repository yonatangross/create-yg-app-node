import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export function HomePage() {
  const {
    data: health,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['health'],
    queryFn: api.getHealth,
    refetchInterval: 30000, // Refresh every 30s
  });

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="rounded-lg border-4 border-dashed border-gray-200 dark:border-gray-700 p-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          Welcome to YG App
        </h1>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          A full-stack Node.js + React application with AI capabilities.
        </p>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            System Status
          </h2>

          {isLoading && (
            <p className="text-gray-500 dark:text-gray-400">
              Loading health status...
            </p>
          )}

          {error && (
            <p className="text-red-500">
              Error connecting to backend: {(error as Error).message}
            </p>
          )}

          {health && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-block w-3 h-3 rounded-full ${
                    health.status === 'healthy'
                      ? 'bg-green-500'
                      : health.status === 'degraded'
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                  }`}
                />
                <span className="text-gray-700 dark:text-gray-300 capitalize">
                  {health.status}
                </span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Version: {health.version}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Last checked: {new Date(health.timestamp).toLocaleTimeString()}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
