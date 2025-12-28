# Hono Production Readiness Checklist

## Security

- [ ] CORS configured with specific origins (not `*`)
- [ ] Secure headers middleware enabled
- [ ] Rate limiting on all public endpoints
- [ ] CSRF protection for state-changing requests
- [ ] Input validation with Zod on all endpoints
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention (escape output, CSP headers)
- [ ] Authentication middleware on protected routes
- [ ] Authorization checks in handlers
- [ ] No sensitive data in error responses

## Error Handling

- [ ] Global error handler with `app.onError()`
- [ ] 404 handler with `app.notFound()`
- [ ] Consistent error response format
- [ ] Request ID in all error responses
- [ ] No stack traces in production errors
- [ ] HTTP status codes used correctly

## Observability

- [ ] Structured logging with Pino
- [ ] Request ID middleware
- [ ] Request/response logging
- [ ] Timing header (`Server-Timing`)
- [ ] Health check endpoint (`/health`)
- [ ] Readiness endpoint (`/ready`)
- [ ] Prometheus metrics endpoint (`/metrics`)

## Performance

- [ ] Compression enabled (gzip/brotli)
- [ ] ETag caching for static responses
- [ ] Connection pooling for database
- [ ] Response streaming where appropriate
- [ ] No N+1 queries
- [ ] Pagination on list endpoints

## API Design

- [ ] OpenAPI documentation
- [ ] Consistent response envelope
- [ ] Pagination metadata in responses
- [ ] Proper HTTP methods (GET, POST, PUT, DELETE)
- [ ] Proper HTTP status codes
- [ ] Version prefix (`/api/v1/`)

## Type Safety

- [ ] AppType exported for RPC client
- [ ] Env types defined (Variables, Bindings)
- [ ] Zod schemas shared with frontend
- [ ] No `any` types

## Deployment

- [ ] Graceful shutdown handling
- [ ] Environment variables validated at startup
- [ ] Docker health check configured
- [ ] HTTPS only in production
- [ ] Trust proxy configured for reverse proxy

## Testing

- [ ] Unit tests for handlers
- [ ] Integration tests for routes
- [ ] E2E tests for critical flows
- [ ] Load testing completed
- [ ] Error scenarios tested

## Configuration

```typescript
// Required environment variables
const config = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  CORS_ORIGINS: z.string().transform((s) => s.split(",")),
});
```

## Recommended Middleware Order

```typescript
app.use("*", timing());
app.use("*", requestId());
app.use("*", secureHeaders());
app.use("*", compress());
app.use("*", cors());
app.use("*", logger());
app.use("/api/*", rateLimiter());
app.use("/api/*", auth());
// Routes...
```

## Sign-off

- [ ] Security review completed
- [ ] Load testing passed
- [ ] Monitoring configured
- [ ] Runbook documented
- [ ] On-call schedule defined
