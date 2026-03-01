# CLAUDE.md — reqit-sdk

## What This Is

This is the **reqit** npm package — the core SDK for the Reqit product family (Phase 1). It provides a parser, AST, resolver, auditor, and exporters for academic requirements. Pure computation library — no database, no network, no dependency on other reqit packages.

## Project Family

Reqit is organized as 5 sibling projects:

| Project | What | Visibility |
|---------|------|-----------|
| **reqit-specs** | Design docs, case studies, strategy, materials | Private |
| **reqit-sdk** (this repo) | Phase 1 — `reqit` npm package: parser, AST, resolver, auditor, exporters | Open source |
| **reqit-pg** | Phase 2 — `reqit-pg` npm package: PostgreSQL schema, materialization, rollover | Open source |
| **reqit-catalog** | Phase 3 — Self-hosted web app: Express 5, Pug, HTMX, Bootstrap 5, PostgreSQL | Open source |
| **reqit-cloud** | Phase 4 — SaaS hosted instance: multi-tenancy, billing, onboarding | Private |

**Dependency chain:** reqit-sdk → reqit-pg → reqit-catalog → reqit-cloud

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
- **Resolve** course filters against a catalog (match `courses where subject = "CMPS"` to actual courses)
- **Audit** a requirement tree against a transcript (single-tree and multi-tree with overlap rules)
- **Export** requirements to multiple formats (description, outline, HTML, XLSX, CSV, JSON)
- **Utilities:** `walk`, `transform`, `diff`, `findUnmet`, `findNextEligible`, `extractCourses`

## Critical Constraints

- **No external system dependencies.** This package is a pure computation library — no database, no network, no dependency on reqit-pg, reqit-catalog, or reqit-cloud. npm dependencies are fine where useful; architectural dependencies are not.
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
