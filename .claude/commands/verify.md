---
description: Feature branch verification with highest standards
---

# Verify: $ARGUMENTS

Comprehensive pre-merge verification with parallel reviewers.

## Phase 1: Analyze Scope

```bash
# Get branch info
BRANCH=$(git branch --show-current)
ISSUE=$(echo $BRANCH | grep -oE '[0-9]+' | head -1)

# Analyze changes
git log --oneline dev..HEAD
git diff dev...HEAD --stat

# Count changes
FILES_CHANGED=$(git diff dev...HEAD --name-only | wc -l)
LINES_ADDED=$(git diff dev...HEAD --numstat | awk '{sum+=$1}END{print sum}')
LINES_REMOVED=$(git diff dev...HEAD --numstat | awk '{sum+=$2}END{print sum}')

echo "Files: $FILES_CHANGED | Lines: +$LINES_ADDED / -$LINES_REMOVED"
```

## Phase 2: Fetch Latest Best Practices

```javascript
// PARALLEL - Current standards
WebSearch(`TypeScript best practices December 2025`)
WebSearch(`React 19 patterns December 2025`)
WebSearch(`Hono API best practices 2025`)
```

## Phase 3: Load Project Standards

```javascript
// PARALLEL - Load capabilities first (token-efficient)
Read(".claude/skills/code-review-playbook/capabilities.json")
Read(".claude/skills/security-checklist/capabilities.json")
Read(".claude/skills/testing-strategy-builder/capabilities.json")

// Load project rules
Read(".claude/instructions/code-quality-rules.md")
```

## Phase 4: Parallel Review (3 Agents)

```javascript
// PARALLEL - All three in ONE message!

Task({
  subagent_type: "code-reviewer",
  prompt: `BACKEND VERIFICATION

  Branch: $BRANCH
  Changes: [from git diff]

  Verify backend code meets standards:

  Quality:
  - TypeScript strict mode compliance
  - Zod validation at API boundaries
  - Error handling (no unhandled promises)
  - Logging (structured with Pino)

  Architecture:
  - Service layer separation
  - Route organization
  - Middleware patterns

  Performance:
  - Query efficiency
  - Caching usage
  - Timeout handling

  Run checks:
  - pnpm run check
  - pnpm --filter backend test:run

  Output: Issues with severity (blocker/warning/info).`,
  run_in_background: true
})

Task({
  subagent_type: "code-reviewer",
  prompt: `FRONTEND VERIFICATION

  Branch: $BRANCH
  Changes: [from git diff]

  Verify frontend code meets standards:

  React 19:
  - useActionState for forms
  - useOptimistic for UX
  - Proper Suspense boundaries
  - No legacy patterns

  TypeScript:
  - Strict mode compliance
  - No 'any' types
  - Zod for runtime validation

  Accessibility:
  - ARIA attributes
  - Keyboard navigation
  - Color contrast

  Run checks:
  - pnpm --filter frontend test:run

  Output: Issues with severity.`,
  run_in_background: true
})

Task({
  subagent_type: "security-auditor",
  prompt: `SECURITY VERIFICATION

  Branch: $BRANCH
  Changes: [from git diff]

  Critical checks:
  1. No hardcoded secrets (grep for API_KEY, SECRET, PASSWORD)
  2. Input validation on all endpoints
  3. SQL injection prevention (parameterized queries)
  4. XSS prevention
  5. CSRF protection
  6. Dependency vulnerabilities

  Run:
  - pnpm audit
  - Check .env.example for secret exposure

  Output: Security findings with severity.`,
  run_in_background: true
})
```

**Wait for all 3 to complete.**

## Phase 5: Run Full Test Suite

```bash
# Full validation
pnpm run check
pnpm test:run --coverage

# Capture results
pnpm run check 2>&1 | tee /tmp/verify_check.log
pnpm test:run --coverage 2>&1 | tee /tmp/verify_tests.log
```

## Phase 6: E2E Verification (If Applicable)

```javascript
// If UI changes, run E2E tests
mcp__playwright__browser_navigate({ url: "http://localhost:4173" })
mcp__playwright__browser_snapshot()

// Take screenshot evidence
mcp__playwright__browser_take_screenshot({ filename: "verify-screenshot.png" })
```

## Phase 7: Generate Verification Report

```markdown
# Verification Report: $BRANCH

**Issue**: #$ISSUE
**Date**: [timestamp]
**Files Changed**: X | **Lines**: +Y / -Z

## Quality Gate Status

### Code Quality
| Check | Status | Details |
|-------|--------|---------|
| Format | ✅/❌ | [biome/prettier] |
| Lint | ✅/❌ | [eslint errors] |
| TypeScript | ✅/❌ | [type errors] |
| Tests | ✅/❌ | [pass/fail count] |
| Coverage | ✅/❌ | [X%] |

### Security
| Check | Status | Details |
|-------|--------|---------|
| Secrets Scan | ✅/❌ | [findings] |
| Dependencies | ✅/❌ | [vulnerabilities] |
| Input Validation | ✅/❌ | [issues] |

### Standards Compliance
| Standard | Status |
|----------|--------|
| TypeScript Strict | ✅/❌ |
| No 'any' Types | ✅/❌ |
| Zod Validation | ✅/❌ |
| Error Handling | ✅/❌ |
| Accessibility | ✅/❌ |

## Findings

### Blockers (Must Fix)
- [None / List items]

### Warnings
- [List items]

### Info
- [List items]

## Evidence
- Check log: /tmp/verify_check.log
- Test log: /tmp/verify_tests.log
- Screenshot: verify-screenshot.png

## Recommendation
[✅ READY TO MERGE | ⚠️ NEEDS ATTENTION | ❌ BLOCKERS FOUND]
```

## Phase 8: Save to Memory

```javascript
mcp__memory__create_entities({
  entities: [{
    name: `verification-$BRANCH-${Date.now()}`,
    entityType: "verification-result",
    observations: [
      "Branch: $BRANCH",
      "Status: [PASS/FAIL]",
      "Blockers: [count]",
      "Warnings: [count]"
    ]
  }]
})
```

---

## Summary

**Total Parallel Agents: 3**
- 2 code-reviewer (backend, frontend)
- 1 security-auditor

**Standards Enforced:**
- TypeScript strict mode
- Zod validation at boundaries
- React 19 patterns
- OWASP security checklist
- 80% test coverage minimum

**MCPs Used:**
- WebSearch (current best practices)
- context7 (library docs)
- playwright (E2E verification)
- memory (save results)

**Quality Gate:**
- All checks must pass
- No security blockers
- Test coverage >= 80%
