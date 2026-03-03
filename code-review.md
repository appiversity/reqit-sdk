# Code Review: Rendering & Resolving Subsystems

**Date:** 2026-03-03
**Scope:** `src/render/`, `src/resolve/`, and corresponding tests in `test/render/`, `test/resolve/`

---

## Overview

The rendering subsystem comprises four renderers and a shared module:

| Module | Purpose | Nature |
|--------|---------|--------|
| `to-text.js` | Render AST back to reqit DSL source code | **Code renderer** — must preserve grammar structure, round-trip guarantee |
| `to-description.js` | Render AST as human-readable prose | Human-readable display |
| `to-outline.js` | Render AST as indented tree with box-drawing | Human-readable display |
| `to-html.js` | Render AST as semantic HTML with `reqit-` CSS classes | Human-readable display |
| `shared.js` | Constants (`OP_SYMBOLS`, `OP_PHRASES`, `NODE_TYPES`), helpers, catalog title lookup | Shared infrastructure |

The resolving subsystem is a single module (`src/resolve/index.js`, 504 lines) that expands course references and filters against a catalog.

**Key architectural distinction:** `toText` is fundamentally different from the other three renderers. It produces **parseable reqit DSL code** — the round-trip guarantee (`parse(toText(parse(input))) ≡ parse(input)`) means it must faithfully reproduce every grammar construct including variable definitions and scope blocks. The other three renderers produce **human-readable artifacts** where grammar constructs like `variable-def` and `scope` are transparent wrappers rendered through to their inner content. This distinction should guide all refactoring decisions.

---

## Findings

### F1: Composite Node Labels Are Repetitive (Human-Readable Renderers)

**Files:** `to-description.js`, `to-outline.js`, `to-html.js`

In each of the three human-readable renderers, the composite node types (`all-of`, `any-of`, `none-of`, `n-of`, `one-from-each`, `from-n-groups`) follow a near-identical pattern — only the display label differs. For example in `to-description.js` lines 111–139:

```js
case 'all-of': {
  let text = `Complete all of the following:${renderItems(node.items, indent)}`;
  return renderPostConstraints(node, text);
}
case 'any-of': {
  let text = `Complete any one of the following:${renderItems(node.items, indent)}`;
  return renderPostConstraints(node, text);
}
// ... 4 more nearly identical cases
```

The same pattern repeats in `to-outline.js` (lines 89–117) and `to-html.js` (lines 103–145), totaling ~100 lines of mechanical repetition across the three files. Operators are already centralized in `shared.js` — composite labels should be too.

**Note:** `toText` (the code renderer) should **not** be refactored this way. Its composite cases produce DSL syntax (`all of (...)`, `at least N of (...)`) where the keyword/structure mapping is tightly coupled to grammar rules. Keeping explicit cases there maintains clarity about what DSL code is produced.

**Action:** Create a `COMPOSITE_LABELS` table in `shared.js` mapping node types to their human-readable labels. Collapse the repetitive switch cases in the three human-readable renderers into data-driven dispatch. Leave `toText` as-is.

---

### F2: Duplicated Cross-List Expansion Logic

**File:** `src/resolve/index.js`

`collectWithCrossListed()` (lines 79–96) and `expandCrossListed()` (lines 380–396) implement the same algorithm — collect a course and its cross-list group members into a deduplicated collection. The difference is only in interface:

- `collectWithCrossListed`: takes a single course, mutates `ctx.collected` (side effect)
- `expandCrossListed`: takes an array of courses, returns a new array (immutable)

Both contain the identical `if (course.crossListGroup) { group = index.get(group); for equiv... }` loop.

**Action:** Consolidate on the immutable `expandCrossListed` pattern. Prefer immutability — the caller can merge the returned array into `ctx.collected` if needed. Delete `collectWithCrossListed`.

---

### F3: Duplicated Course Key Construction

**Files:** `src/resolve/index.js` (9 occurrences), `src/render/shared.js` (2 occurrences), plus 8 occurrences in test files

The pattern `c.subject + ':' + c.number` appears **19 times** across the codebase. There is no `courseKey()` helper despite this being the single most common micro-operation in both renderers and resolver.

**Action:** Create a `courseKey(course)` helper in a shared utility module (see [Plan: Shared Catalog Index Facility](#plan-shared-catalog-index-facility) below). This function will be used extensively as the codebase grows — auditing, exporting, and the future `reqit-pg` package will all need it. Document this helper prominently so that contributors (including AI agents) always reach for it rather than inlining the key pattern.

---

### F4: Three Independent AST Traversal Implementations in Resolver

**File:** `src/resolve/index.js`

The resolver contains three recursive functions that each independently walk the AST, visiting slightly different child properties:

| Function | Purpose | Child properties visited |
|----------|---------|------------------------|
| `collectDefs()` (line 138) | Pre-pass: register variable definitions | `items`, `expression`, `value`, `source`, `requirement`, `body` |
| `walkNode()` (line 406) | Main resolution: collect courses & filters | `items`, `source`, `requirement`, `exclude`, `body`, `defs` |
| `astContainsCourse()` (line 351) | Filter helper: search for course in prereq tree | `items`, `source`, `value`, `requirement`, `expression` |

Each function has its own traversal strategy. If a new child-bearing AST property is introduced, it must be added to all three — a maintenance trap.

**Action:** Extract a generic child-visitor helper (e.g., `forEachChild(node, callback)`) that centralizes knowledge of which properties hold child nodes. Each function retains its own logic but delegates traversal to the shared visitor. This ensures new child properties need only be added in one place.

---

### F5: Inconsistent `renderPostConstraints` Contract

**Files:** `to-text.js`, `to-description.js`, `to-outline.js`, `to-html.js`

Each renderer implements its own `renderPostConstraints` with different signatures:

| Renderer | Function name | Signature | Pattern |
|----------|--------------|-----------|---------|
| to-text (code) | `renderPostConstraints` | `(node, text) → string` | Appends DSL syntax to accumulated text |
| to-description | `renderPostConstraints` | `(node, text) → string` | Appends prose to accumulated text |
| to-outline | `renderPostConstraintSuffix` | `(node, catalog) → string` | Returns standalone suffix |
| to-html | `renderPostConstraints` | `(node, catalog) → string` | Returns standalone HTML span |

The three human-readable renderers have inconsistent signatures — `to-description` uses the accumulator pattern while `to-outline` and `to-html` return standalone fragments (and `to-outline` uses a different function name). This makes it hard to reason about the contract.

**Important context:** `toText` (the code renderer) legitimately has different needs — it accumulates DSL syntax where post-constraints are part of the grammar production, and it never needs a catalog parameter. Its signature is appropriate for its purpose and should not be forced to match the human-readable renderers.

**Action:** Formalize the contract for the three human-readable renderers to use a consistent pattern. The standalone-fragment approach (as used by `to-outline` and `to-html`) is cleaner — the caller concatenates or positions the fragment. Align `to-description` to return a standalone fragment as well. Rename `renderPostConstraintSuffix` in `to-outline` to `renderPostConstraints` for consistency. Document that `toText` intentionally uses a different pattern because it is a code renderer, not a display renderer.

---

### F6: `toText` Should Be Better Documented as a Code Renderer

**File:** `src/render/to-text.js`

`toText` is the only renderer that produces parseable DSL source code rather than a human-readable artifact. This is why it correctly renders `variable-def` as `$name = expression` and `scope` as `scope "name" { ... }` — these are grammar constructs that cannot be made transparent. The other three renderers correctly treat them as transparent wrappers.

Currently, the function's JSDoc mentions "round-trip guarantee" but does not clearly state that it is a **code renderer** as distinct from the display renderers. This distinction is critical for anyone working on the codebase (including AI agents) to avoid incorrectly applying display-renderer patterns to `toText` or vice versa.

**Action:** Add prominent documentation to `toText` and `renderNode` in `to-text.js` clarifying:
- This is a **code renderer** (consider renaming to `toCode` in a future pass) that produces parseable reqit DSL
- Grammar constructs (`variable-def`, `scope`) must NOT be transparent — they are structural
- The round-trip guarantee depends on this: `parse(toText(ast))` must reproduce the original AST
- Refactoring patterns from the human-readable renderers should not be blindly applied here

---

### F7: `to-outline` Drops Nested Source Lines in `except` Handling

**File:** `src/render/to-outline.js`, lines 136–144

**This is a bug.** When an `except` node has a composite source (e.g., `all of (...) except (...)`), the outline renderer calls `renderTree(node.source, catalog, '', '')` which returns multiple lines, but only uses `srcLines[0]` as the label — silently dropping all child lines.

**Reproduction:**

```js
const { toOutline } = require('./src/render/to-outline');
const { parse } = require('./src/parser');

console.log(toOutline(parse('all of (MATH 151, MATH 152, CMPS 130) except (CMPS 130)')));
```

**Actual output:**
```
All of the following:, except:
└── CMPS 130
```

**Expected output** (the source tree's children should appear):
```
All of the following:, except:
├── Source:
│   ├── MATH 151
│   ├── MATH 152
│   └── CMPS 130
└── Except:
    └── CMPS 130
```

Or at minimum, the source's children should not be silently dropped. The exact formatting is a design choice, but losing information is a defect.

**Action:** Create a test case that proves the error (test case below). Then fix the `except` branch in `renderTree` to properly render the source subtree.

**Proposed test case** (add to `test/render/to-outline.test.js`):

```js
test('except with composite source preserves source tree children', () => {
  const result = outline('all of (MATH 151, MATH 152, CMPS 130) except (CMPS 130)');
  // The source tree's children must not be dropped
  expect(result).toContain('MATH 151');
  expect(result).toContain('MATH 152');
  expect(result).toContain('CMPS 130');
});

test('except with deeply nested composite source', () => {
  const result = outline('all of (MATH 151, any of (MATH 152, CMPS 130)) except (CMPS 130)');
  // All source items must appear
  expect(result).toContain('MATH 151');
  expect(result).toContain('MATH 152');
  expect(result).toContain('CMPS 130');
});
```

---

### F8: No Exhaustiveness Test for Resolver Node Type Handling

**File:** `src/resolve/index.js`, `test/resolve/`

The renderer subsystem has `exhaustiveness.test.js` — a structural guard ensuring every `NODE_TYPE` is handled by every renderer. The resolver has no equivalent. If a new node type is added to `NODE_TYPES` but not to `walkNode`, no test catches it — the resolver would silently skip the new type.

Additionally, the `NODE_TYPES` constant in `shared.js` lists 20 types, while `walkNode` explicitly handles them all (course-bearing types get resolution logic; non-course types like `score`, `attainment`, etc. get explicit no-op cases). The code comments should be clearer about this: all 20 types are handled, but only some trigger course collection.

**Action:** Create `test/resolve/exhaustiveness.test.js` mirroring the renderer's exhaustiveness test. For each `NODE_TYPE`, verify that `walkNode` doesn't throw when given a minimal valid node (i.e., it has an explicit case, even if it's a no-op). Update comments in `walkNode` to clarify the distinction between "resolves courses" and "explicitly handled as no-op."

---

### F9: Resolver Edge Cases Lack Test Coverage

**File:** `test/resolve/`

Several resolver code paths have no test coverage:

| Path | Code location | Gap |
|------|--------------|-----|
| `null`/`undefined` AST input | `walkNode` line 407 guard | No test verifies graceful handling |
| Empty catalog (`{ courses: [] }`) | `buildCourseIndex`, `buildCrossListIndex` | No test verifies empty results |
| Unknown filter field | `evaluateFilter` line 230 `default: return false` | No test exercises this branch |
| Unknown node type in `walkNode` | No `default` case exists | No test verifies silent skip behavior |
| `post_constraints` containing course refs | Not walked by resolver | No test documents whether this is intentional |

**Action:** Add targeted tests for each gap. For `post_constraints`, decide whether course refs inside post-constraint filter values should be resolved and document the decision. If they should be resolved, add walking logic; if not, add a test that explicitly asserts the current behavior as intentional.

---

### F10: Resolver Integration Tests Use Weak Assertions

**File:** `test/resolve/integration.test.js`

Many integration tests use `expect(result.courses.length).toBeGreaterThan(0)` — a very weak assertion that can't catch regressions. If a filter change causes the resolver to match 50 courses instead of 12, these tests pass silently. Example from line 100:

```js
it('resolves CS courses with number filter', () => {
  const result = parseAndResolve('courses where subject = "CSCI" and number >= 200', moravianCatalog);
  expect(result.courses.length).toBeGreaterThan(0);  // ← too weak
});
```

Contrast with the one strong assertion in the file (Lehigh CS core, line 82):

```js
expect(result.courses).toHaveLength(17);  // ← precise, catches regressions
```

**Action (after F1–F8 are resolved):** Determine exact expected counts for each integration test case and replace `toBeGreaterThan(0)` with precise `toHaveLength(N)` assertions. This should be done after code fixes stabilize the resolver's output.

---

### F11: `scope` Def Walking is Dead Code in Resolver

**File:** `src/resolve/index.js`, lines 482–489

```js
case 'scope':
  if (Array.isArray(node.defs)) {
    for (const def of node.defs) {
      walkNode(def, ctx);  // ← each def is a variable-def, which is a no-op
    }
  }
  walkNode(node.body, ctx);
  break;
```

The scope handler iterates over `node.defs` and calls `walkNode` for each — but `walkNode`'s `variable-def` case (line 465) is an explicit no-op (variable values are only resolved through `variable-ref` expansion). This loop does nothing.

**Action (after F1–F8 are resolved):** Add a test that confirms the current behavior (variable defs inside scopes are resolved only when referenced), then either remove the dead loop or add a comment explaining why it's retained (e.g., future-proofing for def-level side effects). Recommend removal since the pre-pass `collectDefs` already handles registration.

---

### F12: `except` Resolution Semantics Not Tested for Filter Distinction

**File:** `test/resolve/`

The resolver's `except` handler walks both `source` and `exclude`, collecting all courses from both into `result.courses`. This is correct for resolution (we need to know about all referenced courses), but the current result structure doesn't distinguish which courses came from the source vs. the exclusion list. The tests confirm this behavior (e.g., `resolve-skeleton.test.js` line 213, `integration.test.js` line 395) but don't verify whether the **filter results** carry this distinction.

**Action (after F1–F8 are resolved):** Add tests that verify the filter-result structure for `except` nodes. Document whether the resolver should annotate which courses are excluded (useful for auditing) or whether that's the auditor's responsibility.

---

## Plans

### Plan: Shared Catalog Index Facility

**Problem:** Catalog indexing logic is duplicated across subsystems with no shared infrastructure:

| Location | What it indexes | Cache mechanism |
|----------|----------------|-----------------|
| `src/render/shared.js` lines 80–107 | `"SUBJECT:NUMBER" → title` | Module-level `WeakMap` |
| `src/resolve/index.js` lines 46–52 | `"SUBJECT:NUMBER" → course` | Built per `resolve()` call (no cache) |
| `src/resolve/index.js` lines 60–71 | `crossListGroup → courses[]` | Built per `resolve()` call (no cache) |
| `src/grade/index.js` lines 59–72 | `grade → scale position` | Module-level `WeakMap` |

As the SDK grows (auditing, exporting, future `reqit-pg` integration), every new subsystem will need fast catalog lookups. A shared facility prevents each module from reinventing its own indexing.

**Proposed design: `src/catalog/index.js`**

```
src/catalog/
  index.js       — CatalogIndex class, courseKey() helper, normalization
```

**Responsibilities:**
1. **`courseKey(course)`** — canonical key construction (`"SUBJECT:NUMBER"`), used everywhere
2. **`CatalogIndex` class** — lazily builds and caches multiple indexes from a catalog:
   - `coursesByKey: Map<string, Course>` — O(1) course lookup
   - `coursesByTitle: Map<string, string>` — O(1) title lookup (replaces `shared.js` `lookupTitle`)
   - `crossListGroups: Map<string, Course[]>` — O(1) cross-list resolution
   - `coursesByAttribute: Map<string, Course[]>` — O(1) attribute lookup (future)
   - `coursesBySubject: Map<string, Course[]>` — O(1) subject lookup (future)
3. **`normalizeCatalog(catalog)`** — moved from resolver, shared across subsystems
4. **Cache strategy** — instance-based, not module-level (see next plan)

**Migration path:**
- Create `src/catalog/index.js` with `courseKey()`, `CatalogIndex`, `normalizeCatalog()`
- Update `src/resolve/index.js` to use `CatalogIndex` instead of its own `buildCourseIndex`/`buildCrossListIndex`
- Update `src/render/shared.js` `lookupTitle` to delegate to `CatalogIndex`
- Export `courseKey` from the main `src/index.js` for test use (replacing inline key construction in tests)

**Documentation requirement:** The `courseKey()` function must be prominently documented. Add a note to `CLAUDE.md` or a `CONTRIBUTING.md` instructing contributors to always use `courseKey()` for key construction — never inline the `subject + ':' + number` pattern.

---

### Plan: Multi-Process Safe Caching

**Problem:** The current codebase uses module-level `WeakMap` instances for caching in two places:

1. `src/render/shared.js` line 80 — `_catalogIndex: WeakMap<catalog, Map<key, title>>`
2. `src/grade/index.js` line 60 — `_scaleIndexCache: WeakMap<scale, Map<grade, position>>`

`WeakMap` keyed by object identity is safe for single-process use — it doesn't leak memory (GC cleans up when the catalog is released) and provides O(1) amortized lookups. However:

- **Worker threads** (Node.js `worker_threads`): Each worker gets its own module scope, so each worker would have its own `WeakMap`. This is actually **safe** — no shared mutable state. But it means each worker independently builds its own index on first use (redundant work, not data corruption).
- **Cluster mode** (`cluster` module): Each process is fully isolated. Same situation — safe but redundant.
- **Shared catalog across calls in a single process** (e.g., Express request handler reusing a catalog): The `WeakMap` cache works correctly here — first request builds the index, subsequent requests reuse it.

**Risk assessment:** The current `WeakMap` approach is **safe** in all multi-process scenarios (no shared mutable state risk). The concern is **redundant work**, not correctness. Each worker rebuilds indexes independently.

**Proposed approach:**

1. **Short-term (SDK scope):** Move caching into `CatalogIndex` instances (see plan above). Callers create a `CatalogIndex` and pass it to renderers/resolver/auditor. The index is built once and reused across operations on the same catalog. No module-level state.

   ```js
   const idx = new CatalogIndex(catalog);  // Build once
   const resolved = resolve(ast, idx);      // Reuse
   const html = toHTML(ast, idx);           // Reuse
   const outline = toOutline(ast, idx);     // Reuse
   ```

2. **Medium-term (reqit-catalog scope):** When the web app (reqit-catalog) needs multi-worker support, the `CatalogIndex` instances should be created per-request or per-catalog-version and shared within a request lifecycle. Since each worker has its own memory, this is naturally isolated.

3. **If true cross-worker sharing is ever needed:** Consider a read-through cache backed by `SharedArrayBuffer` or an external cache (Redis), but this is unlikely for the SDK layer — it's an application-layer concern for reqit-catalog.

**Migration:**
- Replace module-level `WeakMap` in `shared.js` and `grade/index.js` with instance-level caches on `CatalogIndex` and `GradeConfig` objects respectively
- Ensure `CatalogIndex` is cheap to construct (lazy index building on first access)
- Export `CatalogIndex` from `src/index.js` so downstream packages can manage lifecycle

---

### Plan: Resolver Architecture Reassessment (Post-F1–F8)

After the code-level issues (F1–F8) are resolved, reassess the resolver's monolithic `walkNode` architecture:

1. **Does the unified child-visitor (from F4) simplify the walker enough?** If `collectDefs`, `walkNode`, and `astContainsCourse` all delegate traversal to `forEachChild`, the remaining per-function logic should be minimal and the 504-line module may no longer feel monolithic.

2. **Does `CatalogIndex` (from the shared facility plan) reduce resolver complexity?** Moving index building and normalization out of the resolver should drop it to ~350 lines.

3. **Should the resolver return richer results?** Currently it returns `{ courses, filters }`. After the auditor is built, evaluate whether it also needs:
   - Per-node resolution annotations (which node produced which courses)
   - Source/exclude distinction for `except` nodes
   - Post-constraint resolution results

4. **Should `walkNode` have an explicit `default` case?** Currently, unknown node types are silently ignored. After adding the exhaustiveness test (F8), decide whether an unknown type should warn or throw.

---

## Summary: Action Items

### Code Changes (do first)

| ID | Action | Files | Priority |
|----|--------|-------|----------|
| F1 | Centralize composite labels in `shared.js`, refactor 3 human-readable renderers | `shared.js`, `to-description.js`, `to-outline.js`, `to-html.js` | High |
| F2 | Consolidate cross-list expansion on immutable `expandCrossListed` | `resolve/index.js` | High |
| F3 | Create `courseKey()` helper, replace all inline key construction | New `catalog/index.js`, `resolve/index.js`, `shared.js` | High |
| F4 | Extract generic AST child-visitor, refactor 3 traversal functions | `resolve/index.js` | High |
| F5 | Formalize `renderPostConstraints` contract for human-readable renderers | `to-description.js`, `to-outline.js`, `to-html.js` | Medium |
| F6 | Add code-renderer documentation to `toText` | `to-text.js` | Medium |
| F7 | Fix `except` composite source bug in outline renderer | `to-outline.js` | High |
| F8 | Add resolver exhaustiveness test, update comments | New `test/resolve/exhaustiveness.test.js`, `resolve/index.js` | High |

### Test Improvements (do after code changes)

| ID | Action | Files | Priority |
|----|--------|-------|----------|
| F9 | Add resolver edge-case tests (null AST, empty catalog, unknown fields, post_constraints) | `test/resolve/` | Medium |
| F10 | Strengthen integration test assertions with precise counts | `test/resolve/integration.test.js` | Medium |
| F11 | Test/remove dead scope-def walking loop | `test/resolve/`, `resolve/index.js` | Low |
| F12 | Test except filter-result semantics, document design decision | `test/resolve/` | Low |

### Infrastructure Plans (do after code and test changes)

| Plan | Scope | Priority |
|------|-------|----------|
| Shared Catalog Index Facility | New `src/catalog/index.js` | High |
| Multi-Process Safe Caching | Refactor `shared.js`, `grade/index.js` caching | Medium |
| Resolver Architecture Reassessment | Evaluate after F1–F8 | Deferred |
