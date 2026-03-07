# Database Integration Guide

This guide explains how to design an application that uses the reqit SDK with persistent storage. It covers schema design, loading data into SDK objects, and common patterns for building a degree audit web application.

## Schema Design

### Catalog Tables

The catalog represents what your institution offers. Store it in normalized tables:

```sql
-- Courses
CREATE TABLE courses (
  id SERIAL PRIMARY KEY,
  institution_id INTEGER NOT NULL REFERENCES institutions(id),
  ay VARCHAR(20) NOT NULL,           -- e.g. '2025-2026'
  subject VARCHAR(10) NOT NULL,
  number VARCHAR(10) NOT NULL,
  title TEXT,
  credits_min NUMERIC(4,1),
  credits_max NUMERIC(4,1),
  cross_list_group VARCHAR(50),
  prerequisites TEXT,                -- reqit DSL text or JSON AST
  corequisites TEXT,                 -- reqit DSL text or JSON AST
  UNIQUE(institution_id, ay, subject, number)
);

-- Course attributes (many-to-many)
CREATE TABLE course_attributes (
  course_id INTEGER NOT NULL REFERENCES courses(id),
  attribute_code VARCHAR(20) NOT NULL,
  PRIMARY KEY (course_id, attribute_code)
);

-- Attribute definitions
CREATE TABLE attributes (
  id SERIAL PRIMARY KEY,
  institution_id INTEGER NOT NULL REFERENCES institutions(id),
  ay VARCHAR(20) NOT NULL,
  code VARCHAR(20) NOT NULL,
  name TEXT,
  UNIQUE(institution_id, ay, code)
);

-- Programs (majors, minors, certificates)
CREATE TABLE programs (
  id SERIAL PRIMARY KEY,
  institution_id INTEGER NOT NULL REFERENCES institutions(id),
  ay VARCHAR(20) NOT NULL,
  code VARCHAR(50) NOT NULL,
  name TEXT,
  type VARCHAR(20) NOT NULL,         -- major, minor, certificate, etc.
  level VARCHAR(20) NOT NULL,        -- undergraduate, graduate, etc.
  UNIQUE(institution_id, ay, code)
);

-- Program requirements stored as reqit DSL text
CREATE TABLE program_requirements (
  program_id INTEGER NOT NULL REFERENCES programs(id) PRIMARY KEY,
  requirement_text TEXT NOT NULL      -- reqit DSL source text
);

-- Degrees (B.S., B.A., etc.)
CREATE TABLE degrees (
  id SERIAL PRIMARY KEY,
  institution_id INTEGER NOT NULL REFERENCES institutions(id),
  ay VARCHAR(20) NOT NULL,
  code VARCHAR(20) NOT NULL,
  name TEXT,
  type VARCHAR(20) NOT NULL,
  level VARCHAR(20) NOT NULL,
  UNIQUE(institution_id, ay, code)
);
```

### Transcript Tables

```sql
-- Student transcript courses
CREATE TABLE student_courses (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(id),
  subject VARCHAR(10) NOT NULL,
  number VARCHAR(10) NOT NULL,
  grade VARCHAR(5),
  credits NUMERIC(4,1),
  term VARCHAR(30),
  status VARCHAR(20) DEFAULT 'completed',  -- 'completed' or 'in-progress'
  UNIQUE(student_id, subject, number, term)
);

-- Student attainments (test scores, milestones)
CREATE TABLE student_attainments (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(id),
  code VARCHAR(50) NOT NULL,
  value TEXT NOT NULL,                -- number or boolean stored as text
  UNIQUE(student_id, code)
);

-- Student declared programs
CREATE TABLE student_programs (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(id),
  program_code VARCHAR(50) NOT NULL,
  type VARCHAR(20) NOT NULL,
  level VARCHAR(20) NOT NULL,
  role VARCHAR(20),                   -- 'primary' or null
  UNIQUE(student_id, program_code)
);
```

### Exception Tables

```sql
-- Waivers
CREATE TABLE waivers (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(id),
  target_type VARCHAR(20) NOT NULL,   -- 'course', 'score', 'attainment', 'quantity', 'label'
  target_value JSONB NOT NULL,        -- e.g. {"subject":"CMPS","number":"310"} or "SAT-MATH"
  reason TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Substitutions
CREATE TABLE substitutions (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(id),
  original_subject VARCHAR(10) NOT NULL,
  original_number VARCHAR(10) NOT NULL,
  replacement_subject VARCHAR(10) NOT NULL,
  replacement_number VARCHAR(10) NOT NULL,
  reason TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Requirement Storage

You have two options for storing requirements:

**Option A: reqit DSL text (recommended)**

Store the human-readable reqit source. Parse at load time.

```sql
requirement_text TEXT NOT NULL  -- 'all of (MATH 151, CMPS 130) with grade >= "C"'
```

Advantages: human-readable, diffable, version-control friendly, compact.

**Option B: Serialized AST (JSON)**

Store the parsed AST as JSON.

```sql
requirement_ast JSONB NOT NULL  -- { "type": "all-of", "items": [...] }
```

Advantages: no parse step at load time, can query AST structure via JSONB operators.

Recommendation: Store DSL text as the source of truth. Cache parsed ASTs if parse time matters for your workload. A typical parse takes under 1ms.

---

## Loading Data into SDK Objects

### Building a Catalog from Database Rows

```javascript
const reqit = require('reqit');

async function loadCatalog(db, institutionId, ay) {
  // Load courses with their attributes
  const courseRows = await db.query(`
    SELECT c.id, c.subject, c.number, c.title,
           c.credits_min, c.credits_max, c.cross_list_group,
           c.prerequisites, c.corequisites,
           array_agg(ca.attribute_code) FILTER (WHERE ca.attribute_code IS NOT NULL) AS attributes
    FROM courses c
    LEFT JOIN course_attributes ca ON ca.course_id = c.id
    WHERE c.institution_id = $1 AND c.ay = $2
    GROUP BY c.id
  `, [institutionId, ay]);

  const courses = courseRows.map(row => ({
    id: row.id,
    subject: row.subject,
    number: row.number,
    title: row.title,
    creditsMin: row.credits_min,
    creditsMax: row.credits_max,
    crossListGroup: row.cross_list_group || undefined,
    attributes: row.attributes || [],
    // String prerequisites are auto-parsed by the Course constructor
    prerequisites: row.prerequisites || null,
    corequisites: row.corequisites || null,
  }));

  // Load programs, attributes, degrees in parallel
  const [programRows, attributeRows, degreeRows] = await Promise.all([
    db.query('SELECT * FROM programs WHERE institution_id = $1 AND ay = $2', [institutionId, ay]),
    db.query('SELECT * FROM attributes WHERE institution_id = $1 AND ay = $2', [institutionId, ay]),
    db.query('SELECT * FROM degrees WHERE institution_id = $1 AND ay = $2', [institutionId, ay]),
  ]);

  return reqit.catalog({
    institution: institutionId,
    ay,
    courses,
    programs: programRows.map(r => ({
      id: r.id, code: r.code, name: r.name, type: r.type, level: r.level,
    })),
    attributes: attributeRows.map(r => ({
      code: r.code, name: r.name,
    })),
    degrees: degreeRows.map(r => ({
      code: r.code, name: r.name, type: r.type, level: r.level,
    })),
  });
}
```

### Attaching Program Requirements

Load requirement text and attach via `withPrograms()`:

```javascript
async function loadCatalogWithRequirements(db, institutionId, ay) {
  const catalog = await loadCatalog(db, institutionId, ay);

  const reqRows = await db.query(`
    SELECT p.code, pr.requirement_text
    FROM program_requirements pr
    JOIN programs p ON p.id = pr.program_id
    WHERE p.institution_id = $1 AND p.ay = $2
  `, [institutionId, ay]);

  const programMap = {};
  for (const row of reqRows) {
    programMap[row.code] = reqit.parse(row.requirement_text);
  }

  return catalog.withPrograms(programMap);
}
```

### Building a Transcript from Student Records

```javascript
async function loadTranscript(db, studentId) {
  const [courseRows, attainmentRows, programRows, waiverRows, subRows] = await Promise.all([
    db.query('SELECT * FROM student_courses WHERE student_id = $1 ORDER BY term', [studentId]),
    db.query('SELECT * FROM student_attainments WHERE student_id = $1', [studentId]),
    db.query('SELECT * FROM student_programs WHERE student_id = $1', [studentId]),
    db.query('SELECT * FROM waivers WHERE student_id = $1', [studentId]),
    db.query('SELECT * FROM substitutions WHERE student_id = $1', [studentId]),
  ]);

  // Build attainments object
  const attainments = {};
  for (const row of attainmentRows) {
    attainments[row.code] = isNaN(row.value) ? (row.value === 'true') : Number(row.value);
  }

  // Build waivers
  const waivers = waiverRows.map(row => {
    const target = JSON.parse(row.target_value);
    const opts = { id: String(row.id), reason: row.reason };
    if (row.metadata) opts.metadata = row.metadata;

    switch (row.target_type) {
      case 'course': return reqit.waiver({ ...opts, course: target });
      case 'score': return reqit.waiver({ ...opts, score: target });
      case 'attainment': return reqit.waiver({ ...opts, attainment: target });
      case 'quantity': return reqit.waiver({ ...opts, quantity: target });
      case 'label': return reqit.waiver({ ...opts, label: target });
    }
  }).filter(Boolean);

  // Build substitutions
  const substitutions = subRows.map(row => reqit.substitution({
    id: String(row.id),
    original: { subject: row.original_subject, number: row.original_number },
    replacement: { subject: row.replacement_subject, number: row.replacement_number },
    reason: row.reason,
    metadata: row.metadata || undefined,
  }));

  return reqit.transcript({
    courses: courseRows.map(r => ({
      id: r.id,
      subject: r.subject,
      number: r.number,
      grade: r.grade,
      credits: r.credits,
      term: r.term,
      status: r.status,
    })),
    attainments,
    declaredPrograms: programRows.map(r => ({
      code: r.program_code,
      type: r.type,
      level: r.level,
      role: r.role || undefined,
    })),
    waivers,
    substitutions,
  });
}
```

### Managing `id` Fields

SDK entities accept an `id` field that is passed through unchanged. Use this to round-trip your database primary keys:

```javascript
// When loading: set id from your database PK
const course = { id: row.id, subject: row.subject, number: row.number, ... };

// After audit: the id is preserved on entity instances
const c = catalog.findCourse('MATH', '151');
console.log(c.id); // → your database PK

// When saving audit results: reference entities by their id
result.walk((node) => {
  if (node.type === 'course' && node.satisfiedBy) {
    // node.satisfiedBy has the transcript course data including its id
    saveAuditCourseMatch(node, node.satisfiedBy.id);
  }
});
```

---

## Storing Audit Results

### Re-compute vs. Persist

**Re-compute on demand (recommended for most cases):**

Audits are fast (typically < 10ms for a full program). Re-computing ensures results are always current with the latest catalog, transcript, and exceptions.

```javascript
// No audit storage needed — just compute when the user requests it
app.get('/audit/:studentId/:programCode', async (req, res) => {
  const catalog = await loadCatalogWithRequirements(db, institutionId, ay);
  const transcript = await loadTranscript(db, req.params.studentId);
  const requirement = catalog.findProgram(req.params.programCode).requirements;
  const result = reqit.fromAST(requirement).audit(catalog, transcript);
  res.render('audit', { result, catalog });
});
```

**Persist for batch reporting:**

When you need audit results across many students (e.g., graduation clearance, institutional reports), store computed results:

```sql
CREATE TABLE audit_snapshots (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL,
  program_code VARCHAR(50) NOT NULL,
  ay VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL,
  summary JSONB NOT NULL,
  computed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(student_id, program_code, ay)
);
```

```javascript
async function batchAudit(db, institutionId, ay) {
  const catalog = await loadCatalogWithRequirements(db, institutionId, ay);
  const students = await db.query('SELECT id FROM students WHERE active = true');

  for (const student of students) {
    const transcript = await loadTranscript(db, student.id);
    for (const dp of transcript.declaredPrograms) {
      const program = catalog.findProgram(dp.code);
      if (!program || !program.requirements) continue;

      const result = reqit.fromAST(program.requirements).audit(catalog, transcript);
      await db.query(`
        INSERT INTO audit_snapshots (student_id, program_code, ay, status, summary)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (student_id, program_code, ay)
        DO UPDATE SET status = $4, summary = $5, computed_at = now()
      `, [student.id, dp.code, ay, result.status, JSON.stringify(result.summary)]);
    }
  }
}
```

---

## Patterns

### What-If Scenarios

The SDK's immutable design makes what-if analysis easy. Modify a transcript without touching the database:

```javascript
// What if the student takes CMPS 310 next semester?
const whatIf = transcript.addCourse({
  subject: 'CMPS', number: '310', credits: 3, status: 'in-progress',
});
const whatIfResult = requirement.audit(catalog, whatIf);
// transcript is unchanged — whatIf is a separate instance
```

### Comparing Potential Majors

```javascript
async function compareMajors(catalog, transcript, programCodes) {
  const results = {};
  for (const code of programCodes) {
    const program = catalog.findProgram(code);
    if (!program || !program.requirements) continue;
    const result = reqit.fromAST(program.requirements).audit(catalog, transcript);
    results[code] = {
      status: result.status,
      summary: result.summary,
      unmet: result.findUnmet().length,
    };
  }
  return results;
}
```

### Catalog Version Management

Each academic year gets its own catalog. Store them independently:

```javascript
// Load a specific year's catalog
const catalog2025 = await loadCatalog(db, institutionId, '2025-2026');
const catalog2026 = await loadCatalog(db, institutionId, '2026-2027');

// Students are audited against their catalog year
const studentAY = student.catalog_year; // e.g. '2025-2026'
const catalog = await loadCatalog(db, institutionId, studentAY);
```

---

## Complete Example

An Express route that loads data from a database, runs an audit, and renders the result:

```javascript
const reqit = require('reqit');

app.get('/students/:id/audit/:program', async (req, res) => {
  try {
    const studentId = req.params.id;
    const programCode = req.params.program;

    // Load student's catalog year
    const student = await db.query('SELECT catalog_ay FROM students WHERE id = $1', [studentId]);
    const ay = student.rows[0].catalog_ay;

    // Load catalog and transcript in parallel
    const [catalog, transcript] = await Promise.all([
      loadCatalogWithRequirements(db, req.institutionId, ay),
      loadTranscript(db, studentId),
    ]);

    // Find the program and its requirements
    const program = catalog.findProgram(programCode);
    if (!program || !program.requirements) {
      return res.status(404).render('error', { message: 'Program not found or has no requirements' });
    }

    // Run the audit
    const requirement = reqit.fromAST(program.requirements);
    const result = requirement.audit(catalog, transcript);

    // Render
    res.render('audit', {
      student: studentId,
      program,
      status: result.status,
      summary: result.summary,
      auditHtml: result.toHTML(catalog, { classPrefix: 'audit-', wrapperTag: 'div' }),
      unmet: result.findUnmet(),
      eligible: result.findNextEligible(catalog, transcript),
      gpa: reqit.calculateGPA(transcript, catalog),
    });
  } catch (err) {
    console.error('Audit error:', err);
    res.status(500).render('error', { message: 'Failed to generate audit' });
  }
});
```
