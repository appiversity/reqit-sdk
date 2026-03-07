# Database Integration Guide

The reqit SDK is deliberately stateless — it operates on plain JavaScript objects and returns plain objects. It doesn't read from or write to databases. This guide bridges that gap: it shows how to design a relational schema that stores the data the SDK needs, how to load that data into SDK objects, and how to build common patterns like on-demand audits, batch reporting, and what-if scenarios.

The examples use PostgreSQL syntax, but the patterns apply to any relational database.

## Schema Design

A degree audit system has three kinds of data:

1. **Catalog data** — what the institution offers: courses, programs, degrees, attributes.
2. **Transcript data** — what the student has done: completed courses, declared programs, test scores.
3. **Exception data** — per-student overrides: waivers and substitutions.

Each of these maps to a set of tables. We'll walk through them in order, explaining the relationships as we go.

### The Academic Year Column

Before looking at individual tables, notice that nearly every catalog table includes an `ay` (academic year) column:

```sql
ay VARCHAR(20) NOT NULL  -- e.g. '2025-2026'
```

This is not incidental — it's the most important design decision in the schema. A catalog is not a single static thing; it changes every year. Courses are added and removed, credit values change, prerequisites are updated, program requirements are revised. The `ay` column on every catalog table means you store each year's catalog independently, as a complete snapshot.

This matters because students don't all follow the same catalog. A student who entered in 2023 may be following the 2023–2024 requirements, even though the institution is now publishing the 2026–2027 catalog. When you audit that student, you need to load the catalog from *their* entry year, not the current year.

The SDK supports this naturally — `reqit.catalog()` accepts an `ay` field, and all queries and audits operate against whichever catalog you pass in. Your database schema just needs to store multiple years side by side, and your application logic needs to know which year to load for each student. We'll revisit this in the [Catalog Year and Rollover](#catalog-year-and-rollover) section below.

### Catalog Tables

#### Courses

Courses are the foundation of the catalog. Every requirement ultimately resolves to courses (or groups of courses), so this is the table you'll query most often.

```sql
CREATE TABLE courses (
  id SERIAL PRIMARY KEY,
  institution_id INTEGER NOT NULL REFERENCES institutions(id),
  ay VARCHAR(20) NOT NULL,
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
```

A few things to note:

- **`credits_min` and `credits_max`** are separate columns because some courses have variable credit (e.g., 1–3 credits for independent study). If a course always has 3 credits, both columns hold `3`.
- **`cross_list_group`** links courses that are equivalent across departments (e.g., CMPS 364 and DATA 364). The SDK uses this during audit to treat cross-listed courses as interchangeable. Any string works as a group identifier — just make sure all cross-listed courses share the same value.
- **`prerequisites` and `corequisites`** can be stored as reqit DSL text. The SDK's `Course` constructor auto-parses string prerequisites, so you don't need to parse them separately.

#### Attributes

Attributes tag courses with institutional designations — things like "Writing Intensive", "Quantitative Reasoning", or "General Education: Humanities." Requirements often reference attributes instead of specific courses: `at least 1 of (courses where attribute = "GE-QR")`.

```sql
CREATE TABLE attributes (
  id SERIAL PRIMARY KEY,
  institution_id INTEGER NOT NULL REFERENCES institutions(id),
  ay VARCHAR(20) NOT NULL,
  code VARCHAR(20) NOT NULL,
  name TEXT,
  UNIQUE(institution_id, ay, code)
);

CREATE TABLE course_attributes (
  course_id INTEGER NOT NULL REFERENCES courses(id),
  attribute_code VARCHAR(20) NOT NULL,
  PRIMARY KEY (course_id, attribute_code)
);
```

The `attributes` table defines what attribute codes exist and their human-readable names. The `course_attributes` join table assigns attributes to courses — a many-to-many relationship, since a course can carry multiple attributes and an attribute applies to many courses.

#### Programs

A program is an academic pathway — a major, minor, concentration, certificate, or cluster. Programs are what students declare and what the SDK audits against.

```sql
CREATE TABLE programs (
  id SERIAL PRIMARY KEY,
  institution_id INTEGER NOT NULL REFERENCES institutions(id),
  ay VARCHAR(20) NOT NULL,
  code VARCHAR(50) NOT NULL,
  name TEXT,
  type VARCHAR(20) NOT NULL,         -- major, minor, certificate, cluster, etc.
  level VARCHAR(20) NOT NULL,        -- undergraduate, graduate
  UNIQUE(institution_id, ay, code)
);
```

The `type` column is important for the SDK. Requirements can reference programs by type — for example, `any program where type = "minor"` means "the student must have *some* declared minor, but we don't care which one." The `type` values you use here must match what appears in your reqit requirement text.

Cluster programs (like General Education) are a special case. They aren't declared by students the way majors and minors are — instead, they're referenced by other programs using `program "GEN-ED"` syntax. The SDK expands the cluster's requirements inline during audit. Your application may need to auto-add cluster programs to a student's declared programs when auditing a major that references them.

#### Program Requirements

Each program has a requirement tree written in the reqit language. This is stored in a separate table because not every program may have requirements loaded yet, and because the requirement text can be large:

```sql
CREATE TABLE program_requirements (
  program_id INTEGER NOT NULL REFERENCES programs(id) PRIMARY KEY,
  requirement_text TEXT NOT NULL      -- reqit DSL source text
);
```

The `program_requirements` table has a one-to-one relationship with `programs`. It's separate (rather than a column on `programs`) because requirements are loaded and attached differently — you load program metadata into the catalog first, then parse and attach requirements via `catalog.withPrograms()`. This two-step process also means you can load a catalog without parsing any requirements (useful for course lookups and resolution) and only parse the specific program trees you need for a given audit.

#### Degrees

A degree is the credential conferred — "Bachelor of Science," "Master of Arts," "Associate of Applied Science." Degrees are distinct from programs: the B.S. is the degree; Computer Science is the program (major). A single degree type can apply to many programs (B.S. in Computer Science, B.S. in Biology, B.S. in Chemistry), and the same program name might exist under different degrees at some institutions (B.A. in Mathematics vs. B.S. in Mathematics).

```sql
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

The SDK uses degrees for informational purposes — they appear in catalog metadata and can be referenced in audit output — but they don't directly affect requirement evaluation. A program's requirements are attached to the program, not the degree. Think of the degree as a label for the type of credential, while the program defines what the student must actually complete.

If you need to associate programs with their degrees (e.g., to display "B.S. in Computer Science" rather than just "Computer Science"), add a foreign key from `programs` to `degrees`:

```sql
ALTER TABLE programs ADD COLUMN degree_id INTEGER REFERENCES degrees(id);
```

### Transcript Tables

Transcript tables record what the student has done. Unlike catalog tables, these are not versioned by academic year — a student has one transcript that spans their entire enrollment.

#### Completed and In-Progress Courses

```sql
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
```

The `status` column distinguishes between courses the student has finished and courses they're currently taking. The SDK treats in-progress courses differently during audit: a requirement satisfied only by in-progress courses gets status `in-progress` rather than `met`, which propagates up through the requirement tree.

The `term` column (e.g., "Fall 2025") is not used by the SDK directly, but it's essential for your application — it determines the order courses appear in the transcript and matters for features like term-by-term progress tracking.

#### Attainments

Attainments represent non-course achievements: test scores, placement results, milestones like "completed orientation." Requirements can reference them with `score SAT-MATH >= 600` or `attainment CAREER_PATHWAYS`.

```sql
CREATE TABLE student_attainments (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(id),
  code VARCHAR(50) NOT NULL,
  value TEXT NOT NULL,                -- number or boolean stored as text
  UNIQUE(student_id, code)
);
```

The `value` column stores everything as text — your loading code converts to `Number` or `Boolean` based on the content (see [Building a Transcript](#building-a-transcript-from-student-records) below).

#### Declared Programs

```sql
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

Declared programs tell the SDK which programs a student is pursuing. This matters for two reasons: first, it determines what gets audited; second, requirements like `any program where type = "minor"` check whether the student has a declared program matching the filter.

The `role` column marks one program as `'primary'` for multi-program audits with overlap rules. When the SDK encounters `with overlap = exclusive`, it needs to know which program gets first claim on shared courses.

### Exception Tables

Waivers and substitutions are per-student overrides that modify how the audit evaluates specific requirements.

#### Waivers

A waiver says "this student doesn't need to satisfy this specific requirement." Waivers can target courses, scores, attainments, quantity thresholds, or labeled requirement groups:

```sql
CREATE TABLE waivers (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(id),
  target_type VARCHAR(20) NOT NULL,   -- 'course', 'score', 'attainment', 'quantity', 'label'
  target_value JSONB NOT NULL,        -- e.g. {"subject":"CMPS","number":"310"} or "SAT-MATH"
  reason TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

The `target_type` and `target_value` columns work together to identify what's being waived. For a course waiver, `target_value` is `{"subject":"CMPS","number":"310"}`; for a score waiver, it's the score code as a string. The `reason` is required — it appears in audit output so advisors can see why a requirement shows as waived rather than met.

#### Substitutions

A substitution says "this student can use course X in place of course Y." The SDK replaces the original course reference with the substitute during audit:

```sql
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

You have two options for storing requirement text in `program_requirements`:

**Option A: reqit DSL text (recommended)**

Store the human-readable reqit source. Parse at load time.

```sql
requirement_text TEXT NOT NULL  -- 'all of (MATH 151, CMPS 130) with grade >= "C"'
```

Advantages: human-readable, diffable, version-control friendly, compact. Registrars and department chairs can read and edit the requirement text directly.

**Option B: Serialized AST (JSON)**

Store the parsed AST as JSON.

```sql
requirement_ast JSONB NOT NULL  -- { "type": "all-of", "items": [...] }
```

Advantages: no parse step at load time, can query AST structure via JSONB operators.

We recommend storing DSL text as the source of truth. A typical parse takes under 1ms, so the parse-at-load-time cost is negligible. If you do need to avoid repeated parsing (e.g., in a high-throughput batch pipeline), cache parsed ASTs in memory or in a separate JSONB column — but keep the DSL text as the authoritative version.

---

## Loading Data into SDK Objects

The SDK doesn't know about your database. You query your tables, reshape the rows into the plain objects the SDK expects, and pass them to factory functions. This section shows the standard pattern for each entity.

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

Notice the column name mapping: the database uses `credits_min` (snake_case) but the SDK expects `creditsMin` (camelCase). This is the only transformation needed — the SDK's factory functions handle the rest.

### Attaching Program Requirements

Loading a catalog gives you course data, program metadata, and attributes — but not the requirement trees themselves. Requirements are parsed separately and attached via `catalog.withPrograms()`:

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

`withPrograms()` returns a new `Catalog` instance (catalogs are immutable) where each program entry has its parsed requirement AST attached. After this call, `catalog.findProgram('BS-CMPS').requirements` returns the AST, and you can pass it to `reqit.fromAST()` to create an auditable `Requirement` instance.

This two-step pattern — load catalog first, attach requirements second — is intentional. You can use a catalog without requirements for operations that don't need them (course lookups, resolution previews, prerequisite analysis). And in a web application, you might cache the base catalog and only parse requirements for the specific programs being audited in a given request.

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

  // Build attainments object: convert string values to numbers or booleans
  const attainments = {};
  for (const row of attainmentRows) {
    attainments[row.code] = isNaN(row.value) ? (row.value === 'true') : Number(row.value);
  }

  // Build waivers — the target_type determines which waiver factory parameter to use
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

All five queries run in parallel — there are no dependencies between them. The resulting `Transcript` object contains everything the SDK needs to run an audit: completed courses, attainments, declared programs, and any per-student exceptions.

### Managing `id` Fields

SDK entities accept an `id` field that is passed through unchanged. Use this to round-trip your database primary keys so you can link audit results back to your data:

```javascript
// When loading: set id from your database PK
const course = { id: row.id, subject: row.subject, number: row.number, ... };

// After audit: the id is preserved on entity instances
const c = catalog.findCourse('MATH', '151');
console.log(c.id); // → your database PK

// When walking audit results: reference entities by their id
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

Audits are fast — typically under 10ms for a full program, even with complex requirement trees. For most applications, the right approach is to re-compute on demand rather than store results:

```javascript
app.get('/audit/:studentId/:programCode', async (req, res) => {
  const catalog = await loadCatalogWithRequirements(db, institutionId, ay);
  const transcript = await loadTranscript(db, req.params.studentId);
  const program = catalog.findProgram(req.params.programCode);
  const result = reqit.fromAST(program.requirements).audit(catalog, transcript);
  res.render('audit', { result, catalog });
});
```

Re-computing ensures the audit always reflects the current state: if a grade posts, a waiver is added, or a requirement is updated, the next audit request automatically picks it up. There's no cache to invalidate.

### Persisting for Batch Reporting

The exception is batch reporting — when you need audit status across hundreds or thousands of students at once (graduation clearance lists, retention reports, institutional dashboards). Running live audits for every student on every request isn't practical, so you persist snapshots:

```sql
CREATE TABLE audit_snapshots (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL,
  program_code VARCHAR(50) NOT NULL,
  ay VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL,        -- met, in-progress, partial-progress, not-met
  summary JSONB NOT NULL,             -- { met: N, inProgress: N, ... }
  computed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(student_id, program_code, ay)
);
```

The `summary` column stores the same structure returned by `result.summary` — counts of met, in-progress, partial-progress, and not-met nodes. This is enough for most reporting queries ("how many seniors are on track to graduate?") without needing to store the full audit tree.

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

Run this as a nightly job or after bulk data imports. Individual audit requests still re-compute live — the snapshots are only for aggregate reporting.

---

## Catalog Year and Rollover

### Why Academic Year Matters

Every catalog table is keyed by `(institution_id, ay)`. This means your database holds a complete, independent catalog for each academic year — the 2024–2025 courses, programs, attributes, and requirements exist alongside the 2025–2026 versions, and neither affects the other.

This is essential because catalog data changes every year. A program might add a new required course, drop an elective, change a GPA threshold, or restructure its requirement tree entirely. If you only stored "the current catalog," you'd lose the ability to audit students against the requirements they entered under.

### The Rollover Problem

Most institutions follow a **catalog rights** or **catalog year** policy: students follow the requirements that were in effect when they entered the institution (or declared their major), not the requirements that happen to be current today. A student who enrolled in 2022 and declared a CS major in 2023 might be entitled to follow the 2023–2024 CS requirements through graduation, even though the 2026–2027 catalog has different requirements.

This is the rollover problem: your application needs to decide which catalog year to use for each student. The SDK doesn't make this decision — it audits against whichever catalog you pass in. But your data model and application logic need to support it.

At minimum, store a `catalog_ay` on your students table:

```sql
ALTER TABLE students ADD COLUMN catalog_ay VARCHAR(20);
-- The year the student's requirements were locked in
```

When loading data for an audit, use the student's catalog year, not the institution's current year:

```javascript
const student = await db.queryRow('SELECT catalog_ay FROM students WHERE id = $1', [studentId]);
const catalog = await loadCatalogWithRequirements(db, institutionId, student.catalog_ay);
```

### Rollover Strategies

Institutions vary in how they handle catalog year assignment:

- **Entry year**: Students follow the catalog from the year they first enrolled. Simple, but can lock students into outdated requirements.
- **Declaration year**: Students follow the catalog from the year they declared their major. Requires tracking per-program declaration dates.
- **Best-of / student-choice**: Students can choose any catalog year from their enrollment through the present. The application runs audits against multiple catalog years and lets the student or advisor pick the most favorable one.
- **Rolling window**: Students follow their entry year's catalog, but if they haven't graduated within N years, they must switch to the current catalog.

The SDK supports all of these — the only difference is which `ay` value you pass when loading the catalog. The "best-of" strategy is the most audit-intensive (you run multiple audits per student), but since individual audits are fast, this is usually practical.

### Planning for Multiple Years

When designing your import and maintenance processes, keep rollover in mind:

- **Don't delete old catalogs.** Even when a new academic year starts, old catalogs must remain in the database as long as any student might still be audited against them.
- **Copy-and-modify** is usually the best approach for creating a new year's catalog. Copy the previous year's courses, programs, attributes, and requirements, then make the changes for the new year. This ensures you start with a complete catalog rather than building from scratch.
- **Requirement text carries forward.** If a program's requirements didn't change from one year to the next, the reqit text is identical. You can copy the `program_requirements` row unchanged.

---

## Patterns

### What-If Scenarios

The SDK's immutable design makes what-if analysis straightforward. You can modify a transcript without touching the database, run an audit against the modified version, and discard it:

```javascript
// What if the student takes CMPS 310 next semester?
const whatIf = transcript.addCourse({
  subject: 'CMPS', number: '310', credits: 3, status: 'in-progress',
});
const whatIfResult = requirement.audit(catalog, whatIf);
// transcript is unchanged — whatIf is a separate instance
```

This is useful for advising: "if you take these three courses next semester, here's how your audit changes." You can chain multiple `addCourse()` calls (each returns a new transcript) to model an entire semester plan.

### Comparing Potential Majors

For students who haven't declared, or who are considering changing majors, you can audit the same transcript against multiple programs and compare:

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

The `unmet` count gives a rough sense of "how far" the student is from completing each program. Combined with `findNextEligible()` (which considers prerequisite chains), you can build an advising tool that shows not just what's missing but what the student can take next.

---

## Complete Example

An Express route that ties everything together — loads data from a database, runs an audit, and renders the result:

```javascript
const reqit = require('reqit');

app.get('/students/:id/audit/:program', async (req, res) => {
  try {
    const studentId = req.params.id;
    const programCode = req.params.program;

    // Load student's catalog year — this determines which requirements apply
    const student = await db.queryRow(
      'SELECT catalog_ay FROM students WHERE id = $1', [studentId]
    );
    const ay = student.catalog_ay;

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

Notice the flow: the student's `catalog_ay` determines which catalog version to load, the catalog and transcript are loaded in parallel, the audit runs against the student's specific catalog year, and the result is rendered with full detail — HTML output, unmet requirements, next-eligible courses, and GPA.
