# Code Review Response — Review 06

## F1: Inline requires in exceptions.js

**Verdict: Agree**

Confirmed — neither `status.js` nor `children.js` require `exceptions.js`. There is no circular dependency; these were likely deferred during development. All five inline requires should be hoisted to top-level imports.

Fix: Move `require('./status')` and `require('../ast/children')` to top-level `const` declarations alongside the existing `require('../render/shared')`.

## F2: Catalog.findCourse uses inline key construction

**Verdict: Agree**

Clear violation of the coding standard. `courseKey()` is the canonical key constructor and should be used here. The `Catalog` entity in `entities.js` should import `courseKey` from `./render/shared` and use it in both `#courseIndex.set()` and `#courseIndex.get()`.

Fix: Add `const { courseKey } = require('./render/shared');` to entities.js. Replace inline template literals with `courseKey(c)` for set and `courseKey({ subject, number })` for get.

## F3: CSS class naming inconsistency between spec and implementation

**Verdict: Agree**

The implementation correctly avoided the `reqit-label` collision with the existing `<p class="reqit-label">` on composite headings. `reqit-named-label` is the right call. The spec needs updating to match.

Fix: Update four references to `reqit-label` in `23-label-dsl-render.md` to `reqit-named-label`.

## F4: resolveWaivedCredits doesn't handle course-filter nodes

**Verdict: Agree (document, don't fix)**

Correct observation. A waived group containing `course-filter` nodes can't resolve credits without evaluating filters against the catalog, which would couple waiver construction to resolution. This is an acceptable limitation — waived groups with filter-only children are rare, and the credit count is informational.

Fix: Add a JSDoc note to `resolveWaivedCredits()` documenting this limitation.

## F5: No public API tests for non-course waiver targets

**Verdict: Agree**

The unit-level coverage is thorough but the public SDK path (`reqit.waiver()` → `req.audit()` → result) is only tested for course waivers. Adding score and label waiver targets through the public API strengthens integration confidence.

Fix: Add two tests to `test/api/public-api.test.js`: one for score waivers, one for label waivers, both exercising the full `reqit.waiver()` → `req.audit()` → status check path.

## F6: Label round-trip test coverage

**Verdict: Disagree**

The review states "there's no explicit round-trip test" but the `round-trip.test.js` file already has a dedicated `describe('round-trip — labels')` block with 11 tests covering all 7 composite types, variable-defs, nested labels, except+grade, where clauses, and scoped programs. These were added in the same commit as the label implementation. The `roundTrip()` helper does exactly `parse(toText(parse(input)))` deep-equal, which is the assertion the review asks for.

## F7: Missing edge case — waiver on non-existent label

**Verdict: Agree**

Good catch. `partitionExceptions()` should classify a waiver targeting a non-existent label as unused. This is likely already correct behavior (the waiver won't match any node, so it won't appear in the result tree), but an explicit test documents the contract.

Fix: Add a test to `test/api/public-api.test.js` verifying that a label waiver targeting `'NonExistent'` appears in `result.exceptions.unused`.

## F8: Spec shows flat waiver signature, implementation uses nested

**Verdict: Agree**

Confirmed — `22-sdk-api-design.md` line 413 shows `{ subject: 'MATH', number: '151', reason: '...' }` but the implementation uses `{ course: { subject, number }, reason }`. The spec also shows flat form at line 579. Both should be updated to match the implemented nested structure.

Fix: Update the waiver examples in `22-sdk-api-design.md` to use `{ course: { subject, number }, reason }` syntax, and add examples for the other four target types (score, attainment, quantity, label).

---

## Action Plan

| Priority | Finding(s) | Planned Fix | Commit Scope |
|----------|------------|-------------|--------------|
| Medium | F1 | Hoist 5 inline requires to top-level in `exceptions.js` | reqit-sdk |
| Medium | F2 | Use `courseKey()` in `Catalog.findCourse` in `entities.js` | reqit-sdk |
| Medium | F5, F7 | Add public API tests for score waiver, label waiver, and non-existent label waiver | reqit-sdk |
| Low | F3 | Update `reqit-label` → `reqit-named-label` in `23-label-dsl-render.md` | reqit-specs |
| Low | F4 | Add JSDoc note to `resolveWaivedCredits()` | reqit-sdk |
| Low | F8 | Update waiver signature examples in `22-sdk-api-design.md` | reqit-specs |

## Deferred Items

None — all findings addressed.
