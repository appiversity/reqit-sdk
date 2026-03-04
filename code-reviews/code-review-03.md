# Code Review 03 — Multi-Tree Audit

## Scope

Evaluation of the multi-tree audit system: `src/audit/multi-tree.js` (445 lines),
its integration surface in `src/audit/index.js`, and all associated tests
(`test/audit/multi-tree.test.js` — 415 lines, 17 tests;
`test/audit/integration/william-mary-multi.test.js` — 221 lines, 7 tests).
Comparison against `03-ast.md` and `08-sdk.md` / `22-sdk-api-design.md` specs.

Report only — no code changes.

All 1,767 tests pass (61 suites).

---

## Architecture Overview

| Module | Lines | Responsibility |
|--------|-------|---------------|
| `multi-tree.js` | 445 | `auditMulti()`, `CourseAssignmentMap`, policy evaluators |
| `index.js` (multi surface) | 5 | Re-exports `auditMulti`, `CourseAssignmentMap` |

The module is structured as:

1. **CourseAssignmentMap** (lines 32–128) — a class tracking which courses are assigned
   to which programs. Clean API with `assign`, `getAssignments`, `isAssigned`,
   `getSharedCourses`, `getCoursesForProgram`, `getCoursesOutsideProgram`.

2. **auditMulti** (lines 148–209) — two-pass orchestrator:
   - Pass 1: audit each tree independently via single-tree `auditNode()`, collect
     matched entries into the assignment map
   - Pass 2: walk ASTs for policy nodes (`overlap-limit`, `outside-program`,
     `program-context-ref`) and evaluate them

3. **Policy evaluators** (lines 268–407) — `evaluateOverlapLimit`,
   `evaluateOutsideProgram`, `evaluateProgramContextRef`, plus helper `resolveProgram`
   and `sumCredits`

---

## Findings — Code Smells

### F1: Pass 2 policy results are computed but never returned

`evaluateMultiTreePolicies` (line 220) stores results on `ctx.policyResults`, but
`auditMulti` (line 208) returns `{ results, assignments, warnings }` — `policyResults`
is not included in the return value. The entire pass 2 computation is discarded except
for the side-effect of pushing warnings.

This means:
- `evaluateOverlapLimit` returns a result with `{ status, actual, limit, sharedCourses }`
  — never accessible to the caller
- `evaluateOutsideProgram` returns `{ status, actual, required, unit }` — discarded
- `evaluateProgramContextRef` returns `{ status, role, resolvedProgram }` — discarded

The only observable effect of pass 2 is warning emission (e.g., `overlap-limit-exceeded`).
Callers have no way to inspect which policy nodes are met or not-met, what the overlap
counts are, or what programs were resolved.

**Action:** Include `policyResults` in the return value, or attach the results to the
per-tree audit results so they're accessible through the existing `results` map.

### F2: Pass 2 never updates pass 1 tree statuses

Policy nodes (`overlap-limit`, `outside-program`, `program-context-ref`) return
`NOT_MET` as stubs during the single-tree pass 1 audit (`single-tree.js:89-93`).
Pass 2 evaluates them with multi-tree context, but **never writes the result back**
into the audit result tree. The tree statuses from pass 1 remain unchanged.

This means a graduation-requirements tree containing an `outside-program` node will
always have that node as `NOT_MET` in the result tree, even when the policy is satisfied.
The overall tree status is degraded (e.g., `PARTIAL_PROGRESS` instead of `MET`) because
the stub `NOT_MET` propagates through the composite.

The test at `multi-tree.test.js:354` demonstrates this:

```js
// The GRAD tree status is partial-progress because ENGL 101 is met but
// the outside-program node returns NOT_MET in single-tree mode
expect(results.get('GRAD').status).toBe(PARTIAL_PROGRESS);
```

This is testing the **broken** behavior as if it were correct. The intent is that
pass 2 should update the status to reflect the actual evaluation, but it doesn't.

**Action:** After pass 2, patch the audit result tree by replacing stub `NOT_MET`
nodes with the actual policy results, then re-compute composite statuses up the tree.
Alternatively, pass the multi-tree context into single-tree audit so policy nodes can
be evaluated inline.

### F3: `overlap-limit` node shape diverges from spec

The spec (`03-ast.md:470-486`) defines:

```json
{
  "type": "overlap-limit",
  "left": { "type": "variable-ref", "name": "coll" },
  "right": { "type": "program-context-ref", "role": "primary-major" },
  "constraint": { "comparison": "at-most", "value": 3, "unit": "courses" }
}
```

The implementation (`multi-tree.js:263-267`) expects:

```json
{
  "type": "overlap-limit",
  "programA": "PROG-A",
  "programB": "PROG-B",
  "comparison": "at-most",
  "value": 3,
  "unit": "courses"
}
```

Three differences:
- **Field naming:** `left`/`right` (spec) vs `programA`/`programB` (impl)
- **Nesting:** `constraint.comparison` (spec) vs flat `comparison` (impl)
- **Type:** `left`/`right` are AST nodes in the spec; `programA`/`programB` are
  plain strings in the implementation

Any parser producing spec-compliant ASTs will not work with this evaluator.

**Action:** Decide which shape is canonical. If the spec shape is correct, update
the evaluator to destructure `node.left`, `node.right`, `node.constraint`. If the
flat shape is intentional, update the spec.

### F4: `outside-program` node shape diverges from spec

Same pattern as F3. The spec (`03-ast.md:502-516`) defines:

```json
{
  "type": "outside-program",
  "program": { "type": "program-context-ref", "role": "primary-major" },
  "constraint": { "comparison": "at-least", "value": 72, "unit": "credits" }
}
```

The implementation expects `program` as a plain string and `comparison`/`value`/`unit`
flat on the node.

**Action:** Same as F3 — reconcile spec and implementation.

### F5: `auditMulti` API signature diverges from spec

| Aspect | Spec (`08-sdk.md`, `22-sdk-api-design.md`) | Implementation |
|--------|-----|------|
| Signature | `auditMulti(catalog, transcript, options)` | `auditMulti(trees, catalog, transcript, options)` |
| Trees | `options.trees` as `{ name: ast }` dict | First arg, array of `{ ast, programCode, role }` |
| Overlap rules | `options.overlapRules` (separate array) | Not accepted — inline in ASTs |
| Program context | `options.programContext` (role→name map) | Derived from `tree.role` |
| Assignments | `options.assignments` (pre-set) | Not supported |
| Return shape | `{ trees, overlapResults, courseAssignments }` | `{ results: Map, assignments: CourseAssignmentMap, warnings }` |

The argument order, trees shape, and return shape are all incompatible.

**Action:** This is a design decision — the implementation's array-of-objects approach
is arguably cleaner than the spec's dict-in-options approach. Update the spec to match
the implementation, or vice versa. The `assignments` (pre-set course assignments)
feature from the spec is absent and may be needed for advisor workflows.

### F6: `overlap_rules` placement contradicts spec validation rule

Spec validation rule 13 (`03-ast.md:595`):

> `overlap-limit` and `outside-program` nodes may only appear in the `overlap_rules`
> array of a root document, not inline in the requirement tree

The implementation requires them inline in the AST (discovered by `walkForPolicies`).
All tests place them inline. If AST validation enforced rule 13, the implementation's
own test ASTs would be rejected.

**Action:** Decide the canonical approach. The spec's separation (overlap rules as
a distinct input, not inline) has merit for clean data modeling. The implementation's
inline approach is simpler for the audit engine. One must change.

### F7: Catalog preparation duplicated between `audit` and `auditMulti`

`auditMulti` (lines 163-167) repeats the exact same catalog preparation sequence as
`prepareAudit` in `index.js` (lines 45-48):

```js
const norm = normalizeCatalog(catalog);
const catalogIndex = buildCourseIndex(norm.courses);
const crossListIndex = buildCrossListIndex(norm.courses);
const gradeConfig = norm.gradeConfig || catalog.gradeConfig;
```

Both build the same four structures from the same input. If catalog preparation
logic changes, both must be updated.

**Action:** Extract a shared `prepareCatalog(catalog)` helper that both `prepareAudit`
and `auditMulti` call.

---

## Findings — Test Improvements

### F8: outside-program "met" test only checks for absence of warnings

`multi-tree.test.js:310-330` ("sufficient credits outside program → met policy"):

```js
const { warnings } = auditMulti(trees, minimalCatalog, overlapTranscript);
const outsideWarnings = warnings.filter(w => w.type === 'outside-program-unresolved');
expect(outsideWarnings).toHaveLength(0);
```

This only verifies no `unresolved` warning was emitted. It does not assert that:
- The outside-program policy is MET
- The actual credit count matches expectations
- The GRAD tree status reflects the policy being met

The test would pass even if `evaluateOutsideProgram` were never called — the absence
of a warning doesn't prove presence of a correct result. (This is directly tied to
F1 — the policy results aren't returned, so there's nothing to assert against.)

### F9: outside-program "not-met" test asserts the wrong thing

`multi-tree.test.js:332-355` tests the insufficient-credits case by checking that
`GRAD` status is `PARTIAL_PROGRESS`. But this status comes from the single-tree stub
(`NOT_MET` for the outside-program node) — not from pass 2 evaluation. The test
passes because the stub is always `NOT_MET`, regardless of whether pass 2 runs or
the credit count is correct.

If pass 2 were deleted entirely, this test would still pass.

### F10: program-context-ref resolution status not verified

`multi-tree.test.js:400-414` ("resolves role and returns referenced program status")
checks that `MATH-CERT` is `NOT_MET` but never checks the `GRAD` tree's status or
verifies that the program-context-ref node was actually resolved by pass 2. Again,
this is untestable because pass 2 results are discarded (F1).

### F11: `percent` mode in overlap-limit untested

`evaluateOverlapLimit` (line 291-293) implements a `percent` unit mode:

```js
const totalA = ctx.assignments.getCoursesForProgram(programA).length;
actual = totalA > 0 ? Math.round((shared.length / totalA) * 100) : 0;
```

This has no test coverage. The percentage calculation is relative to programA only
(not the union or intersection), which may or may not be the intended semantics.
The `Math.round` means 50.5% rounds to 51% — this rounding behavior should be
documented and tested.

### F12: No test for overlap-limit with role-based references

All overlap-limit tests use direct program codes (`'PROG-A'`, `'PROG-B'`). None
test using role references (e.g., `programA: 'primary-major'`) that go through
`resolveProgram`. The integration test (`william-mary-multi.test.js`) uses
`program: 'BS-CSCI'` (direct code) for outside-program as well.

### F13: W&M integration test uses imprecise assertions

`william-mary-multi.test.js:215-220`:

```js
const csStatus = results.get('BS-CSCI').status;
expect([IN_PROGRESS, PARTIAL_PROGRESS]).toContain(csStatus);
```

This accepts either of two statuses without knowing which is correct. The partial
transcript should produce a deterministic status — the test should assert the exact
expected value.

Similarly, line 219:

```js
expect(collStatus).not.toBe(NOT_MET);
```

This accepts any of three statuses. Pin the exact expected value.

### F14: `CourseAssignmentMap` has no test for `entries()` or `size`

The `entries()` method (line 126) and `size` getter (line 120) are part of the
public API but have no direct tests. The `size` property is tested indirectly
in one assertion (`expect(assignments.size).toBe(0)` in the empty transcript test)
but `entries()` is never tested.

### F15: W&M integration test comments contain outdated assumptions

`william-mary-multi.test.js:173`:

```js
const outsideKeys = assignments.getCoursesOutsideProgram('BS-CSCI');
expect(outsideKeys.length).toBeGreaterThan(0);
```

Uses `toBeGreaterThan(0)` instead of an exact count. The number of courses outside
BS-CSCI is deterministic given the transcript — pin it.

---

## Confidence Assessment

### CourseAssignmentMap: High

- Clean, focused class with a single responsibility
- All methods tested directly with exact assertions
- Idempotent assign behavior tested
- Edge cases (empty map, unassigned keys) covered

### Pass 1 (independent tree auditing): High

- Delegates to the well-tested single-tree auditor
- Course assignment tracking via `collectMatchedEntries` is straightforward
- Warning aggregation with programCode annotation is correct
- Empty transcript, multiple trees, shared courses all tested

### Pass 2 (policy evaluation): Low

Critical issues:
- Policy results are **computed but discarded** — never returned to the caller (F1)
- Policy results **never update the tree statuses** from pass 1 (F2)
- Tests verify the **broken behavior** as correct (F9, F10)
- The only observable effect is warning emission, which is tested for overlap-limit
  but weakly tested for outside-program and program-context-ref
- Node shapes diverge from spec in every policy type (F3, F4, F6)

The evaluator functions themselves (`evaluateOverlapLimit`, `evaluateOutsideProgram`,
`evaluateProgramContextRef`) appear **internally correct** — they compute the right
values. But their results are thrown away, so correctness is moot.

### Spec compliance: Low

Every major aspect of the API diverges from the spec:
- API signature (F5)
- Node shapes (F3, F4)
- Policy node placement (F6)
- Return shape (F5)
- Missing features: pre-set assignments, `program` node evaluation

These are not subtle drift — they're wholesale reimaginings of the design. The spec
and implementation describe two different systems that happen to solve the same
problem. One must be updated to match the other.

---

## Action Items

| Priority | Finding | Action |
|----------|---------|--------|
| **Critical** | F1 | Return `policyResults` from `auditMulti` so callers can inspect policy evaluation |
| **Critical** | F2 | Write pass 2 results back into the audit result tree and recompute statuses |
| **High** | F3, F4 | Reconcile overlap-limit and outside-program node shapes with spec |
| **High** | F5 | Reconcile `auditMulti` API signature and return shape with spec |
| **High** | F6 | Decide canonical placement for overlap rules (inline vs separate) |
| **High** | F8, F9, F10 | Rewrite policy tests to verify actual policy results, not stub behavior |
| **Medium** | F7 | Extract shared catalog preparation helper |
| **Medium** | F11 | Add tests for `percent` mode in overlap-limit |
| **Medium** | F12 | Add tests for role-based references in overlap-limit |
| **Medium** | F13 | Pin exact expected statuses in W&M integration tests |
| **Low** | F14 | Add tests for `entries()` and `size` on CourseAssignmentMap |
| **Low** | F15 | Replace `toBeGreaterThan(0)` with exact counts |
