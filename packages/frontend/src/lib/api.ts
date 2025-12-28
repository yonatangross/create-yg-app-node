import type {
  ApiResponse,
  HealthCheck,
  User,
  CreateUser,
  PaginatedResponse,
} from '@yg-app/shared';

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
};
