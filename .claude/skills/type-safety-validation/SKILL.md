---
name: type-safety-validation
description: End-to-end type safety with Zod validation, exhaustive type checking, branded types, and TypeScript 5.7+ patterns for full-stack Node.js applications.
version: 1.0.0
tags: [typescript, zod, type-safety, validation, exhaustive-types, branded-types]
---

# Type Safety & Validation

## Overview

End-to-end type safety ensures bugs are caught at compile time, not runtime. This skill covers Zod for runtime validation, modern TypeScript features, and patterns for type-safe full-stack applications.

**When to use:**
- Validating API inputs and form data
- Building type-safe APIs with Hono
- Creating end-to-end typed applications
- Implementing strict validation rules

## Core Patterns

### 1. Zod Runtime Validation

```typescript
import { z } from 'zod'

// Define schema
const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  age: z.number().int().positive().max(120),
  role: z.enum(['admin', 'user', 'guest']),
  metadata: z.record(z.string()).optional(),
  createdAt: z.date().default(() => new Date())
})

// Infer TypeScript type from schema
type User = z.infer<typeof UserSchema>

// Validate data
const result = UserSchema.safeParse(data)
if (result.success) {
  const user: User = result.data
} else {
  console.error(result.error.issues)
}
```

**Advanced Patterns**:
```typescript
// Refinements
const PasswordSchema = z.string()
  .min(8)
  .refine((pass) => /[A-Z]/.test(pass), 'Must contain uppercase')
  .refine((pass) => /[0-9]/.test(pass), 'Must contain number')

// Discriminated Unions
const EventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('click'), x: z.number(), y: z.number() }),
  z.object({ type: z.literal('scroll'), offset: z.number() })
])

// Transform
const EmailSchema = z.string().email().transform(email => email.toLowerCase())
```

### 2. Hono with Zod Validation

```typescript
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'

const app = new Hono()

const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(100)
})

app.post('/users',
  zValidator('json', CreateUserSchema),
  async (c) => {
    const { email, name } = c.req.valid('json')
    // email and name are fully typed!
    const user = await createUser({ email, name })
    return c.json({ data: user })
  }
)
```

### 3. Exhaustive Type Checking

```typescript
// ✅ ALWAYS use this helper function
function assertNever(x: never): never {
  throw new Error(`Unexpected value: ${x}`)
}

// Example: Status handling
type AnalysisStatus = 'pending' | 'running' | 'completed' | 'failed'

function getStatusColor(status: AnalysisStatus): string {
  switch (status) {
    case 'pending': return 'gray'
    case 'running': return 'blue'
    case 'completed': return 'green'
    case 'failed': return 'red'
    default: return assertNever(status) // Compile-time exhaustiveness check
  }
}

// If you add a new status, TypeScript will error at compile time!
```

### 4. Exhaustive Record Mapping

```typescript
// For mapping union types to values
type EventType = 'click' | 'scroll' | 'keypress' | 'hover'

const eventColors = {
  click: 'red',
  scroll: 'blue',
  keypress: 'green',
  hover: 'yellow',
} as const satisfies Record<EventType, string>

// TypeScript will error if any EventType is missing
```

### 5. Branded Types for IDs

```typescript
import { z } from 'zod'

// Create branded types for different ID kinds
const UserId = z.string().uuid().brand<'UserId'>()
const AnalysisId = z.string().uuid().brand<'AnalysisId'>()

type UserId = z.infer<typeof UserId>
type AnalysisId = z.infer<typeof AnalysisId>

// Now TypeScript prevents mixing ID types
function deleteAnalysis(id: AnalysisId): void { ... }
function getUser(id: UserId): User { ... }

const userId: UserId = UserId.parse('...')
const analysisId: AnalysisId = AnalysisId.parse('...')

deleteAnalysis(analysisId) // ✅ OK
deleteAnalysis(userId)     // ❌ Error: UserId not assignable to AnalysisId
```

### 6. Drizzle Schema with Zod

```typescript
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'

// Drizzle schema
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').defaultNow()
})

// Auto-generate Zod schemas
export const insertUserSchema = createInsertSchema(users)
export const selectUserSchema = createSelectSchema(users)

// Use in Hono
app.post('/users',
  zValidator('json', insertUserSchema),
  async (c) => {
    const userData = c.req.valid('json')
    const user = await db.insert(users).values(userData).returning()
    return c.json({ data: user[0] })
  }
)
```

## Common Anti-Patterns

```typescript
// ❌ NEVER use non-exhaustive switch
switch (status) {
  case 'pending': return 'gray'
  case 'running': return 'blue'
  // Missing cases! Runtime bugs waiting to happen
}

// ❌ NEVER use default without assertNever
switch (status) {
  case 'pending': return 'gray'
  case 'running': return 'blue'
  default: return 'unknown' // Silent bug if new status added
}

// ✅ ALWAYS use switch with assertNever
switch (status) {
  case 'pending': return 'gray'
  case 'running': return 'blue'
  case 'completed': return 'green'
  case 'failed': return 'red'
  default: return assertNever(status)
}
```

## Best Practices

### Validation
- ✅ Validate at boundaries (API inputs, form submissions, external data)
- ✅ Use `.safeParse()` to handle errors gracefully
- ✅ Provide clear error messages for users
- ✅ Validate environment variables at startup
- ✅ Use branded types for IDs

### Type Safety
- ✅ Enable `strict: true` in `tsconfig.json`
- ✅ Use `noUncheckedIndexedAccess` for safer array access
- ✅ Prefer `unknown` over `any`
- ✅ Use type guards for narrowing
- ✅ Always use `assertNever` in switch default cases

### Performance
- ✅ Reuse schemas (don't create inline)
- ✅ Use `.parse()` for known-good data (faster than `.safeParse()`)
- ✅ Cache validation results when appropriate

## Resources

- [Zod Documentation](https://zod.dev)
- [Drizzle Zod](https://orm.drizzle.team/docs/zod)
- [Hono Zod Validator](https://hono.dev/helpers/zod-validator)
