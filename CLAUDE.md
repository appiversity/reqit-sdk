# CLAUDE.md — reqit-sdk

## What This Is

This is the **reqit** npm package — the core SDK for the Reqit product family (Phase 1). It provides a parser, AST, resolver, auditor, and exporters for academic requirements. Pure computation library — no database, no network, no dependency on other reqit packages.

## Project Family

Reqit is organized as 4 sibling projects:

| Project | What | Visibility |
|---------|------|-----------|
| **reqit-specs** | Design docs, case studies, strategy, materials | Private |
| **reqit-sdk** (this repo) | Phase 1 — `reqit` npm package: parser, AST, resolver, auditor, exporters | Open source |
| **reqit-pg** | Phase 2 — `reqit-pg` npm package: PostgreSQL schema, materialization, rollover | Open source |
| **reqit-catalog** | Phase 3 — Self-hosted web app: Express 5, Pug, HTMX, Bootstrap 5, PostgreSQL | Open source |

**Dependency chain:** reqit-sdk → reqit-pg → reqit-catalog

All design documents live in `../reqit-specs/design/`. Read `../reqit-specs/design/strategy.md` for the master plan.

## Key Specs

These design documents define what this package implements:

| Spec | What |
|------|------|
| [02-language.md](../reqit-specs/design/02-language.md) | The reqit DSL — syntax, operators, variables, scope blocks |
| [03-ast.md](../reqit-specs/design/03-ast.md) | JSON AST — 20 node types, validation rules, audit semantics |
| [06-export.md](../reqit-specs/design/06-export.md) | Export formats — XLSX, CSV, JSON, HTML, outline, description |
| [08-sdk.md](../reqit-specs/design/08-sdk.md) | SDK API — `parse()`, `resolve()`, `audit()`, `toText()`, rollover |
| [13-testing-strategy.md](../reqit-specs/design/13-testing-strategy.md) | Test layers, fixtures, round-trip testing |

## What This Package Does

- **Parse** reqit DSL text into a JSON AST
- **Validate** AST structure (20 node types, validation rules)
- **Render** AST back to text (round-trip guarantee: parse → render → parse produces identical AST)
- **Render** AST to human-readable formats (description, outline, HTML)
- **Resolve** course filters against a catalog (match `courses where subject = "CMPS"` to actual courses)
- **Grade** comparison and GPA calculation with configurable scales
- **Audit** a requirement tree against a transcript *(not yet implemented)*
- **Export** requirements to multiple formats *(not yet implemented)*
- **Utilities:** `walk`, `transform`, `diff`, `findUnmet`, `findNextEligible`, `extractCourses` *(not yet implemented)*

## Current Implementation Status

| Subsystem | Status | Tests |
|-----------|--------|-------|
| Parser (Peggy.js grammar) | Complete | ~650 tests |
| AST validation | Complete | ~30 tests |
| Renderers (4 renderers + shared) | Complete | ~330 tests |
| Resolver (catalog resolution) | Complete | ~270 tests |
| Grade system | Complete | ~80 tests |
| Auditor | Not started | — |
| Exporters (XLSX, CSV, JSON) | Not started | — |
| Utility functions | Not started | — |

## Source Organization

```
src/
  index.js              — Public API exports
  parser/               — Peggy.js grammar + error rewriting
  ast/                  — AST validation
  render/
    shared.js           — NODE_TYPES, courseKey(), COMPOSITE_LABELS, lookupTitle, helpers
    to-text.js          — CODE renderer (round-trip guarantee)
    to-description.js   — Display renderer (prose)
    to-outline.js       — Display renderer (tree with box-drawing)
    to-html.js          — Display renderer (semantic HTML, reqit- CSS classes)
  resolve/index.js      — Catalog resolution
  grade/index.js        — Grade comparison, GPA, custom scales
test/
  fixtures/catalogs/    — Lehigh, Moravian, W&M, RCNJ, minimal catalogs
  parser/               — Grammar tests by construct
  render/               — Renderer tests + exhaustiveness guard
  resolve/              — Resolution tests + exhaustiveness guard + edge cases
  grade/                — Grade system tests
  ast/                  — Validation tests
```

## Coding Standards

These patterns are established and must be followed. They come from a code review that identified and fixed violations — do not reintroduce them.

### Always use `courseKey()`
```js
const { courseKey } = require('./render/shared');
courseKey(course) // → "MATH:151"
```
**Never** inline `course.subject + ':' + course.number`. The `courseKey()` helper in `shared.js` is the single canonical key constructor.

### Code Renderer vs Display Renderer
`toText` is a **code renderer** — it produces parseable DSL source code. The other three renderers (`toDescription`, `toOutline`, `toHTML`) are **display renderers** producing human-readable output.

- In display renderers, `variable-def` and `scope` are transparent wrappers (render through to inner content)
- In `toText`, they produce real DSL syntax (`$name = ...`, `scope "name" { ... }`)
- Composite labels use `COMPOSITE_LABELS` table in display renderers, but stay as explicit switch cases in `toText`
- **Never apply display-renderer patterns to toText or vice versa**

### Centralize shared constants
- New node type → add to `NODE_TYPES` in `shared.js`, then add cases in all 4 renderers + resolver
- New composite label → add to `COMPOSITE_LABELS` in `shared.js`
- New operator → add to `OP_SYMBOLS` + `OP_PHRASES` in `shared.js`
- `shared.js` has a maintenance guide comment at the top listing all change-impact points

### Exhaustiveness tests are structural guards
Both `test/render/exhaustiveness.test.js` and `test/resolve/exhaustiveness.test.js` verify every `NODE_TYPE` is handled. Adding a node type without updating all renderers/resolver will fail these tests.

### Test precision
- Use `toHaveLength(N)` with exact expected counts, not `toBeGreaterThan(0)`
- Document intentional design decisions in test comments when behaviour is non-obvious
- Cover edge cases: null/undefined inputs, empty catalogs, unknown fields, missing courses

### Don't over-abstract
Three similar switch cases are better than one premature `forEachChild` abstraction. Centralize only when there's a clear, proven maintenance burden.

### Data model changes and test failures
Tests that depend on data models exist to surface dependencies — when a model changes, test failures show you what's affected. Never silently support both old and new data model shapes as a fallback to avoid test failures. Always ask before changing tests that fail due to a data model change, and always ask before adding fallback/alternate shape support. The right default is: change the model, let tests fail, confirm the failures align with the plan, then update tests.

### Remove dead code
Don't comment out dead code or leave no-op loops. Remove it and add a test proving the correct behaviour. If keeping dead code intentionally, explain why in a comment.

## Critical Constraints

- **No external system dependencies.** This package is a pure computation library — no database, no network, no dependency on reqit-pg or reqit-catalog. npm dependencies are fine where useful; architectural dependencies are not.
- **No student data storage.** Transcripts are in-memory input to `audit()` — never persisted.
- **Parser:** Peggy.js (PEG grammar). Not Nearley.js, not ANTLR.
- **Three representations:** Text (DSL) ↔ JSON AST. This package handles only Text ↔ AST. Relational (database) is reqit-pg.
- **FERPA boundary:** Reqit never stores student data.
- **Overlap rules** control course sharing between programs during multi-tree audits.
- **Audit adjustments** (waivers, substitutions) are application-layer concerns, not SDK.

## Build Order

1. Peggy.js grammar (02-language.md)
2. Parser: text → AST
3. AST validation (03-ast.md §Validation Rules)
4. Renderer: AST → text (round-trip guarantee)
5. Catalog resolution (resolve course filters against catalog)
6. Single-tree auditing
7. Multi-tree auditing (overlap rules)
8. Export renderers (description, outline, HTML, XLSX, CSV, JSON)
9. Utility functions
10. Grade configuration

## Testing

- **Test fixtures derived from case studies** — Lehigh BS CS, Moravian CS/DS, William & Mary COLL, RCNJ
- **Round-trip testing** — parse text → AST → render text → parse again → compare ASTs
- **Audit golden tests** — known transcript + known requirements → expected audit result
- **Pure unit tests** — no database, no HTTP, no mocks of external systems

## What NOT to Do

- Do not add database, network, or other reqit-package dependencies — this is a pure computation library
- Do not store student data
- Do not build on the v1 grammar or AST — v2 replaces them entirely
- Do not implement database features — that's reqit-pg
- Do not implement HTTP/REST — that's reqit-catalog
