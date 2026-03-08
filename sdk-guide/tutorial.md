# reqit SDK Tutorial

This tutorial walks you through building a degree audit system with the reqit SDK. By the end, you'll understand the data model, know how to write and evaluate requirements, and be able to display audit results in a web application.

The tutorial builds progressively — each section introduces concepts used by later ones. If you're looking up a specific method signature, the [Data Types Reference](data-types.md) is a better starting point.

**Prerequisites:** You should be comfortable with Node.js. Some familiarity with academic degree requirements (courses, credits, prerequisites, majors/minors) will help, but isn't strictly required — the tutorial explains the domain concepts as they come up.

> **A note on `id` fields:** Every entity type (Course, Program, TranscriptCourse, etc.) accepts an optional `id` field. The SDK never generates or interprets these — they exist so you can round-trip your own database keys through the system. You can omit them entirely when working without a database.

## Installation

```bash
npm install reqit
```

```javascript
const reqit = require('reqit');
```

---

## 1. Building a Catalog — Your Institution's Course Offering

Before you can audit anyone's progress, you need to describe what the institution offers. A **catalog** is a snapshot of an institution's academic offerings for a specific academic year: its courses, the programs those courses belong to, course attributes (like "Writing Intensive" or "Quantitative Reasoning"), and the grade scale used for GPA calculation.

You'll typically build a catalog from your Student Information System (SIS) data. For database loading patterns, see the [Database Integration Guide](database-guide.md).

### Courses

Start with courses. At minimum, every course needs a `subject` (department code) and `number`. In practice, you'll want `title`, `creditsMin`/`creditsMax`, and often `attributes` and `prerequisites`:

```javascript
const catalog = reqit.catalog({
  ay: '2025-2026',
  courses: [
    {
      subject: 'MATH', number: '151', title: 'Calculus I',
      creditsMin: 4, creditsMax: 4,
      attributes: ['QR'],
    },
    {
      subject: 'MATH', number: '152', title: 'Calculus II',
      creditsMin: 4, creditsMax: 4,
      attributes: ['QR'],
      prerequisites: 'MATH 151',
    },
    {
      subject: 'CMPS', number: '130', title: 'Intro to Programming',
      creditsMin: 3, creditsMax: 3,
    },
    {
      subject: 'CMPS', number: '230', title: 'Data Structures',
      creditsMin: 3, creditsMax: 3,
      prerequisites: 'CMPS 130',
    },
    {
      subject: 'CMPS', number: '310', title: 'Algorithms',
      creditsMin: 3, creditsMax: 3,
      attributes: ['WI'],
      prerequisites: 'CMPS 230',
    },
    {
      subject: 'ENGL', number: '101', title: 'College Writing',
      creditsMin: 3, creditsMax: 3,
      attributes: ['WI'],
    },
  ],
  attributes: [
    { code: 'QR', name: 'Quantitative Reasoning' },
    { code: 'WI', name: 'Writing Intensive' },
  ],
  programs: [
    { code: 'CMPS', name: 'Computer Science', type: 'major', level: 'undergraduate' },
  ],
});
```

A few things matter here:

- **Prerequisites** can be strings (`'CMPS 130'`), Requirement instances, or raw AST objects. Strings are auto-parsed when the Catalog is constructed. If your SIS already stores prerequisites as structured data, you can pass AST objects directly and skip parsing.
- **Attributes** are opaque string codes that tag courses with institutional classifications. The `attributes` array on the catalog provides human-readable names; the `attributes` array on each course indicates which tags apply. You'll use these in requirement filters like `courses where attribute = "QR"`.
- **Credits** use `creditsMin` / `creditsMax` to handle variable-credit courses (like independent study). For fixed-credit courses, set both to the same value. The audit engine uses `creditsMin` when evaluating credit requirements.

### Looking Things Up

The catalog provides O(1) lookups with memoized indexes — the index is built once on first access:

```javascript
const calc = catalog.findCourse('MATH', '151');
// → Course { subject: 'MATH', number: '151', title: 'Calculus I', ... }

const csCourses = catalog.findCourses({ subject: 'CMPS' });
// → all CMPS courses (returns a new array each time)

const wiCourses = catalog.findCourses({ attribute: 'WI' });
// → courses tagged Writing Intensive

const subjects = catalog.getSubjects();
// → ['CMPS', 'ENGL', 'MATH']  (sorted)
```

These lookups are useful for building advising UIs — course pickers, prerequisite chains, etc. They're also how renderers like `toOutline()` look up course titles and credit values to display alongside audit results.

---

## 2. Writing Requirements — The reqit Language

With a catalog in place, you can define what students need to complete. Requirements are written in the **reqit language** — a domain-specific language designed to read like how registrars describe degree requirements in a catalog.

The key insight is that degree requirements are trees. A major requires "all of" several groups; each group might require "at least 3 of" a set of electives; an elective might be "any course where subject = CMPS and number >= 300." The reqit language directly expresses this tree structure.

This section covers the most common patterns. The full [Language Guide](../language-guide/) covers every construct with detailed examples.

### Basic Requirements

The simplest requirement is a single course. Combine them with `all of`, `any of`, and `at least N of`:

```javascript
// A single course
const req1 = reqit.parse('MATH 151');
```

`reqit.parse()` creates a `Requirement` from DSL text. Its complement is `reqit.fromAST()`, which creates a `Requirement` from a stored AST object — useful when loading requirements from a database where they've been saved as JSON. Both produce identical `Requirement` instances with the same methods.

```javascript
// All of these courses (student must complete every one)
const req2 = reqit.parse('all of (MATH 151, MATH 152, CMPS 130)');

// Any one of these courses (student picks one)
const req3 = reqit.parse('any of (ENGL 101, ENGL 102, ENGL 105)');

// At least 2 of these 4 courses (student picks 2+)
const req4 = reqit.parse('at least 2 of (CMPS 310, CMPS 320, CMPS 350, CMPS 360)');
```

These composites nest freely. A real program is typically an `all of` whose children are named groups, each with its own internal structure.

### Course Filters

Listing every course works for core requirements, but elective pools can have dozens of options — and the list changes as courses are added to the catalog. Filters let you describe a pattern instead:

```javascript
// Any 3 courses in the CMPS department numbered 300+
const electives = reqit.parse(`
  at least 3 of (
    courses where subject = "CMPS" and number >= 300
  )
`);

// At least 6 credits of courses with the QR attribute
const genEd = reqit.parse(`
  at least 6 credits from (
    courses where attribute = "QR"
  )
`);
```

During audit, filters expand against the catalog to find matching courses, then evaluate which ones the student has completed. You can also mix explicit courses and filters in the same list — useful for "take these specific courses plus N electives from this pool."

### Credit Requirements

Sometimes the requirement is about credit hours, not course count:

```javascript
// At least 12 credits from a pool of courses
const credits = reqit.parse(`
  at least 12 credits from (
    CMPS 310, CMPS 320, CMPS 350, CMPS 360, CMPS 380,
    courses where subject = "CMPS" and number >= 400
  )
`);
```

Credit requirements use each course's `creditsMin` from the catalog. This handles the common case where "9 credits of electives" might be three 3-credit courses or two 3-credit courses and one pass/fail lab.

### Grade Constraints

Many programs require minimum grades in core courses or minimum GPAs within a group:

```javascript
// All courses with a minimum grade of C
const withGrade = reqit.parse(`
  all of (MATH 151, MATH 152, CMPS 130) with grade >= "C"
`);

// GPA requirement scoped to this group's courses
const withGPA = reqit.parse(`
  all of (MATH 151, MATH 152, MATH 250) with gpa >= 2.5
`);
```

An important distinction: `with grade >= "C"` means each individual course must earn at least a C. `with gpa >= 2.5` means the GPA computed across just these courses (not the student's overall GPA) must be at least 2.5. A student could have a B+ and a C- and still pass a 2.0 GPA requirement — that wouldn't be possible with `grade >= "C"`.

Grade comparison uses the catalog's grade configuration, which defines the ordering. The default is standard US letter grades (A+ > A > A- > B+ > ... > F), but you can customize it for institutions that use different scales.

### Non-Course Requirements

Not everything is a course. Test scores, milestones, and accumulative metrics are modeled as non-course requirements:

```javascript
// A test score threshold
const sat = reqit.parse('score SAT_MATH >= 580');

// A binary milestone (completed or not)
const standing = reqit.parse('attainment JUNIOR_STANDING');
```

These are evaluated against the transcript's `attainments` object (covered in the next section). Scores support comparison operators (`>=`, `>`, `=`, etc.); attainments are boolean.

### Variables and Structure

For complex programs, variables let you name groups and build the requirement tree piece by piece. This is how real degree requirements are typically structured:

```javascript
const csMajor = reqit.parse(`
  $core = "CS Core": all of (
    CMPS 130,
    CMPS 230,
    CMPS 310
  ) with grade >= "C"

  $math = "Mathematics": all of (
    MATH 151,
    MATH 152
  )

  $electives = "Electives": at least 9 credits from (
    courses where subject = "CMPS" and number >= 300
  ) except (CMPS 310)

  "B.S. Computer Science": all of ($core, $math, $electives)
`);
```

Labels (the quoted strings before the colon) give groups human-readable names that appear in audit output. The `except` clause excludes courses already counted in the core from the elective pool — without this, CMPS 310 could double-count.

Variables are scoped to the requirement tree. If you need to share variables across multiple programs, see [Section 8: Shared Definitions and Clusters](#8-shared-definitions-and-clusters--reusing-requirements-across-programs).

### Rendering Requirements

Once parsed, you can render requirements before auditing — useful for displaying program requirements in a course catalog or advising tool:

```javascript
// Indented text outline (course titles come from the catalog)
console.log(csMajor.toOutline(catalog));
// All of the following:
// ├── CS Core — All of the following (min grade: C):
// │   ├── CMPS 130 - Intro to Programming
// │   ├── CMPS 230 - Data Structures
// │   └── CMPS 310 - Algorithms
// ├── Mathematics — All of the following:
// │   ├── MATH 151 - Calculus I
// │   └── MATH 152 - Calculus II
// └── Electives — At least 9 credits from: ...

// HTML for web display (see html-reference.md for CSS classes)
const html = csMajor.toHTML(catalog);

// Human-readable prose description
console.log(csMajor.description);

// Round-trip back to reqit source text
console.log(csMajor.text);
```

The same `toOutline()` and `toHTML()` methods work on audit results too, where they add status icons, grades, and progress counts. That's covered in Section 4.

### Attaching Requirements to Programs

When your catalog has programs, you can attach parsed requirements to them using `withPrograms()`. This makes the requirements available through the catalog's program lookup:

```javascript
const programMap = {
  'BS-CMPS': reqit.parse(csRequirementText),
  'GEN-ED': reqit.parse(genEdRequirementText),
};
const catalogWithReqs = catalog.withPrograms(programMap);

// Now programs have requirements attached
const program = catalogWithReqs.findProgram('BS-CMPS');
// program.requirements is the AST (not a Requirement instance)
// Use fromAST() to get back an auditable Requirement:
const req = reqit.fromAST(program.requirements);
```

`withPrograms()` returns a new Catalog (catalogs are immutable). The programs store the AST form of the requirement, not the `Requirement` wrapper — use `reqit.fromAST()` to wrap it back when you need to audit or render.

---

## 3. Building a Transcript — A Student's Academic Record

A transcript represents everything a student has accomplished and declared: courses completed (or in progress), test scores and milestones, and which programs they've declared (major, minor, etc.).

```javascript
const transcript = reqit.transcript({
  courses: [
    { subject: 'MATH', number: '151', grade: 'A', credits: 4, term: 'Fall 2023' },
    { subject: 'MATH', number: '152', grade: 'B+', credits: 4, term: 'Spring 2024' },
    { subject: 'CMPS', number: '130', grade: 'A-', credits: 3, term: 'Fall 2023' },
    { subject: 'CMPS', number: '230', grade: 'B', credits: 3, term: 'Spring 2024' },
    { subject: 'CMPS', number: '310', grade: 'B+', credits: 3, term: 'Fall 2024' },
    { subject: 'ENGL', number: '101', grade: 'A', credits: 3, term: 'Fall 2023' },
    // A course currently in progress (no grade yet)
    { subject: 'CMPS', number: '350', credits: 3, term: 'Spring 2025', status: 'in-progress' },
  ],
  attainments: {
    'SAT-MATH': 650,         // Numeric score
    'JUNIOR_STANDING': true,  // Boolean milestone
  },
  declaredPrograms: [
    { code: 'CMPS', type: 'major', level: 'undergraduate', role: 'primary' },
  ],
});
```

The `status` field on a course entry defaults to `'completed'`. Setting it to `'in-progress'` tells the audit engine this course hasn't been finished yet — it will count toward the requirement but produce an `in-progress` status rather than `met`.

The `role: 'primary'` on the declared program identifies which major/minor is the student's primary one. This matters for multi-program audits where overlap policies reference "primary major" or "primary minor."

### Modifying Transcripts

Transcripts are **immutable** — every mutation returns a new Transcript instance, leaving the original unchanged. This is critical for what-if analysis (Section 5), where you want to explore hypothetical scenarios without corrupting the student's actual record:

```javascript
// Add a course — returns a NEW transcript
const updated = transcript.addCourse({
  subject: 'CMPS', number: '380', grade: 'A', credits: 3, term: 'Spring 2025',
});

// Remove a course
const removed = transcript.removeCourse('CMPS', '380');

// Add an attainment
const withAttainment = transcript.addAttainment('CAREER_PATHWAYS', true);

// These are chainable — each call returns a new Transcript you can chain on
const modified = transcript
  .addCourse({ subject: 'CMPS', number: '320', grade: 'B', credits: 3, term: 'Spring 2025' })
  .addAttainment('CAREER_PATHWAYS', true);
```

### Duplicate Policy

When a student takes the same course more than once (e.g., retaking for a better grade), the `duplicatePolicy` option controls which attempt the audit uses:

```javascript
const tx = reqit.transcript({
  courses: [
    { subject: 'MATH', number: '151', grade: 'D', credits: 4, term: 'Fall 2023' },
    { subject: 'MATH', number: '151', grade: 'B+', credits: 4, term: 'Spring 2024' },
  ],
  duplicatePolicy: 'best-grade',  // use the attempt with the highest grade
});
```

| Policy | Behavior |
|--------|----------|
| `null` (default) | Uses the latest attempt (last in the array). |
| `'best-grade'` | Uses the attempt with the highest grade per the catalog's grade scale. |
| `'first'` | Uses the first attempt. |

The choice is typically driven by institutional policy — most institutions use latest-wins or best-grade for GPA purposes.

### Custom Grade Configuration

The default grade scale is standard US letter grades (A+ through F). For institutions with different grading systems, customize via `gradeConfig` on the catalog:

```javascript
const catalog = reqit.catalog({
  ay: '2025-2026',
  courses: [ /* ... */ ],
  gradeConfig: {
    scale: [
      { grade: 'A+', points: 4.0 },
      { grade: 'A',  points: 4.0 },
      { grade: 'A-', points: 3.7 },
      { grade: 'B+', points: 3.3 },
      { grade: 'B',  points: 3.0 },
      { grade: 'B-', points: 2.7 },
      { grade: 'C+', points: 2.3 },
      { grade: 'C',  points: 2.0 },
      { grade: 'C-', points: 1.7 },
      { grade: 'D',  points: 1.0 },
      { grade: 'F',  points: 0.0 },
      // A grade with audit: false is invisible to the audit engine
      { grade: 'AU', points: 0.0, audit: false },
    ],
    passFail: [
      { grade: 'P', passing: true },
      { grade: 'NP', passing: false },
    ],
    withdrawal: ['W', 'WP', 'WF'],
    incomplete: ['I', 'IP'],
  },
});
```

The grade scale must be ordered highest to lowest. Pass/fail grades satisfy requirements but don't count toward GPA. Grades with `audit: false` are completely ignored by the audit engine — useful for audit/observer enrollment markers.

---

## 4. Running an Audit — Evaluating Progress

This is where everything comes together. An audit evaluates a requirement tree against a student's transcript and produces a structured result with a status at every node.

```javascript
const result = csMajor.audit(catalog, transcript);

console.log(result.status);
// → 'in-progress'
```

### Audit Statuses

Every node in the audit result carries one of four primary statuses:

| Status | Meaning |
|--------|---------|
| **`met`** | Fully satisfied. |
| **`provisional-met`** | Will be satisfied once currently-enrolled courses complete. |
| **`in-progress`** | Some progress made, but more work needed. A composite where some children are met but others are not yet. |
| **`not-met`** | No progress. |

Additionally, nodes can be **`waived`** or **`substituted`** when exceptions apply (see Section 6).

Statuses **propagate upward** from leaves to the root. An `all of` is `met` only when every child is `met`. It's `provisional-met` when all unmet children are themselves `provisional-met`. It's `in-progress` when there's a mix. An `any of` is `met` when at least one child is `met`.

This propagation is why `result.status` gives you a single-value summary of the entire program — but you can always drill into `result.results` or use `result.walk()` to see the status at every level.

### The Summary

The summary gives you a high-level count of how the top-level groups break down:

```javascript
console.log(result.summary);
// → {
//     met: 2,              // groups fully satisfied
//     waived: 0,           // groups waived
//     substituted: 0,      // groups substituted
//     provisionalMet: 0,   // groups that will be met when current courses finish
//     inProgress: 1,       // groups with mixed progress
//     notMet: 0,           // groups with no progress
//     total: 3             // total top-level children
//   }
```

This powers the "2 of 3 requirements met" display you see in advising tools.

### Walking the Result Tree

The result tree mirrors the requirement tree's structure, but every node has a `status` and, for courses, a `satisfiedBy` object with the transcript entry that satisfied it:

```javascript
result.walk((node, path, parent, depth) => {
  const indent = '  '.repeat(depth);
  if (node.type === 'course') {
    const icon = node.status === 'met' ? '✓' : node.status === 'in-progress' ? '◕' : '✗';
    const grade = node.satisfiedBy ? ` [${node.satisfiedBy.grade}]` : '';
    console.log(`${indent}${icon} ${node.subject} ${node.number}${grade}`);
  }
});
```

The `walk()` callback receives four arguments:
- **`node`** — the audit result node (with `type`, `status`, and type-specific fields)
- **`path`** — an array of keys and indices (e.g., `['items', 0, 'items', 1]`) identifying position in the tree
- **`parent`** — the parent node (null for root)
- **`depth`** — numeric depth (0 for root, 1 for direct children, etc.)

### Finding What's Missing

Two convenience methods save you from walking the tree yourself:

```javascript
// All leaf requirements that aren't met — courses, scores, attainments, filters
const unmet = result.findUnmet();
for (const item of unmet) {
  if (item.node.type === 'course') {
    console.log(`Still need: ${item.node.subject} ${item.node.number}`);
  }
}

// Courses the student is eligible to take next (prerequisites already met)
const eligible = result.findNextEligible(catalog, transcript);
for (const course of eligible) {
  console.log(`Can take: ${course.subject} ${course.number} - ${course.title}`);
}
```

`findNextEligible()` is particularly valuable for advising. It cross-references unmet course requirements with the catalog's prerequisite chains and the student's transcript to find courses whose prerequisites are satisfied. A student who needs CMPS 310 but hasn't taken CMPS 230 won't see CMPS 310 in the eligible list.

### Displaying the Audit

The built-in renderers produce ready-to-use output with status icons, grades, terms, and progress counts:

```javascript
// Text outline — great for CLIs and debugging
console.log(result.toOutline(catalog));
// ◔ All of the following: (2/3 met)
// ├── ✓ CS Core (3/3 met)
// │   ├── ✓ CMPS 130 - Intro to Programming  [A-, Fall 2023]
// │   ├── ✓ CMPS 230 - Data Structures  [B, Spring 2024]
// │   └── ✓ CMPS 310 - Algorithms  [B+, Fall 2024]
// ├── ✓ Mathematics (2/2 met)
// │   ├── ✓ MATH 151 - Calculus I  [A, Fall 2023]
// │   └── ✓ MATH 152 - Calculus II  [B+, Spring 2024]
// └── ✗ Electives (3/9 credits)
//     └── ◕ CMPS 350 - Machine Learning  (in progress)

// HTML with CSS classes for styling — use in web apps
const auditHtml = result.toHTML(catalog, { wrapperTag: 'div' });
```

You can customize the outline icons and control what information is shown:

```javascript
// Custom icons (e.g. for a terminal that doesn't support Unicode)
result.toOutline(catalog, {
  icons: { 'met': '[PASS]', 'not-met': '[NEED]', 'provisional-met': '[WIP]', 'in-progress': '[PART]' },
});

// Suppress grades and summary counts for a cleaner view
result.toOutline(catalog, { showGrades: false, showSummary: false });
```

---

## 5. What-If Analysis — Exploring Hypothetical Scenarios

Because transcripts are immutable, you can safely explore hypothetical scenarios without affecting the original data. This is one of the most powerful features for academic advising.

### Testing Future Course Plans

The most common what-if: "If I take these courses next semester, how does my audit look?"

```javascript
// What if the student takes CMPS 320 and CMPS 380 next semester?
const whatIf = transcript
  .addCourse({ subject: 'CMPS', number: '320', credits: 3, status: 'in-progress' })
  .addCourse({ subject: 'CMPS', number: '380', credits: 3, status: 'in-progress' });

const whatIfResult = csMajor.audit(catalog, whatIf);
console.log(`With planned courses: ${whatIfResult.status}`);
// The original transcript is untouched — whatIf is a separate instance
```

Use `status: 'in-progress'` for planned courses. This way the audit shows them contributing but not yet confirmed — the student sees "this plan would get you to in-progress" rather than "you're done."

### Comparing Potential Majors

For undeclared students exploring their options:

```javascript
const programCodes = ['CMPS', 'MATH', 'PHYS'];
for (const code of programCodes) {
  const program = catalog.findProgram(code);
  if (!program || !program.requirements) continue;
  const req = reqit.fromAST(program.requirements);
  const result = req.audit(catalog, transcript);
  console.log(`${program.name}: ${result.summary.met}/${result.summary.total} met`);
}
// → Computer Science: 2/3 met
// → Mathematics: 1/4 met
// → Physics: 0/3 met
```

Note the use of `reqit.fromAST()` — programs in the catalog store their requirements as AST objects (attached via `withPrograms()`). `fromAST()` wraps these back into Requirement instances so you can call `.audit()`.

### What-If with Multiple Programs

```javascript
// What if the student declares a CS major and Math minor?
const whatIfTx = transcript
  .declareProgram({ code: 'CMPS', type: 'major', level: 'undergraduate', role: 'primary' })
  .declareProgram({ code: 'MATH', type: 'minor', level: 'undergraduate' });

const multi = reqit.auditMulti(catalog, whatIfTx, {
  trees: { 'CMPS': csMajor, 'MATH': mathMinor },
});
console.log('CS:', multi.trees['CMPS'].status);
console.log('Math:', multi.trees['MATH'].status);
```

---

## 6. Waivers and Substitutions — Handling Exceptions

Students sometimes get exceptions: a course is waived due to transfer credit, or one course is accepted in place of another. These are modeled as first-class entities on the transcript.

### Waivers

A waiver exempts a specific requirement from evaluation. The audited node shows `'waived'` instead of being evaluated against the transcript:

```javascript
// Waive a specific course (e.g. transfer credit)
const waiver = reqit.waiver({
  id: 'w-001',
  course: { subject: 'CMPS', number: '310' },
  reason: 'Transfer credit from partner institution',
});

// Add the waiver to the transcript
const txWithWaiver = transcript.addWaiver(waiver);

// Now audit — CMPS 310 shows as 'waived', the student doesn't need it
const result = csMajor.audit(catalog, txWithWaiver);
```

Waivers target specific things. You can waive a course, a test score, an attainment, or an entire labeled group:

```javascript
// Waive a test score requirement
reqit.waiver({ score: 'SAT-MATH', reason: 'Exempt by policy' });

// Waive an attainment milestone
reqit.waiver({ attainment: 'PRAXIS', reason: 'Already certified' });

// Waive a quantity requirement (e.g., clinical hours)
reqit.waiver({ quantity: 'CLINICAL_HOURS', reason: 'Prior professional experience' });

// Waive an entire named group (matches the label in the requirement)
reqit.waiver({ label: 'Math Core', reason: 'AP credit covers all math' });
```

Each waiver targets exactly one thing:

| Target Type | What It Waives | Example |
|-------------|---------------|---------|
| `course` | A specific course requirement | Transfer credit for CMPS 310 |
| `score` | A test score threshold | SAT exemption by policy |
| `attainment` | A milestone or certification | Already holds teaching certification |
| `quantity` | A numeric accumulation (hours, credits) | Prior professional experience |
| `label` | An entire labeled requirement group | AP credit covers all math requirements |

### Substitutions

A substitution says "this student took course X in place of required course Y":

```javascript
const sub = reqit.substitution({
  id: 's-001',
  original: { subject: 'MATH', number: '250' },
  replacement: { subject: 'MATH', number: '241' },
  reason: 'Department approved equivalent',
});

const txWithSub = transcript.addSubstitution(sub);
```

During audit, if the student has MATH 241 on their transcript, it satisfies the MATH 250 requirement. The node shows `'substituted'` status.

### Removing Exceptions

```javascript
// Remove by ID
const cleaned = txWithWaiver.removeWaiver('w-001');

// Or remove by target (matches on the course/score/attainment/label)
const cleaned2 = txWithWaiver.removeWaiver({ subject: 'CMPS', number: '310' });

// Same for substitutions
const cleaned3 = txWithSub.removeSubstitution('s-001');
```

### Tracking What Was Applied

After an audit with exceptions, you can see exactly which ones took effect and which didn't match anything in the requirement tree:

```javascript
const result = req.audit(catalog, txWithWaiver);
if (result.exceptions) {
  console.log('Applied:', result.exceptions.applied.length);
  console.log('Unused:', result.exceptions.unused.length);
  // Unused exceptions generate warnings — they might indicate stale data
}
```

Unused exceptions also appear as warnings in `result.warnings`. This is useful for data hygiene — if a waiver doesn't match any requirement node, it may have been entered incorrectly or the requirement may have changed since the waiver was granted.

---

## 7. Resolving Filters — Previewing Course Matches

Before auditing, you might want to see which courses a requirement's filters actually match against the current catalog. This is useful for two things:

1. **Advising** — showing students their elective options before they register
2. **Validation** — confirming that a filter expression matches the courses you expect

```javascript
const electives = reqit.parse(`
  at least 9 credits from (
    courses where subject = "CMPS" and number >= 300
  )
`);

const resolved = electives.resolve(catalog);

// allCourses() deduplicates across explicit course refs and filter matches
console.log('Matching courses:');
for (const course of resolved.allCourses()) {
  console.log(`  ${course.subject} ${course.number} - ${course.title} (${course.creditsMin} cr)`);
}
// → CMPS 310 - Algorithms (3 cr)
// → CMPS 320 - Operating Systems (3 cr)
// → CMPS 350 - Machine Learning (3 cr)
// → ...
```

Resolution is purely a catalog operation — no transcript needed. It tells you "given this catalog, which courses could potentially satisfy this requirement?"

### Reverse Lookup

You can also ask the reverse question: "which filters in this requirement does a specific course match?"

```javascript
const matchedFilters = resolved.filtersForCourse('CMPS', '310');
console.log(`CMPS 310 matched ${matchedFilters.length} filter(s)`);
```

This is useful for building UIs where clicking on a course highlights which requirement groups it could count toward.

### Resolution Warnings

If your catalog has an `attributes` registry, resolution warns about unknown attribute codes in filters:

```javascript
const bad = reqit.parse('at least 1 of (courses where attribute = "NONEXISTENT")');
const result = bad.resolve(catalog);
console.log(result.warnings);
// → ['Unknown attribute code "NONEXISTENT"']
```

---

## 8. Shared Definitions and Clusters — Reusing Requirements Across Programs

When the same requirement appears in multiple programs (e.g. general education in every major), you don't want to duplicate it. The SDK offers two complementary approaches depending on whether the shared piece is independently auditable.

### Cluster Programs — Independently Auditable Groups

A **cluster** is a program that holds requirements which are referenced from other programs. General education is the canonical example: it has its own complex requirement tree, appears in every major, and should be auditable on its own.

1. Store gen-ed as a program with `type: 'cluster'` in the catalog:

```javascript
const catalog = reqit.catalog({
  ay: '2025-2026',
  courses: [ /* ... */ ],
  programs: [
    { code: 'GEN-ED', name: 'General Education', type: 'cluster', level: 'undergraduate' },
    { code: 'BS-CMPS', name: 'B.S. in Computer Science', type: 'major', level: 'undergraduate' },
  ],
});
```

2. Write the cluster's requirements in its own file (e.g. `gen-ed.reqit`) and attach via `withPrograms()`.

3. Reference it from each major using a `program-ref` node:

```
# In bs-cmps.reqit
$gen_ed = program "GEN-ED"

"Degree Requirements": all of ($gen_ed, $cs_core, $math_required)
```

The audit engine looks up the GEN-ED program in the catalog, finds its attached requirements, and runs a sub-audit inline. The sub-audit's result appears as a section within the major's audit output.

For the sub-audit to work, GEN-ED must be in the student's `declaredPrograms`:

```javascript
const tx = reqit.transcript({
  courses: [...],
  declaredPrograms: [
    reqit.declaredProgram({ code: 'GEN-ED', type: 'cluster', level: 'undergraduate' }),
  ],
});
```

### Shared Definitions — Reusable Building Blocks

For smaller patterns that don't warrant their own program — a repeated course choice, a common sub-expression — use **shared definitions**. Create them with `reqit.sharedDefinition()` and inject via the `sharedDefinitions` option:

```javascript
const sharedDefs = [
  reqit.sharedDefinition({
    name: 'discrete',
    requirement: 'any of (MATH 205, MATH 237)',
  }),
];

// Single-tree audit
const result = req.audit(catalog, transcript, { sharedDefinitions: sharedDefs });

// Multi-tree audit
const multi = reqit.auditMulti(catalog, transcript, {
  trees: { 'BS-CMPS': csMajor, 'BS-CYBER': cyberMajor },
  sharedDefinitions: sharedDefs,
});

// Resolution
const resolved = req.resolve(catalog, { sharedDefinitions: sharedDefs });
```

In the requirement file, reference the shared definition just like a local one:

```
$math_required = "Math Requirements": all of (MATH 121, $discrete)
```

**Local definitions always take precedence.** If a requirement file defines `$discrete` locally, that definition wins over the shared one. This means you can provide institution-wide defaults that individual programs can override.

### When to Use Which

| | Cluster Program | Shared Definition |
|---|---|---|
| **Auditable on its own** | Yes — has its own result tree | No — embedded in the referencing program's tree |
| **Appears in audit output** | As a distinct, collapsible section | Inlined where referenced |
| **Needs `declaredPrograms`** | Yes | No |
| **Best for** | Gen-ed, school cores, any group meaningful on its own | Common elective lists, repeated sub-expressions, small reusable patterns |

---

## 9. Multi-Program Audits — Shared Course Assignment

Real students pursue multiple requirement trees simultaneously — a major, general education, maybe a minor or concentration. When MATH 151 satisfies both the major's math requirement and the gen-ed QR requirement, you need to decide whether that's allowed.

The multi-tree audit handles this by auditing each tree independently and then tracking which courses are assigned to which programs:

```javascript
const genEd = reqit.parse(`
  all of (
    at least 6 credits from (courses where attribute = "QR"),
    at least 6 credits from (courses where attribute = "WI")
  )
`);

const multi = reqit.auditMulti(catalog, transcript, {
  trees: {
    'CMPS': csMajor,
    'GEN-ED': genEd,
  },
});

// Each tree gets its own AuditResult — all the same methods work
console.log(multi.trees['CMPS'].status);    // 'in-progress'
console.log(multi.trees['GEN-ED'].status);  // 'met'

// See which courses were assigned to which programs
const assignments = multi.courseAssignments;
// assignments.getAssignments('MATH:151') → ['CMPS', 'GEN-ED']
// assignments.getSharedCourses('CMPS', 'GEN-ED') → ['MATH:151', 'MATH:152']
```

### Overlap Rules

By default, courses can count toward any number of programs. To enforce policies that limit double-counting, pass overlap rules to the `auditMulti()` options. Overlap rules describe relationships *between* programs — they configure multi-program audit behavior, not individual requirement trees. This is why they sit in the `auditMulti()` options rather than inside a requirement string. The rules are specified as AST objects:

```javascript
const multi = reqit.auditMulti(catalog, transcript, {
  trees: { 'CMPS': csMajor, 'MATH-MINOR': mathMinor },
  overlapRules: [{
    type: 'overlap-limit',
    left: { type: 'program-context-ref', role: 'primary-major' },
    right: { type: 'program-context-ref', role: 'primary-minor' },
    constraint: { comparison: 'at-most', value: 50, unit: 'percent' },
  }],
});

// Check for violations
for (const r of multi.overlapResults) {
  if (r.status === 'not-met') {
    console.log(`Violation: ${r.programA} and ${r.programB} share ${r.actual}% (limit: ${r.limit}%)`);
    console.log('Shared courses:', r.sharedCourses);
  }
}
```

The overlap rule above says "at most 50% of courses can be shared between the primary major and primary minor." The `role` values (`'primary-major'`, `'primary-minor'`) are derived from the `role: 'primary'` field on `declaredPrograms` in the transcript.

---

## 10. Displaying Audits in a Web App — Server-Side Rendering

Here's a practical pattern for integrating audit results into a server-rendered web application using Express and Pug. For database loading patterns, see the [Database Integration Guide](database-guide.md).

### Express Route

```javascript
app.get('/audit/:studentId', async (req, res) => {
  // Load your data (from database, API, etc.)
  const catalog = reqit.catalog(await loadCatalog());
  const transcript = reqit.transcript(await loadTranscript(req.params.studentId));
  const requirement = reqit.parse(await loadRequirementText('CMPS'));

  const result = requirement.audit(catalog, transcript);

  res.render('audit', {
    student: req.params.studentId,
    status: result.status,
    summary: result.summary,
    auditHtml: result.toHTML(catalog, {
      classPrefix: 'audit-',   // Prefix all CSS classes to avoid conflicts
      wrapperTag: 'div',       // Use divs instead of spans for block layout
    }),
    unmet: result.findUnmet(),
    eligible: result.findNextEligible(catalog, transcript),
  });
});
```

The `classPrefix` option namespaces all CSS classes (e.g. `reqit-course` becomes `audit-course`), which prevents conflicts with your application's existing styles. The `wrapperTag: 'div'` produces block-level elements instead of the default inline spans.

### Pug Template

```pug
h2 Degree Audit
p.status(class=`status-${status}`)
  | Status: #{status} (#{summary.met}/#{summary.total} met)

.audit-container
  != auditHtml

if unmet.length > 0
  h3 Still Needed
  ul
    each item in unmet
      if item.node.type === 'course'
        li #{item.node.subject} #{item.node.number}

if eligible.length > 0
  h3 Can Take Next
  ul
    each course in eligible
      li #{course.subject} #{course.number} - #{course.title}
```

### Styling

Use the CSS classes from `toHTML()` in your stylesheet. The [HTML Reference](html-reference.md) documents every class and includes a complete starter stylesheet.

```css
/* With classPrefix: 'audit-' */
.audit-status-met { border-left: 3px solid #16a34a; padding-left: 0.5em; }
.audit-status-not-met { border-left: 3px solid #dc2626; padding-left: 0.5em; }
.audit-status-in-progress { border-left: 3px solid #ca8a04; padding-left: 0.5em; }
.audit-course { display: block; padding: 0.25em 0; }
.audit-grade { font-weight: bold; color: #166534; }
```

---

## 11. Building a Custom Renderer — Using walk()

The built-in `toHTML()` and `toOutline()` renderers cover most needs. When you need full control over the output — a JSON API response, a PDF report, or a template engine that works differently — use `walk()` to traverse the audit result tree yourself.

### Flat Course Status List

Extract just the course-level results for a simplified view:

```javascript
const courses = [];
result.walk((node, path, parent, depth) => {
  if (node.type === 'course') {
    const course = catalog.findCourse(node.subject, node.number);
    courses.push({
      subject: node.subject,
      number: node.number,
      title: course ? course.title : null,
      status: node.status,
      grade: node.satisfiedBy ? node.satisfiedBy.grade : null,
    });
  }
});
// → [{ subject: 'MATH', number: '151', title: 'Calculus I', status: 'met', grade: 'A' }, ...]
```

### JSON API Response

Build a summary-level JSON response for a REST API:

```javascript
function auditToJSON(result, catalog) {
  const sections = [];
  result.walk((node, path, parent, depth) => {
    // Capture only the top-level groups (depth 1 = direct children of root)
    if (depth === 1 && node.items) {
      sections.push({
        label: node.label || node.type,
        status: node.status,
        met: node.summary ? node.summary.met : 0,
        total: node.summary ? node.summary.total : 0,
      });
    }
  });
  return {
    status: result.status,
    summary: result.summary,
    sections,
  };
}
```

The `depth` parameter is key here — it lets you pick the right level of detail. Depth 0 is the root; depth 1 is the top-level groups (the direct children of the outermost `all of`).

### Server-Rendered HTML with Pug

For full layout control, pass the raw tree data to your template engine instead of using `toHTML()`:

```javascript
// In your Express route
const auditTree = [];
result.walk((node, path, parent, depth) => {
  auditTree.push({ ...node, depth });
});
res.render('custom-audit', { auditTree, catalog });
```

```pug
//- custom-audit.pug
each node in auditTree
  if node.type === 'course'
    .course(class=`status-${node.status}` style=`padding-left: ${node.depth * 1.5}em`)
      if node.status === 'met'
        span.icon ✓
      else
        span.icon ○
      span.name #{node.subject} #{node.number}
      if node.satisfiedBy && node.satisfiedBy.grade
        span.grade [#{node.satisfiedBy.grade}]
  else if node.items
    .group(style=`padding-left: ${node.depth * 1.5}em`)
      strong #{node.label || node.type}
      if node.summary
        span.counts  (#{node.summary.met}/#{node.summary.total})
```

---

## 12. Catalog Analysis — Prerequisite Graphs and Impact

Beyond auditing individual students, the catalog provides tools for curriculum planning and institutional analysis.

### Prerequisite Graph

The prerequisite graph is built lazily from all courses' prerequisite data and cached on the catalog instance:

```javascript
const graph = catalog.prereqGraph();

// What does CMPS 310 directly require?
const prereqs = graph.directPrereqs('CMPS:310');
// → Set { 'CMPS:230' }

// What does a student need to have completed before CMPS 310?
// (transitive = direct prereqs + their prereqs + ...)
const allPrereqs = graph.transitivePrereqs('CMPS:310');
// → Set { 'CMPS:230', 'CMPS:130' }

// What courses depend on CMPS 230? (reverse lookup)
const dependents = graph.dependents('CMPS:230');
// → Set { 'CMPS:310', 'CMPS:320', 'CMPS:350', ... }
```

Note the key format: `'SUBJECT:NUMBER'`. This is consistent throughout the SDK wherever courses are identified by key.

### Impact Analysis

Before retiring, modifying, or re-sequencing a course, check how many other courses and programs it affects:

```javascript
const impact = catalog.courseImpact('CMPS', '230');
console.log('Courses affected:', impact.dependentCourses);
// → ['CMPS:310', 'CMPS:320', 'CMPS:350', ...]
console.log('Programs affected:', impact.programs);
// → [{ code: 'CMPS', context: 'required' }]
```

The `context` field tells you whether the course is `'required'` (every student in the program needs it) or `'elective'` (it's one of several options).

### GPA Calculation

```javascript
const gpa = reqit.calculateGPA(transcript, catalog);
console.log(`GPA: ${gpa.toFixed(2)}`);
```

`calculateGPA()` uses the catalog's grade configuration to map letter grades to quality points. It accepts a Transcript instance or a plain array of course entries.

---

## 12.5. Requirement Analysis — Validation, Diffing, and Transformation

The SDK provides utilities for working with requirement trees beyond auditing.

### Validation

Validate requirement text before saving — useful for admin UIs where users author requirements:

```javascript
const req = reqit.parse(userInput);
const { valid, errors } = req.validate();
if (!valid) {
  console.log('Validation errors:', errors);
  // → ['Unknown node type at path items[2]', ...]
}
```

### Diffing

Compare two versions of a program's requirements to see what changed:

```javascript
const oldReq = reqit.parse(previousText);
const newReq = reqit.parse(currentText);
const changes = oldReq.diff(newReq);
for (const change of changes) {
  console.log(`${change.type} at ${change.path}: ${JSON.stringify(change.detail)}`);
}
// → 'added at items[3]: { type: "course", subject: "CMPS", number: "380" }'
// → 'removed at items[1]: { type: "course", subject: "CMPS", number: "220" }'
```

### Transformation

Programmatically modify an AST — returns a new Requirement (immutable):

```javascript
// Change all CMPS courses to CS (e.g., after a department rename)
const transformed = req.transform((node) => {
  if (node.type === 'course' && node.subject === 'CMPS') {
    return { ...node, subject: 'CS' };
  }
  return node;
});
```

### Expansion

Inline all variable references for export or display:

```javascript
const expanded = req.expand();
// All $variable references are replaced with their definitions
console.log(expanded.text);
```

---

## 13. Exporting Data — Spreadsheet-Ready Output

The SDK exports requirement and audit data as structured objects suitable for CSV or XLSX generation. These are useful for institutional reporting, advising printouts, and data exchange:

```javascript
// Prerequisite matrix — which courses require which
const prereqData = reqit.exportPrereqMatrix(catalog, { format: 'csv' });

// Program requirements checklist — the requirement tree as a flat checklist
const checklist = csMajor.exportChecklist(catalog, { format: 'xlsx' });

// Audit result export — flattened audit with statuses and grades
const auditExport = result.export(catalog, { format: 'csv' });
```

---

## 14. Annotations — Marking Shared Courses

When displaying multi-program audit results, you often want to visually flag courses that count toward more than one program. Annotations let you attach arbitrary labels to courses in the rendered output:

```javascript
// Build an annotations map from multi-tree overlap data
const annotations = new Map();
const csResult = multi.trees['CMPS'];

// Use courseAssignments to find shared courses
for (const [key, programs] of multi.courseAssignments.entries()) {
  if (programs.length > 1) {
    annotations.set(key, programs.map(p => `also counts toward ${p}`));
  }
}

// Pass annotations to the renderer
const html = csResult.toHTML(catalog, { annotations });
// Shared courses get: <span class="reqit-annotation">(also counts toward GEN-ED)</span>
```

Annotations are a general-purpose mechanism — you can use them for anything, not just overlap indicators. They're just an arbitrary `Map<courseKey, string[]>` that gets rendered as extra text on matching course nodes.

---

## 15. Putting It All Together

Here's a complete, minimal example of a degree audit flow from start to finish:

```javascript
const reqit = require('reqit');

// 1. Build catalog from your data
const catalog = reqit.catalog({
  ay: '2025-2026',
  courses: [
    { subject: 'MATH', number: '151', title: 'Calculus I', creditsMin: 4, creditsMax: 4 },
    { subject: 'MATH', number: '152', title: 'Calculus II', creditsMin: 4, creditsMax: 4,
      prerequisites: 'MATH 151' },
    { subject: 'CMPS', number: '130', title: 'Intro to Programming', creditsMin: 3, creditsMax: 3 },
    { subject: 'CMPS', number: '230', title: 'Data Structures', creditsMin: 3, creditsMax: 3,
      prerequisites: 'CMPS 130' },
    { subject: 'CMPS', number: '310', title: 'Algorithms', creditsMin: 3, creditsMax: 3,
      prerequisites: 'CMPS 230' },
  ],
});

// 2. Define requirements
const req = reqit.parse(`
  $math = "Mathematics": all of (MATH 151, MATH 152)
  $core = "CS Core": all of (CMPS 130, CMPS 230, CMPS 310) with grade >= "C"
  "B.S. Computer Science": all of ($math, $core)
`);

// 3. Build transcript from student data
const tx = reqit.transcript({
  courses: [
    { subject: 'MATH', number: '151', grade: 'A', credits: 4, term: 'Fall 2023' },
    { subject: 'CMPS', number: '130', grade: 'B+', credits: 3, term: 'Fall 2023' },
    { subject: 'CMPS', number: '230', grade: 'B', credits: 3, term: 'Spring 2024' },
  ],
});

// 4. Run audit
const result = req.audit(catalog, tx);

// 5. Use the results
console.log(`Status: ${result.status}`);              // 'in-progress'
console.log(`Progress: ${result.summary.met}/${result.summary.total}`);

// What's still needed?
for (const item of result.findUnmet()) {
  console.log(`Need: ${item.node.subject} ${item.node.number}`);
}
// → Need: MATH 152
// → Need: CMPS 310

// What can the student take next?
for (const course of result.findNextEligible(catalog, tx)) {
  console.log(`Eligible: ${course.subject} ${course.number} - ${course.title}`);
}
// → Eligible: MATH 152 - Calculus II
// → Eligible: CMPS 310 - Algorithms

// 6. Render for display
console.log(result.toOutline(catalog));
```

---

## What's Next

- **[Data Types Reference](data-types.md)** — every field on every object, with types and defaults
- **[HTML Reference](html-reference.md)** — all CSS classes, DOM structure, and starter stylesheet
- **[Database Integration Guide](database-guide.md)** — schema design, loading patterns, and storing audit results
- **[Language Guide](../language-guide/)** — full reference for the reqit requirement language
