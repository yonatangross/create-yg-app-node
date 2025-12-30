# Redis Services

> Type-safe, production-ready Redis services for YG Node Starter

## Overview

This directory contains specialized Redis services built on a centralized client manager (`core/redis.ts`). All services use MessagePack encoding for 30% smaller payloads compared to JSON.

## Services

### 1. Cache Service (`cache.service.ts`)

General-purpose caching with type safety and automatic TTL management.

```typescript
import { cacheService } from './services/cache.service.js';

// Get/Set with type safety
const user = await cacheService.get<User>('cache:user:123');
await cacheService.set('cache:user:123', user, 3600); // 1 hour TTL

// Batch operations
const users = await cacheService.mget<User>(['cache:user:123', 'cache:user:456']);

// Pattern-based clearing
await cacheService.clear('cache:user:*');

// Statistics
const stats = cacheService.getStats();
console.log(`Hit rate: ${stats.hitRate * 100}%`);
```

**Key Features**:
- MessagePack encoding (30% smaller than JSON)
- Automatic hit/miss tracking
- Pattern-based cache invalidation
- Graceful degradation on Redis failure

---

### 2. Session Service (`session.service.ts`)

HASH-based session storage with automatic TTL extension and multi-device tracking.

```typescript
import { sessionService } from './services/session.service.js';

// Create session
const sessionId = await sessionService.create('user123', {
  ip: '192.168.1.1',
  userAgent: 'Mozilla/5.0...',
  deviceId: 'device-abc',
  loginMethod: 'oauth',
});

// Get session (automatically extends TTL with sliding expiration)
const session = await sessionService.get(sessionId);

// List all user sessions (multi-device support)
const userSessions = await sessionService.getUserSessionsWithData('user123');

// Destroy session
await sessionService.destroy(sessionId);

// Destroy all user sessions (logout from all devices)
await sessionService.destroyAllUserSessions('user123');
```

**Key Features**:
- HASH storage for efficient multi-field updates
- Sliding expiration (extends TTL on access)
- User session index (track all devices)
- Configurable TTL (default: 7 days)

**Redis Keys**:
- `session:user:<sessionId>` - Session data (HASH)
- `session:index:user:<userId>` - User's sessions (SET)

---

### 3. Analytics Service (`analytics.service.ts`)

Metrics tracking with leaderboards (ZSET) and unique visitor counting (HyperLogLog).

```typescript
import { analyticsService } from './services/analytics.service.js';

// Track page view with unique visitor
await analyticsService.trackPageView('/home', 'user123', '2025-12-29');

// Get unique visitors (HyperLogLog - 0.81% error rate)
const uniqueVisitors = await analyticsService.getUniqueVisitors('/home', '2025-12-29');

// Get page views
const pageViews = await analyticsService.getPageViews('/home', '2025-12-29');

// Track custom event
await analyticsService.trackEvent('button-click', 'user123', '2025-12-29');

// Leaderboard operations
await analyticsService.addToLeaderboard('daily-points', 'user123', 50, 'daily');
const topUsers = await analyticsService.getTopLeaderboard('daily-points', 10, 'daily');
const rank = await analyticsService.getUserRank('daily-points', 'user123', 'daily');
```

**Key Features**:
- HyperLogLog for space-efficient unique counting (12KB fixed size)
- ZSET for leaderboards with O(log N) operations
- Time-based aggregations (daily, weekly, monthly, all-time)
- Automatic TTL management (90 days for analytics)

**Redis Keys**:
- `analytics:uv:<resource>:<date>` - Unique visitors (HLL)
- `analytics:pageviews:<page>:<date>` - Page views (STRING)
- `analytics:leaderboard:<name>:<range>` - Rankings (ZSET)

---

## Core Redis Client (`core/redis.ts`)

Centralized Redis client manager with connection pooling and health monitoring.

```typescript
import { getRedis, getRedisPubSub, shutdownRedis } from '../core/redis.js';

// Main client (for commands)
const redis = getRedis();
await redis.set('key', 'value');

// Pub/Sub client (separate connection required)
const pubsub = getRedisPubSub();
pubsub.subscribe('channel');
pubsub.on('message', (channel, message) => {
  console.log(`Received: ${message}`);
});

// Health check
import { isRedisHealthy, getRedisStats } from '../core/redis.js';
const healthy = await isRedisHealthy();
const stats = await getRedisStats();

// Graceful shutdown
await shutdownRedis();
```

**Features**:
- Lazy initialization with automatic reconnection
- Exponential backoff retry strategy
- Health monitoring and stats
- Graceful shutdown handling
- Separate Pub/Sub connection

---

## Key Naming Conventions

All services follow hierarchical key naming:

```
<namespace>:<resource>:<identifier>[:<sub-resource>]
```

### Namespaces

| Namespace | Purpose | Data Type | TTL |
|-----------|---------|-----------|-----|
| `cache:*` | Application cache | STRING, HASH | Variable |
| `session:*` | User sessions | HASH | 7 days |
| `rate:*` | Rate limiting | rate-limiter lib | Sliding window |
| `analytics:*` | Metrics | ZSET, HLL, STRING | 90 days |
| `queue:*` | Job queues | LIST, STREAM | Persistent |
| `pubsub:*` | Real-time messaging | PUB/SUB | None |

### Examples

```
cache:user:123:profile
cache:embed:a3f8d9e1...
session:user:abc123xyz
rate:api:chat:192.168.1.1
analytics:uv:/home:2025-12-29
analytics:leaderboard:daily-points:2025-12-29
```

---

## Configuration

### Environment Variables

```bash
REDIS_URL=redis://:redis_password@localhost:6381
REDIS_MAX_RETRIES=3
REDIS_CONNECT_TIMEOUT=10000
```

### Docker Compose

```yaml
redis:
  image: redis:7-alpine
  command: redis-server /usr/local/etc/redis/redis.conf
  volumes:
    - redis_data:/data
    - ./docker/redis.conf:/usr/local/etc/redis/redis.conf:ro
  ports:
    - "6381:6379"
```

### Redis Configuration (`docker/redis.conf`)

```redis
# Memory
maxmemory 2gb
maxmemory-policy allkeys-lru

# Persistence (RDB + AOF hybrid)
save 900 1
save 300 10
save 60 10000
appendonly yes
appendfsync everysec

# Performance
slowlog-log-slower-than 10000
hash-max-ziplist-entries 512
```

---

## Best Practices

### 1. Use Appropriate Data Types

```typescript
// Bad: STRING for multi-field entity
await redis.set('user:123', JSON.stringify(user));

// Good: HASH for multi-field entity
await redis.hmset('cache:user:123', {
  id: user.id,
  email: user.email,
  name: user.name,
});
```

### 2. Always Set TTLs for Cache Data

```typescript
// Bad: No expiration (memory leak)
await cacheService.set('cache:user:123', user);

// Good: TTL set
await cacheService.set('cache:user:123', user, 3600);
```

### 3. Use MessagePack for Binary Efficiency

```typescript
// Automatic in cacheService (30% smaller than JSON)
const cacheService = new CacheService({ useMsgpack: true });
```

### 4. Handle Redis Failures Gracefully

```typescript
// Services return null on error (no throw)
const user = await cacheService.get<User>('cache:user:123');
if (!user) {
  // Fallback to database
  user = await db.query.users.findFirst({ where: eq(users.id, '123') });
}
```

### 5. Monitor Cache Performance

```typescript
// Track hit rate
const stats = cacheService.getStats();
logger.info({ hitRate: stats.hitRate }, 'Cache performance');

// Alert if hit rate < 70%
if (stats.hitRate < 0.7) {
  logger.warn('Low cache hit rate - adjust TTLs');
}
```

---

## Migration Guide

### Phase 1: Consolidate Redis Clients (CURRENT PRIORITY)

Replace individual Redis clients with centralized manager:

```typescript
// Before (embeddings.ts)
let redisClient: Redis | null = null;
function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(config.REDIS_URL);
  }
  return redisClient;
}

// After
import { getRedis } from '../core/redis.js';
const redis = getRedis();
```

**Files to update**:
1. `shared/embeddings.ts` - Use `getRedis()`
2. `middleware/rate-limit.ts` - Use `getRedis()`
3. Any future Redis usage

### Phase 2: Adopt Service Layer

Replace raw Redis commands with type-safe services:

```typescript
// Before
const cached = await redis.get('cache:user:123');
const user = cached ? JSON.parse(cached) : null;

// After
const user = await cacheService.get<User>('cache:user:123');
```

### Phase 3: Add Advanced Features

- Implement queue service (LIST or STREAM)
- Add Pub/Sub for real-time features
- Configure persistence strategy
- Set up monitoring and alerts

---

## Performance Characteristics

| Operation | Time Complexity | Notes |
|-----------|----------------|-------|
| `cache.get()` | O(1) | STRING/HASH lookup |
| `cache.mget()` | O(N) | N keys |
| `session.get()` | O(1) | HASH lookup |
| `analytics.addToLeaderboard()` | O(log N) | ZSET insert |
| `analytics.getTopLeaderboard()` | O(log N + M) | M top entries |
| `analytics.trackPageView()` | O(1) | HLL add + incr |

---

## Memory Usage

| Data Type | Overhead | Use Case |
|-----------|----------|----------|
| STRING | ~100 bytes | Simple cache |
| HASH | ~50 bytes/field | Multi-field entities |
| ZSET | ~60 bytes/member | Leaderboards |
| HyperLogLog | 12KB fixed | Unique counting |
| LIST | ~40 bytes/element | Queues |
| SET | ~50 bytes/member | Indexes |

---

## Cluster Considerations

For future Redis Cluster deployment:

### Hash Tags

Use `{entity}` to ensure related keys hash to same slot:

```typescript
// Cluster-safe (same slot)
const keys = {
  profile: `cache:{user:${userId}}:profile`,
  settings: `cache:{user:${userId}}:settings`,
};

// Transactions work
await redis.multi()
  .get(keys.profile)
  .get(keys.settings)
  .exec();
```

### Avoid Cross-Slot Operations

```typescript
// Bad: MGET across slots
await redis.mget('cache:user:123', 'cache:user:456');

// Good: Batch per user
const batch1 = await redis.mget('cache:{user:123}:*');
const batch2 = await redis.mget('cache:{user:456}:*');
```

---

## Troubleshooting

### High Memory Usage

```bash
# Check memory stats
redis-cli INFO memory

# Find biggest keys
redis-cli --bigkeys

# Or use monitoring service
const stats = await getRedisStats();
console.log(stats.memoryUsedHuman);
```

### Low Hit Rate

```typescript
const stats = cacheService.getStats();
if (stats.hitRate < 0.7) {
  // Increase TTLs
  // Add missing cache keys
  // Check eviction policy
}
```

### Connection Issues

```typescript
const healthy = await isRedisHealthy();
if (!healthy) {
  // Check REDIS_URL
  // Verify Redis is running: docker compose ps
  // Check logs: docker compose logs redis
}
```

---

## References

- [Redis Data Types](https://redis.io/docs/data-types/)
- [ioredis Documentation](https://github.com/redis/ioredis)
- [MessagePack](https://msgpack.org/)
- [Redis Best Practices](https://redis.io/docs/management/optimization/)
- [Full Data Modeling Guide](../db/REDIS_DATA_MODELING.md)
