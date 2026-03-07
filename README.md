# reqit SDK

**reqit** is a toolkit for modeling, auditing, and rendering academic degree requirements. It provides a purpose-built language for expressing requirements (courses, credits, GPA thresholds, prerequisites, program references) and an engine that evaluates a student's transcript against those requirements to produce a structured audit result.

## What the SDK Does

The SDK is the core logic layer. Given a catalog (courses, programs, attributes, grade configuration) and a student transcript (completed courses, attainments, declared programs), it:

- **Parses** human-readable requirement text into a structured AST
- **Validates** requirement trees for structural correctness
- **Resolves** course filters against a catalog to preview which courses satisfy filter-based requirements
- **Audits** a transcript against one or more requirement trees, producing a four-state result (met, in-progress, partial-progress, not-met) with full detail at every node
- **Renders** audit results as HTML or text outlines, suitable for server-rendered web applications
- **Exports** requirement data as CSV/XLSX checklists, prerequisite matrices, and dependency matrices
- **Analyzes** prerequisite chains, transitive dependencies, and course impact across programs

It also handles the edge cases that make degree auditing hard: waivers and substitutions, cross-listed courses, GPA constraints scoped to specific requirement groups, overlap policies between programs, and shared requirements (clusters and shared variables) that appear across multiple programs.

## What the SDK Does Not Do

The SDK is deliberately stateless and has no opinions about:

- **Storage** — It doesn't read from or write to databases. You load catalog and transcript data from whatever source you use (PostgreSQL, a SIS API, flat files) and pass plain objects to the SDK. The [Database Integration Guide](sdk-guide/database-guide.md) shows patterns for this.
- **Authentication or authorization** — It doesn't know who the student is or who's allowed to view the audit.
- **UI framework** — It produces HTML strings and structured result objects. How you present them (server-rendered templates, a REST API, a CLI) is up to you.
- **Curriculum management** — It doesn't manage catalog versions, approval workflows, or program proposals. It evaluates requirements that already exist.

## Where It Fits

In a typical application, the SDK sits between your data layer and your presentation layer:

```
┌──────────────────┐
│  Student Info     │  ← Your database / SIS
│  System (SIS)     │
└────────┬─────────┘
         │  catalog data, transcript data
         ▼
┌──────────────────┐
│   reqit SDK       │  ← This library
│                   │
│  parse / audit /  │
│  resolve / render │
└────────┬─────────┘
         │  AuditResult, HTML, outlines, exports
         ▼
┌──────────────────┐
│  Your App         │  ← Express, CLI, API, etc.
│  (Web / API / CLI)│
└──────────────────┘
```

The SDK operates on plain JavaScript objects and returns plain objects or class instances with no external dependencies. You can use it in a web server, a CLI tool, a batch job, or a serverless function.

## Installation

```bash
npm install reqit
```

```javascript
const reqit = require('reqit');
```

## Quick Example

```javascript
const reqit = require('reqit');

// 1. Build a catalog from your institution's data
const catalog = reqit.catalog({
  ay: '2025-2026',
  courses: [
    { subject: 'CMPS', number: '147', title: 'Intro to CS I', creditsMin: 3, creditsMax: 3 },
    { subject: 'CMPS', number: '148', title: 'Intro to CS II', creditsMin: 3, creditsMax: 3 },
    { subject: 'MATH', number: '151', title: 'Calculus I', creditsMin: 4, creditsMax: 4 },
  ],
});

// 2. Parse a requirement written in the reqit language
const req = reqit.parse(`
  "CS Foundation": all of (
    CMPS 147,
    CMPS 148,
    MATH 151
  )
`);

// 3. Build a transcript
const transcript = reqit.transcript({
  courses: [
    { subject: 'CMPS', number: '147', grade: 'A', credits: 3 },
    { subject: 'MATH', number: '151', grade: 'B+', credits: 4 },
  ],
});

// 4. Run the audit
const result = req.audit(catalog, transcript);

console.log(result.status);           // 'partial-progress'
console.log(result.summary.met);      // 2
console.log(result.summary.notMet);   // 1

// 5. See what's still needed
const unmet = result.findUnmet();
console.log(unmet[0].subject, unmet[0].number);  // 'CMPS' '148'

// 6. Render for display
console.log(result.toOutline(catalog));
// ◔ CS Foundation
//   ✓ CMPS 147 - Intro to CS I (A)
//   ✗ CMPS 148 - Intro to CS II
//   ✓ MATH 151 - Calculus I (B+)
```

## Documentation

### [The reqit Language Guide](language-guide/)

Start here if you're writing requirements. The language guide is aimed at registrars, advisors, and department chairs — anyone who defines what students need to graduate. It covers every construct in the language, from simple course references through complex multi-program overlap rules, with real-world examples throughout.

No programming knowledge required. The guide teaches the language through progressive examples, building from single courses to complete degree programs.

### [SDK Tutorial](sdk-guide/tutorial.md)

The developer tutorial. Walks through building a degree audit system step by step: constructing catalogs and transcripts, writing and parsing requirements, running audits, handling waivers and substitutions, multi-program audits with overlap policies, rendering results in web applications, and exporting data. Each section builds on the previous one with working code examples.

### [Data Types Reference](sdk-guide/data-types.md)

Field-by-field reference for every class and type in the SDK: Catalog, Course, Program, Attribute, Degree, Transcript, TranscriptCourse, DeclaredProgram, ReqitVariable, Waiver, Substitution, Requirement, ResolutionResult, AuditResult, MultiAuditResult, GradeConfig, and all enumerations.

### [HTML Class Reference](sdk-guide/html-reference.md)

Complete reference for the HTML output produced by `toHTML()`. Documents every CSS class, the DOM structure for each node type, audit-mode status classes, and includes a starter stylesheet.

### [Database Integration Guide](sdk-guide/database-guide.md)

Patterns for loading catalog and transcript data from PostgreSQL (or any relational database), storing requirements as DSL text vs. AST JSON, persisting audit results, and building batch audit pipelines.

## The reqit Language at a Glance

Requirements are written in a readable, domain-specific language:

```
# Variables break complex requirements into named pieces
$gen_ed = "General Education": all of (
  ENGL 101,
  at least 6 credits from (courses where attribute = "QR"),
  at least 1 of (courses where attribute = "WI")
)

$cs_core = "CS Core": all of (
  CMPS 147, CMPS 148, CMPS 231, CMPS 311, CMPS 361
) with gpa >= 2.0

$electives = "Electives": at least 4 of (
  courses where subject = "CMPS" and number >= 300
    except (CMPS 311, CMPS 361)
)

"B.S. Computer Science": all of (
  $gen_ed,
  $cs_core,
  $electives
) with gpa >= 2.0
```

The language supports course references, course filters (by subject, number, attribute, credits), credit requirements, grade and GPA constraints, counted requirements (at least/at most/exactly N of), exclusions, non-course requirements (scores, attainments), variables and scopes, program references with overlap policies, and prerequisites/corequisites. See the [Language Guide](language-guide/) for the full reference.

## License

ISC
