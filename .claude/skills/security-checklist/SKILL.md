---
name: security-checklist
description: Use this skill for security reviews and implementing secure coding practices in Node.js applications. Covers OWASP Top 10, authentication, input validation, and secrets management.
version: 1.0.0
author: YG Node Starter
tags: [security, owasp, authentication, node.js, typescript]
---

# Security Checklist (Node.js)

## OWASP Top 10 Mitigations

### 1. Injection Prevention
```typescript
// ✅ Drizzle ORM - Parameterized queries by default
const user = await db.query.users.findFirst({
  where: eq(users.email, email), // Safe
});

// ✅ Zod validation for all inputs
const schema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(100).regex(/^[a-zA-Z\s]+$/),
});

// ❌ NEVER use string interpolation
const user = await db.execute(`SELECT * FROM users WHERE email = '${email}'`);
```

### 2. Authentication
```typescript
import { sign, verify } from 'jsonwebtoken';
import bcrypt from 'bcrypt';

// Password hashing
const SALT_ROUNDS = 12;
const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
const isValid = await bcrypt.compare(password, hashedPassword);

// JWT with proper configuration
const token = sign(
  { sub: user.id, role: user.role },
  process.env.JWT_SECRET,
  {
    expiresIn: '15m',        // Short-lived access token
    issuer: 'your-app',
    audience: 'your-app',
  }
);

// Refresh token (longer-lived, stored securely)
const refreshToken = sign(
  { sub: user.id, type: 'refresh' },
  process.env.JWT_REFRESH_SECRET,
  { expiresIn: '7d' }
);
```

### 3. Sensitive Data Exposure
```typescript
// ✅ Never log sensitive data
logger.info({ userId: user.id }, 'User logged in');
// ❌ logger.info({ user }, 'User logged in'); // Logs password!

// ✅ Pino redaction
const logger = pino({
  redact: ['password', 'token', 'authorization', '*.password', '*.token'],
});

// ✅ Select only needed fields
const user = await db.query.users.findFirst({
  where: eq(users.id, id),
  columns: { id: true, email: true, name: true }, // No password
});
```

### 4. XXE Prevention
```typescript
// ✅ Avoid XML parsing or use safe parsers
// If XML is required:
import { XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({
  ignoreAttributes: false,
  parseAttributeValue: false, // Don't evaluate entities
});
```

### 5. Access Control
```typescript
// Role-based middleware
const requireRole = (...roles: string[]) => {
  return createMiddleware(async (c, next) => {
    const user = c.get('user');
    if (!user || !roles.includes(user.role)) {
      throw new ForbiddenError('Insufficient permissions');
    }
    await next();
  });
};

// Resource ownership check
const requireOwnership = createMiddleware(async (c, next) => {
  const userId = c.get('user').id;
  const resourceId = c.req.param('id');

  const resource = await getResource(resourceId);
  if (resource.ownerId !== userId) {
    throw new ForbiddenError('Access denied');
  }
  await next();
});

app.delete('/api/posts/:id', requireAuth, requireOwnership, deletePost);
```

### 6. Security Headers (Hono)
```typescript
import { secureHeaders } from 'hono/secure-headers';

app.use('*', secureHeaders({
  contentSecurityPolicy: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:', 'https:'],
  },
  xFrameOptions: 'DENY',
  xContentTypeOptions: 'nosniff',
  referrerPolicy: 'strict-origin-when-cross-origin',
  permissionsPolicy: {
    camera: [],
    microphone: [],
    geolocation: [],
  },
}));
```

### 7. XSS Prevention
```typescript
// ✅ React handles by default
// For server-rendered content:
import { escape } from 'html-escaper';

const safeHtml = escape(userInput);

// Sanitize HTML if needed
import DOMPurify from 'isomorphic-dompurify';
const cleanHtml = DOMPurify.sanitize(htmlContent);
```

### 8. Insecure Deserialization
```typescript
// ✅ Always validate with Zod
const data = schema.parse(JSON.parse(input));

// ❌ NEVER deserialize untrusted data directly
const data = JSON.parse(input); // No validation!
```

### 9. Vulnerable Dependencies
```bash
# Regular audits
pnpm audit

# In CI/CD
pnpm audit --audit-level=high

# Update dependencies
pnpm update --interactive
```

### 10. Logging & Monitoring
```typescript
// Security events to log
logger.warn({ ip, userId, endpoint }, 'Rate limit exceeded');
logger.warn({ ip, attemptCount }, 'Failed login attempt');
logger.info({ userId, action: 'password_change' }, 'Password changed');
logger.error({ userId, resource }, 'Unauthorized access attempt');
```

## Input Validation

```typescript
// Comprehensive validation schemas
const createUserSchema = z.object({
  email: z.string()
    .email()
    .toLowerCase()
    .max(255),
  password: z.string()
    .min(12)
    .regex(/[A-Z]/, 'Must contain uppercase')
    .regex(/[a-z]/, 'Must contain lowercase')
    .regex(/[0-9]/, 'Must contain number')
    .regex(/[^A-Za-z0-9]/, 'Must contain special character'),
  name: z.string()
    .min(2)
    .max(100)
    .regex(/^[a-zA-Z\s'-]+$/),
});

// URL validation
const urlSchema = z.string().url().refine(
  (url) => {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  },
  { message: 'Only HTTP(S) URLs allowed' }
);
```

## Secrets Management

```typescript
// ✅ Environment variables
const config = {
  jwtSecret: process.env.JWT_SECRET!,
  dbUrl: process.env.DATABASE_URL!,
  apiKey: process.env.API_KEY!,
};

// ✅ Validate required secrets at startup
const requiredEnvVars = ['JWT_SECRET', 'DATABASE_URL', 'API_KEY'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

// ✅ .env files in .gitignore
// .env
// .env.local
// .env.*.local

// ❌ NEVER commit secrets
// ❌ NEVER log secrets
// ❌ NEVER embed in code
```

## CORS Configuration

```typescript
import { cors } from 'hono/cors';

app.use('/api/*', cors({
  origin: (origin) => {
    const allowedOrigins = [
      'https://yourdomain.com',
      'https://app.yourdomain.com',
    ];
    if (process.env.NODE_ENV === 'development') {
      allowedOrigins.push('http://localhost:5173');
    }
    return allowedOrigins.includes(origin) ? origin : null;
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400,
}));
```

## Rate Limiting for Auth

```typescript
const authLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'auth',
  points: 5,           // 5 attempts
  duration: 60 * 15,   // per 15 minutes
  blockDuration: 60 * 60, // block for 1 hour after exceeded
});

app.post('/api/auth/login', async (c) => {
  const ip = c.req.header('x-forwarded-for') || 'unknown';

  try {
    await authLimiter.consume(ip);
  } catch {
    throw new TooManyRequestsError('Too many login attempts');
  }

  // Process login...
});
```

## Security Checklist

### Pre-Deployment
- [ ] All inputs validated with Zod
- [ ] Parameterized queries (Drizzle ORM)
- [ ] Passwords hashed with bcrypt (12+ rounds)
- [ ] JWT with short expiration
- [ ] Security headers configured
- [ ] CORS properly configured
- [ ] Rate limiting on auth endpoints
- [ ] Dependencies audited
- [ ] Secrets in environment variables
- [ ] Error messages don't leak info

### Production
- [ ] HTTPS only
- [ ] Security headers verified
- [ ] Logging for security events
- [ ] Regular dependency updates
- [ ] Backup verification
- [ ] Incident response plan
