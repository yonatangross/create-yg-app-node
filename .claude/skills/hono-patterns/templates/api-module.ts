/**
 * API Module Template
 * RESTful resource with CRUD operations, validation, and error handling
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

// =============================================================================
// Types & Schemas
// =============================================================================

const resourceSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  status: z.enum(["active", "inactive", "archived"]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const createResourceSchema = resourceSchema.pick({
  name: true,
  description: true,
});

const updateResourceSchema = resourceSchema
  .pick({
    name: true,
    description: true,
    status: true,
  })
  .partial();

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(["name", "createdAt", "updatedAt"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  status: z.enum(["active", "inactive", "archived"]).optional(),
});

const idParamSchema = z.object({
  id: z.string().uuid(),
});

type Resource = z.infer<typeof resourceSchema>;
type CreateResource = z.infer<typeof createResourceSchema>;
type UpdateResource = z.infer<typeof updateResourceSchema>;
type Pagination = z.infer<typeof paginationSchema>;

// =============================================================================
// Service Layer (Replace with actual implementation)
// =============================================================================

const resourceService = {
  async findMany(params: Pagination): Promise<{
    items: Resource[];
    total: number;
  }> {
    // Replace with actual database query
    return { items: [], total: 0 };
  },

  async findById(id: string): Promise<Resource | null> {
    // Replace with actual database query
    return null;
  },

  async create(data: CreateResource): Promise<Resource> {
    // Replace with actual database insert
    const now = new Date().toISOString();
    return {
      id: crypto.randomUUID(),
      ...data,
      status: "active",
      createdAt: now,
      updatedAt: now,
    };
  },

  async update(id: string, data: UpdateResource): Promise<Resource | null> {
    // Replace with actual database update
    return null;
  },

  async delete(id: string): Promise<boolean> {
    // Replace with actual database delete
    return false;
  },
};

// =============================================================================
// Error Handler
// =============================================================================

function validationErrorHandler(
  result: { success: boolean; error?: z.ZodError },
  c: any
) {
  if (!result.success) {
    const errors = result.error!.flatten().fieldErrors;
    return c.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid input",
          details: errors,
        },
      },
      400
    );
  }
}

// =============================================================================
// Routes
// =============================================================================

const app = new Hono()
  // List resources
  .get("/", zValidator("query", paginationSchema, validationErrorHandler), async (c) => {
    const params = c.req.valid("query");
    const { items, total } = await resourceService.findMany(params);

    const totalPages = Math.ceil(total / params.limit);

    return c.json({
      success: true,
      data: {
        items,
        pagination: {
          page: params.page,
          limit: params.limit,
          total,
          totalPages,
          hasNext: params.page < totalPages,
          hasPrev: params.page > 1,
        },
      },
    });
  })

  // Get single resource
  .get("/:id", zValidator("param", idParamSchema, validationErrorHandler), async (c) => {
    const { id } = c.req.valid("param");
    const resource = await resourceService.findById(id);

    if (!resource) {
      throw new HTTPException(404, { message: "Resource not found" });
    }

    return c.json({
      success: true,
      data: resource,
    });
  })

  // Create resource
  .post("/", zValidator("json", createResourceSchema, validationErrorHandler), async (c) => {
    const data = c.req.valid("json");
    const resource = await resourceService.create(data);

    return c.json(
      {
        success: true,
        data: resource,
      },
      201
    );
  })

  // Update resource
  .patch(
    "/:id",
    zValidator("param", idParamSchema, validationErrorHandler),
    zValidator("json", updateResourceSchema, validationErrorHandler),
    async (c) => {
      const { id } = c.req.valid("param");
      const data = c.req.valid("json");

      const resource = await resourceService.update(id, data);

      if (!resource) {
        throw new HTTPException(404, { message: "Resource not found" });
      }

      return c.json({
        success: true,
        data: resource,
      });
    }
  )

  // Delete resource
  .delete("/:id", zValidator("param", idParamSchema, validationErrorHandler), async (c) => {
    const { id } = c.req.valid("param");
    const deleted = await resourceService.delete(id);

    if (!deleted) {
      throw new HTTPException(404, { message: "Resource not found" });
    }

    return c.body(null, 204);
  });

// Export type for RPC client
export type ResourceRoutes = typeof app;
export default app;

// =============================================================================
// Usage: Mount in main app
// =============================================================================
/*
import resourceRoutes from "./routes/resources";

const app = new Hono();
app.route("/api/resources", resourceRoutes);
*/
