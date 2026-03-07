# reqit SDK Tutorial

This tutorial walks you through building a degree audit system with the reqit SDK. By the end, you'll know how to define catalogs, write requirements, audit student transcripts, and display results in a web application.

**Prerequisites:** You should be comfortable with Node.js and understand the basics of academic degree requirements (courses, credits, prerequisites, majors/minors).

## Installation

```bash
npm install reqit
```

```javascript
const reqit = require('reqit');
```

---

## 1. Building a Catalog

A catalog represents everything your institution offers in a given academic year — courses, programs, attributes, and grade configuration. You'll typically build this from your Student Information System (SIS) data.

### Courses

Start with courses. Every course needs a `subject` and `number` at minimum:

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
      prerequisites: reqit.parse('MATH 151').ast,
    },
    {
      subject: 'CMPS', number: '130', title: 'Intro to Programming',
      creditsMin: 3, creditsMax: 3,
    },
    {
      subject: 'CMPS', number: '230', title: 'Data Structures',
      creditsMin: 3, creditsMax: 3,
      prerequisites: reqit.parse('CMPS 130').ast,
    },
    {
      subject: 'CMPS', number: '310', title: 'Algorithms',
      creditsMin: 3, creditsMax: 3,
      attributes: ['WI'],
      prerequisites: reqit.parse('CMPS 230').ast,
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

A few things to note:

- **Prerequisites** are reqit ASTs. The easiest way is `reqit.parse('CMPS 130').ast`. If your SIS stores prerequisites as structured data, you can build the AST objects directly.
- **Attributes** are opaque string codes. Define them in `attributes` for human-readable names, and reference them in `course.attributes` arrays.
- **Credits** use `creditsMin` / `creditsMax` for variable-credit courses. For fixed-credit courses, set both to the same value.

### Looking Things Up

The catalog provides efficient lookup methods:

```javascript
const calc = catalog.findCourse('MATH', '151');
// → { subject: 'MATH', number: '151', title: 'Calculus I', ... }

const csCourses = catalog.findCourses({ subject: 'CMPS' });
// → all CMPS courses

const wiCourses = catalog.findCourses({ attribute: 'WI' });
// → courses with the Writing Intensive attribute

const subjects = catalog.getSubjects();
// → ['CMPS', 'ENGL', 'MATH']
```

---

## 2. Writing Requirements

Requirements are written in the reqit language — a human-readable DSL that's close to how registrars think about degree requirements.

### Basic Requirements

```javascript
// A single course
const req1 = reqit.parse('MATH 151');

// All of these courses
const req2 = reqit.parse('all of (MATH 151, MATH 152, CMPS 130)');

// Any one of these courses
const req3 = reqit.parse('any of (ENGL 101, ENGL 102, ENGL 105)');

// At least 2 of these courses
const req4 = reqit.parse('at least 2 of (CMPS 310, CMPS 320, CMPS 350, CMPS 360)');
```

### Course Filters

Instead of listing every course, you can use filters:

```javascript
// Any course in the CMPS department numbered 300+
const electives = reqit.parse(`
  at least 3 of (
    courses where subject = "CMPS" and number >= 300
  )
`);

// Courses with a specific attribute
const genEd = reqit.parse(`
  at least 6 credits from (
    courses where attribute = "QR"
  )
`);
```

### Credit Requirements

```javascript
// At least 12 credits from a pool of courses
const credits = reqit.parse(`
  at least 12 credits from (
    CMPS 310, CMPS 320, CMPS 350, CMPS 360, CMPS 380,
    courses where subject = "CMPS" and number >= 400
  )
`);
```

### Grade Constraints

```javascript
// All courses with a minimum grade
const withGrade = reqit.parse(`
  all of (MATH 151, MATH 152, CMPS 130) with grade >= "C"
`);

// GPA requirement on a group
const withGPA = reqit.parse(`
  all of (MATH 151, MATH 152, MATH 250) with gpa >= 2.5
`);
```

### Non-Course Requirements

```javascript
// Test scores
const sat = reqit.parse('score SAT_MATH >= 580');

// Milestones
const standing = reqit.parse('attainment JUNIOR_STANDING');
```

### Variables and Structure

For complex programs, use variables to name reusable groups:

```javascript
const csMajor = reqit.parse(`
  $core = all of (
    CMPS 130,
    CMPS 230,
    CMPS 310
  ) with grade >= "C"

  $math = all of (
    MATH 151,
    MATH 152
  )

  $electives = at least 9 credits from (
    courses where subject = "CMPS" and number >= 300
  ) except (CMPS 310)

  all of ($core, $math, $electives)
`);
```

### Rendering Requirements

Once parsed, you can render requirements in several formats:

```javascript
// Indented text outline (great for CLI tools)
console.log(csMajor.toOutline(catalog));
// All of the following:
// ├── Core — All of the following (min grade: C):
// │   ├── CMPS 130 - Intro to Programming
// │   ├── CMPS 230 - Data Structures
// │   └── CMPS 310 - Algorithms
// ├── Math — All of the following:
// │   ├── MATH 151 - Calculus I
// │   └── MATH 152 - Calculus II
// └── Electives — At least 9 credits from: ...

// HTML for web display (see html-reference.md for CSS classes)
const html = csMajor.toHTML(catalog);

// Human-readable paragraph
console.log(csMajor.description);

// Round-trip back to reqit source
console.log(csMajor.text);
```

---

## 3. Building a Transcript

A transcript represents a student's academic record. Create it with course entries and any attainments, program declarations, or exceptions.

```javascript
const transcript = reqit.transcript({
  courses: [
    { subject: 'MATH', number: '151', grade: 'A', credits: 4, term: 'Fall 2023' },
    { subject: 'MATH', number: '152', grade: 'B+', credits: 4, term: 'Spring 2024' },
    { subject: 'CMPS', number: '130', grade: 'A-', credits: 3, term: 'Fall 2023' },
    { subject: 'CMPS', number: '230', grade: 'B', credits: 3, term: 'Spring 2024' },
    { subject: 'CMPS', number: '310', grade: 'B+', credits: 3, term: 'Fall 2024' },
    { subject: 'ENGL', number: '101', grade: 'A', credits: 3, term: 'Fall 2023' },
    // A course currently in progress
    { subject: 'CMPS', number: '350', credits: 3, term: 'Spring 2025', status: 'in-progress' },
  ],
  attainments: {
    'SAT-MATH': 650,
  },
  declaredPrograms: [
    { code: 'CMPS', type: 'major', level: 'undergraduate', role: 'primary' },
  ],
});
```

### Modifying Transcripts

Transcripts are immutable — every mutation returns a new Transcript:

```javascript
// Add a course
const updated = transcript.addCourse({
  subject: 'CMPS', number: '380', grade: 'A', credits: 3, term: 'Spring 2025',
});

// Remove a course
const removed = transcript.removeCourse('CMPS', '380');

// Add an attainment
const withAttainment = transcript.addAttainment('JUNIOR_STANDING', true);

// These operations are chainable
const modified = transcript
  .addCourse({ subject: 'CMPS', number: '320', grade: 'B', credits: 3, term: 'Spring 2025' })
  .addAttainment('JUNIOR_STANDING', true);
```

---

## 4. Running an Audit

An audit evaluates a requirement tree against a student's transcript and tells you what's met, what's not, and what's in progress.

```javascript
const result = csMajor.audit(catalog, transcript);

console.log(result.status);
// → 'partial-progress' (some met, some not)

console.log(result.summary);
// → { met: 2, total: 3, ... }  (how many top-level children are met)
```

### Understanding the Result

The audit result is a tree that mirrors the requirement structure, with a `status` on every node:

```javascript
// Walk the entire result tree
result.walk((node, path, parent, depth) => {
  const indent = '  '.repeat(depth);
  if (node.type === 'course') {
    const icon = node.status === 'met' ? '✓' : node.status === 'in-progress' ? '◑' : '✗';
    console.log(`${indent}${icon} ${node.subject} ${node.number}`);
  }
});
```

### Finding What's Missing

```javascript
// Get unmet leaf requirements
const unmet = result.findUnmet();
for (const node of unmet) {
  if (node.type === 'course') {
    console.log(`Still need: ${node.subject} ${node.number}`);
  }
}

// Get courses the student could take next (prerequisites already met)
const eligible = result.findNextEligible(catalog, transcript);
for (const course of eligible) {
  console.log(`Can take: ${course.subject} ${course.number} - ${course.title}`);
}
```

### Displaying the Audit

```javascript
// Text outline with status icons and grades
console.log(result.toOutline(catalog));
// ◑ All of the following: (2/3 met)
// ├── ✓ Core (3/3 met)
// │   ├── ✓ CMPS 130 - Intro to Programming  [A-, Fall 2023]
// │   ├── ✓ CMPS 230 - Data Structures  [B, Spring 2024]
// │   └── ✓ CMPS 310 - Algorithms  [B+, Fall 2024]
// ├── ✓ Math (2/2 met)
// │   ├── ✓ MATH 151 - Calculus I  [A, Fall 2023]
// │   └── ✓ MATH 152 - Calculus II  [B+, Spring 2024]
// └── ✗ Electives (3/9 credits)
//     └── ◑ CMPS 350 - Machine Learning  (in progress)

// HTML with status CSS classes
const auditHtml = result.toHTML(catalog, { wrapperTag: 'div' });
```

### Customizing the Outline

```javascript
// Custom status icons (e.g. for a web terminal with emoji)
result.toOutline(catalog, {
  icons: {
    'met': '[PASS]',
    'not-met': '[NEED]',
    'in-progress': '[WIP]',
    'partial-progress': '[PART]',
  },
});

// Hide grades and summary counts
result.toOutline(catalog, {
  showGrades: false,
  showSummary: false,
});
```

---

## 5. Waivers and Substitutions

Students sometimes get exceptions — a course is waived due to transfer credit, or one course is accepted in place of another.

### Waivers

A waiver exempts a specific requirement from evaluation:

```javascript
// Waive a specific course
const waiver = reqit.waiver({
  id: 'w-001',
  course: { subject: 'CMPS', number: '310' },
  reason: 'Transfer credit from partner institution',
});

// Add it to the transcript
const txWithWaiver = transcript.addWaiver(waiver);

// Now audit — CMPS 310 shows as 'waived' instead of checking the transcript
const result = csMajor.audit(catalog, txWithWaiver);
```

You can waive other requirement types too:

```javascript
// Waive a test score requirement
reqit.waiver({ score: 'SAT-MATH', reason: 'Exempt by policy' });

// Waive an entire named group (e.g. "Math Core")
reqit.waiver({ label: 'Math Core', reason: 'AP credit covers all math' });
```

### Substitutions

A substitution maps a required course to a different course the student took:

```javascript
const sub = reqit.substitution({
  id: 's-001',
  original: { subject: 'MATH', number: '250' },
  replacement: { subject: 'MATH', number: '241' },
  reason: 'Department approved equivalent',
});

const txWithSub = transcript.addSubstitution(sub);
```

During audit, if the student has MATH 241 on their transcript, it will satisfy the MATH 250 requirement and show as `'substituted'`.

### Removing Exceptions

```javascript
// Remove by ID
const cleaned = txWithWaiver.removeWaiver('w-001');

// Or remove by target
const cleaned2 = txWithWaiver.removeWaiver({ subject: 'CMPS', number: '310' });

// Same for substitutions
const cleaned3 = txWithSub.removeSubstitution('s-001');
```

### Tracking What Was Used

After an audit with exceptions, you can see which were applied:

```javascript
const result = req.audit(catalog, txWithWaiver);
if (result.exceptions) {
  console.log('Applied:', result.exceptions.applied);
  console.log('Unused:', result.exceptions.unused);
}
```

---

## 6. Resolving Filters

Before auditing, you might want to see which courses a requirement's filters actually match. This is useful for advising — showing students their options.

```javascript
const electives = reqit.parse(`
  at least 9 credits from (
    courses where subject = "CMPS" and number >= 300
  )
`);

const resolved = electives.resolve(catalog);

console.log('Matching courses:');
for (const course of resolved.allCourses()) {
  console.log(`  ${course.subject} ${course.number} - ${course.title}`);
}
// → CMPS 310 - Algorithms
// → CMPS 320 - Operating Systems
// → CMPS 350 - Machine Learning
// → ...

// Which filters matched a specific course?
const matchedFilters = resolved.filtersForCourse('CMPS', '310');
console.log(`CMPS 310 matched ${matchedFilters.length} filter(s)`);
```

---

## 7. Multi-Program Audits

Real students have multiple requirement trees — a major, general education, maybe a minor. The multi-tree audit handles shared course assignment and overlap rules.

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

// Each tree gets its own AuditResult
console.log(multi.trees['CMPS'].status);    // 'partial-progress'
console.log(multi.trees['GEN-ED'].status);  // 'met'

// See which courses were assigned to which program
console.log(multi.courseAssignments);
```

### Overlap Rules

You can limit how many courses count toward both programs:

```javascript
const overlap = reqit.parse(`
  overlap between program CMPS major undergraduate
    and program GEN-ED major undergraduate
    at most 2 courses
`);
```

---

## 8. Displaying Audits in a Web App

Here's a practical pattern for a server-rendered web application using Express and Pug.

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
      classPrefix: 'audit-',
      wrapperTag: 'div',
    }),
    unmet: result.findUnmet(),
    eligible: result.findNextEligible(catalog, transcript),
  });
});
```

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
      if item.type === 'course'
        li #{item.subject} #{item.number}

if eligible.length > 0
  h3 Can Take Next
  ul
    each course in eligible
      li #{course.subject} #{course.number} - #{course.title}
```

### Styling

Use the classes from `toHTML()` in your stylesheet. See the [HTML Reference](html-reference.md) for the full class list and starter CSS.

```css
/* With classPrefix: 'audit-' */
.audit-status-met { border-left: 3px solid #16a34a; padding-left: 0.5em; }
.audit-status-not-met { border-left: 3px solid #dc2626; padding-left: 0.5em; }
.audit-course { display: block; padding: 0.25em 0; }
.audit-grade { font-weight: bold; color: #166534; }
```

---

## 9. Building a Custom Renderer with walk()

The built-in `toHTML()` and `toOutline()` renderers cover most cases. When you need something completely custom — React components, JSON for a mobile API, a PDF report — use `walk()`.

### Flat Course Status List

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

```javascript
function auditToJSON(result, catalog) {
  const sections = [];
  result.walk((node, path, parent, depth) => {
    // Only capture top-level groups (depth 1 = direct children of root)
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

### Server-Rendered HTML with Pug

Instead of using `toHTML()`, render the audit tree directly in Pug for full layout control:

```javascript
// In your route
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

## 10. Catalog Analysis

The catalog provides tools for curriculum planning and impact analysis.

### Prerequisite Graph

```javascript
const graph = catalog.prereqGraph();

// What does CMPS 310 require?
const prereqs = graph.directPrereqs('CMPS:310');
// → Set { 'CMPS:230' }

// All transitive prerequisites (everything a student needs first)
const allPrereqs = graph.transitivePrereqs('CMPS:310');
// → Set { 'CMPS:230', 'CMPS:130' }

// What courses depend on CMPS 230?
const dependents = graph.dependents('CMPS:230');
// → Set { 'CMPS:310', 'CMPS:320', 'CMPS:350', ... }
```

### Impact Analysis

Before retiring or modifying a course, check the impact:

```javascript
const impact = catalog.courseImpact('CMPS', '230');
console.log('Courses affected:', impact.dependentCourses);
// → ['CMPS:310', 'CMPS:320', 'CMPS:350', ...]
console.log('Programs affected:', impact.programs);
// → [{ code: 'CMPS', context: 'required' }]
```

### GPA Calculation

```javascript
const gpa = reqit.calculateGPA(transcript, catalog);
console.log(`GPA: ${gpa.toFixed(2)}`);
```

---

## 11. Exporting Data

The SDK can export requirement and audit data as spreadsheet-ready objects (CSV or XLSX).

```javascript
// Prerequisite matrix — which courses require which
const prereqData = reqit.exportPrereqMatrix(catalog, { format: 'csv' });

// Program requirements checklist
const checklist = csMajor.exportChecklist(catalog, { format: 'xlsx' });

// Audit result spreadsheet
const auditExport = result.export(catalog, { format: 'csv' });
```

---

## 12. Annotations for Shared Courses

When a course satisfies requirements in multiple programs, you can annotate it in the rendered output:

```javascript
// Build an annotations map showing which courses are shared
const annotations = new Map();
const csResult = multi.trees['CMPS'];
const genEdResult = multi.trees['GEN-ED'];

// Find courses that appear in both audit results
csResult.walk((node) => {
  if (node.type === 'course' && node.status === 'met') {
    const key = `${node.subject}:${node.number}`;
    // Check if this course also appears met in gen-ed
    genEdResult.walk((genNode) => {
      if (genNode.type === 'course' && genNode.status === 'met' &&
          genNode.subject === node.subject && genNode.number === node.number) {
        annotations.set(key, ['shared with Gen-Ed']);
      }
    });
  }
});

// Render with annotations
const html = csResult.toHTML(catalog, { annotations });
// Shared courses get: <span class="reqit-annotation">(shared with Gen-Ed)</span>
```

---

## 13. Putting It All Together

Here's a complete, minimal example of a degree audit flow:

```javascript
const reqit = require('reqit');

// 1. Build catalog from your data
const catalog = reqit.catalog({
  ay: '2025-2026',
  courses: [
    { subject: 'MATH', number: '151', title: 'Calculus I', creditsMin: 4, creditsMax: 4 },
    { subject: 'MATH', number: '152', title: 'Calculus II', creditsMin: 4, creditsMax: 4,
      prerequisites: reqit.parse('MATH 151').ast },
    { subject: 'CMPS', number: '130', title: 'Intro to Programming', creditsMin: 3, creditsMax: 3 },
    { subject: 'CMPS', number: '230', title: 'Data Structures', creditsMin: 3, creditsMax: 3,
      prerequisites: reqit.parse('CMPS 130').ast },
    { subject: 'CMPS', number: '310', title: 'Algorithms', creditsMin: 3, creditsMax: 3,
      prerequisites: reqit.parse('CMPS 230').ast },
  ],
});

// 2. Define requirements
const req = reqit.parse(`
  $math = all of (MATH 151, MATH 152)
  $core = all of (CMPS 130, CMPS 230, CMPS 310) with grade >= "C"
  all of ($math, $core)
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
console.log(`Status: ${result.status}`);              // 'partial-progress'
console.log(`Progress: ${result.summary.met}/${result.summary.total}`);

// What's still needed?
for (const node of result.findUnmet()) {
  console.log(`Need: ${node.subject} ${node.number}`);
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

- [Data Types Reference](data-types.md) — every field on every object, with types and defaults
- [HTML Reference](html-reference.md) — all CSS classes, DOM structure, and starter stylesheet
