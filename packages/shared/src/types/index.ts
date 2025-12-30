/**
 * Shared type definitions
 */

import { z } from 'zod';

// ============================================================================
// API Response Types
// ============================================================================

export const ApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.record(z.unknown()).optional(),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;

export const ApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
    meta: z
      .object({
        requestId: z.string(),
        timestamp: z.string(),
      })
      .optional(),
  });

export const ApiErrorResponseSchema = z.object({
  success: z.literal(false),
  error: ApiErrorSchema,
  meta: z
    .object({
      requestId: z.string(),
      timestamp: z.string(),
    })
    .optional(),
});

export type ApiResponse<T> =
  | { success: true; data: T; meta?: { requestId: string; timestamp: string } }
  | {
      success: false;
      error: ApiError;
      meta?: { requestId: string; timestamp: string };
    };

// ============================================================================
// Pagination Types
// ============================================================================

export const PaginationParamsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type PaginationParams = z.infer<typeof PaginationParamsSchema>;

export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(
  itemSchema: T
) =>
  z.object({
    items: z.array(itemSchema),
    pagination: z.object({
      page: z.number(),
      limit: z.number(),
      total: z.number(),
      totalPages: z.number(),
      hasNext: z.boolean(),
      hasPrev: z.boolean(),
    }),
  });

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// ============================================================================
// User Types
// ============================================================================

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1).max(255),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type User = z.infer<typeof UserSchema>;

export const CreateUserSchema = UserSchema.pick({
  email: true,
  name: true,
});

export type CreateUser = z.infer<typeof CreateUserSchema>;

export const UpdateUserSchema = UserSchema.pick({
  name: true,
}).partial();

export type UpdateUser = z.infer<typeof UpdateUserSchema>;

// ============================================================================
// Health Check Types
// ============================================================================

export const HealthCheckSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  version: z.string(),
  timestamp: z.string().datetime(),
  services: z.record(
    z.object({
      status: z.enum(['up', 'down', 'unknown']),
      latencyMs: z.number().optional(),
    })
  ),
});

export type HealthCheck = z.infer<typeof HealthCheckSchema>;

// ============================================================================
// Chat Types
// ============================================================================

export const ChatMessageSchema = z.object({
  id: z.string().uuid(),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  timestamp: z.string().datetime(),
  toolCalls: z
    .array(
      z.object({
        name: z.string(),
        arguments: z.record(z.unknown()),
        result: z.unknown().optional(),
      })
    )
    .optional(),
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const ChatRequestSchema = z.object({
  message: z.string().min(1).max(10000),
  threadId: z.string().uuid().optional(),
  persona: z.string().max(100).optional(),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export const ChatResponseSchema = z.object({
  response: z.string(),
  threadId: z.string().uuid(),
  toolsUsed: z
    .array(
      z.object({
        name: z.string(),
        arguments: z.record(z.unknown()),
      })
    )
    .optional(),
  traceId: z.string().optional(),
});

export type ChatResponse = z.infer<typeof ChatResponseSchema>;

// ============================================================================
// Chat UI Types (Enhanced)
// ============================================================================

// Re-export enhanced chat UI types for streaming with content blocks
// NOTE: StreamEvent and StreamEventSchema are exported from chat-ui.ts
export * from './chat-ui.js';
