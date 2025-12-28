# Parallel Execution Rules and Conflict Prevention

This document defines the rules and mechanisms for safe parallel agent execution.

---

## Quality Gates for Parallel Execution

### Pre-Execution Gate Check

Before ANY parallel phase, MUST:
1. Run quality gate for each task (complexity, dependencies)
2. If ANY task BLOCKED → halt entire phase
3. If ANY task has 3+ attempts → escalate to user
4. Document assumptions for WARNING tasks

### Core Functions

| Function | Purpose |
|----------|---------|
| `validateParallelPhase()` | Check all gates before starting |
| `checkAgentProgress()` | Monitor attempts, detect stuck (≥3) |
| `checkFailureCascade()` | Block dependent tasks on failure |
| `validateSyncPoint()` | Verify evidence before next phase |

### Parallel Execution Rules

**Rule 1: Gate Check Before Starting**
- ❌ **OLD:** Start parallel work immediately
- ✅ **NEW:** Run quality gates, only proceed if all PASS/WARNING

**Rule 2: Monitor Attempts During Execution**
- ❌ **OLD:** Let agents retry indefinitely
- ✅ **NEW:** Track attempts, escalate at 3, halt parallel work if stuck

**Rule 3: Detect Cascades Immediately**
- ❌ **OLD:** Let dependent agents continue working
- ✅ **NEW:** Block dependent tasks instantly, stop agents, prevent wasted cycles

**Rule 4: Validate Evidence at Sync**
- ❌ **OLD:** Accept completion claims
- ✅ **NEW:** Verify evidence exists and shows passing, reject without proof

**Rule 5: Block Next Phase on Failures**
- ❌ **OLD:** Continue to next phase with failing tasks
- ✅ **NEW:** STOP if any task lacks evidence or shows failures

---

## File Ownership Matrix

### Ownership Levels
1. **EXCLUSIVE**: Only one agent can modify this file/directory
2. **SEQUENTIAL**: Multiple agents can modify, but only in sequence
3. **READ-ONLY**: All agents can read, none can modify during parallel phase
4. **PARTITIONED**: File divided into sections, each owned by different agent

### Directory Ownership Defaults (Node.js Project)

```yaml
ownership_matrix:
  /frontend:
    default_owner: frontend-ui-developer
    subdirectories:
      /src/components: EXCLUSIVE
      /src/pages: EXCLUSIVE
      /src/hooks: EXCLUSIVE
      /src/lib: SEQUENTIAL

  /backend:
    default_owner: backend-system-architect
    subdirectories:
      /src/routes: EXCLUSIVE
      /src/services: EXCLUSIVE
      /src/db: SEQUENTIAL
      /src/lib: SEQUENTIAL

  /backend/src/agents:
    default_owner: ai-ml-engineer
    subdirectories:
      /chains: EXCLUSIVE
      /tools: EXCLUSIVE
      /prompts: EXCLUSIVE

  /shared:
    default_owner: NONE
    access: SEQUENTIAL
    subdirectories:
      /types: SEQUENTIAL
      /constants: READ-ONLY
      /config: SEQUENTIAL
```

## Parallel Execution Zones

### Green Zones (Safe for Parallel)
- Different top-level directories (frontend vs backend)
- Non-overlapping component trees
- Independent API endpoints
- Separate database tables
- Different LangChain agents

### Yellow Zones (Caution Required)
- Shared type definitions
- Common utilities
- Configuration files
- Environment variables
- Package dependencies

### Red Zones (Sequential Only)
- package.json / pnpm-lock.yaml
- Database migrations (drizzle)
- CI/CD configurations
- Git operations
- Production deployments
- drizzle.config.ts

## Safety Rules

### Never Parallel
1. Database schema changes
2. Package dependency updates
3. Git commits and merges
4. Production deployments
5. Security configurations

### Always Check Before Edit
1. `git status` - ensure clean state
2. Lock existence - check `.squad/locks/`
3. Agent communications - read recent messages
4. File ownership - verify in allocation plan

### Recovery Procedures
1. **Deadlock**: Kill all locks, restart allocation
2. **Corruption**: Revert to last known good state
3. **Conflict**: Invoke sequential fallback mode
4. **Timeout**: Escalate to supervisor

---

## Validation Checklist

Before starting parallel execution:
- [ ] All agents have unique IDs
- [ ] File ownership matrix is complete
- [ ] No overlapping MODIFY permissions
- [ ] Lock directory exists and is empty
- [ ] Communication files are initialized
- [ ] Allocation plan is validated
- [ ] Git repository is clean
- [ ] Backup/rollback plan exists
