# Code Review Response — Review 05

## F1: `Catalog` constructor does not validate `ay` field

**Verdict: Agree**

The spec says "Throws on fundamentally malformed input (missing `courses`, missing `ay`)." I missed the `ay` check.

Fix: Add `ay` validation to the Catalog constructor in `src/entities.js:109-111`:
```js
if (!data || !data.courses) throw new Error('Catalog requires courses');
if (!data.ay) throw new Error('Catalog requires ay');
```

Update the error message test in the test file and add a test for missing `ay`. This also feeds into F10 (edge case tests).

## F2: `AuditResult.export()` signature differs from spec

**Verdict: Agree**

The implementation is correct — `exportAudit()` genuinely needs a catalog for `lookupTitle()`. The spec needs updating, not the code. This is a spec documentation fix, not a code fix. I'll note it as deferred to a spec update pass.

## F3: `AuditResult.summary` breaks for `credits-from` root nodes

**Verdict: Agree**

Real bug. The getter reads `this.#raw.result.items`, which works for `all-of`/`any-of`/`n-of` composites but not for `credits-from` (has `source`, not `items`), `with-constraint` (has `requirement`), `except` (has `source` + `exclude`), or leaf nodes (no children at all).

The reviewer's suggested fix (`if (this.#raw.result.summary) return this.#raw.result.summary`) won't work — I verified that `single-tree.js` does not pre-compute a `.summary` property on any audit result node. `buildSummary` is only used in `status.js` as a utility for external callers, not during tree construction.

The right fix is to walk immediate children regardless of node shape, using the same child-property knowledge that `forEachChild` centralizes. However, `forEachChild` is an internal module and `summary` needs to work on audit result nodes (which have `source`, `requirement`, etc., not just AST child props).

Pragmatic fix — collect immediate child statuses from whichever child property the result node has:

```js
get summary() {
  const r = this.#raw.result;
  let statuses;
  if (r.items && Array.isArray(r.items)) {
    statuses = r.items.map(i => i.status);
  } else if (r.source && r.source.items) {
    // credits-from: source is typically an all-of wrapping the source items
    statuses = r.source.items.map(i => i.status);
  } else if (r.requirement) {
    // with-constraint
    statuses = [r.requirement.status];
  } else {
    // leaf node
    statuses = [r.status];
  }
  return buildSummary(statuses);
}
```

This covers all node shapes: composites (`items`), `credits-from` (`source.items`), `with-constraint` (`requirement`), and leaf nodes. I'll add tests exercising each shape per F8.

## F4: `MultiAuditResult.trees` getter creates new instances on every access

**Verdict: Agree**

Real bug. A getter that returns different object identity each call violates the principle of least surprise and has performance implications. The fix is to memoize using a private field.

Fix in `src/entities.js` — use a `#trees` private field:
```js
#trees;
get trees() {
  if (!this.#trees) {
    const obj = {};
    for (const [code, data] of this.#raw.results) {
      obj[code] = new AuditResult(data, this.#asts[code] || null);
    }
    this.#trees = Object.freeze(obj);
  }
  return this.#trees;
}
```

Using a private field (not `_trees`) to stay consistent with the rest of the entity pattern. `Object.freeze` prevents mutation of the trees map.

## F5: `Object.freeze` on Catalog is shallow

**Verdict: Partially Agree**

The asymmetry is real — Requirement uses `structuredClone` + `Object.freeze`, Catalog doesn't. However, I disagree that deep-freezing is the right fix:

1. **Performance**: Catalogs can have 500+ courses with nested prerequisites. `structuredClone` on a large catalog is expensive, and this constructor is called in hot paths (batch auditing).
2. **Shared ownership**: The catalog is typically loaded once from JSON and shared across many operations. Deep cloning on every `new Catalog()` wastes memory.
3. **Internal functions don't mutate**: All internal functions treat the catalog as read-only. The shallow freeze prevents accidental reassignment of top-level properties (`catalog.courses = []`). Individual course mutations (`catalog.courses[0].title = 'x'`) are possible but would be a clear misuse.

Fix: Accept the asymmetry. Document it by adding a JSDoc comment on the Catalog constructor explaining the shallow freeze decision. No code change beyond the comment.

## F6: `unwrapTranscript` maps every entry on every call

**Verdict: Partially Agree**

The allocation concern is valid but the impact is negligible. Typical transcripts have 30-60 entries. Creating 60 plain objects is microseconds. The real hot path is `prepareAudit().run()` for batch auditing, which takes plain arrays directly and never hits `unwrapTranscript`.

That said, a lazy cache is cheap to add and prevents any future concern if someone does audit the same Transcript entity repeatedly.

Fix: Add a `#plain` cache on Transcript:
```js
#plain;
toPlainArray() {
  if (!this.#plain) {
    this.#plain = Object.freeze(this.#entries.map(e => e.toJSON()));
  }
  return this.#plain;
}
```

Update `unwrapTranscript` to use it:
```js
function unwrapTranscript(t) {
  if (t instanceof Transcript) return t.toPlainArray();
  return t;
}
```

Since Transcript is immutable (entries never change), the cache is always valid.

## F7: 13 assertions use `toBeGreaterThan(0)` instead of exact counts

**Verdict: Agree**

Violates the coding standard. All 13 are testable with exact counts given the minimal catalog fixture.

Specific fixes (I'll verify each count against the fixture):
- Line 97: `result.errors.length` — `toHaveLength(1)` (single rule violation)
- Line 113: `req.description.length` — this one is a string length, not an array count. Replace with a content assertion instead (e.g. `toContain`).
- Lines 271-272: filter resolution — `toHaveLength(1)` for filters, exact count for matched CMPS courses
- Lines 279, 285: `result.courses.length` — `toHaveLength(1)` (single course ref)
- Line 340: `unmet.length` — `toHaveLength(1)` (CMPS 310 is unmet)
- Lines 693-694: `extractAllReferences` — exact counts for explicit and filtered
- Lines 702, 710: `diff changes.length` — exact counts
- Line 742: `extractAllReferences` — `toHaveLength(1)`

## F8: No test for `AuditResult.summary` correctness

**Verdict: Agree**

The test only checks property existence. After fixing F3, I need tests that verify:
1. Complete transcript: `{ met: 2, notMet: 0, inProgress: 0, partialProgress: 0, total: 2 }`
2. Partial transcript (some unmet): exact counts
3. In-progress transcript: verify `inProgress` count
4. `credits-from` root: verify it walks `source.items` correctly
5. Leaf node root: verify `{ total: 1 }`

## F9: No test for `MultiAuditResult.trees` identity stability

**Verdict: Agree**

After fixing F4, the test should verify `multi.trees === multi.trees` (same reference on repeated access). This is the regression test for the memoization fix.

## F10: Missing edge case tests for entity construction

**Verdict: Agree**

I'll add:
1. `catalog({courses: []})` — empty but valid (courses present)
2. `catalog({courses: [...], ay: undefined})` — throws after F1 fix
3. `transcript([])` — empty transcript is valid
4. `TranscriptEntry` with extra unknown fields — `toJSON()` preserves them
5. Deeply nested AST — `structuredClone` handles it

---

## Action Plan

| Priority | Finding(s) | Planned Fix | Commit Scope |
|----------|------------|-------------|--------------|
| High | F3 | Fix `AuditResult.summary` to handle `credits-from`, `with-constraint`, and leaf roots | `src/entities.js` |
| High | F4 | Memoize `MultiAuditResult.trees` with `#trees` private field + `Object.freeze` | `src/entities.js` |
| High | F7 | Replace 13 `toBeGreaterThan(0)` with exact counts/content assertions | `test/api/public-api.test.js` |
| High | F8 | Add exact summary value tests: complete, partial, in-progress, credits-from, leaf | `test/api/public-api.test.js` |
| Medium | F1 | Add `ay` validation to Catalog constructor | `src/entities.js` + test |
| Medium | F9 | Add `multi.trees === multi.trees` identity test | `test/api/public-api.test.js` |
| Medium | F10 | Add 5 edge case tests for entity construction | `test/api/public-api.test.js` |
| Low | F5 | Add JSDoc comment documenting shallow freeze decision on Catalog | `src/entities.js` |
| Low | F6 | Add `toPlainArray()` cache on Transcript, update `unwrapTranscript` | `src/entities.js` |

All changes fit in a single commit — they're all fixes to the same three files.

## Deferred Items

- **F2** (spec documentation): `AuditResult.export(catalog, opts)` signature mismatch is a spec doc update, not a code change. Will be addressed in the next spec review pass.
