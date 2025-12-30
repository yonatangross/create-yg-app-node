import type {
  ApiResponse,
  HealthCheck,
  User,
  CreateUser,
  PaginatedResponse,
  ChatResponse,
  StreamEvent,
} from '@yg-app/shared';
import { ChatResponseSchema, StreamEventSchema } from '@yg-app/shared';

const API_BASE = '/api';

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  const data = (await response.json()) as ApiResponse<T>;

  if (!data.success) {
    throw new Error(data.error.message);
  }

  return data.data;
}

export const api = {
  // Health
  async getHealth(): Promise<HealthCheck> {
    const response = await fetch('/health');
    const data = (await response.json()) as ApiResponse<HealthCheck>;
    if (!data.success) {
      throw new Error(data.error.message);
    }
    return data.data;
  },

  // Users
  async getUsers(page = 1, limit = 20): Promise<PaginatedResponse<User>> {
    return fetchApi<PaginatedResponse<User>>(
      `/users?page=${page}&limit=${limit}`
    );
  },

  async getUser(id: string): Promise<User> {
    return fetchApi<User>(`/users/${id}`);
  },

  async createUser(data: CreateUser): Promise<User> {
    return fetchApi<User>('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateUser(id: string, data: Partial<CreateUser>): Promise<User> {
    return fetchApi<User>(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async deleteUser(id: string): Promise<void> {
    await fetchApi(`/users/${id}`, {
      method: 'DELETE',
    });
  },

  // Chat
  async sendChatMessage(
    message: string,
    threadId?: string,
    persona?: string
  ): Promise<ChatResponse> {
    const response = await fetchApi<ChatResponse>('/chat', {
      method: 'POST',
      body: JSON.stringify({ message, threadId, persona }),
    });

    // Validate response with Zod
    const result = ChatResponseSchema.safeParse(response);
    if (!result.success) {
      throw new Error('Invalid chat response format');
    }

    return result.data;
  },

  /**
   * Stream event types matching backend StreamEvent
   */

  /**
   * Create SSE stream for chat responses
   * Returns async generator that yields typed stream events
   *
   * @example
   * for await (const event of api.chatStream('Hello')) {
   *   switch (event.type) {
   *     case 'text_delta':
   *       appendText(event.content);
   *       break;
   *     case 'tool_call':
   *       showToolRunning(event.toolName);
   *       break;
   *     case 'tool_result':
   *       showToolResult(event.result);
   *       break;
   *     case 'done':
   *       // Stream complete - traceId available for observability
   *       saveTraceId(event.traceId);
   *       break;
   *   }
   * }
   */
  async *chatStream(
    message: string,
    threadId?: string,
    persona?: string
  ): AsyncGenerator<StreamEvent> {
    const params = new URLSearchParams({ message });
    if (threadId) params.append('threadId', threadId);
    if (persona) params.append('persona', persona);

    const response = await fetch(`${API_BASE}/chat/stream?${params}`);

    if (!response.ok) {
      throw new Error(`Stream failed: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const rawParsed = JSON.parse(data);
              // Validate with Zod schema for runtime type safety
              const result = StreamEventSchema.safeParse(rawParsed);
              if (result.success) {
                yield result.data;
              }
              // Silently skip invalid events - server-side logging handles debugging
            } catch {
              // Ignore malformed JSON
            }
          }
        }
      }
    } finally {
      // Fix memory leak: cancel reader before releasing lock
      await reader.cancel();
      reader.releaseLock();
    }
  },
};

// Re-export StreamEvent from shared for backward compatibility
export type { StreamEvent } from '@yg-app/shared';
