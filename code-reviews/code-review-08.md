# Code Review 08 — SDK Review Issues #2–#12 (Parent #11)

## Scope

Review of all 10 sub-issues under GitHub Issue #11, implemented across commits `4d5124a` through `2bc8184`. The review covers the complete implementation against each issue's specification.

| Commit | Issue | Description |
|--------|-------|-------------|
| `4d5124a` | #2 | Enrich Transcript as complete student boundary object |
| `42e8487` | #6 | Export ProgramType, ProgramLevel, DegreeType enums |
| `567f51d` | #12 | Add Attribute as first-class catalog entity |
| `cfdf8c8` | #3 | Add catalog query methods for course discovery |
| `8b0abf8` | #5 | Add Degree as first-class entity |
| `e87c4ed` | #4 | Add reverse dependency queries |
| `58ac6e3` | #7 | Enrich ResolutionResult with reverse index and aggregation |
| `b04c1cb` | #8 | Add renderer customization options |
| `44fa8c2` | #9 | Improve API discoverability |
| `2bc8184` | #10 | Add repeated course duplicate policy |

**Test suite:** 2585 tests, all passing.

**Files reviewed:**
- `src/entities.js` (967 lines — primary implementation file)
- `src/index.js` (194 lines)
- `src/advanced.js` (24 lines)
- `src/render/shared.js` (`lookupAttributeName`)
- `src/render/to-outline.js` (renderer options)
- `src/render/to-html.js` (renderer options)
- `src/render/to-description.js` (attribute handling)
- `src/audit/walk-result.js` (walk callback signature)
- `src/audit/transcript.js` (duplicate policy)
- `test/api/public-api.test.js` (2357 lines)
- `test/render/renderer-options.test.js` (319 lines)
- `test/audit/transcript.test.js` (duplicate policy tests)

---

## Per-Issue Assessment

### Issue #2: Transcript Enrichment — PASS

All requirements met:
- `TranscriptEntry` → `TranscriptCourse` rename: complete, no remnants
- `.entries` → `.courses` rename: complete
- Full student record: courses, attainments, declaredPrograms, waivers, substitutions, level
- `addCourse`/`removeCourse` replace `addEntry`/`removeEntry`: complete
- `addAttainment`/`removeAttainment`: implemented
- `declareProgram`/`undeclareProgram`: implemented
- `addWaiver`/`removeWaiver`: implemented (requires `Waiver` instance)
- `addSubstitution`/`removeSubstitution`: implemented (requires `Substitution` instance)
- Plain array constructor rejected with clear error message
- `extractTranscriptOptions()` bridges transcript data to audit engine
- Immutability preserved through `#toData()` helper

Test coverage is comprehensive (lines 643–961 of public-api.test.js) including mutation preservation tests.

### Issue #6: Enumerations — PASS

All three enums implemented as frozen objects:
- `ProgramType`: 6 values (matches spec)
- `ProgramLevel`: 6 values (spec had 4; `POST_GRADUATE` and `POST_DOCTORAL` added — reasonable extension)
- `DegreeType`: 25+ values grouped by category (spec had 10; comprehensive extension — good)

Tests verify values and `Object.isFrozen()`.

### Issue #12: Attribute Registry — PASS with findings

Core implementation complete:
- `catalog.attributes` getter with `[]` default
- `findAttribute(code)` with lazy-built `#attributeIndex`
- `getAttributes()` returns sorted copy
- `lookupAttributeName()` in shared.js used by `toOutline` and `toHTML`
- Fallback to raw code when no registry or attribute not found
- Test fixtures updated with 5 representative attributes

**See F1, F2, F3** for findings.

### Issue #3: Catalog Query Methods — PASS

All methods implemented:
- `findCourses({ subject, attribute })` with AND logic
- `getSubjects()` returns sorted unique subject codes
- `getAttributes()` returns rich objects from registry
- `getCrossListEquivalents(subject, number)` via crossListGroup

Tests cover empty filters, combined filters, no matches, new arrays per call.

### Issue #5: Degree Entity — PASS

- `Degree` class with code, name, type, level, requirements, toJSON()
- Constructor validation (code, type, level required)
- `degree()` factory in index.js
- `Catalog.findDegree(code)` with lazy `#degreeIndex`
- `Catalog.findDegrees(filter)` supporting type and level
- Test fixtures include 3 degrees (BS, BA, MS)

### Issue #4: Reverse Dependencies — PASS

- `PrereqGraph` class wrapping `buildPrereqGraph()` with reverse index
- `directPrereqs`, `transitivePrereqs`, `dependents`, `transitiveDependents` — all BFS-based
- `Catalog.prereqGraph()` lazily cached
- `Catalog.findProgramsRequiring(subject, number)` using `classifyCourseInTree()`
- `Catalog.courseImpact(subject, number)` combining prereq graph + program search

`classifyCourseInTree()` handles all relevant node types correctly.

**See F4** for a finding.

### Issue #7: ResolutionResult Enrichment — PASS

All methods implemented:
- `allCourses()` with courseKey deduplication
- `coursesForFilter(index)` with bounds check
- `filtersForCourse(subject, number)` with lazy `#reverseIndex`
- `totalUniqueCourses` getter
- `subjects` getter returning Set

Tests use precise assertions.

### Issue #8: Renderer Customization — PARTIAL PASS

**Implemented:**
- `toOutline`: `labelFormat`, `icons`, `showGrades`, `showSummary`, `annotations` — all working
- `toHTML`: `classPrefix`, `labelFormat` — working
- Entity method forwarding for options — verified

**See F5, F6, F7** for missing features.

### Issue #9: API Discoverability — PASS

- `src/advanced.js` created with 4 internal exports + JSDoc
- `package.json` `exports` field properly configured
- Internal exports removed from main `index.js` (verified by negative test)
- All public exports have JSDoc comments
- `version` export from package.json
- Tests verify both public API shape and advanced subpath

### Issue #10: Duplicate Policy — PASS

- `duplicatePolicy` field on Transcript (null default)
- Three policies: `'latest'` (default), `'first'`, `'best-grade'`
- Implemented in `normalizeTranscript()` in `audit/transcript.js`
- Extracted via `extractTranscriptOptions()` and threaded to audit engine
- Preserved through immutable mutations
- Credit-count and residency correctly deferred (lower priority)

---

## Findings — Code Smells

### F1: `lookupAttributeName` uses linear scan instead of index

**Location:** `src/render/shared.js:168-172`

```javascript
function lookupAttributeName(code, catalog) {
  if (!catalog || !catalog.attributes) return code;
  const attr = catalog.attributes.find(a => a.code === code);
  return attr ? attr.name : code;
}
```

The renderers receive the raw catalog data object (not the `Catalog` class), so this function does `Array.find()` on every attribute lookup. The `Catalog` class has a lazy `#attributeIndex` Map, but renderers operate on raw data and can't access it.

For small attribute lists (typical: 5–20) this is fine. For catalogs with hundreds of attributes rendered across many course-filter nodes, this becomes O(n) per lookup. Not a correctness issue — a minor efficiency concern.

**Suggested action:** Accept as-is for now. If profiling shows it matters, build a local Map on first call within the render function.

### F2: Resolver does not warn on unknown attribute codes

**Location:** `src/resolve/index.js`

Issue #12 specified: "Resolver should warn (not error) if the referenced attribute code is not defined in `catalog.attributes`."

This is not implemented. The resolver silently matches against course attribute arrays without consulting the catalog's attribute registry. A requirement referencing `courses where attribute = "FAKE"` returns no matches with no warning.

**Suggested action:** Implement attribute validation in the resolver's course-filter handling. Add unknown attribute codes to the resolution result's warnings when `catalog.attributes` is populated.

### F3: `toDescription` does not receive catalog, cannot resolve attribute names

**Location:** `src/entities.js:242`

```javascript
get description() { return toDescription(this.#ast); }
```

The `description` getter on `Requirement` passes no catalog. This means `toDescription` can never look up attribute names. The issue acknowledged this ("toDescription does not resolve attributes — no catalog param"). However, this creates an asymmetry: `toOutline(cat)` shows "Writing Intensive courses" while `description` shows "courses where attribute = WI".

This is by design (description is catalog-independent), but it's worth noting as a future consideration — `toDescription` could optionally accept a catalog.

**Suggested action:** No action now. Document as a known limitation. If a consumer needs attribute names in prose descriptions, they can use `toOutline`.

### F4: `findProgramsRequiring` silently skips programs without requirements

**Location:** `src/entities.js:546`

```javascript
if (!prog.requirements) continue;
```

Issue #4 said: "Requires withPrograms() to have been called. Throw a clear error if not."

The implementation silently skips programs without requirements instead of throwing. If a developer calls `findProgramsRequiring` on a catalog without `withPrograms()`, they get an empty array with no indication that requirements weren't checked.

**Suggested action:** Consider throwing or warning when ALL programs lack requirements, which strongly suggests `withPrograms()` was never called. Silently skipping individual programs without requirements is correct (some programs genuinely may not have requirements attached).

### F5: `toHTML` does not support `annotations` option

**Location:** `src/render/to-html.js`

Issue #8 specified annotations for toHTML, but only `toOutline` implements them. The `toHTML` renderer has no annotation handling. This is a feature parity gap — a consumer using `toHTML` for audit rendering cannot show `(shared)` tags on overlapping courses.

**Suggested action:** Implement annotation support in `toHTML`, mirroring the `toOutline` pattern. Apply annotations as a `<span>` with a CSS class (e.g., `reqit-annotation`) appended to course elements.

### F6: `toHTML` does not support `wrapperTag` option

**Location:** `src/render/to-html.js`

Issue #8 specified `wrapperTag` (default `'ul'`, customizable to `'div'` etc.) but this was not implemented. The HTML renderer always produces `<ul>` wrapper elements.

**Suggested action:** Low priority. The `classPrefix` option covers most customization needs. Implement if a consumer requires non-list HTML structure.

### F7: `AuditResult.walk()` callback signature missing `depth` and `parent`

**Location:** `src/audit/walk-result.js:14-17`, `src/entities.js:893`

Issue #8 specified the walk callback should receive `(node, depth, parent, path)`. The actual signature is `(node, path)` — missing `depth` and `parent`.

The AST `walk()` provides `(node, path, parent)` which is richer. The audit `walkResult()` provides only `(node, path)`. This asymmetry makes it harder for developers to build custom renderers from audit results compared to ASTs.

**Suggested action:** Add `depth` (integer, 0 at root) and `parent` (node reference, null at root) parameters to `walkResult()`. This is a breaking change to any existing `walkResult` callbacks — but since this is v1 design phase, make the change now.

### F8: `unwrapTranscript` has implicit backward compatibility fallback

**Location:** `src/entities.js:42-44`

```javascript
if (t && typeof t === 'object' && !Array.isArray(t) && Array.isArray(t.courses)) {
  return t.courses;
}
```

This silently accepts a plain `{ courses: [...] }` object that isn't a `Transcript` instance. Per CLAUDE.md: "Do not silently support both old and new data model shapes as a fallback to avoid test failures."

This fallback allows callers to bypass the `Transcript` class entirely, which undermines the enrichment work in #2 (attainments, waivers, etc. would be lost). If the intent is to allow raw objects for simple cases, it should be documented. If not, it should throw.

**Suggested action:** Evaluate whether this fallback is intentional. If the audit engine should always receive a `Transcript` instance (to get waivers, attainments, etc.), remove this branch and require `Transcript` instances. If raw objects are a valid input for simple cases, document it explicitly.

---

## Findings — Test Improvements

### F9: `toDescription` attribute test is negative-only

**Location:** `test/api/public-api.test.js:1987-1992`

The test verifies that `toDescription` does NOT resolve attributes. While this documents the current behavior, there's no positive test verifying what `toDescription` actually outputs for attribute filters (e.g., "courses where attribute = WI").

**Suggested action:** Add a positive assertion verifying the raw-code output format.

### F10: `getCrossListEquivalents` only tests negative cases in main suite

**Location:** `test/api/public-api.test.js:1607-1616`

Two of three tests verify empty-array returns (non-cross-listed course, unknown course). The positive test uses a custom catalog, which is good, but the minimal fixture doesn't include cross-listed courses.

**Suggested action:** Add cross-listed courses to the minimal fixture so the positive test uses the shared fixture.

### F11: No test for `findProgramsRequiring` when `withPrograms` not called

**Location:** `test/api/public-api.test.js`

There's a test that programs without requirements are skipped (line 1853-1858), but no test verifying behavior when NO programs have requirements (i.e., `withPrograms` was never called). This is the scenario that F4 flags.

**Suggested action:** Add test: catalog without `withPrograms()` → `findProgramsRequiring` returns empty array (or throws, depending on resolution of F4).

### F12: `DegreeType` test samples only a subset

**Location:** `test/api/public-api.test.js:93-110`

The test checks 8 representative values out of 25+. While sampling is reasonable, there's no structural test verifying the total count.

**Suggested action:** Add `expect(Object.keys(api.DegreeType)).toHaveLength(25)` (or whatever the exact count is) to catch accidental additions/removals.

---

## Confidence Assessment

### Issue #2 (Transcript): High
The Transcript class is thoroughly tested with 30+ test cases covering all mutation methods, preservation, rejection of old API, and audit integration. The `extractTranscriptOptions` bridge is well-designed.

### Issue #6 (Enums): High
Simple frozen objects with straightforward tests. Low complexity, high confidence.

### Issue #12 (Attributes): Medium-High
Core functionality works well. The `lookupAttributeName` function is correct. Confidence reduced slightly by missing resolver warnings (F2) and no `toDescription` support (F3, by design).

### Issue #3 (Catalog Queries): High
All methods are simple, correct, and well-tested. Lazy indexing follows established patterns.

### Issue #5 (Degree): High
Clean implementation following the existing entity patterns. Good validation and test coverage.

### Issue #4 (Reverse Dependencies): Medium-High
`PrereqGraph` and `classifyCourseInTree` are solid. BFS handles cycles. Confidence slightly reduced because `findProgramsRequiring` doesn't warn when `withPrograms` wasn't called (F4).

### Issue #7 (ResolutionResult): High
All methods correct, reverse index built correctly, tests are precise.

### Issue #8 (Renderer Options): Medium
Implemented features are solid and well-tested. But `toHTML annotations`, `wrapperTag`, and `walkResult` callback signature are missing from spec (F5, F6, F7). The implemented subset works correctly.

### Issue #9 (API Discoverability): High
Clean separation, proper package.json exports, negative tests verify internal exports removed. JSDoc on all public exports.

### Issue #10 (Duplicate Policy): High
All three policies implemented correctly. Well-tested at both unit and integration level. Correct thread-through from Transcript to audit engine.

---

## Action Items

| Priority | Finding | Issue | Action |
|----------|---------|-------|--------|
| Medium | F2 | #12 | Implement resolver warnings for unknown attribute codes |
| Medium | F5 | #8 | Implement `annotations` support in `toHTML` |
| Medium | F7 | #8 | Add `depth` and `parent` params to `AuditResult.walk()` callback |
| Medium | F8 | #2 | Evaluate and resolve `unwrapTranscript` backward-compat fallback |
| Low | F4 | #4 | Warn when all programs lack requirements in `findProgramsRequiring` |
| Low | F1 | #12 | Accept as-is; `Array.find` fine for typical attribute counts |
| Low | F3 | #12 | Accept by design; `toDescription` is catalog-independent |
| Low | F6 | #8 | Implement `wrapperTag` if needed |
| Low | F9 | — | Add positive `toDescription` attribute output test |
| Low | F10 | — | Add cross-listed courses to minimal fixture |
| Low | F11 | #4 | Add test for `findProgramsRequiring` without `withPrograms` |
| Low | F12 | #6 | Add structural count assertion for `DegreeType` |
