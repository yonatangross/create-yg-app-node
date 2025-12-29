---
description: Comprehensive test execution with parallel analysis
---

# Run Tests: $ARGUMENTS

Test execution with parallel analysis agents for failures.

## Phase 1: Determine Test Scope

Interpret $ARGUMENTS:
- Empty/`all` → Run all tests
- `backend` → Backend tests only
- `frontend` → Frontend tests only
- `path/to/test.ts` → Specific test file
- `test_name` → Specific test by name

## Phase 2: Execute Tests

```bash
# Full test suite with coverage
pnpm test:run --coverage 2>&1 | tee /tmp/test_results.log

# Or specific scopes:
# Backend only
pnpm --filter backend test:run --coverage 2>&1 | tee /tmp/backend_test_results.log

# Frontend only
pnpm --filter frontend test:run --coverage 2>&1 | tee /tmp/frontend_test_results.log
```

### Specific Test Commands

```bash
# Specific file
pnpm test:run $ARGUMENTS

# Specific test name (pattern match)
pnpm test:run -t "$ARGUMENTS"

# Watch mode (for development)
pnpm test

# Quick summary (no coverage)
pnpm test:run 2>&1 | tail -20
```

## Phase 3: Parallel Failure Analysis (If Tests Fail)

If tests fail, launch 3 agents to analyze:

```javascript
// PARALLEL - All three in ONE message!

Task({
  subagent_type: "test-engineer",
  prompt: `BACKEND FAILURE ANALYSIS

  Test Results: [from /tmp/test_results.log]

  For each failing test:
  1. What is the test trying to verify?
  2. What's the actual vs expected result?
  3. Root cause of failure
  4. Is this a test bug or code bug?
  5. Suggested fix

  Read the failing test files and the code they test.

  Output: Analysis with fix suggestions for each failure.`,
  run_in_background: true
})

Task({
  subagent_type: "test-engineer",
  prompt: `FRONTEND FAILURE ANALYSIS

  Test Results: [from /tmp/test_results.log]

  For each failing test:
  1. Component/hook being tested
  2. What assertion failed?
  3. Is it a mock issue or real bug?
  4. React 19 compatibility check
  5. Suggested fix

  Output: Analysis with fix suggestions for each failure.`,
  run_in_background: true
})

Task({
  subagent_type: "Explore",
  prompt: `COVERAGE GAP ANALYSIS

  Coverage Reports: [from test output]

  Identify:
  1. Files with <80% coverage
  2. Uncovered critical paths
  3. Missing edge case tests
  4. Functions without any tests

  Output: Priority list of coverage improvements needed.`,
  run_in_background: true
})
```

## Phase 4: Generate Test Report

```markdown
# Test Results Report
**Date**: [timestamp]
**Scope**: $ARGUMENTS

## Summary
| Suite | Total | Passed | Failed | Skipped | Coverage |
|-------|-------|--------|--------|---------|----------|
| Backend | X | Y | Z | W | XX% |
| Frontend | X | Y | Z | W | XX% |

## Status: [✅ ALL PASS | ⚠️ SOME FAILURES | ❌ CRITICAL FAILURES]

## Results
```
[Output from tests - last 50 lines]
```

### Coverage by Module
| Module | Coverage | Status |
|--------|----------|--------|
| routes/ | XX% | ✅/⚠️ |
| services/ | XX% | ✅/⚠️ |
| components/ | XX% | ✅/⚠️ |

### Failures (if any)
| Test | Error | Root Cause | Fix |
|------|-------|------------|-----|
| test_name | AssertionError | [analysis] | [suggestion] |

## Recommendations
1. [Priority fix 1]
2. [Priority fix 2]
3. [Coverage improvement]

## Evidence
- Test log: /tmp/test_results.log
```

## Phase 5: Quick Fix Mode (Optional)

If user wants to fix failures:

```javascript
Task({
  subagent_type: "test-engineer",
  prompt: `AUTO-FIX TEST FAILURES

  Failures to fix: [from analysis]

  For each failure:
  1. Determine if test or code needs fixing
  2. Make minimal fix
  3. Verify fix doesn't break other tests

  Output: Summary of fixes applied.`
})
```

Then re-run tests to verify.

---

## Summary

**Parallel Execution:**
- All tests run with coverage
- 3 analysis agents if failures occur

**Test Commands Quick Reference:**

```bash
# All tests with coverage
pnpm test:run --coverage

# All tests (no coverage, faster)
pnpm test:run

# Watch mode
pnpm test

# Specific file
pnpm test:run src/path/to/file.test.ts

# Specific test name
pnpm test:run -t "should handle error"

# Backend only
pnpm --filter backend test:run

# Frontend only
pnpm --filter frontend test:run

# Update snapshots
pnpm test:run -u
```

**Key Options:**
- `--coverage` - Show coverage report
- `-t "pattern"` - Filter tests by name
- `-u` - Update snapshots
- `--watch` - Watch mode
