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
- [x] **5.5** Filter evaluation: `prerequisite includes`, `corequisite includes` — walk each catalog course's `prerequisites`/`corequisites` AST to check whether it contains the specified course reference. Courses with `null` prerequisites/corequisites never match. + tests
- [x] **5.6** Variable expansion with scope resolution (local → institution → error) + tests
- [x] **5.7** Cross-list group resolution: when resolving an explicit course reference (e.g. `CSE 340`), also match any catalog course sharing the same `crossListGroup` (e.g. `MATH 340`). Filter results likewise include cross-listed equivalents. + tests
- [x] **5.8** Resolution integration tests using all 4 case study catalogs (Lehigh tech electives, Moravian multi-subject pools, W&M attribute-based gen-ed, RCNJ institution-wide filters)

**Do not proceed to Phase 6 without asking for verification.  This is a checkpoint**.

## Phase 6: Single-Tree Auditing

Implementation deviated from the original fine-grained commit plan. All 20 node types were implemented in `single-tree.js` in one pass, with tests organized by concern rather than by commit. The audit subsystem also absorbed Phase 7 (warnings), `prepareAudit()` batch optimization, post-constraint backtracking, and `findUnmet()` — all originally planned for later phases.

**Source files:** `src/audit/index.js`, `src/audit/single-tree.js`, `src/audit/status.js`, `src/audit/transcript.js`, `src/audit/backtrack.js`
**Test files:** 14 test files, 245 tests total (214 original + 17 W&M + 14 RCNJ)

- [x] **6.1** `audit()` skeleton + leaf node auditing (course, score, attainment, quantity) against transcript + tests
- [x] **6.2** Composite node auditing: all-of, any-of status rollup + tests
- [x] **6.3** Composite node auditing: n-of (at-least, at-most, exactly) with course assignment + tests
- [x] **6.4** Composite node auditing: none-of, one-from-each, from-n-groups + tests
- [x] **6.5** Credit counting: credits-from with variable-credit courses + tests
- [x] **6.6** Grade constraint evaluation: with-constraint (min-grade, min-gpa) applied during audit + tests
- [x] **6.7** Post-selection constraint evaluation (`where at least N match`) + tests
- [x] **6.8** Concurrent-allowed handling + in-progress course status + tests
- [x] **6.9** Except node auditing (exclude courses from source pool before evaluation) + tests
- [x] **6.10** Audit summary generation (met/not-met/in-progress counts per node) + tests
- [x] **6.11** Audit integration tests: Lehigh scenarios (cross-listing, alternative paths, missing capstone, in-progress) — 7 tests
- [x] **6.12** Audit integration tests: minimal catalog scenarios (CS major, gen-ed, grade constraints, scores, except) — 16 tests

Additional items completed during Phase 6 (absorbed from later phases):
- [x] Grade config `audit` attribute (`isAuditableGrade()`) — originally Phase 10
- [x] Transcript model + normalization + indexing — new module
- [x] 4-state status propagation module (`status.js`) — new module
- [x] Export resolver internals (`buildCourseIndex`, `buildCrossListIndex`, `evaluateFilter`, `collectDefs`)
- [x] Warning infrastructure + all warning types (cross-listed-match, unknown-node-type, post-constraint-failed) — originally Phase 7
- [x] Exhaustiveness guard (every NODE_TYPE handled) — 23 tests
- [x] `prepareAudit()` batch optimization — originally Phase 10
- [x] Post-constraint backtracking (`backtrack.js`) — new module
- [x] `findUnmet()` utility — originally Phase 10
- [x] Public API updated (`src/index.js`)

- [x] **6.13** Audit integration tests: W&M scenarios (GPA constraints, track selection, gen-ed distribution, proficiency attainments, except clauses) — 17 tests, 4 transcript fixtures
- [x] **6.14** Audit integration tests: RCNJ scenarios (test score prerequisites, pervasive grade constraints, gen-ed keystones + distribution, CS minor) — 14 tests, 4 transcript fixtures

## Phase 7: Audit Warnings — Completed in Phase 6

- [x] **7.1** Warning infrastructure + `unrecognized-grade`, `course-not-in-catalog` warnings + tests
- [x] **7.2** `ambiguous-credit-match`, `post-constraint-failed` warnings + tests
- [x] **7.3** `cross-listed-match` warning (informational) + tests

**Do not proceed to Phase 8 without asking for verification.  This is a checkpoint**.

## Phase 8: Multi-Tree Auditing

- [x] **8.1** `auditMulti()` skeleton + `CourseAssignmentMap` + global course assignment tracking across trees — 10 tests
- [x] **8.2** Overlap rule enforcement (at-most N courses/credits between two trees) + `overlap-limit-exceeded` warning — 4 tests
- [x] **8.3** `outside-program` evaluation (complement constraint — count credits outside a referenced program) — 2 tests
- [x] **8.4** Program context reference resolution (`primary-major` role → program code) — 3 tests
- [x] **8.5** Multi-tree integration tests: W&M (CS major + COLL gen-ed + graduation requirements with overlap tracking, outside-program, program-context-ref) — 6 tests

**Source files:** `src/audit/multi-tree.js` (new), `src/audit/index.js` (updated exports)
**Test files:** `test/audit/multi-tree.test.js` (19 tests), `test/audit/integration/william-mary-multi.test.js` (6 tests)

**Design decisions:**
- Greedy sequential strategy: audit each tree independently, track assignments, evaluate policy nodes in pass 2
- `CourseAssignmentMap` as first-class data structure for course→program tracking
- Policy nodes (overlap-limit, outside-program, program-context-ref) return NOT_MET in single-tree mode; multi-tree pass 2 walks ASTs separately to evaluate them
- Avoids circular dependency: `multi-tree.js` uses `auditNode` directly instead of importing `audit()` from `index.js`

**Do not proceed to Phase 9 without asking for verification.  This is a checkpoint**.

## Phase 9: AST Utilities

- [x] **9.0** `forEachChild()` — generic AST child visitor centralizing child-property knowledge for all 20 NODE_TYPES + exhaustiveness guard + tests (29 tests)
- [x] **9.1** `walk()` — depth-first pre-order traversal with node, path, parent callback + tests
- [x] **9.2** `transform()` — immutable post-order AST transformation + tests
- [x] **9.0b** Internal consolidation — refactored `validate.js`, `resolve/index.js`, `audit/index.js`, `single-tree.js`, `multi-tree.js` to use `forEachChild` (eliminated 8 independent child-property traversal implementations)
- [x] **9.3** `extractCourses()` — all explicit course references (deduplicated) + tests
- [x] **9.4** `extractAllReferences()` — explicit + filter-resolved references (requires catalog) + tests
- [x] **9.5** `diff()` — structural comparison of two ASTs using LCS, returns list of changes (added/removed/changed/moved) + tests

## Phase 10: Audit Utility Functions

- [x] **10.1** `findUnmet()` — extract unmet leaf requirements from audit result + tests — *completed in Phase 6*
- [x] **10.2** `findNextEligible()` — courses whose prerequisites are met but course not yet taken + tests
- [x] **10.3** `prepareAudit()` — batch optimization, pre-resolve catalog + tests — *completed in Phase 6 (replaced `recomputeStatus()` which is deferred)*

## Phase 11: Export

- [x] **11.0** Export infrastructure — CSV (RFC 4180) + XLSX (`exceljs`) serializers, `formatResult()` dispatcher + tests
- [x] **11.1** `exportPrereqMatrix()` — prerequisite cross-reference table as XLSX and CSV + tests
- [x] **11.2** `exportProgramChecklist()` — program requirements as XLSX and CSV + tests
- [x] **11.3** `exportAudit()` — audit result as XLSX and CSV + tests
- [x] **11.4** `exportDependencyMatrix()` — course dependency matrix as XLSX and CSV + tests
- [x] **11.5** `toHTML()` with audit result overlay (status classes, checkmarks, grade display) + tests

## Phase 12: Public API, Documentation & Packaging

See [22-sdk-api-design.md](../reqit-specs/design/22-sdk-api-design.md) for the full class-based API design. The public surface is a thin facade over the functional modules built in Phases 1–11.

- [x] **12.1** `src/index.js` — Implement `Requirement`, `Catalog`, `Transcript`, `ResolutionResult`, `AuditResult`, `MultiAuditResult`, `AuditException` classes as thin wrappers delegating to internal modules. Entity factories: `reqit.parse()`, `reqit.fromAST()`, `reqit.catalog()`, `reqit.transcript()`, `reqit.waiver()`, `reqit.substitution()`. Module-level functions: `reqit.auditMulti()`, `reqit.exportPrereqMatrix()`, `reqit.exportDependencyMatrix()`, grade utilities.
- [x] **12.2** Public API integration tests — exercise the full public surface through the class-based API. Every entity factory, every instance method, every module-level function. Tests use `require('reqit')` (not internal module imports). Cover: Requirement construction (parse, fromAST), immutability (frozen AST, transform returns new instance), rendering methods (toText, toDescription, toOutline, toHTML), resolve returns ResolutionResult (not a new Requirement), audit returns AuditResult with methods, Catalog/Transcript accept plain objects, AuditException waivers/substitutions, fluent chaining.
- [x] **12.3** Developer documentation in "sdk-guide" folder (markdown) for integration data types — Catalog, Transcript, GradeConfig, AuditResult. These are the integration boundary — consuming applications build these structures to feed into reqit. Documentation must cover every field, its type, whether it's required/optional, and semantic meaning. Key points to document:
  - **Catalog:** `institution` (slug, opaque to reqit), `ay` (academic year string, e.g. "2025-2026"), courses, programs, attainments, gradeConfig
  - **Course:** `id`, `subject`, `number`, `title`, `creditsMin`, `creditsMax`, `attributes` (array of attribute code strings — these are unique identifiers referencing the institution's attribute definitions; at the SDK level reqit matches them as opaque strings; reqit-pg provides the `attribute` table with names/descriptions), `crossListGroup`
  - **Transcript:** array of transcript entries — external input, never stored by reqit. Grade resolution happens at audit time using catalog.gradeConfig, not at transcript instantiation.
  - **GradeConfig:** scale, passFail, withdrawal, incomplete — configurable per institution per AY
  - **AuditResult:** status, items, summary, warnings — output of `audit()` and `auditMulti()`
  - **ResolutionResult:** filters, courses — output of `req.resolve(catalog)`, informational only
  - **AuditException:** waivers and substitutions with required reason field
- [x] **12.4** CSS class reference for `toHTML()` — comprehensive documentation of every `reqit-` CSS class emitted by the HTML renderer. Developers using the SDK will customize these styles for their own UIs, so the docs must cover: every class name and which node type / structural role produces it, the HTML structure (nesting of `div`/`span`/`ul`/`li`/`p` elements), which classes appear on leaf vs composite vs wrapper nodes, semantic meaning of each class (e.g. `reqit-post-constraint`, `reqit-concurrent`), and a starter stylesheet example. This is an integration boundary — the CSS class names and DOM structure are the SDK's visual contract with consuming applications.
- [x] **12.5** Complete and easy to understand tutorial, covering all aspects of the sdk - explaining how to build catalogs, transcripts, perform audits, tips for displaying resolve and audit results, how to customize.  Use reqit-demo tasks as a good guide - but the tutorial needs to be tailored to developers integrating within a web app too (primarily actually).  Use real-world examples from case studies, don't solely focus on RCNJ, examples from several (do not name them specifically).  This tutorial is the most important part of the documentation - it needs to bring a mid-level developer with knowledge about being a registrar from 0 to productive in the SDK, and allow clear paths towards integrating into existing and greenfield applications.
- [ ] **12.6** Final coverage audit — verify 95% line, 90% branch, 100% parser rule coverage; add any missing edge case tests
- [ ] **12.7** Package metadata (`package.json` fields: main, exports, files, engines, keywords, license), README.md with usage examples

## Post-Phase 12: Developer Feedback Fixes

Addressed 9 issues discovered while building `reqit-demo` (interactive CLI exercising the Phase 12 class-based API with 3 RCNJ programs). All fixes implemented in a single commit.

**Commit:** `1a802f7` — Address 9 developer feedback issues from reqit-demo

### Parser Improvements

- [x] **DF.1** Bare variable programs — `TopLevel` rule accepts `VariableDef+ Expression` without `scope` keyword. Produces `{ type: 'scope', name: null, defs, body }`. Enables `$a = MATH 151\n$b = CMPS 130\nall of ($a, $b)` without scope boilerplate.
- [x] **DF.2** Letter-first course numbers — `Number` rule extended with second alternative for identifiers like `TS1`, `A101` (requires at least one digit via semantic predicate, so `all` won't collide with keywords).

### AST Utilities

- [x] **DF.3** `Requirement.expand()` — inlines all variable references, producing a flat AST with no scope/variable nodes. Composable with all renderers: `req.expand().toOutline(catalog)` shows course titles instead of `$name`. New module: `src/ast/expand.js`.

### Audit Improvements

- [x] **DF.4** `findUnmet()` semantic fix — now skips `MET` and `IN_PROGRESS` composites. Previously descended into all composites regardless of status, causing unchosen alternatives inside satisfied `any-of` nodes to appear as "unmet."
- [x] **DF.5** `AuditResult.walk(callback)` — depth-first traversal of the audit result tree using `forEachChild`. Calls `callback(node, path)` for each node. New module: `src/audit/walk-result.js`.
- [x] **DF.6** Summary scope unwrap — `AuditResult.summary` getter now unwraps `scope` and `variable-ref/resolved` nodes before counting children, giving meaningful group-level counts instead of `{ total: 1 }` for scoped programs.

### Entity Convenience

- [x] **DF.7** `Catalog.findCourse(subject, number)` and `Catalog.findProgram(code)` — memoized `Map` indexes for O(1) lookup, replacing verbose `cat.courses.find(...)`.
- [x] **DF.8** `calculateGPA()` entity wrapping — accepts `Transcript` and `Catalog` entities in addition to plain arrays/objects. Unwraps internally.
- [x] **DF.9** `isValidGrade(grade, gradeConfig)` — checks scale + passFail + withdrawal + incomplete. Case-insensitive. Exported from `src/grade/index.js` and `src/index.js`.

**Test count after DF fixes:** 2134 tests, 97.28% statement coverage, 90.32% branch coverage.

## Phase 13: Audit Exceptions — Waivers & Substitutions (Spec 23)

First-class exception support in the audit engine. Waivers exempt requirement nodes from evaluation; substitutions map one course to another via virtual transcript entries. Both new statuses (`waived`, `substituted`) propagate as met-equivalent through composite nodes.

**Commit:** `847d90c` — Add audit exceptions: waivers and substitutions (Spec 23)

### Exception Entities

- [x] **13.1** `Waiver` and `Substitution` classes with immutable frozen data, `toJSON()` serialization, `kind` discriminator
- [x] **13.2** `waiver()` and `substitution()` factory functions with validation (required reason, exactly one target key for waivers, subject+number for substitutions)
- [x] **13.3** `buildExceptionContext()` — indexes exceptions by type for O(1) lookup during audit (course/score/attainment/quantity/label Maps for waivers, courseKey Map for substitutions)

### Status Values

- [x] **13.4** `WAIVED` and `SUBSTITUTED` constants in `status.js`; `countStatuses()` treats both as met-equivalent; `buildSummary()` reports waived/substituted counts separately
- [x] **13.5** `findUnmet()` skips WAIVED and SUBSTITUTED nodes
- [x] **13.6** `AuditStatus` enum updated with WAIVED and SUBSTITUTED values

### Audit-Time Waiver Processing

- [x] **13.7** Waiver interception at top of `auditNode()` — checks label-based group waivers (short-circuits entire subtree) and leaf-node waivers (course, score, attainment, quantity) before normal dispatch
- [x] **13.8** `buildWaivedResult()` — constructs waived result node with catalog credits lookup (`waivedCredits`) for credit counting
- [x] **13.9** `buildGroupWaivedResult()` — constructs waived result for labeled composites; `resolveWaivedCredits()` walks AST subtree to sum catalog credits
- [x] **13.10** Constraint interaction — waived course inside `with-constraint` bypasses grade/GPA checks (status propagates as WAIVED)
- [x] **13.11** `credits-from` with waivers — `collectWaivedCredits()` sums `waivedCredits` from waived nodes in source subtree, added to earned credits

### Audit-Time Substitution Processing

- [x] **13.12** `applySubstitutions()` — creates virtual transcript entries for each substitution where the replacement course exists on the transcript; does not override existing direct matches
- [x] **13.13** `auditCourse()` detects virtual entries (via `_substitution` marker) and returns `status: 'substituted'` with substitution metadata
- [x] **13.14** Evaluation order: waiver > direct transcript match > substitution (virtual entry)
- [x] **13.15** Constraint interaction — replacement course's grade used for min-grade/min-gpa evaluation

### Multi-Tree Integration

- [x] **13.16** `auditMulti()` builds shared exception context once, applies substitutions to shared normalized transcript, passes waivers/substitutions to each tree's audit context

### Public API

- [x] **13.17** `AuditResult.exceptions` getter — `{ applied, unused }` when exceptions provided, `null` otherwise
- [x] **13.18** Unused exception warnings — `unused-exception` type with descriptive message
- [x] **13.19** `reqit.waiver()`, `reqit.substitution()` factory exports; `Waiver`, `Substitution` class exports for `instanceof` checks

### Testing

- [x] **13.20** `test/audit/exceptions.test.js` — 62 unit tests covering entity classes, factory validation, context builder, leaf/group waiver matching, virtual transcript entries, status integration
- [x] **13.21** `test/audit/waiver-audit.test.js` — 24 integration tests covering course/score/attainment/quantity waivers, labeled group waivers, constraint interaction, credits-from, unused exception warnings, backward compatibility
- [x] **13.22** `test/audit/substitution-audit.test.js` — 12 integration tests covering basic substitution, evaluation order, composite propagation, constraint interaction, credits-from, in-progress substitution
- [x] **13.23** `test/api/public-api.test.js` — 14 new tests for exception factory exports, structural guards, audit integration via public API, multi-tree exceptions

**Source files:** `src/audit/exceptions.js` (new), `src/audit/status.js`, `src/audit/single-tree.js`, `src/audit/index.js`, `src/audit/multi-tree.js`, `src/audit/find-unmet.js`, `src/entities.js`, `src/index.js`
**Test files:** 3 new test files + updated `status.test.js` and `public-api.test.js`
**Test count after Phase 13:** 2245 tests, 97.34% statement coverage, 90.43% branch coverage.

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
| 13 | 1 | Audit exceptions (waivers & substitutions) |
| **Total** | **99** | |

## Test Fixture Strategy

Every parser and renderer test uses real requirement text derived from the 4 case studies:

| Case Study | Exercises | Used In |
|------------|-----------|---------|
| **Lehigh** | all-of, any-of, credits-from, variables, deep prereq chains, course filters | Parser, resolution, audit (6 progression scenarios) |
| **Moravian** | n-of, grade constraints, attainments (standing), unit-based, multi-program | Parser, audit (grade scenarios) |
| **William & Mary** | except, GPA constraints, attribute filters, tracks, gen-ed distribution, negative filters, proficiency attainments | Parser, resolution, audit, multi-tree |
| **RCNJ** | score prerequisites, pervasive grade constraints, institution-wide scale, gen-ed keystones + distribution, concurrent | Parser, resolution, audit (test score scenarios) |

Constructs not exercised by case studies (`none of`, `one from each of`, `from N groups`, `quantity`) get dedicated synthetic test fixtures to ensure 100% language coverage.
