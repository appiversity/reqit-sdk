# Code Review 05 — Phase 12.1 + 12.2: Public SDK API

## Scope

Review of the class-based public API (Phase 12.1) and its integration tests
(Phase 12.2), focusing on spec compliance against
[22-sdk-api-design.md](../../reqit-specs/design/22-sdk-api-design.md) and
[08-sdk.md](../../reqit-specs/design/08-sdk.md).

**Source reviewed:**
- `src/entities.js` (270 lines) — entity classes
- `src/index.js` (105 lines) — public API entry point
- `test/api/public-api.test.js` (970 lines, 97 tests)

**Context:** Code review 04 found the previous `src/index.js` was fundamentally
broken (undefined renderer exports, missing `auditMulti`). Phase 12 introduced a
new class-based API with entity facades. This review evaluates the new design.

**Test suite:** 74 suites, 2,077 tests — all passing.

---

## Architecture Overview

| Module | Lines | Responsibility |
|--------|-------|----------------|
| `src/entities.js` | 270 | `Requirement`, `Catalog`, `Transcript`, `TranscriptEntry`, `ResolutionResult`, `AuditResult`, `MultiAuditResult`, `AuditStatus`, unwrap helpers |
| `src/index.js` | 105 | Public entry point — factory functions, re-exports, `auditMulti` facade |
| `test/api/public-api.test.js` | 970 | 19 test sections, 97 tests exercising the full public surface |

The architecture is clean. Entity classes are thin facades over internal
functions (matching spec principle 8: "thin facade over functional core").
Private `#fields` prevent external mutation. `unwrapCatalog()` and
`unwrapTranscript()` enable dual acceptance of wrapped entities and plain objects
(spec principle 4).

---

## Findings — Spec Deviations

### F1: `Catalog` constructor does not validate `ay` field

**Location:** `src/entities.js:109-111`

**Spec:** 22-sdk-api-design.md §Catalog says "Throws on fundamentally malformed
input (missing `courses`, missing `ay`)."

**Implementation:**
```js
constructor(data) {
  if (!data || !data.courses) throw new Error('Catalog requires courses');
  this.#data = Object.freeze(data);
}
```

Only `courses` is validated. A catalog with no `ay` field is accepted silently.

**Action:** Add `ay` validation to match spec, or document that `ay` is optional
for SDK-only usage (no DB context).

### F2: `AuditResult.export()` signature differs from spec

**Spec:** 22-sdk-api-design.md §AuditResult:
```js
const buffer = result.export({ format: 'xlsx' });
```

**Implementation:** `src/entities.js:222-224`
```js
export(catalog, opts) {
  return exportAudit(this.#raw.result, unwrapCatalog(catalog), opts);
}
```

The implementation requires `catalog` as the first argument because `exportAudit`
needs it for `lookupTitle()`. The spec omits it. The test calls
`result.export(minimalCatalog, { format: 'csv' })` — matching the
implementation.

**Assessment:** The implementation is correct. The catalog is genuinely needed
for course title lookup. This follows spec principle 5 ("when a method needs a
catalog, it is always the first argument").

**Action:** Update the spec to show `result.export(catalog, opts)`.

---

## Findings — Code Issues

### F3: `AuditResult.summary` breaks for `credits-from` root nodes

**Location:** `src/entities.js:206-210`

```js
get summary() {
  const items = this.#raw.result.items;
  const statuses = items ? items.map(i => i.status) : [this.#raw.result.status];
  return buildSummary(statuses);
}
```

The getter reads `this.#raw.result.items` — the `items` property on the
annotated root node. This works for `all-of`, `any-of`, `n-of`, `none-of`,
`one-from-each`, `from-n-groups` (all have `items`). But `credits-from` has
`source` instead of `items`, and leaf nodes have neither.

For these nodes, `items` is undefined, so the fallback produces
`buildSummary([rootStatus])` — a summary with exactly 1 item. This is
misleading: a `credits-from` with 5 source courses reports `total: 1`.

Meanwhile, composite nodes already have a `summary` property computed by
`single-tree.js` (via `buildSummary`). The getter ignores this existing value
and recomputes.

**Action:** Use the pre-computed summary when available:
```js
get summary() {
  if (this.#raw.result.summary) return this.#raw.result.summary;
  return buildSummary([this.#raw.result.status]);
}
```

### F4: `MultiAuditResult.trees` getter creates new AuditResult instances on every access

**Location:** `src/entities.js:240-246`

```js
get trees() {
  const obj = {};
  for (const [code, data] of this.#raw.results) {
    obj[code] = new AuditResult(data, this.#asts[code] || null);
  }
  return obj;
}
```

Every call to `multi.trees` constructs new `AuditResult` instances. This means:
```js
multi.trees.major !== multi.trees.major  // true — different object each time
```

This violates expectations for a property getter and could cause performance
issues if called repeatedly (e.g., in a loop rendering multiple trees).

**Action:** Memoize the result:
```js
get trees() {
  if (!this._trees) {
    this._trees = {};
    for (const [code, data] of this.#raw.results) {
      this._trees[code] = new AuditResult(data, this.#asts[code] || null);
    }
    Object.freeze(this._trees);
  }
  return this._trees;
}
```

### F5: `Object.freeze` on Catalog is shallow — nested arrays/objects are mutable

**Location:** `src/entities.js:111`

```js
this.#data = Object.freeze(data);
```

`Object.freeze` is shallow. `catalog.courses` is still a mutable array — a
consumer can `catalog.courses.push(...)` or mutate individual course objects.
Contrast with Requirement, which uses `Object.freeze(structuredClone(ast))` for
deep immutability.

**Assessment:** Deep freezing the catalog would be expensive (catalogs can have
hundreds of courses). The shallow freeze is a pragmatic choice. But it creates
an inconsistency: Requirement is deeply immutable, Catalog is not.

**Action:** Document that `Catalog.data` is shallowly frozen. Consider
`structuredClone` + deep freeze if catalog sizes are reasonable, or accept the
asymmetry and document it.

### F6: `unwrapTranscript` maps every entry on every call

**Location:** `src/entities.js:34-38`

```js
function unwrapTranscript(t) {
  if (t instanceof Transcript) {
    return t.entries.map(e => e instanceof TranscriptEntry ? e.toJSON() : e);
  }
  return t;
}
```

Every `audit()` call on a Transcript entity creates a new array by mapping
entries through `toJSON()`. For a transcript with 100 entries, this creates 100
new plain objects every time. This could be cached on the Transcript instance.

**Action:** Add a lazy-cached `toPlainArray()` on Transcript, or cache the
result of `unwrapTranscript`.

---

## Findings — Test Improvements

### F7: 13 assertions use `toBeGreaterThan(0)` instead of exact counts

**Location:** `test/api/public-api.test.js` lines 97, 113, 232, 271, 272, 279,
285, 340, 693, 694, 702, 710, 742

CLAUDE.md coding standard: "Use `toHaveLength(N)` with exact expected counts,
not `toBeGreaterThan(0)`."

Examples:
```js
expect(result.filters.length).toBeGreaterThan(0);      // line 271
expect(result.filters[0].matched.length).toBeGreaterThan(0); // line 272
expect(result.courses.length).toBeGreaterThan(0);       // line 279
expect(unmet.length).toBeGreaterThan(0);                // line 340
expect(changes.length).toBeGreaterThan(0);              // line 702
```

These are all testable with exact values given the minimal catalog fixture.

**Action:** Replace all 13 instances with exact `toHaveLength(N)` assertions.

### F8: No test for `AuditResult.summary` correctness

**Location:** `test/api/public-api.test.js:320-327`

```js
test('result.summary has met, notMet, inProgress', () => {
  const req = api.parse('all of (MATH 151, CMPS 130)');
  const result = req.audit(minimalCatalog, completeTx);
  const s = result.summary;
  expect(s).toHaveProperty('met');
  expect(s).toHaveProperty('notMet');
  expect(s).toHaveProperty('inProgress');
});
```

Only checks property existence, not values. With `completeTx`, both courses are
met, so the expected values are `{ met: 2, notMet: 0, inProgress: 0, ... }`.
Also does not test with a partial transcript to verify mixed statuses.

**Action:** Assert exact summary values for complete, partial, and in-progress
transcripts. Add a test with a `credits-from` root to exercise the F3 edge case.

### F9: No test for `MultiAuditResult.trees` identity stability

**Location:** `test/api/public-api.test.js` §12

No test verifies that `multi.trees.major === multi.trees.major`. Given F4
(new instances on every access), such a test would currently fail — but that
failure is the bug indicator.

**Action:** Add identity test to detect the F4 memoization issue.

### F10: Missing edge case tests for entity construction

**Location:** `test/api/public-api.test.js` §9-11

Missing:
- `catalog({courses: []})` — empty but valid catalog (courses present but empty)
- `catalog({courses: [...], ay: undefined})` — missing ay (F1 gap)
- `transcript([])` — empty transcript
- `TranscriptEntry` with extra unknown fields (should they be preserved in
  `toJSON()`?)
- `Requirement` from deeply nested AST — verify `structuredClone` handles depth

**Action:** Add 4-5 edge case tests for entity construction boundaries.

---

## Confidence Assessment

### Entity Classes (Requirement, Catalog, Transcript): High

- Clean facade pattern with private fields
- `structuredClone` + `Object.freeze` on Requirement prevents mutation
- `unwrapCatalog`/`unwrapTranscript` correctly bridge wrapped and plain inputs
- 97 integration tests exercise the full surface
- Immutability tests are thorough (§3)
- Fluent chaining works cleanly (§16)

What reduces confidence: Catalog shallow freeze (F5).

### AuditResult / MultiAuditResult: Medium-High

- Core methods work correctly (status, findUnmet, toHTML, export)
- Tests cover happy paths and key variations
- Summary has a real edge case bug (F3 — `credits-from` root)
- `trees` getter creates new instances per call (F4)

What reduces confidence: F3 and F4 are real bugs, summary tests are property-
existence-only (F8).

### Public API Entry Point (src/index.js): High

- All exports are defined (verified by structural guards in §1)
- No undefined exports (explicit test at line 58-62)
- Factory functions work correctly
- `auditMulti` facade correctly unwraps entities and maps program context

Code review 04's critical findings (F1-F3: undefined renderer exports, missing
auditMulti) are fully resolved.

### Test Quality: Medium-High

- Good structural coverage — every entity, every method, every factory
- 19 well-organized sections with clear naming
- Cross-cutting tests (§18) verify plain object acceptance
- Backward compatibility exports tested (§19)
- 13 loose assertions violate coding standard (F7)
- Summary correctness not tested (F8)
- Missing edge cases for entity construction (F10)

---

## Action Items

| Priority | Finding | Action |
|----------|---------|--------|
| **High** | F3 | Fix `AuditResult.summary` for `credits-from` root — use pre-computed summary |
| **High** | F7 | Replace 13 `toBeGreaterThan(0)` with exact `toHaveLength(N)` assertions |
| **High** | F8 | Add exact summary value tests for complete, partial, in-progress, and credits-from |
| **Medium** | F1 | Add `ay` validation to Catalog constructor per spec |
| **Medium** | F4 | Memoize `MultiAuditResult.trees` getter |
| **Medium** | F10 | Add edge case tests for entity construction |
| **Low** | F2 | Update spec: `result.export(catalog, opts)` not `result.export(opts)` |
| **Low** | F5 | Document shallow freeze on Catalog, or deep-freeze if practical |
| **Low** | F6 | Cache `unwrapTranscript` result for repeated audit calls |
| **Low** | F9 | Add `trees` identity stability test |
