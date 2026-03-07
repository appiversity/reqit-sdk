# Code Review Response — Review 07

## F1: Catalog index rebuilt on every `filterDeclaredPrograms()` call

**Verdict: Agree**

The reviewer is right — building a `Map` from `catalog.programs` on every call to `filterDeclaredPrograms()` is inconsistent with the established pattern where `ctx.catalogIndex` is built once for courses. The fix is straightforward: build `ctx.programIndex` (a `Map<code, program>`) once in `audit/index.js` and `multi-tree.js` context setup, then read it in both `filterDeclaredPrograms()` and `auditProgramRef()` (which also does a linear scan — see F2).

## F2: Linear scan for program lookup in `auditProgramRef()`

**Verdict: Agree**

Same issue as F1. `catalogPrograms.find(p => p.code === code)` at line 749 should use the `ctx.programIndex` Map. Will fix together with F1.

## F3: Cache returns mutable reference

**Verdict: Partially Agree**

The aliasing is intentional and the test (`expect(result1).toBe(result2)`) documents it. The reviewer acknowledges this works today because `recomputeStatus()` in multi-tree pass 2 doesn't mutate cached results. A shallow clone would break the cache identity test and add allocation overhead for no current benefit.

However, the reviewer's point about fragility is valid — a future developer mutating a cached result would get a subtle aliasing bug. The right fix is a comment at the cache-hit return, not a clone. Will add a comment explaining the intentional aliasing and the invariant that result trees must not be mutated after caching.

## F4: `visitedPrograms` guard interaction with cache

**Verdict: Agree**

The code is correct. The `visitedPrograms` set detects cycles (A → B → A), while `programCache` prevents redundant work for non-circular re-use. They serve complementary roles, and the interaction is non-obvious. Will add a comment explaining their relationship.

## F5: `program-filter` `or` conjunction not tested at audit level

**Verdict: Disagree**

The reviewer assumed the grammar supports `or` conjunction for program filters, referencing a `ProgramFilterJunction` rule. This rule does not exist. The actual grammar rule is `ProgramFilterList`:

```pegjs
ProgramFilterList
  = head:ProgramFilterField tail:(__ AND __ ProgramFilterField)* {
      return [head, ...tail.map(t => t[3])];
    }
```

Only `AND` is supported — the flat `filters` array always represents a conjunction. This matches `course-filter`'s `FilterList` rule, which also only supports `AND`. There is no `or` path, no dead code, and no semantic mismatch. The audit code treating filters as conjunctive is correct.

## F6: `auditProgramFilter` short-circuit may under-populate items

**Verdict: Agree**

The short-circuit is intentional and correct for audit status computation. The reviewer's concern about export consumers seeing incomplete lists is valid but acceptable — the `any` quantifier semantically means "at least one program satisfies this," so showing only the first MET program is sufficient. Exporters don't need the full list because unmatched programs aren't relevant to the student.

Will add a JSDoc note documenting that `items` may be a subset when `any` short-circuits.

## F7: No test for `findUnmet` with `program-ref` nodes

**Verdict: Agree**

`findUnmet()` uses `forEachChild()` which traverses `program-ref.result` via CHILD_PROPS. The traversal should work, but the path construction at `find-unmet.js:47-52` for the non-array single-child case (`walkResult(child, [...path, key])`) hasn't been verified for `program-ref`. Will add a test.

## F8: No test for `findNextEligible` with `program-ref`

**Verdict: Agree**

`findNextEligible()` calls `findUnmet()` and then collects `course` and `course-filter` nodes. Courses inside an unmet `program-ref` sub-audit should surface as eligible candidates. Will add a test proving this works end-to-end.

## F9: `program-filter` test uses `toBeGreaterThanOrEqual` instead of exact count

**Verdict: Agree**

The comment on line 183-184 even says "items should have length 2." The `any` quantifier with two NOT_MET results won't short-circuit, so both items are always present. Fix: `expect(result.items).toHaveLength(2)`.

## F10: No test for waivers applied to sub-audit requirements

**Verdict: Agree**

The sub-context inherits `ctx.waivers` via the spread at line 774. This means a waiver for MATH 151 in the parent program's audit options will also waive MATH 151 inside a `program "MATH-MINOR"` sub-audit. This is the correct semantic — waivers are institution-level decisions that apply regardless of which program tree is being evaluated. If the registrar waives MATH 151 for a student, it should be waived everywhere.

Will add a test proving waiver inheritance works in sub-audits, with a comment documenting the intended semantics.

## F11: `programCache` not shared across trees in multi-tree

**Verdict: Agree**

The code is correct — per-tree caches are necessary because different trees have independent contexts (different `visitedPrograms`, potentially different course availability after overlap assignment). Will add a comment at multi-tree.js:204 explaining the design choice.

## F12: `program-filter` `or` conjunction — grammar vs audit semantics

**Verdict: Disagree**

Same as F5. The grammar does not support `or` conjunction for program filters. `ProgramFilterList` uses `AND` exclusively. There is no `ProgramFilterJunction` rule. No gap exists between grammar and audit semantics.

## F13: HTML audit overlay handles `notDeclared` but not sub-audit drilldown

**Verdict: Agree (defer)**

The reviewer correctly identifies that the HTML renderer shows program-ref status but doesn't expand the sub-audit tree. This is reasonable for the current summary-view use case. Sub-audit drilldown rendering would be a separate enhancement that should be designed alongside the broader HTML audit visualization work — it needs thought about collapse/expand UX, indentation, and how deeply nested program-ref chains display.

Deferring this to a future enhancement. No code change now.

## F14: Exporter `audit-export.js` doesn't recurse into sub-audit results

**Verdict: Disagree**

The reviewer initially thought the `break` in the switch would prevent recursion, then self-corrected: `walk()` calls the callback and then always recurses into children via `forEachChild()`. The switch statement in the callback only controls row generation, not traversal. Since `CHILD_PROPS` maps `program-ref` → `{ key: 'result' }`, the walker will descend into the sub-audit tree and produce rows for inner courses automatically.

That said, the reviewer's suggestion to add a verification test is good. Will add a test confirming that audit export of a program-ref with a sub-audit produces rows for both the summary row and the inner courses.

---

## Action Plan

| Priority | Finding(s) | Planned Fix | Commit Scope |
|----------|------------|-------------|--------------|
| Medium | F7, F8 | Add `findUnmet()` and `findNextEligible()` tests with program-ref sub-audits | Tests |
| Medium | F10 | Add waiver-in-sub-audit test with comment documenting intended semantics | Tests |
| Low | F1, F2 | Build `ctx.programIndex` once in `audit/index.js` and `multi-tree.js`; use in `auditProgramRef()` and `filterDeclaredPrograms()` | Audit context setup |
| Low | F3, F4, F11 | Add comments: cache aliasing invariant, visitedPrograms+cache interaction, per-tree cache rationale | Comments |
| Low | F6 | Add JSDoc note on short-circuit behavior in `auditProgramFilter` | Comment |
| Low | F9 | Change `toBeGreaterThanOrEqual(1)` → `toHaveLength(2)` | Test fix |
| Low | F14 | Add export test verifying sub-audit row generation | Test |

## Deferred Items

| Finding | Rationale |
|---------|-----------|
| F13 | Sub-audit drilldown in HTML renderer is an enhancement that needs UX design for collapse/expand, indentation, and nesting depth. Will address alongside broader HTML audit visualization work. |
| F5, F12 | No action needed — the premise was incorrect. Grammar does not support `or` conjunction for program filters. |
