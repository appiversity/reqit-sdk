# Code Review Response — Review 04

## F1: All four renderer exports are `undefined` in the public API

**Verdict: Agree**

This is a critical bug. The renderer modules export `toText`, `toDescription`, `toOutline`, `toHTML` but `src/index.js` destructures them as `renderText`, `renderDescription`, `renderHtml`, `renderOutline` — all resulting in `undefined`. This predates the Phase 9–11 work but should have been caught during the index.js updates.

**Fix:** Update `src/index.js` imports to use the actual exported names (`toText`, `toDescription`, `toOutline`, `toHTML`). Align the public API export names with the spec (08-sdk.md uses `toText`, `toDescription`, `toOutline`, `toHTML`). This also resolves F4.

## F2: `auditMulti` and `CourseAssignmentMap` not exported from public API

**Verdict: Agree**

Both are exported from `src/audit/index.js` (line 125-126) but `src/index.js` only destructures `audit`, `prepareAudit`, `findUnmet`, `findNextEligible` — omitting `auditMulti` and `CourseAssignmentMap`. The spec explicitly defines `reqit.auditMulti()` as a core API function.

**Fix:** Add `auditMulti` and `CourseAssignmentMap` to the destructuring import from `./audit` and to `module.exports` in `src/index.js`.

## F3: No tests import from `src/index.js`

**Verdict: Agree**

The public API entry point is completely untested, which is why F1 and F2 went undetected. Every test imports directly from internal modules.

**Fix:** Create `test/api/public-api.test.js` — a smoke test that imports from `../../src/index` and verifies every exported function is defined and callable. This serves as a structural guard for the public API surface.

## F4: Renderer naming decision needed for public API

**Verdict: Agree — use spec names**

The spec (08-sdk.md:47-56) uses `toText`, `toDescription`, `toOutline`, `toHTML`. The modules already export these names. The `render*` names were a leftover from an earlier naming convention.

**Fix:** Addressed as part of F1 — the public API will export `toText`, `toDescription`, `toOutline`, `toHTML`.

## F5: `partial-progress` status not handled in HTML audit overlay

**Verdict: Agree**

`statusIndicator()` handles `met`, `in-progress`, `not-met` but `partial-progress` falls through to `default` returning empty string. The CSS class is applied correctly via `statusClass()`, but no visual indicator appears.

**Fix:** Add `case 'partial-progress'` to `statusIndicator()` using `◑` (U+25D1, circle with right half black) — visually distinct from met (checkmark), in-progress (circle outline &#9711;), and not-met (empty circle &#9675;). Add a test for `partial-progress` in `html-audit-overlay.test.js`.

## F6: Dead code — `resolvedAudit` assigned but unused

**Verdict: Agree**

`to-html.js:288` computes `resolvedAudit` from `auditNode.resolved` but never uses it. This is dead code.

**Fix:** Remove the dead variable assignment. If we later want to render resolved variable values, we can add it back with actual usage.

## F7: `isAncestorPath` duplicated across two export modules

**Verdict: Agree**

Identical 7-line function in `audit-export.js:106-112` and `program-checklist.js:133-139`. Both modules already import from `./index`.

**Fix:** Extract `isAncestorPath` to `src/export/index.js` and remove the local copies from both modules.

## F8: `course-filter` shows generic "Course filter" in audit export

**Verdict: Agree**

The audit export produces `Requirement: "Course filter"` which is unhelpful. `program-checklist.js` already has the right pattern (line 59-61) showing the actual filter description.

**Fix:** Replace `'Course filter'` with `Courses where ${desc}` using the same filter description pattern as `program-checklist.js`.

## F9: `findUnmet` in `index.js` uses hardcoded child property names

**Verdict: Partially Agree**

The review's quoted code snippet (hardcoded `!node.items && !node.source && ...`) does not match the current implementation — `findUnmet` in `src/audit/index.js:86-115` already uses `forEachChild` (refactored in Commit 3). However, the underlying problem is real: `next-eligible.js:131-158` has a full local copy (`findUnmetLeaves`) that duplicates `findUnmet` from `index.js`. The duplication exists solely to avoid a circular dependency (`next-eligible.js` can't import from `index.js` because `index.js` imports `next-eligible.js`).

**Fix:** Extract `findUnmet` into its own module (`src/audit/find-unmet.js`) so both `index.js` and `next-eligible.js` can import it without circular dependency. Remove the local `findUnmetLeaves` copy from `next-eligible.js`.

## F10: `buildPrereqGraph` has no direct unit tests

**Verdict: Agree**

The 70-line BFS transitive closure algorithm is only tested indirectly through export tests. Edge cases like cycles, missing courses, and courses referencing non-catalog courses are not explicitly tested.

**Fix:** Create `test/export/prereq-graph.test.js` with tests for: linear chain, diamond dependency, cycle handling (BFS terminates via visited set), missing course reference (silently skipped).

## F11: Export function test coverage is thin

**Verdict: Agree**

The export tests cover happy paths but miss edge cases. Will add targeted tests for the gaps identified.

**Fix:** Expand test coverage:
- `audit-export.test.js`: add `course-filter` with filter description, `attainment` node
- `html-audit-overlay.test.js`: add `partial-progress` status test, `except` with audit
- `program-checklist.test.js`: add `quantity` node test
- `dependency-matrix.test.js`: add disconnected components test

## F12: diff.test.js edge case gaps

**Verdict: Agree**

Missing tests for null/undefined root nodes and simultaneous add+remove+move.

**Fix:** Add 2-3 edge case tests: null root node, undefined root, complex array operations.

## F13: extract.test.js missing variable-ref scenario

**Verdict: Agree**

No test verifies courses inside `variable-def.value` are extracted. The code handles this correctly via `walk`, but an explicit test documents the behavior.

**Fix:** Add a test with a `variable-def` wrapping courses.

---

## Action Plan

| Priority | Finding(s) | Planned Fix | Commit Scope |
|----------|------------|-------------|--------------|
| Critical | F1, F2, F4 | Fix renderer imports to use spec names (`toText` etc.), add `auditMulti`/`CourseAssignmentMap` exports | `src/index.js` |
| Critical | F3 | Add public API smoke test verifying all exports are defined | `test/api/public-api.test.js` |
| High | F5 | Add `partial-progress` to `statusIndicator()` + test | `src/render/to-html.js`, `test/render/html-audit-overlay.test.js` |
| High | F8 | Show filter description in audit export course-filter case | `src/export/audit-export.js`, `test/export/audit-export.test.js` |
| High | F9 | Extract `findUnmet` into `src/audit/find-unmet.js`, remove duplicate from `next-eligible.js` | `src/audit/find-unmet.js`, `index.js`, `next-eligible.js` |
| Medium | F6 | Remove dead `resolvedAudit` variable | `src/render/to-html.js` |
| Medium | F7 | Extract `isAncestorPath` to `src/export/index.js` | `src/export/index.js`, `audit-export.js`, `program-checklist.js` |
| Medium | F10, F11 | Add prereq-graph unit tests + expand export test coverage | `test/export/prereq-graph.test.js`, various test files |
| Low | F12 | Add diff edge case tests (null roots, complex moves) | `test/ast/diff.test.js` |
| Low | F13 | Add extract test for variable-def courses | `test/ast/extract.test.js` |

## Deferred Items

None — all findings will be addressed.
