# Code Review 06 — Audit Exceptions, Public SDK, and DSL Label Enhancements

## Scope

Three focus areas reviewed:

1. **Audit exceptions** — waiver/substitution system (`src/audit/exceptions.js`, integration with `single-tree.js`)
2. **Public SDK** — entity classes and API surface (`src/entities.js`, `src/index.js`)
3. **DSL label enhancements** — parser, renderers, validation (uncommitted changes)

| Area | Source Files | Source Lines | Test Files | Tests |
|------|-------------|-------------|------------|-------|
| Exceptions | `exceptions.js` | 482 | `exceptions.test.js`, `waiver-audit.test.js`, `substitution-audit.test.js` | ~1,211 |
| Public SDK | `entities.js`, `index.js` | 450 | `public-api.test.js` | ~200 |
| Label DSL | `grammar.pegjs`, 4 renderers, `validate.js` | ~80 changed | `label.test.js`, `public-api.test.js` (label section) | ~20 |

All 2,322 tests pass across 79 suites.

## Architecture Overview

### Exceptions subsystem

Well-structured with clear separation:
- **Factory functions** (`waiver()`, `substitution()`) — input validation and construction
- **Context builder** (`buildExceptionContext()`) — O(1) indexed lookup maps
- **Leaf matching** (`findLeafWaiver()`, `buildWaivedResult()`) — per-node-type dispatch
- **Group matching** (`buildGroupWaivedResult()`) — label-based composite waiver with credit resolution
- **Substitution application** (`applySubstitutions()`) — virtual transcript entry creation
- **Post-audit tracking** (`partitionExceptions()`) — applied vs unused

### Public SDK

Clean entity facade pattern. Entity classes use `#private` fields for encapsulation. `unwrapCatalog()`/`unwrapTranscript()` enable dual acceptance of wrapped entities and plain objects.

### Label DSL

Labels already supported in AST, auditor, exports, and diff. DSL changes add parser syntax (`"Label": composite`), toText round-trip, and display in three renderers.

## Findings — Code Smells

### F1: Inline requires in exceptions.js

`src/audit/exceptions.js` has five inline `require()` calls inside functions:

| Line | Import |
|------|--------|
| 261 | `require('./status')` in `buildWaivedResult()` |
| 305 | `require('./status')` in `buildGroupWaivedResult()` |
| 332 | `require('../ast/children')` in `resolveWaivedCredits()` |
| 429 | `require('./status')` in `wasWaiverApplied()` |
| 441 | `require('../ast/children')` in `wasWaiverApplied()` |

These are likely to avoid circular dependency (`exceptions.js` <-> `status.js` or `audit/index.js`). If that's the case, the cycle should be documented with a comment at the top of the file explaining why top-level imports aren't possible. If there's no actual cycle, move them to the top.

**Suggested action:** Verify whether a circular dependency exists. If yes, add a comment. If no, hoist to top-level imports.

### F2: Catalog.findCourse uses inline key construction

`src/entities.js:134` constructs course keys inline:

```js
this.#courseIndex.set(`${c.subject}:${c.number}`, c);
```

And at line 137:
```js
return this.#courseIndex.get(`${subject}:${number}`);
```

CLAUDE.md coding standards require: "**Never** inline `course.subject + ':' + course.number`. The `courseKey()` helper in `shared.js` is the single canonical key constructor."

The `Catalog` class doesn't import `courseKey()` from `shared.js`. While the concatenation is equivalent, it violates the established coding standard and creates a maintenance risk if the key format ever changes.

**Suggested action:** Import `courseKey` from `./render/shared` and use it in both places.

### F3: CSS class naming inconsistency between spec and implementation

The design spec `23-label-dsl-render.md` specifies `reqit-label` as the CSS class for named labels:

> Add the label as a `<span class="reqit-label">` before the composite description

The implementation in `to-html.js:80` uses `reqit-named-label`:

```js
return `<span class="reqit-named-label">${esc(node.label)}</span> ...`;
```

This divergence exists because `reqit-label` was already in use for composite headings (e.g., `<p class="reqit-label">Complete all of the following:</p>` at line 132). The implementation chose `reqit-named-label` to avoid collision. This is the correct call, but the spec should be updated to match.

**Suggested action:** Update `23-label-dsl-render.md` to reference `reqit-named-label` instead of `reqit-label`.

### F4: `resolveWaivedCredits` doesn't handle course-filter nodes

`src/audit/exceptions.js:331-352` — When a labeled group is waived, `resolveWaivedCredits()` walks the AST subtree summing catalog credits for `course` nodes. However, if the group contains `course-filter` nodes (e.g., `"Electives": at least 4 of (courses where subject = "CMPS")`), those filters are not resolved and contribute zero credits.

This means a waived group with course-filter children will report `waivedCredits: 0` or omit `waivedCredits` entirely, which could be misleading for credit-counting displays.

**Suggested action:** Document this limitation or consider resolving filters against the catalog during credit calculation. Low priority — waived groups with filters are an edge case, and the credit count is informational.

## Findings — Test Improvements

### F5: No public API tests for non-course waiver targets

`test/api/public-api.test.js` tests waiver creation and audit integration only for course waivers. The `waiver()` factory supports five target types (course, score, attainment, quantity, label), but only `course` is tested through the public API.

The unit tests in `test/audit/exceptions.test.js` cover all five targets at the factory level, and `waiver-audit.test.js` covers integration for course, score, attainment, and label waivers. But the public SDK integration path (`reqit.waiver()` → `req.audit()` → result check) is only tested for course.

**Suggested action:** Add public API tests for at least `score` and `label` waiver targets to verify the full SDK path.

### F6: Label round-trip test coverage

The label parser tests (`test/parser/label.test.js`) verify parsing. The `toText` renderer emits labels. But there's no explicit round-trip test that verifies `parse(toText(parse(labeled_input))) === parse(labeled_input)` for labeled composites.

The existing round-trip test suite may cover this implicitly if it includes labeled inputs, but a dedicated test would strengthen confidence.

**Suggested action:** Add a round-trip test for labeled composites in the render test suite.

### F7: Missing edge case — waiver on non-existent label

No test verifies what happens when a label waiver targets a label that doesn't exist in the AST. The `partitionExceptions()` function should classify it as unused, but this isn't explicitly tested.

**Suggested action:** Add a test: `waiver({ label: 'NonExistent', reason: '...' })` → verify it appears in `unused` after audit.

## Findings — Spec Compliance

### F8: Spec shows flat waiver signature, implementation uses nested

`22-sdk-api-design.md` (if it documents waiver creation) may show a flat signature like `waiver({ subject, number, reason })`. The actual implementation uses a nested structure: `waiver({ course: { subject, number }, reason })` to support multiple target types.

The implementation design is superior (it cleanly separates five target types), but the spec should be updated if it shows the flat form.

**Suggested action:** Verify and update `22-sdk-api-design.md` to match the implemented `waiver()` signature.

## Confidence Assessment

### Exceptions subsystem: High

**Evidence for:**
- 1,211 lines of dedicated tests across 3 test files
- All five waiver target types tested at factory and integration levels
- Substitution virtual entry mechanism well-tested
- `partitionExceptions()` correctly tracks applied vs unused
- `buildExceptionContext()` provides clean O(1) lookup
- Group waiver (label-based) tested end-to-end

**Evidence against:**
- Inline requires suggest possible architectural tension (F1)
- `resolveWaivedCredits` doesn't handle course-filter nodes (F4) — minor gap

### Public SDK: High

**Evidence for:**
- Entity classes are thin facades with clear boundaries
- Immutable by construction (`Object.freeze`, `structuredClone`, `#private` fields)
- Dual acceptance pattern (`unwrapCatalog`/`unwrapTranscript`) is clean and well-tested
- `calculateGPA` wrapper correctly handles entity and plain-object inputs
- `publicAuditMulti` properly unwraps entities and maps program context

**Evidence against:**
- `courseKey()` violation in `Catalog.findCourse` (F2) — correctness risk is low but standard is clear
- Non-course waiver targets not tested through full public API path (F5)

### Label DSL: Medium-High

**Evidence for:**
- AST spec already defined labels; parser just adds syntax
- Auditor preserves labels consistently across all 7 composite types
- `toText` round-trip emits labels correctly
- All three display renderers handle labels
- Validate rule added for label format

**Evidence against:**
- No explicit round-trip test for labeled composites (F6)
- CSS class naming diverges from spec (F3) — implementation is correct, spec needs update
- Changes are still uncommitted — not yet validated by CI

## Action Items

| Priority | Finding | Action |
|----------|---------|--------|
| Medium | F1 | Resolve inline requires — document circular dependency or hoist to top-level |
| Medium | F2 | Use `courseKey()` in `Catalog.findCourse` per coding standards |
| Low | F3 | Update `23-label-dsl-render.md` spec to use `reqit-named-label` |
| Low | F4 | Document `resolveWaivedCredits` limitation with course-filter nodes |
| Medium | F5 | Add public API tests for score and label waiver targets |
| Medium | F6 | Add explicit label round-trip test |
| Low | F7 | Add test for waiver on non-existent label |
| Low | F8 | Update `22-sdk-api-design.md` waiver signature to match implementation |
