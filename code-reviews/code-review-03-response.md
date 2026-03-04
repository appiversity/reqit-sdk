# Code Review Response — Review 03

## F1: Pass 2 policy results are computed but never returned

**Verdict: Agree**

This is a real bug. `evaluateMultiTreePolicies` populates `ctx.policyResults` but `auditMulti` returns `{ results, assignments, warnings }` — `policyResults` is silently discarded. The only observable effect of pass 2 is warning emission.

**Fix:** Add `policyResults` to the return value of `auditMulti`. The array is already built — it just needs to be exposed:

```js
return { results, assignments, warnings, policyResults: multiCtx.policyResults };
```

This gives callers access to overlap counts, outside-program credit totals, and resolved program references — all of which are needed for UI rendering and debugging.

## F2: Pass 2 never updates pass 1 tree statuses

**Verdict: Agree**

This is the most important finding. Policy nodes return `NOT_MET` stubs in single-tree mode (`single-tree.js:93`), and pass 2 never writes the real results back. Any tree containing an `outside-program`, `program-context-ref`, or `overlap-limit` node will have a permanently degraded status.

The test at `multi-tree.test.js:354` documents the broken behavior as correct — it should assert the *intended* status after pass 2 patching.

**Fix:** After pass 2 completes, walk each tree's result looking for policy node types (`overlap-limit`, `outside-program`, `program-context-ref`). For each one found, replace its `status` with the value computed by the corresponding pass 2 evaluator. Then recompute composite statuses (`all-of`, `any-of`, etc.) up the tree. This is a post-order tree patch — replace leaves first, then recompute parents.

Implementation approach:
1. Build a lookup from `(ownerProgram, nodeType, nodeIdentifier)` → pass 2 result
2. `patchTreeStatuses(result, programCode, policyResultsLookup)` — recursive walk
3. When a policy node is found, replace its status from the lookup
4. On the way back up, recompute composite node statuses using the same `combineStatuses` logic from `status.js`

This is the approach over passing multi-tree context into single-tree, which would create a circular dependency (we need all tree results before we can evaluate policy nodes).

## F3: `overlap-limit` node shape diverges from spec

**Verdict: Agree**

The spec's shape (`left`/`right` as AST nodes, nested `constraint`) is more flexible than the flat `programA`/`programB` strings. The spec allows overlap-limit to reference program-context-refs and variable-refs, which the evaluator should resolve. The parser will produce spec-compliant nodes, so the evaluator must handle them.

**Fix:** Update `evaluateOverlapLimit` to destructure the spec shape only:
- `node.left` / `node.right` → resolve each as an AST node (if `program-context-ref`, resolve via roleMap; if `variable-ref`, resolve via the defs/scope chain)
- `node.constraint.comparison`, `node.constraint.value`, `node.constraint.unit`

Update all test ASTs in `multi-tree.test.js` and `william-mary-multi.test.js` to use the spec shape. No fallback for the old flat shape — tests exist to verify the data model, so they should break when the model changes and be updated accordingly.

## F4: `outside-program` node shape diverges from spec

**Verdict: Agree**

Same pattern as F3. The spec uses `program` as an AST node and nests the constraint. The implementation uses `program` as a plain string and flattens `comparison`/`value`/`unit`.

**Fix:** Update `evaluateOutsideProgram` to use the spec shape only:
- `node.program` → resolve as an AST node (program-context-ref or direct ref)
- `node.constraint.comparison`, `node.constraint.value`, `node.constraint.unit`

Update all test ASTs to use the spec shape. Same principle as F3 — no fallback shapes.

## F5: `auditMulti` API signature diverges from spec

**Verdict: Partially Agree**

The reviewer correctly identifies the divergences. However, the implementation's signature is cleaner than the spec's:

1. **Trees as first arg vs `options.trees`:** Trees are the primary input — they're not optional. Putting them in `options` obscures this. The implementation is right.
2. **Array of `{ast, programCode, role}` vs dict of `{name: ast}`:** The array preserves ordering (which matters for greedy strategy) and carries role information inline. The implementation is right.
3. **Role derived from tree vs separate `programContext` dict:** Collocating role with the tree is cleaner — no need to maintain a separate mapping. The implementation is right.
4. **Missing `assignments` (pre-set course assignments):** The spec's `assignments` feature for advisor workflows is absent. This is a real gap, but it's a future feature, not a current bug.

**Fix:** Update the spec (`08-sdk.md` and `22-sdk-api-design.md`) to match the implementation's signature. Add a note that pre-set `assignments` is planned for a future iteration.

## F6: `overlap_rules` placement contradicts spec validation rule

**Verdict: Agree**

The spec is right. Overlap rules and outside-program nodes are *about* relationships between trees — they are not requirements within a single tree. Placing them inline in ASTs means they always return `NOT_MET` in single-tree mode, which is confusing and pollutes requirement trees with un-evaluable nodes.

The spec's design (validation rule 13) is well thought out: policy nodes belong in a separate `overlap_rules` array at the document level, not inline in requirement trees.

**Fix:**
1. Add an `overlapRules` option to `auditMulti(trees, catalog, transcript, { overlapRules })` — an array of policy nodes (`overlap-limit`, `outside-program`, `program-context-ref`) evaluated in pass 2.
2. Remove `walkForPolicies` — no longer need to scan ASTs for inline policy nodes.
3. Pass 2 iterates `overlapRules` directly and evaluates each policy node.
4. Update all test ASTs to move policy nodes out of inline trees and into the `overlapRules` option.
5. Single-tree policy node stubs (`single-tree.js:89-93`) should emit a warning if encountered, since they indicate a misplaced node.

## F7: Catalog preparation duplicated between `audit` and `auditMulti`

**Verdict: Agree**

The 4-line catalog preparation sequence (`normalizeCatalog`, `buildCourseIndex`, `buildCrossListIndex`, grade config) is copy-pasted. If catalog preparation changes, both must be updated.

**Fix:** Extract a shared `prepareCatalog(catalog)` function that returns `{ norm, catalogIndex, crossListIndex, gradeConfig }`. Call it from both `prepareAudit` (in `index.js`) and `auditMulti` (in `multi-tree.js`). Place it in a new shared location, likely exported from `resolve/index.js` or a new `audit/catalog-context.js` module.

## F8: outside-program "met" test only checks for absence of warnings

**Verdict: Agree**

The test at `multi-tree.test.js:310-330` only verifies no `unresolved` warning was emitted. It doesn't assert that the policy is MET, that the credit count is 23, or that the GRAD tree status reflects the evaluation. This is a direct consequence of F1 — once policy results are returned, the test can assert:

```js
const outsideResult = policyResults.find(r => r.type === 'outside-program');
expect(outsideResult.status).toBe(MET);
expect(outsideResult.actual).toBe(23);
```

And once F2 is fixed, the GRAD tree status should be MET (both ENGL 101 met and outside-program met).

**Fix:** Rewrite after F1/F2 to assert `policyResults` values and corrected tree status.

## F9: outside-program "not-met" test asserts the wrong thing

**Verdict: Agree**

`multi-tree.test.js:332-355` tests the insufficient-credits case by checking `GRAD` status is `PARTIAL_PROGRESS`. But this comes from the single-tree stub (`NOT_MET` for outside-program node, `MET` for ENGL 101 → `PARTIAL_PROGRESS`). The test would pass even if pass 2 were deleted entirely.

**Fix:** After F1/F2, assert that:
- The outside-program policy result has `status: NOT_MET` and `actual: 23` (below the 50-credit requirement)
- The GRAD tree status is `PARTIAL_PROGRESS` — but now for the *right reason* (pass 2 patched the outside-program node to NOT_MET, which combines with ENGL 101 MET → PARTIAL_PROGRESS)

## F10: program-context-ref resolution status not verified

**Verdict: Agree**

Same pattern as F8/F9. The test at `multi-tree.test.js:400-414` checks `MATH-CERT` status but never verifies the program-context-ref was resolved or what the GRAD tree's status is after resolution.

**Fix:** After F1/F2, assert:
- `policyResults` contains a program-context-ref result with `resolvedProgram: 'MATH-CERT'`
- When MATH-CERT is MET and the ref resolves, GRAD's program-context-ref node should be MET
- GRAD tree status should be MET (all-of with one item that resolves to MET)
- When MATH-CERT is NOT_MET, GRAD's status should reflect NOT_MET through the ref

## F11: `percent` mode in overlap-limit untested

**Verdict: Agree**

The percent calculation at `multi-tree.js:291-292` has no test coverage. Additionally, the current implementation calculates percent based on course count (`shared.length / totalA`), but percent overlap should be based on credits — a 4-credit course represents more overlap than a 1-credit course.

**Fix:**
1. Change `evaluateOverlapLimit` percent mode to use credits: `(sharedCredits / totalCreditsA) * 100`
2. Add tests:
   - PROG-A has 10 credits total, 7 shared credits with PROG-B → 70% overlap
   - Test with limit 60 → exceeded (70 > 60)
   - Test with limit 75 → met (70 ≤ 75)

## F12: No test for overlap-limit with role-based references

**Verdict: Agree**

All overlap-limit tests use direct program code strings. None exercise `resolveProgram` through a role reference like `programA: 'primary-major'`.

**Fix:** Add a test where `programA` is a role string (`'primary-major'`) that resolves via the roleMap. Verify the overlap is correctly computed against the resolved program.

## F13: W&M integration test uses imprecise assertions

**Verdict: Agree**

`expect([IN_PROGRESS, PARTIAL_PROGRESS]).toContain(csStatus)` and `expect(collStatus).not.toBe(NOT_MET)` are both imprecise. The partial transcript is deterministic — the status should be pinned.

**Fix:** Run the audit against the partial transcript, determine the exact statuses for BS-CSCI, COLL, and GRAD-REQ, and pin them with exact `toBe()` assertions. The partial transcript has 3 in-progress CS core courses + 2 in-progress electives, which should produce `IN_PROGRESS` for BS-CSCI (with-constraint where all completed grades are above 2.0). COLL status depends on which courses have matching attributes — will determine by running the test.

## F14: `CourseAssignmentMap` has no test for `entries()` or `size`

**Verdict: Agree**

`entries()` is untested. `size` has one indirect test. These are public API methods.

**Fix:** Add a small test that populates a map, then asserts `size` and iterates `entries()` verifying the expected key-value pairs.

## F15: W&M integration test comments contain outdated assumptions

**Verdict: Agree**

`toBeGreaterThan(0)` at `william-mary-multi.test.js:173` should be an exact count. The courses outside BS-CSCI are deterministic from the cs-complete transcript.

**Fix:** Determine the exact count of courses outside BS-CSCI from the complete transcript and pin it. Based on the transcript, the non-matched courses should be: ENGL 150, HIST 101, MUSC 101, PHYS 101, SOCL 201, GBST 301, ANTH 305, ECON 350, GOVT 310, DATA 441 — 10 courses. Will verify by running the test.

---

## Action Plan

| Priority | Finding(s) | Planned Fix | Commit Scope |
|----------|------------|-------------|--------------|
| Critical | F1, F2, F8, F9, F10 | Return `policyResults` from `auditMulti`; patch tree statuses after pass 2; rewrite policy tests to assert actual results | `multi-tree.js`, `multi-tree.test.js` |
| High | F3, F4 | Update evaluators to spec-compliant node shapes only (nested `left`/`right`/`constraint`); update all tests to new shape | `multi-tree.js`, `multi-tree.test.js` |
| High | F6 | Move policy nodes out of inline ASTs into `overlapRules` option; remove `walkForPolicies`; add warning for misplaced inline policy nodes | `multi-tree.js`, `single-tree.js`, `multi-tree.test.js`, `william-mary-multi.test.js` |
| Medium | F7 | Extract shared `prepareCatalog()` helper used by both `prepareAudit` and `auditMulti` | new helper module, `index.js`, `multi-tree.js` |
| Medium | F11, F12 | Add percent mode test; add role-based reference test for overlap-limit | `multi-tree.test.js` |
| Medium | F13, F15 | Pin exact statuses and counts in W&M multi-tree integration tests | `william-mary-multi.test.js` |
| Low | F14 | Add `entries()` and `size` tests for `CourseAssignmentMap` | `multi-tree.test.js` |

## Deferred Items

| Finding | Rationale |
|---------|-----------|
| F5 (API signature) | The implementation's signature is cleaner than the spec's. Will update the spec in `reqit-specs` to match the implementation. No code change needed — this is a spec-side reconciliation. Pre-set `assignments` is a future feature. |
