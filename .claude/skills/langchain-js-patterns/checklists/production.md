# AI Production Readiness Checklist

## Pre-Deployment Verification

### Resilience
- [ ] Circuit breaker on all LLM API calls (opossum)
- [ ] Timeout configuration < 30s for all external calls
- [ ] Fallback responses when circuit is open
- [ ] Graceful degradation for non-critical AI features

### Caching
- [ ] Embedding cache with Redis (24h TTL recommended)
- [ ] Response cache for deterministic queries
- [ ] Cache key includes model version and parameters

### Cost Control
- [ ] Token counting before API calls (tiktoken)
- [ ] Token budget limits per request
- [ ] Cost tracking with Prometheus metrics
- [ ] Alerts for unusual spending patterns

### Observability
- [ ] Structured logging with request IDs (Pino)
- [ ] Langfuse tracing enabled
- [ ] Token usage metrics exported
- [ ] Latency histograms by endpoint

### Error Handling
- [ ] Retry logic with exponential backoff
- [ ] Rate limit handling (429 responses)
- [ ] API key rotation support
- [ ] Meaningful error messages (no raw API errors to users)

### Security
- [ ] API keys in environment variables (not code)
- [ ] Input sanitization before LLM calls
- [ ] Output filtering for sensitive data
- [ ] Rate limiting on AI endpoints

### Streaming
- [ ] SSE endpoint for chat responses
- [ ] Proper connection cleanup on client disconnect
- [ ] Heartbeat for long-running streams
- [ ] Error events in stream

### State Management
- [ ] Checkpointer configured for conversation persistence
- [ ] Thread ID validation
- [ ] State cleanup for abandoned conversations
- [ ] Memory limits per conversation

## LangGraph Specific

### Agent Design
- [ ] Using Annotation API (not deprecated channels)
- [ ] Clear node responsibilities
- [ ] Conditional edges for tool routing
- [ ] END state properly defined

### Tools
- [ ] Tools defined with `tool()` function
- [ ] Zod schemas for all tool inputs
- [ ] Error handling within tools
- [ ] Tool result size limits

### Human-in-the-Loop (if applicable)
- [ ] Interrupt points defined
- [ ] State persistence across interrupts
- [ ] Clear approval UI/flow
- [ ] Timeout for human responses

## Performance Benchmarks

| Metric | Target | Actual |
|--------|--------|--------|
| P50 Latency | < 1s | |
| P95 Latency | < 3s | |
| P99 Latency | < 10s | |
| Error Rate | < 1% | |
| Cache Hit Rate | > 80% | |

## Sign-off

- [ ] Load tested with expected traffic
- [ ] Reviewed by security team
- [ ] Monitoring dashboards created
- [ ] Runbook documented
- [ ] On-call procedures defined
