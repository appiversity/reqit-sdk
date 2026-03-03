# reqit-sdk Implementation Plan

Each checkbox is a single git commit. Steps are ordered so every commit builds on the previous and produces a working, testable state. Tests are written alongside (or before) the code they cover.

---

## Phase 0: Project Scaffolding

- [x] **0.1** Initialize npm package (`package.json`, jest config, eslint, project structure under `src/` and `test/`)
- [x] **0.2** Create shared test fixture catalogs (`test/fixtures/catalogs/`) — minimal catalog, Lehigh subset, Moravian subset, William & Mary subset, RCNJ subset — derived from case studies

## Phase 1: Grammar & Parser (Incremental)

Build the Peggy.js grammar one construct at a time. Each step adds grammar rules, parser output, and tests.

### Course References
- [x] **1.1** Grammar + parser + tests: single course references (`MATH 151`, `CSE 003`, `CMPS 147`, alphanumeric numbers like `101A`, `220.2`). Case-insensitive subjects and numbers, normalized to uppercase.
- [x] **1.2** Grammar + parser + tests: comments (`# line comment`, `MATH 151 # inline comment`)

### Boolean Operators
- [x] **1.3** Grammar + parser + tests: `all of (...)` with course items. Case-insensitive keywords with word boundary checks.
- [x] **1.4** Grammar + parser + tests: `any of (...)` with course items
- [x] **1.5** Grammar + parser + tests: nested `all of` / `any of` (arbitrary depth). Nesting already works via recursive Expression rule; dedicated tests for 3-4 level depth and case study patterns.

### Counted Selection
- [x] **1.6** Grammar + parser + tests: `at least N of (...)`, `at most N of (...)`, `exactly N of (...)`

### Course Filters
- [x] **1.7** Grammar + parser + tests: `courses where subject = "X"`, `number >= N`, `number <= N`, equality, compound `and` filters
- [x] **1.8** Grammar + parser + tests: `attribute = "X"`, `credits >= N`, `credits <= N`
- [x] **1.9** Grammar + parser + tests: `in (...)` and `not in (...)` operators (`subject in ("CSE", "MATH")`, `attribute in ("ALV", "CSI")`)
- [x] **1.10** Grammar + parser + tests: `!=` operator (`subject != "CSCI"`)
- [x] **1.11** Grammar + parser + tests: `prerequisite includes (...)`, `corequisite includes (...)`

### Credit Requirements
- [x] **1.12** Grammar + parser + tests: `at least N credits from (...)`, `at most N credits from (...)`, `exactly N credits from (...)`

### Exclusions
- [x] **1.13** Grammar + parser + tests: `except (...)` modifier on course sets and filters
- [x] **1.14** Grammar + parser + tests: `none of (...)`

### Constraints
- [x] **1.15** Grammar + parser + tests: `with grade >= "C"` on courses and groups
- [x] **1.16** Grammar + parser + tests: `with gpa >= 2.0` on groups
- [x] **1.17** Grammar + parser + tests: `(concurrent)` on course references

### Non-Course Requirements
- [x] **1.18** Grammar + parser + tests: `score SAT_MATH >= 580`, `attainment JUNIOR_STANDING`, `quantity CLINICAL_HOURS >= 500` (unquoted codes, case-insensitive, normalized to uppercase)

### Group Operators
- [x] **1.19** Grammar + parser + tests: `one from each of (...)`
- [x] **1.20** Grammar + parser + tests: `from at least N of (...)`

### Variables
- [x] **1.21** Grammar + parser + tests: variable definition (`$core = all of (...)`) and reference (`$core`)
- [x] **1.22** Grammar + parser + tests: scope blocks (`scope "cmps-major" { ... }`) and cross-scope references (`$scope.name`)

### Post-Selection Constraints
- [x] **1.23** Grammar + parser + tests: `where at least N match (filter)` on n-of nodes

### Overlap & Program References
- [x] **1.24** Grammar + parser + tests: `program CS major undergraduate` (unquoted code), `any program major`, program filter
- [x] **1.25** Grammar + parser + tests: `overlap between (...) at most N courses/credits/percent`
- [x] **1.26** Grammar + parser + tests: `outside (primary major) at least N credits`
- [x] **1.27** Grammar + parser + tests: program context references (`primary major`, `primary minor`)

### Case Insensitivity & Edge Cases
- [x] **1.28** Grammar + parser + tests: case-insensitive keywords (`ALL OF`, `Any Of`, `Courses Where`), whitespace variations
- [x] **1.29** Parser error handling: human-friendly error messages for non-programmers. Catch common mistakes (missing commas, unclosed parens, misspelled keywords, trailing commas, empty lists) and rewrite Peggy's raw `SyntaxError` into actionable messages with location, problem description, and suggested fix. These errors are the UX surface for a code editor in reqit-catalog.

### Full-Language Integration Tests
- [x] **1.30** Parser integration tests using complete requirement trees from all 4 case studies (Lehigh BS CS prereqs, Moravian CS/DS programs, W&M COLL gen-ed + tracks, RCNJ CS prereqs with test scores)

**Do not proceed to Phase 2 without asking for verification.  This is a checkpoint**.

## Phase 2: AST Validation

- [x] **2.1** `validate()` function skeleton with `walkNode`, `collectDefs`, `joinPath` + test file with smoke tests
- [x] **2.2** Validation rules 1–4 + tests: required `type` field, non-empty `items`, `n-of`/`from-n-groups` count bounds, `credits-from` positive credits
- [x] **2.3** Validation rules 5–8 + tests: variable-ref must be defined, no circular variable refs (direct + indirect), course subject format (2–6 uppercase alphanum), course number format (1–6 alphanum starting with digit)
- [x] **2.4** Validation rules 9–14 + tests: filter op validity per field type, with-constraint targets courses, concurrentAllowed context, post_constraint filter fields, overlap/outside top-level only, program-context-ref role values. Integration tests with parser output. 100% line + branch coverage.

**Do not proceed to Phase 3 without asking for verification.  This is a checkpoint**.

## Phase 3: Renderers

### toText (Round-Trip)
- [x] **3.1** `toText()` for leaf nodes (course, course-filter, score, attainment, quantity, variable-ref)
- [x] **3.2** `toText()` for composite nodes (all-of, any-of, n-of, none-of, one-from-each, from-n-groups, credits-from)
- [x] **3.3** `toText()` for wrapper/modifier nodes (with-constraint, except), variable-def, scope blocks
- [x] **3.4** `toText()` for policy nodes (overlap-limit, outside-program, program, program-context-ref)
- [x] **3.5** Round-trip tests: `parse(toText(parse(text))) ≡ parse(text)` for every fixture in the test suite (all 4 case studies)

### Human-Readable Renderers
- [x] **3.6** `toDescription()` — AST → human-readable paragraph text + tests
- [x] **3.7** `toOutline()` — AST → indented outline with course titles from catalog + tests
- [x] **3.8** `toHTML()` — AST → semantic HTML with `reqit-` CSS classes + tests

### Render Quality Pass
- [x] **3.9** Render package quality pass — documentation, modularity, performance:
  - Maintenance guide in `shared.js` documenting cross-module change impact
  - `NODE_TYPES` frozen registry of all 21 node types
  - `unwrapCreditsSource()` shared helper replacing 4 inline copies
  - `lookupTitle()` WeakMap-cached O(1) index replacing O(n) `find()`
  - JSDoc on all exports and internal functions across all 5 render modules
  - Module headers on all 4 renderers documenting purpose and architecture
  - `renderScorePhrase`/`renderQuantityPhrase` throw on unknown operators (was silent fallback)
  - `to-html.js`: extracted `renderFilter(f, catalog)` helper; bug fix threading `catalog` through `renderPostConstraints`
  - New `test/render/exhaustiveness.test.js` — structural guard verifying every NODE_TYPE is handled by every renderer

**Do not proceed to Phase 4 without asking for verification.  This is a checkpoint**.

## Phase 4: Grade Configuration

- [x] **4.1** Grade config data structure, default US letter grade scale (A+ through F), pass/fail, withdrawal, incomplete
- [x] **4.2** Grade comparison functions (`meetsMinGrade`, `isPassingGrade`) + tests
- [x] **4.3** GPA calculation function (weighted by credits) + tests
- [x] **4.4** Custom grade scale support (international scales, institution-specific) + tests

Commit Phase 4 before moving on.  As long as test coverage remains on target, can proceed to Phase 5.

## Phase 5: Catalog Resolution

Each of the following 8 steps must be distinct commits.

- [x] **5.1** `resolve()` skeleton + catalog normalization (default missing optional fields: `attributes` → `[]`, `crossListGroup` → `undefined`, `prerequisites` → `null`, `corequisites` → `null`) + course reference resolution (match `MATH 151` to catalog entry) + tests including catalogs with omitted optional fields
- [x] **5.2** Filter evaluation: subject, number (with numeric coercion for comparisons, exact string for equality) + tests
- [x] **5.3** Filter evaluation: credits (range matching — gte uses creditsMax, lte uses creditsMin, eq checks range), attribute + tests
- [x] **5.4** Filter evaluation: `in`, `not-in`, `!=` operators + tests
- [ ] **5.5** Filter evaluation: `prerequisite includes`, `corequisite includes` — walk each catalog course's `prerequisites`/`corequisites` AST to check whether it contains the specified course reference. Courses with `null` prerequisites/corequisites never match. + tests
- [ ] **5.6** Variable expansion with scope resolution (local → institution → error) + tests
- [ ] **5.7** Cross-list group resolution: when resolving an explicit course reference (e.g. `CSE 340`), also match any catalog course sharing the same `crossListGroup` (e.g. `MATH 340`). Filter results likewise include cross-listed equivalents. + tests
- [ ] **5.8** Resolution integration tests using all 4 case study catalogs (Lehigh tech electives, Moravian multi-subject pools, W&M attribute-based gen-ed, RCNJ institution-wide filters)

**Do not proceed to Phase 6 without asking for verification.  This is a checkpoint**.

## Phase 6: Single-Tree Auditing

- [ ] **6.1** `audit()` skeleton + leaf node auditing (course, score, attainment, quantity) against transcript + tests
- [ ] **6.2** Composite node auditing: all-of, any-of status rollup + tests
- [ ] **6.3** Composite node auditing: n-of (at-least, at-most, exactly) with course assignment + tests
- [ ] **6.4** Composite node auditing: none-of, one-from-each, from-n-groups + tests
- [ ] **6.5** Credit counting: credits-from with variable-credit courses + tests
- [ ] **6.6** Grade constraint evaluation: with-constraint (min-grade, min-gpa) applied during audit + tests
- [ ] **6.7** Post-selection constraint evaluation (`where at least N match`) + tests
- [ ] **6.8** Concurrent-allowed handling + in-progress course status + tests
- [ ] **6.9** Except node auditing (exclude courses from source pool before evaluation) + tests
- [ ] **6.10** Audit summary generation (met/not-met/in-progress counts per node) + tests
- [ ] **6.11** Audit integration tests: Lehigh scenarios (fresh start, year 1–3 progression, complete, almost-complete, credits-short, transfer)
- [ ] **6.12** Audit integration tests: Moravian scenarios (grade constraints, unit counting, standing requirements)
- [ ] **6.13** Audit integration tests: W&M scenarios (GPA constraints, track selection, gen-ed distribution, proficiency attainments)
- [ ] **6.14** Audit integration tests: RCNJ scenarios (test score prerequisites, pervasive grade constraints, gen-ed keystones + distribution)

## Phase 7: Audit Warnings

- [ ] **7.1** Warning infrastructure + `unrecognized-grade`, `course-not-in-catalog` warnings + tests
- [ ] **7.2** `ambiguous-credit-match`, `post-constraint-failed` warnings + tests
- [ ] **7.3** `cross-listed-match` warning (informational) + tests

**Do not proceed to Phase 8 without asking for verification.  This is a checkpoint**.

## Phase 8: Multi-Tree Auditing

- [ ] **8.1** `auditMulti()` skeleton + global course assignment tracking across trees + tests
- [ ] **8.2** Overlap rule enforcement (at-most N courses/credits/percent between two trees) + `overlap-limit-exceeded` warning + tests
- [ ] **8.3** `outside-program` evaluation (complement constraint) + tests
- [ ] **8.4** Program context reference resolution (primary-major, primary-minor, declared-department) + tests
- [ ] **8.5** Multi-tree integration tests: W&M (CS major + COLL gen-ed + graduation requirements with overlap rules)

**Do not proceed to Phase 9 without asking for verification.  This is a checkpoint**.

## Phase 9: AST Utilities

- [ ] **9.1** `walk()` — depth-first traversal with node, path, parent callback + tests
- [ ] **9.2** `transform()` — immutable AST transformation + tests
- [ ] **9.3** `extractCourses()` — all explicit course references + tests
- [ ] **9.4** `extractAllReferences()` — explicit + filter-resolved references (requires catalog) + tests
- [ ] **9.5** `diff()` — structural comparison of two ASTs, returns list of changes + tests

## Phase 10: Audit Utility Functions

- [ ] **10.1** `findUnmet()` — extract unmet leaf requirements from audit result + tests
- [ ] **10.2** `findNextEligible()` — courses whose prerequisites are met but course not yet taken + tests
- [ ] **10.3** `recomputeStatus()` — recalculate status after external modifications (waivers/substitutions) + tests

## Phase 11: Export

- [ ] **11.1** `exportPrereqMatrix()` — prerequisite cross-reference table as XLSX and CSV + tests
- [ ] **11.2** `exportProgramChecklist()` — program requirements as XLSX and CSV + tests
- [ ] **11.3** `exportAudit()` — audit result as XLSX and CSV + tests
- [ ] **11.4** `exportDependencyMatrix()` — course dependency matrix as XLSX and CSV + tests
- [ ] **11.5** `toHTML()` with audit result overlay (status classes, checkmarks, grade display) + tests

## Phase 12: Public API, Documentation & Packaging

See [22-sdk-api-design.md](../reqit-specs/design/22-sdk-api-design.md) for the full class-based API design. The public surface is a thin facade over the functional modules built in Phases 1–11.

- [ ] **12.1** `src/index.js` — Implement `Requirement`, `Catalog`, `Transcript`, `ResolutionResult`, `AuditResult`, `MultiAuditResult`, `AuditException` classes as thin wrappers delegating to internal modules. Entity factories: `reqit.parse()`, `reqit.fromAST()`, `reqit.catalog()`, `reqit.transcript()`, `reqit.waiver()`, `reqit.substitution()`. Module-level functions: `reqit.auditMulti()`, `reqit.exportPrereqMatrix()`, `reqit.exportDependencyMatrix()`, grade utilities.
- [ ] **12.2** Public API integration tests — exercise the full public surface through the class-based API. Every entity factory, every instance method, every module-level function. Tests use `require('reqit')` (not internal module imports). Cover: Requirement construction (parse, fromAST), immutability (frozen AST, transform returns new instance), rendering methods (toText, toDescription, toOutline, toHTML), resolve returns ResolutionResult (not a new Requirement), audit returns AuditResult with methods, Catalog/Transcript accept plain objects, AuditException waivers/substitutions, fluent chaining.
- [ ] **12.3** Developer documentation for integration data types — Catalog, Transcript, GradeConfig, AuditResult. These are the integration boundary — consuming applications build these structures to feed into reqit. Documentation must cover every field, its type, whether it's required/optional, and semantic meaning. Key points to document:
  - **Catalog:** `institution` (slug, opaque to reqit), `ay` (academic year string, e.g. "2025-2026"), courses, programs, attainments, gradeConfig
  - **Course:** `id`, `subject`, `number`, `title`, `creditsMin`, `creditsMax`, `attributes` (array of attribute code strings — these are unique identifiers referencing the institution's attribute definitions; at the SDK level reqit matches them as opaque strings; reqit-pg provides the `attribute` table with names/descriptions), `crossListGroup`
  - **Transcript:** array of transcript entries — external input, never stored by reqit. Grade resolution happens at audit time using catalog.gradeConfig, not at transcript instantiation.
  - **GradeConfig:** scale, passFail, withdrawal, incomplete — configurable per institution per AY
  - **AuditResult:** status, items, summary, warnings — output of `audit()` and `auditMulti()`
  - **ResolutionResult:** filters, courses — output of `req.resolve(catalog)`, informational only
  - **AuditException:** waivers and substitutions with required reason field
- [ ] **12.4** CSS class reference for `toHTML()` — comprehensive documentation of every `reqit-` CSS class emitted by the HTML renderer. Developers using the SDK will customize these styles for their own UIs, so the docs must cover: every class name and which node type / structural role produces it, the HTML structure (nesting of `div`/`span`/`ul`/`li`/`p` elements), which classes appear on leaf vs composite vs wrapper nodes, semantic meaning of each class (e.g. `reqit-post-constraint`, `reqit-concurrent`), and a starter stylesheet example. This is an integration boundary — the CSS class names and DOM structure are the SDK's visual contract with consuming applications.
- [ ] **12.5** Final coverage audit — verify 95% line, 90% branch, 100% parser rule coverage; add any missing edge case tests
- [ ] **12.6** Package metadata (`package.json` fields: main, exports, files, engines, keywords, license), README.md with usage examples

---

## Commit Count Summary

| Phase | Commits | What |
|-------|---------|------|
| 0 | 2 | Scaffolding + fixtures |
| 1 | 30 | Grammar & parser |
| 2 | 4 | AST validation |
| 3 | 9 | Renderers |
| 4 | 4 | Grade config |
| 5 | 8 | Resolution |
| 6 | 14 | Single-tree audit |
| 7 | 3 | Warnings |
| 8 | 5 | Multi-tree audit |
| 9 | 5 | AST utilities |
| 10 | 3 | Audit utilities |
| 11 | 5 | Export |
| 12 | 6 | API + integration tests + docs + packaging |
| **Total** | **98** | |

## Test Fixture Strategy

Every parser and renderer test uses real requirement text derived from the 4 case studies:

| Case Study | Exercises | Used In |
|------------|-----------|---------|
| **Lehigh** | all-of, any-of, credits-from, variables, deep prereq chains, course filters | Parser, resolution, audit (6 progression scenarios) |
| **Moravian** | n-of, grade constraints, attainments (standing), unit-based, multi-program | Parser, audit (grade scenarios) |
| **William & Mary** | except, GPA constraints, attribute filters, tracks, gen-ed distribution, negative filters, proficiency attainments | Parser, resolution, audit, multi-tree |
| **RCNJ** | score prerequisites, pervasive grade constraints, institution-wide scale, gen-ed keystones + distribution, concurrent | Parser, resolution, audit (test score scenarios) |

Constructs not exercised by case studies (`none of`, `one from each of`, `from N groups`, `quantity`) get dedicated synthetic test fixtures to ensure 100% language coverage.
