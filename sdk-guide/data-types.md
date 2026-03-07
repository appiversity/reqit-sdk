# Data Types Reference

This document covers every data structure you pass into or receive from the reqit SDK. These are your integration boundaries — get these right and everything else falls into place.

## Catalog

The catalog describes everything an institution offers in a given academic year. You build this from your SIS data and pass it to the SDK.

```javascript
const cat = reqit.catalog({
  institution: 'STATE-U',         // string — your institution's identifier (opaque to reqit)
  ay: '2025-2026',                // string — academic year (required)
  courses: [ ... ],               // array of Course objects (required, see below)
  programs: [ ... ],              // array of Program objects (optional)
  attributes: [ ... ],            // array of Attribute objects (optional)
  degrees: [ ... ],               // array of Degree objects (optional)
  gradeConfig: { ... },           // GradeConfig object (optional, defaults to US letter grades)
});
```

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `institution` | `string` | No | Your institution's slug or identifier. The SDK never interprets this — it's for your use. |
| `ay` | `string` | **Yes** | Academic year string, e.g. `'2025-2026'`. Used as a label; no date parsing. |
| `courses` | `Course[]` | **Yes** | All courses offered. Even a one-course catalog is valid. |
| `programs` | `Program[]` | No | Degree programs (majors, minors, certificates). |
| `attributes` | `Attribute[]` | No | General education or tagging attributes (e.g. "Writing Intensive"). |
| `degrees` | `Degree[]` | No | Credential types (B.S., B.A., M.A., etc.). |
| `gradeConfig` | `GradeConfig` | No | Grade scale, pass/fail, withdrawal, and incomplete definitions. Defaults to the standard US letter grade scale (A+ through F). |

### Catalog Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `findCourse(subject, number)` | `Course \| undefined` | O(1) lookup by subject and number. |
| `findCourses({ subject?, attribute? })` | `Course[]` | Filter courses by subject code or attribute. |
| `getSubjects()` | `string[]` | All unique subject codes, sorted. |
| `findProgram(code)` | `Program \| undefined` | O(1) lookup by program code. |
| `findPrograms({ type?, level?, code? })` | `Program[]` | Filter programs. |
| `findAttribute(code)` | `Attribute \| null` | Lookup an attribute by code. |
| `getAttributes()` | `Attribute[]` | All attributes, sorted by code. |
| `findDegree(code)` | `Degree \| undefined` | Lookup a degree by code. |
| `findDegrees({ type?, level? })` | `Degree[]` | Filter degrees. |
| `getCrossListEquivalents(subject, number)` | `Course[]` | Other courses in the same cross-list group. |
| `prereqGraph()` | `PrereqGraph` | Prerequisite graph with forward/reverse lookups (lazily built). |
| `findProgramsRequiring(subject, number)` | `Array<{ code, context }>` | Programs that reference this course. `context` is `'required'` or `'elective'`. |
| `courseImpact(subject, number)` | `{ dependentCourses, programs }` | Impact analysis for retiring a course. |
| `withPrograms(programMap)` | `Catalog` | Returns a new Catalog with requirement ASTs attached to programs. |

---

## Course

A plain object inside `catalog.courses`. The SDK reads these fields but never modifies them.

```javascript
{
  id: 1,                           // any — application-defined, passed through unchanged
  subject: 'CMPS',                 // string — 2-6 uppercase letters/digits
  number: '310',                   // string — starts with a digit, e.g. '101', '220.2', '101A'
  title: 'Algorithms',             // string — human-readable title
  creditsMin: 3,                   // number — minimum credits
  creditsMax: 3,                   // number — maximum credits (same as min for fixed-credit)
  attributes: ['WI', 'QR'],       // string[] — attribute codes (optional, defaults to [])
  crossListGroup: 'CMPS-MATH-310', // string — shared ID linking cross-listed courses (optional)
  prerequisites: { ... },          // AST — parsed prerequisite tree (optional, null = none)
  corequisites: { ... },           // AST — parsed corequisite tree (optional, null = none)
}
```

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `id` | `any` | No | Your database ID. The SDK passes it through but never uses it. |
| `subject` | `string` | **Yes** | Department code — uppercase, 2-6 characters. |
| `number` | `string` | **Yes** | Course number — starts with a digit. Supports suffixes like `101A`, `220.2`. |
| `title` | `string` | No | Human-readable course title. Shown by renderers when available. |
| `creditsMin` | `number` | No | Minimum credits. Used for credit counting in audits. |
| `creditsMax` | `number` | No | Maximum credits. Used for filter matching (`credits >= N` uses creditsMax). |
| `attributes` | `string[]` | No | Attribute codes this course carries. Matched as opaque strings. Defaults to `[]`. |
| `crossListGroup` | `string` | No | Identifier shared by cross-listed courses. When a student takes any course in the group, it satisfies requirements for all courses in the group. |
| `prerequisites` | `object\|null` | No | Prerequisite AST (output of `reqit.parse()`). Used by `prerequisite includes` filters and the prereq graph. |
| `corequisites` | `object\|null` | No | Corequisite AST. Used by `corequisite includes` filters. |

---

## Program

A plain object inside `catalog.programs`.

```javascript
{
  id: 1,
  code: 'CMPS',                    // string — unique identifier
  name: 'Computer Science',        // string — display name
  type: 'major',                   // string — major, minor, certificate, concentration, track, cluster
  level: 'undergraduate',          // string — undergraduate, graduate, doctoral, etc.
  requirements: { ... },           // AST — parsed requirement tree (optional, attached via withPrograms)
}
```

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `id` | `any` | No | Application-defined ID. |
| `code` | `string` | **Yes** | Unique program identifier (e.g. `'CMPS'`, `'MATH-MINOR'`). |
| `name` | `string` | No | Human-readable name. |
| `type` | `string` | **Yes** | One of: `major`, `minor`, `certificate`, `concentration`, `track`, `cluster`. |
| `level` | `string` | **Yes** | One of: `undergraduate`, `graduate`, `doctoral`, `professional`, `post-graduate`, `post-doctoral`. |
| `requirements` | `object` | No | Requirement AST. Usually attached later via `catalog.withPrograms()`. |

---

## Attribute

A plain object inside `catalog.attributes`.

```javascript
{
  code: 'WI',                       // string — unique code used in course.attributes
  name: 'Writing Intensive',        // string — display name
}
```

When a requirement says `courses where attribute = "WI"`, the SDK matches against `course.attributes` arrays. The `name` field is used by renderers to show human-readable labels.

---

## Degree

Created via `reqit.degree()`. Represents a credential like B.S. or M.A.

```javascript
const deg = reqit.degree({
  id: 'deg-001',                    // string — application-defined (optional)
  code: 'BS',                       // string — unique code (required)
  name: 'Bachelor of Science',      // string — display name (optional)
  type: 'B.S.',                     // string — abbreviated type (required)
  level: 'undergraduate',           // string — level (required)
});
```

| Getter | Returns | Description |
|--------|---------|-------------|
| `deg.id` | `string\|null` | Application-defined ID. |
| `deg.code` | `string` | Degree code. |
| `deg.name` | `string\|null` | Display name. |
| `deg.type` | `string` | Abbreviated type. |
| `deg.level` | `string` | Level. |
| `deg.toJSON()` | `object` | Serializable copy. |

---

## TranscriptCourse

Created automatically when you add courses to a Transcript, or directly via `new reqit.TranscriptCourse(data)`.

```javascript
{
  id: 'tc-001',                     // string — application-defined (optional)
  subject: 'MATH',                  // string — must match catalog subject codes
  number: '151',                    // string — must match catalog course numbers
  grade: 'A',                       // string — raw letter grade (optional)
  credits: 4,                       // number — credits earned (optional, defaults to 0)
  term: 'Fall 2023',                // string — term label (optional, defaults to '')
  status: 'completed',              // string — 'completed' or 'in-progress' (optional, defaults to 'completed')
}
```

| Getter | Returns | Description |
|--------|---------|-------------|
| `tc.id` | `string\|null` | Application-defined ID. |
| `tc.subject` | `string` | Subject code. |
| `tc.number` | `string` | Course number. |
| `tc.grade` | `string\|null` | Raw grade string. |
| `tc.credits` | `number` | Credits earned (0 if not provided). |
| `tc.term` | `string` | Term label (empty string if not provided). |
| `tc.status` | `string` | `'completed'` or `'in-progress'`. |
| `tc.toJSON()` | `object` | Serializable copy. |

---

## Transcript

Created via `reqit.transcript()`. Represents a complete student record. All mutations return a new Transcript (immutable).

```javascript
const tx = reqit.transcript({
  courses: [                        // array of course objects (required)
    { subject: 'MATH', number: '151', grade: 'A', credits: 4, term: 'Fall 2023' },
    { subject: 'CMPS', number: '130', grade: 'B+', credits: 3, term: 'Fall 2023' },
  ],
  attainments: {                    // object — keyed by code (optional)
    'SAT-MATH': 620,
  },
  declaredPrograms: [               // array of program declarations (optional)
    { code: 'CMPS', type: 'major', level: 'undergraduate', role: 'primary' },
  ],
  waivers: [ waiver1, waiver2 ],    // array of Waiver instances (optional)
  substitutions: [ sub1 ],          // array of Substitution instances (optional)
  level: 'undergraduate',           // string (optional)
  duplicatePolicy: 'last',          // string — 'first' or 'last' (optional)
});
```

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `courses` | `object[]` | **Yes** | Array of course records. Each is wrapped in a TranscriptCourse. |
| `attainments` | `object` | No | Key-value pairs: code → value (number or boolean). Matched against `score` and `attainment` nodes. |
| `declaredPrograms` | `object[]` | No | Program declarations with `code`, `type`, `level`, and optional `role`. |
| `waivers` | `Waiver[]` | No | Waiver exception instances (must use `reqit.waiver()` to create). |
| `substitutions` | `Substitution[]` | No | Substitution exception instances (must use `reqit.substitution()` to create). |
| `level` | `string` | No | Student's academic level. |
| `duplicatePolicy` | `string` | No | When a course appears multiple times: `'last'` (default) uses the most recent; `'first'` uses the earliest. |

### Transcript Methods

All mutation methods return a **new** Transcript — the original is never modified.

| Method | Returns | Description |
|--------|---------|-------------|
| `addCourse(data)` | `Transcript` | Add a course to the transcript. |
| `removeCourse(subject, number)` | `Transcript` | Remove a course by subject and number. |
| `addAttainment(code, value)` | `Transcript` | Add or update an attainment. |
| `removeAttainment(code)` | `Transcript` | Remove an attainment by code. |
| `declareProgram(declaration)` | `Transcript` | Add a program declaration. |
| `undeclareProgram(code)` | `Transcript` | Remove a program declaration by code. |
| `addWaiver(waiver)` | `Transcript` | Add a Waiver instance. |
| `removeWaiver(target)` | `Transcript` | Remove by course `{ subject, number }`, by string target name, or by ID string. |
| `addSubstitution(sub)` | `Transcript` | Add a Substitution instance. |
| `removeSubstitution(target)` | `Transcript` | Remove by original course `{ subject, number }` or by ID string. |

---

## Waiver

Created via `reqit.waiver()`. Exempts a specific requirement from audit evaluation.

```javascript
// Waive a specific course
const w = reqit.waiver({
  id: 'w-001',                           // string — application-defined (optional)
  course: { subject: 'CMPS', number: '310' },
  reason: 'Transfer credit from partner institution',
});

// Waive by other target types (exactly one target per waiver)
reqit.waiver({ score: 'SAT-MATH', reason: 'Exempt by policy' });
reqit.waiver({ attainment: 'PRAXIS', reason: 'Already certified' });
reqit.waiver({ quantity: 'CLINICAL_HOURS', reason: 'Prior experience' });
reqit.waiver({ label: 'Math Core', reason: 'Placed out by exam' });
```

| Getter | Returns | Description |
|--------|---------|-------------|
| `w.id` | `string\|null` | Application-defined ID. |
| `w.kind` | `'waiver'` | Always `'waiver'`. |
| `w.target` | `object` | The target: `{ course }`, `{ score }`, `{ attainment }`, `{ quantity }`, or `{ label }`. |
| `w.reason` | `string` | Required reason string. |
| `w.metadata` | `object\|null` | Optional pass-through data. |
| `w.toJSON()` | `object` | Serializable copy (includes `id` when present). |

---

## Substitution

Created via `reqit.substitution()`. Maps one required course to another that the student actually took.

```javascript
const s = reqit.substitution({
  id: 's-001',                            // string — application-defined (optional)
  original: { subject: 'MATH', number: '250' },
  replacement: { subject: 'MATH', number: '241' },
  reason: 'Transfer equivalent approved by department',
});
```

| Getter | Returns | Description |
|--------|---------|-------------|
| `s.id` | `string\|null` | Application-defined ID. |
| `s.kind` | `'substitution'` | Always `'substitution'`. |
| `s.original` | `{ subject, number }` | The required course being substituted. |
| `s.replacement` | `{ subject, number }` | The actual course taken. |
| `s.reason` | `string` | Required reason string. |
| `s.metadata` | `object\|null` | Optional pass-through data. |
| `s.toJSON()` | `object` | Serializable copy (includes `id` when present). |

---

## GradeConfig

Defines how an institution's grading system works. Passed as `catalog.gradeConfig`. If omitted, the SDK uses the standard US letter grade scale.

```javascript
{
  scale: [                          // ordered highest-to-lowest
    { grade: 'A+', points: 4.0 },
    { grade: 'A',  points: 4.0 },
    { grade: 'A-', points: 3.7 },
    { grade: 'B+', points: 3.3 },
    { grade: 'B',  points: 3.0 },
    // ... through F
    { grade: 'F',  points: 0.0 },
  ],
  passFail: [                       // non-GPA grades
    { grade: 'P', passing: true },
    { grade: 'NP', passing: false },
  ],
  withdrawal: ['W', 'WP', 'WF'],   // non-calculated withdrawal grades
  incomplete: ['I', 'IP'],          // non-calculated incomplete grades
}
```

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `scale` | `Array<{ grade, points, audit? }>` | **Yes** | Letter grades ordered highest to lowest. `audit: false` excludes a grade from all evaluation (useful for retake markers). |
| `passFail` | `Array<{ grade, passing, audit? }>` | No | Non-GPA grades. `passing: true` means the grade satisfies requirements. |
| `withdrawal` | `string[]` | No | Withdrawal grade codes. Not calculated, never satisfy requirements. |
| `incomplete` | `string[]` | No | Incomplete grade codes. Not calculated, never satisfy requirements. |

**Grade comparison rules:**
- A grade meets a minimum if it appears at the same position or earlier (higher) in the scale.
- Pass/fail grades never meet a minimum letter grade.
- Withdrawal and incomplete grades never satisfy any requirement.
- Grades with `audit: false` are completely invisible to the audit engine.

---

## Requirement

Created via `reqit.parse()` or `reqit.fromAST()`. Wraps a parsed requirement AST with rendering, auditing, and analysis methods.

```javascript
const req = reqit.parse('all of (MATH 151, CMPS 130)');
```

| Property / Method | Returns | Description |
|-------------------|---------|-------------|
| `req.ast` | `object` | Frozen AST. |
| `req.text` | `string` | Round-trip back to reqit source text. |
| `req.description` | `string` | Human-readable prose description. |
| `req.validate()` | `{ valid, errors }` | Validate the AST structure. |
| `req.toOutline(catalog, options?)` | `string` | Indented tree outline with course titles. |
| `req.toHTML(catalog, options?)` | `string` | Semantic HTML with CSS classes. |
| `req.resolve(catalog)` | `ResolutionResult` | Expand filters against the catalog. |
| `req.audit(catalog, transcript, opts?)` | `AuditResult` | Evaluate against a student's transcript. |
| `req.walk(callback)` | `void` | Depth-first traversal: `callback(node, path, parent)`. |
| `req.transform(callback)` | `Requirement` | Immutable AST transformation. |
| `req.expand()` | `Requirement` | Inline all variable references. |
| `req.extractCourses()` | `Course[]` | All explicit course references. |
| `req.extractAllReferences(catalog)` | `Course[]` | Explicit + filter-resolved references. |
| `req.diff(other)` | `Change[]` | Structural diff against another AST. |
| `req.exportChecklist(catalog, opts?)` | `object` | Program checklist as spreadsheet data. |

---

## ResolutionResult

Returned by `req.resolve(catalog)`. Shows which catalog courses match the requirement's filters.

```javascript
const resolved = req.resolve(catalog);
```

| Property / Method | Returns | Description |
|-------------------|---------|-------------|
| `resolved.courses` | `Course[]` | Explicitly referenced courses found in the catalog. |
| `resolved.filters` | `Array<{ node, matched }>` | Each filter node and the courses it matched. |
| `resolved.warnings` | `Array<{ type, message }>` | Resolver warnings (e.g. unknown attribute codes). |
| `resolved.allCourses()` | `Course[]` | All unique courses (explicit + filter-matched), deduplicated. |
| `resolved.totalUniqueCourses` | `number` | Count of unique courses. |
| `resolved.subjects` | `Set<string>` | Unique subject codes across all results. |
| `resolved.filtersForCourse(subject, number)` | `Array<{ node, index }>` | Which filters matched a specific course. |

---

## AuditResult

Returned by `req.audit(catalog, transcript)`. Contains the audit status, detailed result tree, and utilities.

```javascript
const result = req.audit(catalog, transcript);
```

| Property / Method | Returns | Description |
|-------------------|---------|-------------|
| `result.status` | `string` | Overall status: `'met'`, `'in-progress'`, `'partial-progress'`, `'not-met'`, `'waived'`, `'substituted'`. |
| `result.items` | `object` | The audit result tree — a parallel structure to the requirement AST with status on every node. |
| `result.summary` | `{ met, total, ... }` | Counts of met/not-met/in-progress/waived/substituted children. |
| `result.warnings` | `Array` | Audit warnings (unrecognized grades, ambiguous matches, etc.). |
| `result.exceptions` | `{ applied, unused } \| null` | Which waivers/substitutions were used. `null` if none provided. |
| `result.walk(callback)` | `void` | Depth-first traversal: `callback(node, path, parent, depth)`. |
| `result.findUnmet()` | `Array` | Leaf requirements not yet satisfied. |
| `result.findNextEligible(catalog, transcript)` | `Array` | Courses whose prerequisites are met but not yet taken. |
| `result.toOutline(catalog, options?)` | `string` | Audit-aware text outline with status icons and grades. |
| `result.toHTML(catalog, options?)` | `string` | Audit-aware HTML with status CSS classes. |
| `result.export(catalog, opts?)` | `object` | Audit result as spreadsheet data. |

---

## MultiAuditResult

Returned by `reqit.auditMulti(catalog, transcript, options)`. Audits multiple requirement trees with shared course assignment.

```javascript
const multi = reqit.auditMulti(catalog, transcript, {
  trees: {
    'CMPS': csMajorReq,
    'GEN-ED': genEdReq,
  },
  overlapRules: [ ... ],
});
```

| Property | Returns | Description |
|----------|---------|-------------|
| `multi.trees` | `{ [code]: AuditResult }` | Per-program audit results. |
| `multi.overlapResults` | `Array` | Results of overlap policy evaluation. |
| `multi.courseAssignments` | `object` | Which courses were assigned to which programs. |
| `multi.warnings` | `Array` | Combined warnings from all trees. |

---

## AuditStatus Enum

```javascript
const { AuditStatus } = require('reqit');

AuditStatus.MET              // 'met'
AuditStatus.IN_PROGRESS      // 'in-progress'
AuditStatus.PARTIAL_PROGRESS // 'partial-progress'
AuditStatus.NOT_MET          // 'not-met'
AuditStatus.WAIVED           // 'waived'
AuditStatus.SUBSTITUTED      // 'substituted'
```

---

## ProgramType, ProgramLevel, DegreeType Enums

Frozen objects providing canonical values:

```javascript
reqit.ProgramType.MAJOR           // 'major'
reqit.ProgramType.MINOR           // 'minor'
reqit.ProgramType.CERTIFICATE     // 'certificate'

reqit.ProgramLevel.UNDERGRADUATE  // 'undergraduate'
reqit.ProgramLevel.GRADUATE       // 'graduate'
reqit.ProgramLevel.DOCTORAL       // 'doctoral'

reqit.DegreeType.BS               // 'B.S.'
reqit.DegreeType.BA               // 'B.A.'
reqit.DegreeType.PHD              // 'Ph.D.'
// ... 25+ types
```

---

## Grade Utilities

Standalone functions for grade operations:

```javascript
// Check if a grade meets a minimum threshold
reqit.meetsMinGrade('B+', 'C', gradeConfig);   // true

// Check if a grade is passing
reqit.isPassingGrade('P', gradeConfig);          // true
reqit.isPassingGrade('F', gradeConfig);          // false

// Check if a grade string is recognized
reqit.isValidGrade('A', gradeConfig);            // true
reqit.isValidGrade('X', gradeConfig);            // false

// Calculate GPA (accepts Transcript or plain array)
reqit.calculateGPA(transcript, catalog);         // 3.45
reqit.calculateGPA(
  [{ grade: 'A', credits: 4 }, { grade: 'B', credits: 3 }],
  gradeConfig
);                                                // 3.57
```
