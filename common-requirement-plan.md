# Common Requirement Plan: Shared Requirements Across Programs

## The Problem

The reqit-demo contains 6 programs. Three B.S. majors (CS, Cybersecurity, Data Science) each define an identical `$gen_ed` variable — 15 lines of DSL text copied verbatim. Similarly, all three define `$career_pathways = attainment CAREER_PATHWAYS`. At RCNJ scale (60+ programs), the case study identifies 12+ variables shared across multiple programs, including gen-ed (all undergrads), ASB Core (6 business majors), HGS Language (all HGS majors), and school-specific career pathways.

This duplication is the core problem. Variables exist to *name* reusable groups, but the current SDK has no mechanism to *share* them across separate requirement trees. Each program defines its own copy.

---

## What the Spec Designed

The reqit-specs (02-language.md, 04-schema.md, concerns.md §3) designed a two-level scoping system:

### 1. Program-scoped variables
Defined inside `scope "cmps-major" { ... }`. Visible only to that program. Stored in the database with `scope_program = <program_id>`.

### 2. Institution-scoped variables (shared)
Defined inside `scope "rcnj" { ... }` (the institution scope). Visible to all programs. Stored with `scope_program = NULL`.

### Resolution order
When `$core` is referenced:
1. Look in the current program's scope
2. Look in the institution scope
3. Error if not found

Cross-scope references use dot-qualified names: `$cmps-major.core` or `$rcnj.asb_core`. These are rare — most sharing uses institution-level variables.

### Database schema (from 04-schema.md)
```sql
CREATE TABLE requirement_variable (
    id              SERIAL PRIMARY KEY,
    institution     INTEGER NOT NULL,
    ay              TEXT NOT NULL,
    name            TEXT NOT NULL,
    scope_program   INTEGER REFERENCES program(id),  -- NULL = institution-wide
    ast             JSONB NOT NULL,
    stem            INTEGER NOT NULL,
    UNIQUE NULLS NOT DISTINCT (institution, ay, name, scope_program)
);
```

---

## What the Language Guide Documents

The language-guide (a separate directory in reqit-sdk) dedicates two chapters to this:

- **12-variables.md** — Covers variable definition, referencing, readability benefits, and reuse within a single requirement tree. Includes a gen-ed example (`$gen_ed = one from each of (...)`) but only within a single program — no cross-program sharing.

- **13-scopes.md** — Covers scope blocks, cross-scope references (`$rcnj.asb_core`), institution scope, and variable resolution order. Documents the full sharing design (institution scope → program scope → error). Includes a complete example of ASB Core shared across Accounting and Marketing majors.

**Key observation:** The language-guide documents the scoping/sharing mechanism as a *language feature*, but the SDK does not implement cross-tree variable resolution. The language-guide describes a capability that only works within a single parsed document. Two separate documents cannot share variables — there's no runtime mechanism to inject institution-scope variables into a program tree at audit time.

---

## What the SDK Currently Implements

### Grammar: Fully supports scope blocks and cross-scope references

The PEG grammar handles:
- `scope "name" { defs* body }` — parses to `{ type: 'scope', name, defs, body }`
- `$name = expression` — parses to `{ type: 'variable-def', name, value, scope? }`
- `$name` — parses to `{ type: 'variable-ref', name }`
- `$scope.name` — parses to `{ type: 'variable-ref', name, scope }`

Bare variable programs (no explicit scope block) get wrapped in an implicit scope with `name: null`.

### Single-tree audit: Variables work within a tree

`collectDefs()` builds a `Map<string, variable-def>` from the AST. Variable references are resolved lazily during audit. Scoped defs register under both `"scope.name"` and `"name"` keys. Circular references are detected via `ctx.expanding`.

### Multi-tree audit: No cross-tree variable sharing

This is the gap. In `multi-tree.js:188-189`:
```javascript
for (const tree of trees) {
    const defs = collectDefs(tree.ast, '', new Map());  // Fresh defs per tree
    ...
}
```

Each tree gets an isolated variable namespace. A `$gen_ed` defined in the CS major tree is invisible to the Cybersecurity major tree. There is no mechanism to inject institution-wide variables into each tree's `defs` map.

### ProgramType: `cluster` exists but has no special behavior

`ProgramType.CLUSTER = 'cluster'` is defined in the enum and recognized by the grammar. But clusters get no special treatment in catalog storage, auditing, or multi-tree policies. They're just another program type string.

---

## Analysis: Why Scoped Variables May Be Over-Designed

The user's instinct is worth examining. Let's look at what the scoping system is actually solving vs. what sharing requires.

### What scoping solves
Name collision. If the CS major defines `$core` and the Accounting major also defines `$core`, scope blocks prevent them from conflicting. The spec addresses this in concerns.md §3.

### Why scoping may be unnecessary in practice
1. **Each program's requirements are already a separate document.** In the demo, `bs-cmps.reqit` and `bs-cyber.reqit` are separate files, parsed independently. Variables in one file can't collide with another because they're parsed in isolation.

2. **The database already separates programs.** Each program has its own `program_requirements.requirement_text` row. Variables defined there are inherently program-scoped by storage.

3. **Cross-scope references are "rare in practice"** — the spec itself says so (02-language.md line 273). The dot-qualified syntax exists for an edge case.

4. **The UI builder hides scoping entirely.** If users never see scope blocks, the feature exists only for the code editor, and only matters when a power user is editing raw DSL text for a program that happens to share variable names with another program being edited simultaneously.

### What scoping does NOT solve
The actual problem — sharing. Scope blocks and scope resolution are about *isolation*, not *reuse*. The sharing mechanism is separate: institution-wide variables stored with `scope_program = NULL`, available to all programs via the resolution order.

**The sharing mechanism doesn't require scope blocks at all.** It requires:
1. A way to define a variable once (in the database or as a separate document)
2. A way for the audit engine to inject that variable into every tree's namespace

---

## The Real Requirement: How Shared Requirements Should Work

### Three tiers of requirement sharing

| Tier | Example | Scope | Who shares |
|------|---------|-------|------------|
| **Institution-wide** | General education | All undergrads (or all students) | 40+ programs |
| **School/college** | ASB Core, HGS Language | All programs in a school | 6-10 programs |
| **Degree-type** | B.S. lab requirement | All programs leading to that degree | Varies |

### Two implementation approaches

#### Approach A: Shared variables (the spec's design)

Gen-ed is defined as an institution-wide variable. Each program references `$gen_ed` in its requirement tree. At audit time, the engine resolves `$gen_ed` from a shared variable pool injected into every tree.

**What this requires in the SDK:**
- A way to pass shared variable definitions to the audit engine (single-tree and multi-tree)
- `collectDefs()` or an outer layer merges shared defs into the per-tree defs map
- Variable resolution checks local defs first, then shared defs (already spec'd)

**What this requires in the database layer:**
- `requirement_variable` table (already designed in 04-schema.md)
- Load institution-wide variables separately from program requirements
- Pass them to the SDK at audit time

**DSL in the program file:**
```
# No $gen_ed definition — it's loaded from institution scope
$cs_core = "CS Core": all of (...) with gpa >= 2.0
$math = "Math": all of (...)
$cs_electives = "CS Electives": at least 7 of (...)

"Degree Requirements": all of (
  $gen_ed,        # Resolved from institution scope
  $cs_core,
  $math,
  $cs_electives
) with gpa >= 2.0
```

#### Approach B: Clusters / standalone requirement trees (composable programs)

Gen-ed is a standalone program with type `cluster` (or a new type). It has its own requirement tree. The multi-tree audit handles it alongside the major. Programs that require gen-ed simply include a `program "GEN-ED" cluster undergraduate` reference.

**What this requires in the SDK:**
- `program-ref` audit already works — when a requirement contains `program "GEN-ED"`, the engine looks up that program's requirements and audits them
- `auditMulti` already audits multiple trees with shared course assignment
- Overlap rules handle course sharing between gen-ed and the major

**What this requires in the database layer:**
- Store gen-ed as a program with `type = 'cluster'` and its own requirements
- When building `auditMulti` tree set, include gen-ed alongside the major
- No new SDK features needed

**DSL in the program file:**
```
# Gen-ed is a separate tree, not a variable
$cs_core = "CS Core": all of (...) with gpa >= 2.0
$math = "Math": all of (...)
$cs_electives = "CS Electives": at least 7 of (...)

"Degree Requirements": all of (
  $cs_core,
  $math,
  $cs_electives
) with gpa >= 2.0
```

**In the audit call:**
```javascript
reqit.auditMulti(catalog, transcript, {
  trees: {
    'CMPS': csMajorReq,
    'GEN-ED': genEdReq,    // Loaded from cluster program
    'MATH-MINOR': mathMinorReq,
  },
});
```

---

## Comparison of Approaches

| Dimension | A: Shared Variables | B: Standalone Clusters |
|-----------|--------------------|-----------------------|
| **SDK changes needed** | Add shared-defs injection to audit engine | None — already works |
| **Gen-ed shows up as** | Part of each program's tree (embedded) | Separate tree in multi-audit |
| **Audit result structure** | Single tree with gen-ed subtree inline | Separate gen-ed result alongside major result |
| **Overlap handling** | Implicit (same tree) | Explicit via overlap rules |
| **Database complexity** | `requirement_variable` table + loading | Gen-ed is just another program row |
| **Matches how registrars think** | "Every major includes gen-ed" | "Students must complete gen-ed AND their major" |
| **School-level sharing** | `$asb_core` as institution variable | ASB Core as a cluster/concentration |
| **Scoping needed** | Yes, for resolution order | No |
| **Demo duplication fix** | Move `$gen_ed` to shared pool | Move `$gen_ed` to its own program |

---

## Recommendation

**Use both approaches, but clarify when each applies.**

### Clusters for independent, auditable requirement groups

Gen-ed, ASB Core, HGS Language requirement — these are **structurally independent** requirement groups that:
- Are audited as their own unit (gen-ed completion is meaningful on its own)
- Participate in course-sharing with the major (overlap rules apply)
- Appear on degree audits as a separate section
- Multiple programs include them wholesale

These should be **cluster programs** audited via `auditMulti`. This requires zero SDK changes.

### Shared variables for reusable building blocks within trees

Career pathways attainments, a list of approved elective courses, a common prerequisite chain — these are **sub-expressions** that:
- Are not audited independently
- Are embedded inline within a larger requirement tree
- Reduce duplication of DSL text but aren't structurally separate
- Are naturally expressed as `$var = ...` and referenced by name

These benefit from shared variables. This requires modest SDK changes.

### Scope blocks: simplify to match actual need

Scope blocks as designed are more complex than necessary:
- **Drop the scope block syntax from the near-term SDK.** Each program's requirements are already isolated by storage. Name collisions don't happen when each program is a separate document/row.
- **Keep the variable-def/variable-ref AST nodes.** Variables within a single program's requirements are essential.
- **Add a `sharedDefs` option to the audit API** for institution-wide variables that need injection.
- **Revisit scope blocks** if/when the UI builder needs them for the code editor, or when a genuine cross-scope reference need arises.

---

## Concrete Plan

### Phase 1: Clusters for gen-ed and school cores (no SDK changes)

**In reqit-demo:**
1. Create `gen-ed.reqit` as a standalone program with `type: 'cluster'`, `level: 'undergraduate'`
2. Remove `$gen_ed` from bs-cmps.reqit, bs-cyber.reqit, bs-data.reqit
3. Demo the multi-tree audit pattern: major + gen-ed cluster
4. Similarly, extract `$career_pathways` if it deserves independent auditing

**In reqit-pg (canonical database):**
1. Store gen-ed as a program row with `type = 'cluster'`
2. Store its requirements in `program_requirements`
3. When building a student's audit, include all applicable clusters in `auditMulti`

**In SDK documentation:**
1. Add a section to the tutorial showing the cluster + multi-tree pattern
2. Update the database guide to show how clusters are loaded and audited
3. Document when to use clusters vs. inline variables

### Phase 2: Shared variables for sub-expressions (SDK change)

**In reqit-sdk:**
1. Add `sharedDefs` option to `Requirement.audit()` and `auditMulti()`:
   ```javascript
   const result = req.audit(catalog, transcript, {
     sharedDefs: {
       'approved_electives': approvedElectivesAST,
       'career_pathways': careerPathwaysAST,
     },
   });
   ```
2. In the audit engine, merge `sharedDefs` into the per-tree `defs` map with lower priority than local defs
3. Add tests for shared defs resolution, local-over-shared precedence, and undefined reference errors

**In reqit-pg:**
1. Use `requirement_variable` table (already designed) with `scope_program = NULL` for institution-wide variables
2. Load institution-wide variables at startup or per-request
3. Pass them as `sharedDefs` to the audit engine

### Phase 3: Scope blocks (deferred)

Scope blocks in the DSL remain supported by the grammar (they already parse). No changes needed. But the database layer and SDK documentation should not emphasize them until:
- The UI builder code editor needs them
- A real cross-scope reference use case emerges
- An institution with 100+ programs demonstrates a naming collision problem

---

## Status of Each Component

| Component | Status | Notes |
|-----------|--------|-------|
| Grammar: `scope` blocks | Implemented | Parses correctly, produces AST |
| Grammar: `variable-def`/`variable-ref` | Implemented | Full support including cross-scope dot syntax |
| Grammar: `cluster` program type | Implemented | Recognized in ProgramType grammar rule |
| SDK: ProgramType.CLUSTER enum | Implemented | In entities.js |
| SDK: single-tree variable resolution | Implemented | `collectDefs()` + lazy resolution |
| SDK: multi-tree audit | Implemented | But no cross-tree variable sharing |
| SDK: `sharedDefs` option | **Not implemented** | Needed for Phase 2 |
| SDK: cluster special behavior | **Not needed** | Clusters work as regular programs |
| Database: `requirement_variable` table | **Designed only** | In 04-schema.md, not yet in reqit-pg |
| Database: `program.scope_name` column | **Designed only** | In 04-schema.md |
| Demo: cluster usage | **Not demonstrated** | All programs duplicate shared requirements |
| Language guide: variables (ch. 12) | Documented | Covers definition, reference, reuse within a tree |
| Language guide: scopes (ch. 13) | Documented | Covers scope blocks, institution scope, cross-scope refs |
| Language guide: cross-tree sharing | **Not accurate** | Documents institution scope as if it works across programs, but SDK has no runtime injection mechanism |
| Docs: cluster + multi-tree pattern | **Not documented** | Tutorial shows multi-tree but not the cluster sharing pattern |
| Docs: shared variables | **Not documented** | Tutorial shows variables within a single tree only |

---

## Open Questions

1. **Should gen-ed be a cluster or a degree-level requirement?** The RCNJ case study notes gen-ed is tied to the degree (B.S., B.A.), not the major. A B.S. in CS and a B.S. in Biology share the same gen-ed. If gen-ed varies by degree type, it's cleaner to attach it to the degree entity and audit it as a degree-level tree rather than a cluster. The SDK already supports this — it's a question of data modeling in reqit-pg.

2. **What about school-level shared requirements (ASB Core)?** These fit naturally as either clusters or shared variables. If ASB Core should appear as a labeled section in the audit output ("ASB Core: 12/12 met"), it should be a cluster or concentration. If it should be inlined into the major's tree without a separate section, it should be a shared variable.

3. **Should `auditMulti` auto-include applicable clusters?** Rather than requiring callers to manually build the tree set, the engine could auto-discover clusters based on the student's declared programs and degree. This is a convenience feature for reqit-pg/reqit-catalog, not an SDK concern.
