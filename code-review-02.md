# Code Review 02 — Audit Subsystem

## Scope

Evaluation of the reqit-sdk audit architecture: `src/audit/` (5 modules, ~1,343 lines),
`src/grade/` (219 lines), and all associated tests (14 audit test files, 304 tests; 5 grade
test files, 123 tests). Comparison against the `08-sdk.md` specification.

Report only — no code changes.

---

## Architecture Overview

| Module | Lines | Responsibility |
|--------|-------|---------------|
| `audit/index.js` | 133 | Public API: `audit()`, `prepareAudit()`, `findUnmet()` |
| `audit/single-tree.js` | 711 | Core recursive walker, all 20 node-type handlers |
| `audit/status.js` | 220 | Pure status propagation (no AST knowledge) |
| `audit/transcript.js` | 174 | Normalization, indexing, cross-list lookup |
| `audit/backtrack.js` | 105 | Post-constraint combination solver |
| `grade/index.js` | 219 | Grade comparison, GPA, `audit:false` support |

The module boundaries are well-drawn. `status.js` is entirely pure — no AST, no
transcript, just status arrays → parent status. `transcript.js` cleanly handles the
external input boundary. `backtrack.js` is opt-in and isolated. `grade/index.js` uses
a `WeakMap` cache for scale index lookup, which is a nice touch for batch auditing.

---

## Findings — Code Smells

### F1: `checkPostConstraints` duplicates `evaluatePostConstraints`

`single-tree.js:641-670` and `backtrack.js:70-98` are nearly identical functions. Both
iterate items, call `collectMatchedEntries`, look up catalog courses by key, and evaluate
filters against constraints with the same comparison switch. The only difference is
they live in different files.

The duplication was introduced to work around circular dependencies (backtrack imports
`collectMatchedEntries` from single-tree, single-tree conditionally imports backtrack).
Should be consolidated into a shared helper — possibly in a new `post-constraints.js`
module that both can import without circularity.

### F2: Inline `require()` calls to avoid circular dependencies

Three inline requires hide the real dependency graph:

| Location | Import | Reason |
|----------|--------|--------|
| `single-tree.js:310` | `require('./backtrack')` | Inside `auditNOf` body |
| `single-tree.js:642` | `require('../resolve')` | Inside `checkPostConstraints` |
| `backtrack.js:72` | `require('./single-tree')` | Inside `evaluatePostConstraints` |

The `require('../resolve')` at line 642 is especially odd: `evaluateFilters` (plural)
is already imported at the top of the file (line 21), but `evaluateFilter` (singular)
is not — it's fetched via an inline require in a helper function. Meanwhile,
`backtrack.js:18` imports `evaluateFilter` at the top level with no issue.

Consolidating F1 (shared post-constraint evaluator) would eliminate two of these three
inline requires. The third (backtrack from single-tree) is genuinely conditional and
the inline require is acceptable for an opt-in code path.

### F3: `auditFromNGroups` identity-maps statuses

`single-tree.js:366-371`:

```js
const groupStatuses = items.map(r => {
  if (r.status === MET) return MET;
  if (r.status === IN_PROGRESS) return IN_PROGRESS;
  if (r.status === PARTIAL_PROGRESS) return PARTIAL_PROGRESS;
  return NOT_MET;
});
```

This is `items.map(r => r.status)`. The identity mapping serves no purpose. Every other
composite auditor (allOf, anyOf, nOf, noneOf, oneFromEach) uses
`items.map(r => r.status)` directly.

### F4: `auditAttainment` has a dead branch

`single-tree.js:226-231`:

```js
if (attainment.kind === 'boolean') {
  result.status = attainment.value ? MET : NOT_MET;
} else {
  // If attainment exists and has any truthy value, treat as met
  result.status = attainment.value ? MET : NOT_MET;
}
```

Both branches evaluate the same expression. The `kind === 'boolean'` conditional is
meaningless.

### F5: `collectMatchedEntries` and `findUnmet` duplicate result-tree traversal

Both functions walk the audit result tree using the same child properties (`items`,
`source`, `requirement`, `resolved`, `exclude`). This is the same child-visitor
pattern flagged in the renderer/resolver review (F4 from code-review.md). As before,
a shared `walkAuditResult(node, visitor)` utility would reduce the maintenance surface
when new node types add new child properties.

### F6: `evaluateFilter` import inconsistency

`single-tree.js` imports `evaluateFilters` (plural) at the top level (line 21) but
does an inline `require('../resolve')` to get `evaluateFilter` (singular) inside
`checkPostConstraints` (line 642). Both are exported from the same module. The singular
form should be added to the top-level import. (This would be resolved automatically
if F1 is addressed by extracting the post-constraint evaluator.)

---

## Findings — Test Improvements

### F7: `collectMatchedEntries` has no direct unit tests

This critical helper (exported from `single-tree.js`, used by `credits-from`, `except`,
`with-constraint`, and `backtrack.js`) traverses the entire audit result tree to collect
transcript entries. It handles three different entry sources (`satisfiedBy`,
`matchedCourses`, `inProgressCourses`) and deduplicates by `courseKey`.

It has no direct unit tests — it's tested only indirectly through credits-from and
except tests. Direct tests should cover:
- Nested composite results with mixed entry sources
- Deduplication when the same course appears in multiple subtrees
- Variable-ref resolved results
- Empty / null nodes

### F8: `evaluateMinGradeConstraint` vacuous truth — not a bug, but needs a test

When ALL collected entries are in-progress (no graded entries),
`evaluateMinGradeConstraint` returns `{ met: true }` (line 688). This is the constraint
evaluator reporting "no graded entries violate the minimum" — vacuously true.

This is **not a bug**. The outer `auditWithConstraint` (line 448) sets the overall
status to `innerResult.status`, which would be `IN_PROGRESS` in this scenario. The
constraint's `met: true` does not propagate as the node's status.

The full flow for "all in-progress" with a `min-grade >= "B"` constraint:

1. Inner requirement: all children in-progress → `innerResult.status = IN_PROGRESS`
2. `collectMatchedEntries`: in-progress entries (grade: null)
3. `evaluateMinGradeConstraint`: skips all (in-progress) → `{ met: true }`
4. `constraintResult.met = true` → `result.status = innerResult.status` = **IN_PROGRESS**

Overall status is correctly `IN_PROGRESS`, not `MET`. The constraint will be
re-evaluated when grades arrive.

However, the `met: true` naming on the constraint result is misleading. This design
decision should be documented with an explicit test case, and the constraint result
could benefit from an additional field (e.g., `gradedCount: 0`) to make the vacuous
case visible to consumers.

### F9: `evaluateMinGpaConstraint` vacuous truth — same pattern

When there are no graded entries, GPA calculation returns 0 but `met` returns `true`
because the early return at line 700 fires. Same reasoning as F8 — the overall
with-constraint status uses `innerResult.status` (IN_PROGRESS), not the constraint's
`met` field.

The `actual: 0` in the result (0.0 GPA when there are no grades) is technically correct
but could confuse consumers. Should be tested and documented alongside F8.

### F10: No parse-and-audit integration test

All integration tests construct ASTs manually. There are no tests that parse reqit DSL
text and then audit the resulting AST against a transcript. This would catch
parser–auditor contract mismatches (e.g., field naming differences between what the
parser produces and what the auditor expects).

### F11: `from-n-groups` with course-filter groups not tested

The test suite covers `from-n-groups` with `any-of` groups containing explicit courses,
but not with `course-filter` groups. A realistic use case would be "courses from 2 of
these 4 departments" where each group is a `course-filter`.

### F12: Backtracking has no combinatorial warning

`backtrack.js` generates all `C(N, K)` combinations via a generator. For large inputs
this can be expensive — e.g., `C(20, 10) = 184,756` combinations.

**Action:** Emit a warning to `ctx.warnings` when the combination count exceeds 100,000.
Do not prevent the computation — the solver should still run to completion. The warning
alerts the calling application that performance may be degraded, and the requirement
may need restructuring.

Formula for pre-check: `C(N, K) = N! / (K! × (N-K)!)`. Compute before entering the
combination loop.

---

## Confidence Assessment

### Single-tree auditing: High

- All 20 node types handled with explicit cases and exhaustiveness guard
- Status propagation thoroughly unit-tested (including boundary conditions, vacuous
  cases, and all three n-of comparisons)
- Transcript normalization correctly handles dedup (last-entry-wins), withdrawn
  filtering, `audit:false` exclusion, and cross-list indexing
- Grade handling is correct: scale comparison, pass/fail, GPA calculation, and
  `audit:false` support
- Integration tests cover realistic CS major, gen-ed, grade constraints,
  scores/attainments, and except patterns across two catalogs (minimal, Lehigh)
- Cross-listing tested end-to-end: resolver expansion, transcript lookup fallback,
  and warning emission

### Backtracking: Medium-High

- Logic is correct for the problem it solves: exhaustive combination search over met
  items to satisfy post-constraints on `n-of` nodes
- Tests cover: greedy success (no backtrack), greedy fail + backtrack success, greedy
  fail + backtrack fail, multiple constraints, K equals met count, and comparison-type
  guard (only `at-least`)
- Concern: no combinatorial warning for large inputs (F12). The opt-in design
  (`options.backtrack`) mitigates risk — callers must explicitly enable it.

### Grade handling: High

- `audit:false` support cleanly filters non-auditable grades from all paths
  (transcript normalization, passing check, GPA calculation, min-grade comparison)
- WeakMap cache for scale index avoids redundant map construction in batch auditing
- Default US letter grade config is frozen to prevent accidental mutation
- Custom grade scales supported and tested

---

## Action Items

| Priority | Finding | Action |
|----------|---------|--------|
| **High** | F1 | Extract shared post-constraint evaluator to eliminate duplication |
| **High** | F2 | Clean up inline requires (follows from F1) |
| **High** | F7 | Add direct unit tests for `collectMatchedEntries` |
| **Medium** | F3 | Replace identity mapping with `items.map(r => r.status)` |
| **Medium** | F4 | Remove dead branch in `auditAttainment` |
| **Medium** | F8, F9 | Add tests documenting vacuous truth behavior for grade/GPA constraints |
| **Medium** | F10 | Add parse-and-audit integration test |
| **Medium** | F12 | Add combinatorial warning (>100K combinations) in backtrack solver |
| **Low** | F5 | Consider shared `walkAuditResult` utility (defer with F4 from code-review.md) |
| **Low** | F6 | Fix `evaluateFilter` import (resolved by F1) |
| **Low** | F11 | Add `from-n-groups` with course-filter group test |
