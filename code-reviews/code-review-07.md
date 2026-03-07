# Code Review 07 — SDK Implementation of Program References (Issue #2)

## Scope

Review of the reqit-sdk implementation of `program-ref`, `program-filter`,
`program`, and `program-context-ref` — the four program-related AST node types.
This covers grammar, AST validation, all 4 renderers, single-tree audit
(sub-audits), multi-tree integration, exporters, and utilities.

**Files reviewed:**

| Area | Files | Lines (approx) |
|------|-------|----------------|
| Grammar | `src/parser/grammar.pegjs` (program rules) | ~80 |
| AST | `src/ast/children.js`, `src/ast/validate.js` | ~120 |
| Shared | `src/render/shared.js` (NODE_TYPES, helpers) | ~40 |
| Renderers | `to-text.js`, `to-outline.js`, `to-description.js`, `to-html.js` | ~120 |
| Single-tree audit | `src/audit/single-tree.js:732-884` | ~153 |
| Multi-tree audit | `src/audit/multi-tree.js:195-225, 609-625` | ~45 |
| Audit entry | `src/audit/index.js:79-82` | ~4 |
| Utilities | `src/audit/find-unmet.js`, `src/audit/next-eligible.js` | ~127 |
| Exporters | `src/export/audit-export.js:100-124`, `program-checklist.js:124-141` | ~40 |
| Tests | 7 test files (parser, audit, integration, multi-tree) | ~1,262 |

**Test suite:** 2,405 tests passing (84 suites), 99 program-specific.

---

## Architecture Overview

The program reference feature spans every layer of the SDK:

```
Grammar (PEG rules)
  ↓ parse
AST (4 node types in NODE_TYPES + CHILD_PROPS + validation rules 10, 16, 17)
  ↓ render
4 renderers (to-text, to-outline, to-description, to-html)
  ↓ audit
single-tree.js: auditProgramRef(), auditProgramFilter()
  ↓ multi-tree
multi-tree.js: collectSubProgramAssignments(), declaredPrograms context
  ↓ export
audit-export.js + program-checklist.js: row generation
  ↓ utilities
find-unmet.js + next-eligible.js: implicit via forEachChild traversal
```

All layers are implemented and tested. The architecture follows established
patterns — `forEachChild`/`CHILD_PROPS` for traversal, `NODE_TYPES` for
exhaustiveness, switch-based dispatch in renderers and auditor.

---

## Findings — Code Quality

### F1: Catalog index rebuilt on every `filterDeclaredPrograms()` call

**Location:** `src/audit/single-tree.js:851-856`

```javascript
function filterDeclaredPrograms(declaredPrograms, filters, ctx) {
  const catalogPrograms = (ctx.catalog && ctx.catalog.programs) || [];
  const catalogIndex = new Map();
  for (const p of catalogPrograms) {
    catalogIndex.set(p.code, p);
  }
  // ...
}
```

Every call to `auditProgramFilter()` builds a new `Map` from the catalog
programs array. If a requirement tree has multiple `program-filter` nodes, this
is duplicated work. The catalog programs don't change between calls.

**Suggested action:** Build the program index once in the audit context setup
(`audit/index.js` and `multi-tree.js`), store it as `ctx.programIndex`, and
read it in `filterDeclaredPrograms()`. This matches how `ctx.catalogIndex`
already works for courses.

**Priority:** Low — Program arrays are typically small (< 20 entries), so the
performance impact is negligible. But it violates the established pattern where
indexes are built once in context setup.

### F2: Linear scan for program lookup in `auditProgramRef()`

**Location:** `src/audit/single-tree.js:748-749`

```javascript
const catalogPrograms = (ctx.catalog && ctx.catalog.programs) || [];
const program = catalogPrograms.find(p => p.code === code);
```

Uses `Array.find()` for program lookup, while course lookup uses
`ctx.catalogIndex` (a pre-built Map). Same concern as F1 — not a performance
issue at current scale but inconsistent with established patterns.

**Suggested action:** Use the program index from F1:
`const program = ctx.programIndex.get(code)`.

**Priority:** Low

### F3: Cache returns mutable reference

**Location:** `src/audit/single-tree.js:743-745`

```javascript
if (ctx.programCache && ctx.programCache.has(code)) {
  return ctx.programCache.get(code);
}
```

The cached result object is returned by reference. If any downstream code
mutates the result (e.g., adding audit overlay properties, or status patching
in multi-tree pass 2), all references see the mutation. The caching test
(`program-ref.test.js:204-233`) even asserts `expect(result1).toBe(result2)`
— confirming identity, not just equality.

Currently this works because the multi-tree pass 2 rebuilds status from
scratch via `recomputeStatus()` rather than mutating cached results. But it's
fragile — any future mutation of result trees would create aliasing bugs.

**Suggested action:** Document the intentional aliasing in a comment, or
shallow-clone on cache hit: `return { ...ctx.programCache.get(code) }`.

**Priority:** Medium — Not a bug today, but the aliasing is non-obvious and
could become one.

### F4: `visitedPrograms` guard has a subtle correctness issue

**Location:** `src/audit/single-tree.js:760-781`

```javascript
visitedPrograms.add(code);
// ... run sub-audit ...
visitedPrograms.delete(code);
```

The add-then-delete pattern handles the recursive case: A → B → A detects the
cycle on the second visit to A. But it means after A's sub-audit completes, A
is removed from the visited set. If A appears again later in a sibling branch
(not a circular reference), it won't be detected as visited — which is correct
behavior, since that's a legitimate re-use, not a cycle.

However, this interacts with the cache (F3): the second reference to A will
hit the cache and return the same result. The visited-set cleanup is therefore
redundant when caching is enabled — the cache will prevent re-evaluation
regardless. If caching were disabled (e.g., `programCache` is null), the
visited-set pattern would correctly allow non-circular re-evaluation.

**Suggested action:** Add a comment explaining the interaction between
`visitedPrograms` and `programCache` — they serve complementary roles
(cycle detection vs. performance).

**Priority:** Low — Correct as-is, just non-obvious.

### F5: `program-filter` `or` conjunction not tested at audit level

**Location:** Grammar supports `or` conjunction for program filters, and
`filterDeclaredPrograms()` at `single-tree.js:863` iterates filters as
implicit `and` (all filters must match). If a parsed `or` filter produces
separate filter entries, the current `and` logic would be incorrect.

Looking at the grammar: `ProgramFilterJunction` uses `"and"` / `"or"` between
conditions. The parser likely produces a flat `filters` array. The audit code
treats them as conjunctive (all must pass). This is consistent if the parser
flattens `and`-joined filters into a single array and represents `or` as
separate filter groups. But without a test proving the `or` path works
end-to-end, it's unclear.

**Suggested action:** Trace the `or` path from grammar through to
`filterDeclaredPrograms()`. If `or` produces a flat array, it's being treated
as `and` — which is a bug. If it produces nested structure, add a test.

**Priority:** Medium — Potential semantic bug if `or` is supported in grammar
but treated as `and` in audit.

### F6: `auditProgramFilter` short-circuit may under-populate items

**Location:** `src/audit/single-tree.js:820-821`

```javascript
// Short-circuit: for 'any', stop after first MET
if (node.quantifier === 'any' && refResult.status === MET) break;
```

When using `any` quantifier, evaluation stops after the first MET program.
The `items` array will contain only programs evaluated up to that point.
This is correct for status computation but means the result tree doesn't
show all matching programs — only those evaluated before the short-circuit.

This is an intentional performance optimization documented in the code.
However, consumers that inspect `items` to list "all matching programs"
(e.g., exporters, UI displays) will see an incomplete list.

**Suggested action:** Document the short-circuit behavior in the JSDoc.
Consider whether exporters need the full list.

**Priority:** Low — Performance trade-off is reasonable for audit, but
export consumers should be aware.

---

## Findings — Test Quality

### F7: No test for `findUnmet` with `program-ref` nodes

**Location:** `test/audit/` — no test file exercises `findUnmet()` on a
result tree containing `program-ref` nodes.

`findUnmet()` uses `forEachChild()` for traversal, and `CHILD_PROPS` maps
`program-ref` to `{ key: 'result', array: false }`. So `findUnmet` *will*
recurse into the sub-audit result tree. But there's no test proving:
- An unmet course inside a `program-ref` sub-audit appears in `findUnmet()` output
- The path annotation correctly includes the `result` property

**Suggested action:** Add a test in `test/audit/` that runs `findUnmet()`
on an audit result containing a `program-ref` with unmet inner requirements.
Verify the unmet courses are surfaced with correct paths.

**Priority:** Medium — `forEachChild` traversal should handle this correctly,
but the path construction at `find-unmet.js:47-52` hasn't been verified for
the `program-ref.result` (non-array, single child) case.

### F8: No test for `findNextEligible` with `program-ref`

**Location:** `src/audit/next-eligible.js:53-75`

`findNextEligible()` collects courses from unmet nodes of type `course` or
`course-filter`. It calls `findUnmet()` which traverses into `program-ref`
sub-audits. So courses from unmet program-ref sub-audits *should* appear as
eligible candidates. But no test verifies this path.

**Suggested action:** Add a test where a program-ref sub-audit has unmet
course requirements, and verify those courses appear in `findNextEligible()`
output.

**Priority:** Medium

### F9: `program-filter` test uses `toBeGreaterThanOrEqual` instead of exact count

**Location:** `test/audit/program-filter.test.js:185`

```javascript
expect(result.items.length).toBeGreaterThanOrEqual(1);
```

Per CLAUDE.md coding standards: "Use `toHaveLength(N)` with exact expected
counts, not `toBeGreaterThan(0)`." The test should assert exactly 2 items
(MATH-MINOR and CS-CERT match the `in` filter).

However — the `any` quantifier short-circuits (F6), so after the first
matching program evaluates, it might stop. Since neither has catalog
requirements, both will be NOT_MET, so no short-circuit occurs and both
should be evaluated. The assertion should be `toHaveLength(2)`.

**Suggested action:** Change to `expect(result.items).toHaveLength(2)`.

**Priority:** Low — Violates stated coding standard.

### F10: No test for waivers applied to sub-audit requirements

**Location:** `src/audit/single-tree.js:774-778`

```javascript
const subCtx = {
  ...ctx,
  defs: subDefs,
  expanding: new Set(),
};
```

The sub-context inherits `ctx.waivers` and `ctx.substitutions` via the spread.
This means waivers defined for the parent audit also apply inside sub-audits.
This may or may not be the intended behavior (should a waiver for MATH 151 in
the main program also waive it inside a minor's sub-audit?). No test covers
this scenario either way.

**Suggested action:** Add a test that applies a waiver in the parent context
and verifies whether it applies (or doesn't apply) inside a `program-ref`
sub-audit. Document the intended behavior.

**Priority:** Medium — Semantic ambiguity with no test coverage.

### F11: `programCache` not shared across trees in multi-tree

**Location:** `src/audit/multi-tree.js:204`

```javascript
programCache: new Map(),
```

Each tree in `auditMulti()` gets a fresh `programCache`. If two programs
(e.g., BS-CMPS and BS-DATA) both reference the same sub-program (e.g.,
`program "MATH-MINOR"`), the sub-audit runs twice — once per tree.

This is actually the *correct* behavior: different trees may have different
`visitedPrograms` sets and different course availability (due to overlap
assignments). Sharing the cache would be incorrect.

**Suggested action:** No code change needed. Add a comment at line 204
explaining why the cache is per-tree: course assignments from other trees
may change which courses are available for sub-audits.

**Priority:** Low — Code is correct; just undocumented design choice.

---

## Findings — Spec Alignment

### F12: `program-filter` `or` conjunction — grammar vs audit semantics

**Location:** Grammar supports `or` between filter conditions. The audit
engine at `single-tree.js:863` treats `node.filters` as a flat array with
implicit `and` semantics.

Need to verify: does the parser produce different AST shapes for `and` vs
`or`? If `or` produces a different structure (e.g., nested arrays, or a
`conjunction` field), the audit engine needs to handle it. If the parser
only supports `and` despite the grammar rule existing, the grammar rule
is dead code.

**Suggested action:** Trace the grammar `ProgramFilterJunction` rule to
determine what AST shape `or` produces, and ensure audit handles it.

**Priority:** Medium — Potential gap between grammar and audit semantics.

### F13: HTML audit overlay handles `notDeclared` but not sub-audit drilldown

**Location:** `src/render/to-html.js:385-392`

```javascript
case 'program-ref': {
  let html = `<span class="reqit-program-ref${sc}">${si}Program &quot;${esc(node.code)}&quot;`;
  if (auditNode && auditNode.notDeclared) {
    html += ' <em>(not declared)</em>';
  }
  html += '</span>';
  return html;
}
```

When a `program-ref` has a sub-audit result (`auditNode.result`), the HTML
renderer doesn't render the sub-audit tree. It shows the program name and
status indicator but not the inner requirements. For the audit overlay to be
useful for program references, it should optionally expand the sub-audit.

**Suggested action:** Consider adding recursive rendering of
`auditNode.result` inside the `program-ref` span, controlled by an option
(e.g., `expandProgramRefs: true`). Not urgent — the current flat display
is reasonable for summary views.

**Priority:** Low — Enhancement, not a bug.

### F14: Exporter `audit-export.js` doesn't recurse into sub-audit results

**Location:** `src/export/audit-export.js:100-110`

```javascript
case 'program-ref':
  rows.push({
    Group: group,
    Requirement: `Program: "${node.code}"`,
    Status: node.status,
    'Satisfied By': node.notDeclared ? 'Not declared' : '',
    // ...
  });
  break;
```

The audit export produces one row per `program-ref`, showing the overall
status. It doesn't walk into `node.result` to export the sub-audit's
individual requirements. This means exported audit reports will have a single
"Program: MATH-MINOR" row with MET/NOT_MET but no detail about which
sub-requirements are met/unmet.

The `walk()` function used by the exporter traverses children via the AST
walker, but `program-ref` child property is `result` which is the *audit
result*, not an AST child. The walker follows `CHILD_PROPS` which maps
`program-ref` → `{ key: 'result' }`, so it will descend. But the exporter
has an explicit `case 'program-ref'` that pushes a row and `break`s — the
walker won't recurse into `result` because the switch statement handles it.

Wait — re-reading the code: the exporter uses `walk()` which calls the
callback for every node and then recurses into children regardless. The
`switch` statement in the callback produces rows for leaf-like types. The
walker will still recurse into `node.result` after the callback. So child
courses inside the sub-audit *will* get their own rows.

**Suggested action:** Verify with a test that audit export of a `program-ref`
with a sub-audit produces rows for both the program-ref itself and the inner
courses. If so, no code change needed.

**Priority:** Low — Likely correct, needs verification test.

---

## Confidence Assessment

### Grammar & Parser: High
60 dedicated parser tests for program-related syntax. Round-trip tests verify
parse → render → parse for `program-ref` and `program-filter`. Grammar rules
are clean and follow established patterns. Disambiguation with `program` as
overlap target is tested.

### AST Validation: High
Rules 10, 16, 17 validate program node shapes. `CHILD_PROPS` entries are
registered. Exhaustiveness tests will catch any missing node types.

### Renderers: High
All 4 renderers handle all 4 program node types. to-text round-trips
correctly. HTML renderer includes audit-aware display with `notDeclared`.
Display renderers use `comparisonPhrase` consistently.

### Single-tree Audit: Medium-High
Core logic (`auditProgramRef`, `auditProgramFilter`) is well-tested with 16
focused tests. Circular reference guard, caching, quantifier semantics,
metadata fallback — all covered. Concerns: `or` conjunction path (F5, F12),
waiver inheritance into sub-audits untested (F10), cache mutability (F3).

### Multi-tree Integration: Medium
3 dedicated tests verify sub-program course tracking in
`CourseAssignmentMap`. `collectSubProgramAssignments()` correctly walks result
trees. Per-tree cache isolation is correct. Concern: no test for complex
scenarios (program-ref within program-ref, overlap policies referencing
sub-programs).

### Utilities (findUnmet, findNextEligible): Medium
Both use `forEachChild` which handles `program-ref` via `CHILD_PROPS`, so
they should work. But neither has dedicated tests proving they surface
requirements from within program-ref sub-audits (F7, F8).

### Exporters: Medium
Both `audit-export.js` and `program-checklist.js` have `case` branches for
`program-ref` and `program-filter`. The walker should recurse into sub-audit
results. No dedicated export test for program-ref with sub-audit content (F14).

---

## Action Items

| Priority | Finding | Action |
|----------|---------|--------|
| Medium | F3 | Document cache aliasing behavior or shallow-clone on cache hit |
| Medium | F5 | Trace `or` conjunction from grammar through audit — verify correctness or identify bug |
| Medium | F7 | Add `findUnmet()` test with `program-ref` sub-audit |
| Medium | F8 | Add `findNextEligible()` test with `program-ref` sub-audit |
| Medium | F10 | Add test for waiver behavior in sub-audits; document intended semantics |
| Medium | F12 | Verify grammar `or` produces correct AST shape and audit handles it |
| Low | F1 | Build program index once in audit context (match course index pattern) |
| Low | F2 | Use program index for lookup (match course lookup pattern) |
| Low | F4 | Add comment explaining visitedPrograms + programCache interaction |
| Low | F6 | Document short-circuit behavior in JSDoc |
| Low | F9 | Fix `toBeGreaterThanOrEqual(1)` → `toHaveLength(2)` per coding standards |
| Low | F11 | Add comment explaining why programCache is per-tree in multi-tree |
| Low | F13 | Consider expandable sub-audit rendering in HTML overlay |
| Low | F14 | Add export test verifying sub-audit row generation |
