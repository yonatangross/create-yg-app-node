# Squad Communication Protocol

## File-Based Messaging System

### Directory Structure
```
.squad/sessions/
├── [timestamp]/
│   ├── session-status.md           # Overall session state
│   ├── role-plan-*.md              # Task assignments
│   ├── role-comm-*.md              # Progress updates
│   ├── artifacts/                  # Generated files
│   └── locks/                      # File lock tracking
.claude/context/
├── shared-context.json             # Unified context (synced automatically)
└── instructions/context-middleware.md # Context protocol
```

### Context Synchronization
Squad communication files automatically sync with `.claude/context/shared-context.json`:
- Agent decisions from `role-comm-*.md` → `agent_decisions`
- Completed tasks → `tasks_completed`
- Blocked items → `tasks_pending`
- Session continuity preserved across Squad/Classic modes

## Message Formats

### 1. Session Status (Supervisor Maintains)
**File**: `session-status.md`
```yaml
session_id: sess_[timestamp]_[hash]
started_at: 2024-01-15T10:00:00Z
status: active|completed|failed
phase: requirements|design|implementation|quality
agents_active:
  - frontend-ui-developer
  - backend-system-architect
tasks_total: 12
tasks_completed: 7
validation_gates:
  requirements: passed
  design: passed
  implementation: in_progress
  quality: pending
```

### 2. Task Assignment (role-plan)
**File**: `role-plan-[agent]-[task-id].md`
```yaml
# Task Assignment
meta:
  task_id: task_[timestamp]_[sequence]
  agent: backend-system-architect
  created_at: 2024-01-15T10:30:00Z
  priority: high|medium|low
  timeout: 300  # seconds

dependencies:
  requires:
    - task_001  # Must complete first
  blocks:
    - task_010  # Cannot start until this completes

instruction: |
  Create a REST API endpoint for user search with the following requirements:
  - Support pagination with limit/offset
  - Filter by name, email
  - Return proper error responses

boundaries:
  allowed:
    - backend/src/routes/users.ts
    - backend/src/services/userService.ts
  forbidden:
    - frontend/**
    - .env

outputs:
  endpoint: backend/src/routes/users.ts
  tests: backend/src/routes/users.test.ts

success_criteria:
  - Endpoint responds with correct data
  - All types are properly defined (no 'any')
  - Tests achieve 80% coverage
  - Validation with Zod
```

### 3. Progress Update (role-comm)
**File**: `role-comm-[agent]-[task-id].md`
```yaml
# Progress Update
meta:
  task_id: task_[timestamp]_[sequence]
  agent: backend-system-architect
  updated_at: 2024-01-15T10:35:00Z

status: pending|in_progress|completed|blocked
progress_percentage: 75

current_action: |
  Implementing pagination logic

completed_steps:
  - Created route structure
  - Added Zod schemas
  - Implemented query parsing

remaining_steps:
  - Add database query
  - Error handling
  - Unit tests

artifacts_created:
  - path: backend/src/routes/users.ts
    lines: 86
    status: draft

validation_results:
  typescript:
    status: passing
    errors: 0
  eslint:
    status: passing
    errors: 0
  tests:
    status: not_run
    coverage: 0
  build:
    status: passing

blockers:
  - description: Need clarification on pagination limits
    blocking_since: 2024-01-15T10:34:00Z
    requires_agent: product-manager

time_spent: 180  # seconds
```

### 4. Inter-Agent Communication
**File**: `role-comm-[from-agent]-to-[to-agent]-[id].md`
```yaml
# Inter-Agent Message
meta:
  message_id: msg_[timestamp]_[hash]
  from_agent: frontend-ui-developer
  to_agent: backend-system-architect
  created_at: 2024-01-15T10:36:00Z
  priority: high

type: question|request|notification
subject: API contract clarification needed

message: |
  The search endpoint spec shows a 'limit' parameter but no 'offset'.
  How should we handle pagination for large result sets?

context:
  task_id: task_001
  component: UserSearch
  file: frontend/src/components/UserSearch.tsx

response_needed: true
response_by: 2024-01-15T10:45:00Z
```

## Message Priority Handling

### Priority Levels
1. **critical**: System failures, blocking issues (immediate)
2. **high**: Task dependencies, validation failures (< 1 min)
3. **medium**: Standard tasks, progress updates (< 5 min)
4. **low**: Optimizations, nice-to-have features (when available)

## Error Handling Protocol

### Error Message Format
```yaml
# File: error-[agent]-[timestamp].md
error_id: err_[timestamp]_[hash]
agent: backend-system-architect
task_id: task_001
severity: critical|error|warning
occurred_at: 2024-01-15T10:38:00Z

error:
  type: TypeScriptCompilationError
  message: "Type 'string' is not assignable to type 'number'"
  file: backend/src/routes/users.ts
  line: 45
  column: 12

attempted_fixes:
  - Changed type annotation
  - Result: Created new error in dependent component

requires_intervention: true
suggested_agent: code-quality-reviewer
```

## Cleanup Protocol

### Session Completion
1. Archive session folder to `.squad/archives/`
2. Clear active locks
3. Generate session summary report
4. Clean up temporary files

### Retention Policy
- Active sessions: Keep indefinitely
- Completed sessions: Archive after 24 hours
- Archived sessions: Delete after 30 days
- Failed sessions: Keep for 7 days for debugging
