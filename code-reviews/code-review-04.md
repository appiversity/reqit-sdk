# Code Review 04 — Full SDK Pre-Release Review (Phases 9–12 Focus)

## Scope

Full project review with focus on Phases 9–11 (utility functions, audit helpers,
export subsystem) and Phase 12 readiness (public API surface, spec compliance).
This is the last review before creating the public/exported SDK and documentation.

**Source:** 31 files, 11,757 lines across `src/`
**Tests:** 72 suites, 1,883 tests (all passing)
**Reviewed prior reports:** code-review-01 (renderers/resolver), code-review-02
(single-tree audit), code-review-03 (multi-tree audit)

---

## Architecture Overview

| Module | Lines | Responsibility |
|--------|-------|----------------|
| `src/index.js` | 63 | Public API exports |
| `src/ast/children.js` | 96 | `forEachChild`, `CHILD_PROPS` — canonical child enumeration |
| `src/ast/walk.js` | 107 | `walk()`, `transform()` — generic tree traversal |
| `src/ast/diff.js` | 223 | `diff()` — structural AST comparison |
| `src/ast/extract.js` | 79 | `extractCourses()`, `extractAllReferences()` |
| `src/audit/next-eligible.js` | 160 | `findNextEligible()` |
| `src/export/index.js` | 31 | `formatResult()` dispatcher |
| `src/export/serialize.js` | 70 | `toCSV()`, `toXLSX()` serializers |
| `src/export/prereq-graph.js` | 70 | `buildPrereqGraph()` — shared graph builder |
| `src/export/prereq-matrix.js` | 87 | `exportPrereqMatrix()` |
| `src/export/program-checklist.js` | 141 | `exportProgramChecklist()` |
| `src/export/audit-export.js` | 114 | `exportAudit()` |
| `src/export/dependency-matrix.js` | 65 | `exportDependencyMatrix()` |
| `src/render/to-html.js` | 367 | `toHTML()` with audit overlay |
| (remaining) | ~10,084 | Parser, validator, renderers, resolver, grade, audit (reviewed in CR-01–03) |

Module boundaries are clean. The export subsystem is well-structured with a
shared serializer and graph builder. The AST utility layer (`ast/*.js`) is
well-factored around the canonical `forEachChild` + `CHILD_PROPS`.

---

## Findings — Critical Bugs

### F1: All four renderer exports are `undefined` in the public API

**Location:** `src/index.js:9-12`, `src/render/to-*.js` module.exports

Every renderer module exports under the `to*` name:

```js
// to-html.js:367
module.exports = { toHTML };
// to-text.js:221
module.exports = { toText };
// to-description.js:196
module.exports = { toDescription };
// to-outline.js:220
module.exports = { toOutline };
```

But `src/index.js` destructures with `render*` names:

```js
const { renderText } = require('./render/to-text');         // → undefined
const { renderDescription } = require('./render/to-description'); // → undefined
const { renderHtml } = require('./render/to-html');         // → undefined
const { renderOutline } = require('./render/to-outline');   // → undefined
```

**Runtime verification confirms all four are `undefined`:**

```
$ node -e "const m = require('./src/index.js'); console.log(typeof m.renderText)"
undefined
```

Any consumer calling `reqit.renderText()` (or any renderer) gets a
`TypeError: reqit.renderText is not a function` at runtime.

**Root cause:** The modules were originally written with `render*` names,
then renamed to `to*` to match the spec — but `src/index.js` imports were
not updated.

**No tests catch this** because no tests import from `src/index.js`. Every
test imports directly from the internal module (e.g.,
`require('../../src/render/to-text')`).

**Action:** Fix the imports in `src/index.js`. Decide on the canonical public
name (`toText` vs `renderText`). The spec uses `toText`, `toDescription`,
`toOutline`, `toHTML` (08-sdk.md:47-56). Recommend aligning with spec.

### F2: `auditMulti` and `CourseAssignmentMap` not exported from public API

**Location:** `src/index.js` (missing), `src/audit/index.js:125-126` (present)

Both are exported from `src/audit/index.js` but `src/index.js` does not import
or re-export them. The spec (08-sdk.md:86-107) defines `reqit.auditMulti()` as
a core API function.

**Runtime verification:**

```
$ node -e "const m = require('./src/index.js'); console.log(typeof m.auditMulti)"
undefined
```

**Action:** Import and export both from `src/index.js`.

---

## Findings — Public API / Spec Compliance

### F3: No tests import from `src/index.js`

**Location:** All 72 test files

Every test imports from internal modules (e.g., `../../src/render/to-text`,
`../../src/audit/index`). Zero tests use `require('reqit')` or
`require('../../src/index')`.

This means the public API entry point — the only thing consumers actually use —
is completely untested. F1 and F2 above were undetected because of this gap.

**Action:** Phase 12 must include integration tests that exercise the public
API through `src/index.js`. At minimum, a smoke test verifying every export
is defined and callable.

### F4: Renderer naming decision needed for public API

**Location:** `src/index.js:31-34`, spec 08-sdk.md:47-56

The spec uses `reqit.toText()`, `reqit.toDescription()`, `reqit.toOutline()`,
`reqit.toHTML()`. The modules already export these names. The only question is
what `src/index.js` should expose.

Two options:
1. **Spec names** (`toText`, `toDescription`, `toOutline`, `toHTML`) — matches
   spec, matches module exports, natural naming
2. **Prefixed names** (`renderText`, etc.) — distinguishes renderers from other
   functions, avoids confusion with `toCSV`/`toXLSX` (internal serializers)

**Recommendation:** Use spec names. They match the spec, match the module
exports, and are what users will expect from documentation.

### F5: `partial-progress` status not handled in HTML audit overlay

**Location:** `src/render/to-html.js:230-238`

`statusIndicator()` handles `met`, `in-progress`, `not-met` but not
`partial-progress`. The `partial-progress` status falls through to the
`default` branch, returning empty string (no indicator). The CSS class *is*
applied correctly via `statusClass()` (`reqit-status-partial-progress`),
but no indicator icon appears.

**Action:** Add a `partial-progress` case to `statusIndicator()`. Use a
distinct indicator (e.g., half-circle `◔` or similar).

### F6: Dead code in HTML audit overlay — `resolvedAudit` assigned but unused

**Location:** `src/render/to-html.js:288`

```js
case 'variable-ref': {
  const ref = node.scope ? `$${esc(node.scope)}.${esc(node.name)}` : `$${esc(node.name)}`;
  const resolvedAudit = auditNode && auditNode.resolved ? auditNode.resolved : null;
  return `<span class="reqit-variable-ref${sc}">${si}${ref}</span>`;
}
```

`resolvedAudit` is computed but never used in the return value. This is dead
code — likely a leftover from a planned feature to render the resolved value.

**Action:** Remove the dead variable assignment, or implement the intended
behavior (recurse into `resolvedAudit` to render the expanded value).

---

## Findings — Code Smells

### F7: `isAncestorPath` duplicated across two export modules

**Location:** `src/export/audit-export.js:106-112`,
`src/export/program-checklist.js:133-139`

Identical 7-line function copied between two modules. Both use the same
`labelStack` + `walk` pattern for tracking nested labeled groups.

```js
function isAncestorPath(pathA, pathB) {
  if (pathA.length >= pathB.length) return false;
  for (let i = 0; i < pathA.length; i++) {
    if (pathA[i] !== pathB[i]) return false;
  }
  return true;
}
```

**Action:** Extract to a shared location (e.g., `src/export/index.js` or a
shared utility). Both modules already import from `./index`.

### F8: `course-filter` shows "Course filter" in audit export

**Location:** `src/export/audit-export.js:66`

When exporting an audit result, `course-filter` nodes produce:

```
Requirement: "Course filter"
```

This is generic and unhelpful — the user can't tell which filter is unmet.
Contrast with `program-checklist.js:59-61` which shows the actual filter
description (`"Courses where subject = "MATH" and number >= 300"`).

**Action:** Show the filter description using the same pattern as
`program-checklist.js`:

```js
const desc = node.filters
  .map(f => `${f.field} ${f.op} ${JSON.stringify(f.value)}`)
  .join(' and ');
// → Requirement: `Courses where ${desc}`
```

### F9: `findUnmet` in `index.js` uses hardcoded child property names

**Location:** `src/audit/index.js:88-113`, `src/audit/next-eligible.js:131-158`

`findUnmet` in `index.js` hardcodes child property names for leaf detection:

```js
const isLeaf = !node.items && !node.source && !node.requirement
  && !node.resolved && !node.exclude;
```

Meanwhile, `next-eligible.js:131-158` has a local `findUnmetLeaves` copy that
uses `forEachChild()` for leaf detection — which is more correct because it
stays in sync with `CHILD_PROPS` and handles future node types automatically.

**Action:** Update `findUnmet` in `index.js` to use `forEachChild` for leaf
detection, matching the `next-eligible.js` approach.

### F10: `buildPrereqGraph` has no direct unit tests

**Location:** `src/export/prereq-graph.js`

This 70-line module is only tested indirectly through `prereq-matrix.test.js`
and `dependency-matrix.test.js`. The transitive closure BFS algorithm is
non-trivial and silently handles edge cases:

- Cyclic prerequisites: BFS terminates (visited set) but transitive closure incomplete
- Missing prereq courses: silently skipped (line 50 guard)
- Courses referencing non-catalog courses: incomplete graph

**Action:** Add direct unit tests covering: linear chain, diamond dependency,
cycle handling, missing course reference.

---

## Findings — Test Improvements

### F11: Export function test coverage is thin

All export test files cover happy paths but lack edge cases:

| Module | Tests | Missing |
|--------|-------|---------|
| `serialize.test.js` | 12 | CR in CSV field, empty XLSX (header only) |
| `prereq-matrix.test.js` | 7 | `includeNoPrereqs: true` option, unresolvable prereqs |
| `program-checklist.test.js` | 6 | Deep nesting (3+ levels), XLSX format, `quantity` node |
| `audit-export.test.js` | 6 | `course-filter`, `attainment`, `quantity` nodes, XLSX |
| `dependency-matrix.test.js` | 5 | Disconnected components, XLSX format |
| `html-audit-overlay.test.js` | 8 | `partial-progress` status, `except` with audit |

**Action:** Expand test coverage for each export function. At minimum, add
tests for every leaf node type in `audit-export.test.js`, and test
`partial-progress` status in HTML overlay.

### F12: diff.test.js edge case gaps

**Location:** `test/ast/diff.test.js` (197 lines)

Missing tests:
- Null/undefined root nodes (code handles this at line 118 but untested)
- Simultaneous add + remove + move in same array
- Nodes without identity that change position

**Action:** Add 2-3 edge case tests.

### F13: extract.test.js missing variable-ref scenario

**Location:** `test/ast/extract.test.js` (148 lines)

No test verifies that courses inside a `variable-def` value are extracted.
The code handles this correctly (walk visits all children including
`variable-def.value`), but there's no explicit test proving it.

**Action:** Add a test with a `variable-def` containing courses.

---

## Confidence Assessment

### AST Utilities (children, walk, transform): High

- `forEachChild` + `CHILD_PROPS` is a clean, canonical abstraction
- Exhaustiveness guard ensures every NODE_TYPE is registered
- `walk` and `transform` delegate to `forEachChild` — no independent child-property knowledge
- 512 lines of tests with exact assertions
- All internal consumers (resolve, audit, export) successfully use these utilities

### AST Diff: Medium-High

- LCS-based move detection is correct and tested
- JSON.stringify for field comparison is safe but not optimal
- A few edge case gaps (null roots, complex move scenarios)
- No internal consumers yet — only exposed publicly

### Extract Utilities: High

- Simple, focused implementations
- Proper deduplication by courseKey
- `extractAllReferences` correctly uses `evaluateFilters` for catalog resolution
- Missing variable-ref test is minor

### findNextEligible: High

- Clean algorithm: unmet → candidates → prereq check
- Local `findUnmetLeaves` correctly uses `forEachChild`
- Good test coverage: 7 tests covering all major paths
- Defensive handling of null prereqs and empty transcripts

### Export Subsystem: Medium-High

- Clean architecture with shared serializer and graph builder
- CSV/XLSX serialization is correct (RFC 4180 compliant)
- All four export functions follow the same pattern
- Test coverage is adequate for happy paths but thin on edge cases
- Minor duplication (`isAncestorPath`) and usability gap (generic `course-filter` label)

### HTML Audit Overlay: Medium-High

- Parallel walk of AST + audit result is correctly implemented
- XSS prevention via `esc()` is thorough
- All standard node types handled in audit mode
- Missing `partial-progress` indicator is a gap
- Dead `resolvedAudit` variable is confusing

### Public API (`src/index.js`): Low

- **All four renderer exports are `undefined`** — the SDK is broken for any
  consumer using the public API for rendering
- `auditMulti` and `CourseAssignmentMap` missing from exports
- Zero tests exercise the public entry point
- These are not subtle issues — they would be caught by the first user
- Fixing is trivial but the gap is serious

---

## Action Items

| Priority | Finding | Action |
|----------|---------|--------|
| **Critical** | F1 | Fix renderer imports in `src/index.js` — all four are `undefined` |
| **Critical** | F2 | Export `auditMulti` and `CourseAssignmentMap` from `src/index.js` |
| **Critical** | F3 | Add public API smoke test importing from `src/index.js` |
| **High** | F4 | Decide canonical renderer names (`toText` vs `renderText`) for public API |
| **High** | F5 | Add `partial-progress` to `statusIndicator()` in `to-html.js` |
| **High** | F8 | Show filter description in audit export `course-filter` case |
| **High** | F9 | Update `findUnmet` in `index.js` to use `forEachChild` for leaf detection |
| **High** | F11 | Expand export function test coverage (node types, XLSX format) |
| **Medium** | F6 | Remove dead `resolvedAudit` variable in HTML audit overlay |
| **Medium** | F7 | Extract `isAncestorPath` to shared location |
| **Medium** | F10 | Add direct unit tests for `buildPrereqGraph` |
| **Medium** | F12 | Add diff edge case tests (null roots, complex moves) |
| **Low** | F13 | Add extract test for courses inside variable-def |
