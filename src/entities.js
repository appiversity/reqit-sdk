'use strict';

/**
 * entities.js — Entity classes for the reqit public API.
 *
 * Thin facades over internal functions. All logic lives in the internal
 * modules; these classes provide a discoverable, typed surface.
 */

const { audit, prepareAudit, findUnmet, findNextEligible, auditMulti, CourseAssignmentMap } = require('./audit');
const { resolve } = require('./resolve');
const { parse: internalParse } = require('./parser');
const { validate } = require('./ast/validate');
const { toText } = require('./render/to-text');
const { toDescription } = require('./render/to-description');
const { toHTML } = require('./render/to-html');
const { toOutline } = require('./render/to-outline');
const { walk, transform } = require('./ast/walk');
const { extractCourses, extractAllReferences } = require('./ast/extract');
const { diff } = require('./ast/diff');
const { courseKey } = require('./render/shared');
const { expand } = require('./ast/expand');
const { exportProgramChecklist } = require('./export/program-checklist');
const { exportAudit } = require('./export/audit-export');
const { buildSummary } = require('./audit/status');
const { walkResult } = require('./audit/walk-result');
const { Waiver, Substitution } = require('./audit/exceptions');
const { buildPrereqGraph } = require('./export/prereq-graph');

// ============================================================
// Helpers (not exported)
// ============================================================

function unwrapCatalog(c) {
  return c instanceof Catalog ? c.data : c;
}

function unwrapTranscript(t) {
  if (t instanceof Transcript) {
    return t.courses.map(e => e instanceof TranscriptCourse ? e.toJSON() : e);
  }
  if (t && typeof t === 'object' && !Array.isArray(t) && Array.isArray(t.courses)) {
    return t.courses;
  }
  return t;
}

/**
 * Static analysis: classify how a course appears in a requirement tree.
 * Returns 'required' if every ancestor up to root is all-of or transparent,
 * 'elective' if it appears inside n-of/any-of/filter, or null if not found.
 * @param {Object} node - AST node
 * @param {string} targetKey - courseKey to search for
 * @param {boolean} [allRequired=true] - whether all ancestors are required
 * @returns {string|null} 'required', 'elective', or null
 */
function classifyCourseInTree(node, targetKey, allRequired) {
  if (allRequired === undefined) allRequired = true;
  switch (node.type) {
    case 'course':
      return courseKey(node) === targetKey
        ? (allRequired ? 'required' : 'elective')
        : null;
    case 'course-filter':
      return null; // filter matches are always elective — but we don't resolve here
    case 'all-of': {
      for (const item of node.items) {
        const r = classifyCourseInTree(item, targetKey, allRequired);
        if (r) return r;
      }
      return null;
    }
    case 'any-of':
    case 'n-of':
    case 'none-of':
    case 'one-from-each':
    case 'from-n-groups': {
      for (const item of node.items) {
        const r = classifyCourseInTree(item, targetKey, false);
        if (r) return r;
      }
      return null;
    }
    case 'credits-from': {
      const src = node.source.type === 'all-of' ? node.source.items : [node.source];
      for (const item of src) {
        const r = classifyCourseInTree(item, targetKey, false);
        if (r) return r;
      }
      return null;
    }
    case 'with-constraint':
      return classifyCourseInTree(node.requirement, targetKey, allRequired);
    case 'except': {
      const r = classifyCourseInTree(node.source, targetKey, allRequired);
      if (r) return r;
      // Don't classify courses in the exclude list
      return null;
    }
    case 'variable-def':
      return classifyCourseInTree(node.value, targetKey, allRequired);
    case 'scope':
      return classifyCourseInTree(node.body, targetKey, allRequired);
    default:
      return null;
  }
}

/**
 * Extract audit options from a Transcript instance.
 * Returns { attainments, declaredPrograms, exceptions } for the audit engine.
 */
function extractTranscriptOptions(t) {
  if (!(t instanceof Transcript)) return {};
  const opts = {};
  const attainments = t.attainments;
  if (attainments && Object.keys(attainments).length > 0) {
    opts.attainments = attainments;
  }
  const declared = t.declaredPrograms;
  if (declared && declared.length > 0) {
    opts.declaredPrograms = declared;
  }
  const exceptions = [];
  for (const w of t.waivers) exceptions.push(w);
  for (const s of t.substitutions) exceptions.push(s);
  if (exceptions.length > 0) opts.exceptions = exceptions;
  if (t.duplicatePolicy) opts.duplicatePolicy = t.duplicatePolicy;
  return opts;
}

/**
 * Derive programContext from transcript's declaredPrograms.
 * First declared program with role 'primary' for each type becomes the context entry.
 */
function deriveProgramContext(t) {
  if (!(t instanceof Transcript)) return null;
  const declared = t.declaredPrograms;
  if (!declared || declared.length === 0) return null;
  const ctx = {};
  for (const dp of declared) {
    if (dp.role === 'primary') {
      if (dp.type === 'major' && !ctx['primary-major']) {
        ctx['primary-major'] = dp.code;
      } else if (dp.type === 'minor' && !ctx['primary-minor']) {
        ctx['primary-minor'] = dp.code;
      }
    }
  }
  return Object.keys(ctx).length > 0 ? ctx : null;
}

// ============================================================
// Enumerations
// ============================================================

const AuditStatus = Object.freeze({
  MET: 'met',
  IN_PROGRESS: 'in-progress',
  PARTIAL_PROGRESS: 'partial-progress',
  NOT_MET: 'not-met',
  WAIVED: 'waived',
  SUBSTITUTED: 'substituted',
});

const ProgramType = Object.freeze({
  MAJOR: 'major',
  MINOR: 'minor',
  CERTIFICATE: 'certificate',
  CONCENTRATION: 'concentration',
  TRACK: 'track',
  CLUSTER: 'cluster',
});

const ProgramLevel = Object.freeze({
  UNDERGRADUATE: 'undergraduate',
  GRADUATE: 'graduate',
  DOCTORAL: 'doctoral',
  PROFESSIONAL: 'professional',
  POST_GRADUATE: 'post-graduate',
  POST_DOCTORAL: 'post-doctoral',
});

const DegreeType = Object.freeze({
  // Associate degrees
  AA: 'A.A.',
  AS: 'A.S.',
  AAS: 'A.A.S.',
  // Bachelor's degrees
  BA: 'B.A.',
  BS: 'B.S.',
  BFA: 'B.F.A.',
  BBA: 'B.B.A.',
  BSN: 'B.S.N.',
  BE: 'B.E.',
  BARCH: 'B.Arch.',
  BMUS: 'B.Mus.',
  BSW: 'B.S.W.',
  // Master's degrees
  MA: 'M.A.',
  MS: 'M.S.',
  MBA: 'M.B.A.',
  MFA: 'M.F.A.',
  MED: 'M.Ed.',
  MSW: 'M.S.W.',
  MPH: 'M.P.H.',
  MPA: 'M.P.A.',
  MSN: 'M.S.N.',
  MENG: 'M.Eng.',
  // Doctoral degrees
  PHD: 'Ph.D.',
  EDD: 'Ed.D.',
  DBA: 'D.B.A.',
  DNP: 'D.N.P.',
  DMA: 'D.M.A.',
  PSYD: 'Psy.D.',
  // Professional degrees
  JD: 'J.D.',
  MD: 'M.D.',
  DO: 'D.O.',
  DDS: 'D.D.S.',
  DPHARM: 'Pharm.D.',
  DVM: 'D.V.M.',
  MDIV: 'M.Div.',
});

// ============================================================
// Requirement
// ============================================================

class Requirement {
  #ast;

  constructor(ast) {
    this.#ast = Object.freeze(structuredClone(ast));
  }

  get ast() { return this.#ast; }

  get text() { return toText(this.#ast); }

  get description() { return toDescription(this.#ast); }

  validate() { return validate(this.#ast); }

  toOutline(catalog, options) { return toOutline(this.#ast, unwrapCatalog(catalog), null, options); }

  toHTML(catalog, options) { return toHTML(this.#ast, unwrapCatalog(catalog), null, options); }

  resolve(catalog) {
    return new ResolutionResult(resolve(this.#ast, unwrapCatalog(catalog)));
  }

  audit(catalog, transcript, opts) {
    const txOpts = extractTranscriptOptions(transcript);
    const merged = { ...txOpts, ...opts };
    const raw = audit(this.#ast, unwrapCatalog(catalog), unwrapTranscript(transcript), merged);
    return new AuditResult(raw, this.#ast);
  }

  walk(cb) { return walk(this.#ast, cb); }

  transform(cb) { return new Requirement(transform(this.#ast, cb)); }

  extractCourses() { return extractCourses(this.#ast); }

  extractAllReferences(catalog) {
    return extractAllReferences(this.#ast, unwrapCatalog(catalog));
  }

  expand() { return new Requirement(expand(this.#ast)); }

  diff(other) {
    return diff(this.#ast, other instanceof Requirement ? other.ast : other);
  }

  exportChecklist(catalog, opts) {
    return exportProgramChecklist(this.#ast, unwrapCatalog(catalog), opts);
  }
}

// ============================================================
// PrereqGraph
// ============================================================

/**
 * Prerequisite graph with forward and reverse lookups.
 * Built lazily from catalog prerequisite data.
 */
class PrereqGraph {
  #forward; // Map<courseKey, { direct: Set, transitive: Set }>
  #reverse; // Map<courseKey, Set<courseKey>> — direct dependents

  constructor(forwardGraph) {
    this.#forward = forwardGraph;
    // Build reverse index
    this.#reverse = new Map();
    for (const [key, entry] of forwardGraph) {
      for (const prereq of entry.direct) {
        if (!this.#reverse.has(prereq)) this.#reverse.set(prereq, new Set());
        this.#reverse.get(prereq).add(key);
      }
    }
  }

  /** Direct prerequisites of a course. */
  directPrereqs(key) {
    const entry = this.#forward.get(key);
    return entry ? new Set(entry.direct) : new Set();
  }

  /** All transitive prerequisites (direct + indirect). */
  transitivePrereqs(key) {
    const entry = this.#forward.get(key);
    if (!entry) return new Set();
    return new Set([...entry.direct, ...entry.transitive]);
  }

  /** Courses that directly depend on this course as a prerequisite. */
  dependents(key) {
    return new Set(this.#reverse.get(key) || []);
  }

  /** All courses that transitively depend on this course. */
  transitiveDependents(key) {
    const result = new Set();
    const queue = [...(this.#reverse.get(key) || [])];
    while (queue.length > 0) {
      const dep = queue.shift();
      if (result.has(dep)) continue;
      result.add(dep);
      for (const next of (this.#reverse.get(dep) || [])) {
        if (!result.has(next)) queue.push(next);
      }
    }
    return result;
  }
}

// ============================================================
// Degree
// ============================================================

/**
 * A Degree represents a credential (B.S., B.A., M.A., Ph.D., etc.).
 * It sits above programs in the hierarchy — a student earns a degree
 * by completing one or more programs (major, minor) plus degree-level
 * requirements (gen-ed, total credits, GPA, etc.).
 */
class Degree {
  #data;

  constructor(data) {
    if (!data || !data.code) throw new Error('Degree requires a code');
    if (!data.type) throw new Error('Degree requires a type');
    if (!data.level) throw new Error('Degree requires a level');
    this.#data = Object.freeze({ ...data });
  }

  get code() { return this.#data.code; }
  get name() { return this.#data.name || null; }
  get type() { return this.#data.type; }
  get level() { return this.#data.level; }
  get requirements() { return this.#data.requirements || null; }
  get data() { return this.#data; }

  toJSON() {
    return { ...this.#data };
  }
}

// ============================================================
// Catalog
// ============================================================

class Catalog {
  #data;
  #courseIndex;
  #programIndex;
  #attributeIndex;
  #degreeIndex;
  #prereqGraph;

  constructor(data) {
    if (!data || !data.courses) throw new Error('Catalog requires courses');
    if (!data.ay) throw new Error('Catalog requires ay');
    this.#data = Object.freeze(data);
  }

  get data() { return this.#data; }
  get institution() { return this.#data.institution; }
  get ay() { return this.#data.ay; }
  get courses() { return this.#data.courses; }
  get programs() { return this.#data.programs; }
  get attributes() { return this.#data.attributes || []; }
  get degrees() { return this.#data.degrees || []; }
  get gradeConfig() { return this.#data.gradeConfig; }

  findCourse(subject, number) {
    if (!this.#courseIndex) {
      this.#courseIndex = new Map();
      for (const c of this.#data.courses) {
        this.#courseIndex.set(courseKey(c), c);
      }
    }
    return this.#courseIndex.get(courseKey({ subject, number }));
  }

  findProgram(code) {
    if (!this.#programIndex) {
      this.#programIndex = new Map();
      for (const p of (this.#data.programs || [])) {
        this.#programIndex.set(p.code, p);
      }
    }
    return this.#programIndex.get(code);
  }

  findPrograms(filter) {
    const programs = this.#data.programs || [];
    if (!filter || Object.keys(filter).length === 0) return [...programs];
    return programs.filter(p => {
      if (filter.type && p.type !== filter.type) return false;
      if (filter.level && p.level !== filter.level) return false;
      if (filter.code && p.code !== filter.code) return false;
      return true;
    });
  }

  findAttribute(code) {
    if (!this.#attributeIndex) {
      this.#attributeIndex = new Map();
      for (const a of (this.#data.attributes || [])) {
        this.#attributeIndex.set(a.code, a);
      }
    }
    return this.#attributeIndex.get(code) || null;
  }

  getAttributes() {
    return [...(this.#data.attributes || [])].sort((a, b) => a.code.localeCompare(b.code));
  }

  /**
   * Find courses matching a filter object.
   * Supports `subject`, `attribute`, and combinations thereof.
   * @param {{ subject?: string, attribute?: string }} [filter]
   * @returns {Array<Object>} Matching courses
   */
  findCourses(filter) {
    const courses = this.#data.courses;
    if (!filter || Object.keys(filter).length === 0) return [...courses];
    return courses.filter(c => {
      if (filter.subject && c.subject !== filter.subject) return false;
      if (filter.attribute && !(c.attributes || []).includes(filter.attribute)) return false;
      return true;
    });
  }

  /**
   * Get all unique subject codes from the catalog, sorted alphabetically.
   * @returns {string[]}
   */
  getSubjects() {
    const subjects = new Set();
    for (const c of this.#data.courses) {
      subjects.add(c.subject);
    }
    return [...subjects].sort();
  }

  /**
   * Get cross-listed equivalents for a course.
   * Returns courses in the same crossListGroup, excluding the queried course itself.
   * @param {string} subject
   * @param {string} number
   * @returns {Array<Object>}
   */
  getCrossListEquivalents(subject, number) {
    const course = this.findCourse(subject, number);
    if (!course || !course.crossListGroup) return [];
    return this.#data.courses.filter(c =>
      c.crossListGroup === course.crossListGroup &&
      !(c.subject === subject && c.number === number)
    );
  }

  /**
   * Find a degree by code.
   * @param {string} code
   * @returns {Object|undefined}
   */
  findDegree(code) {
    if (!this.#degreeIndex) {
      this.#degreeIndex = new Map();
      for (const d of (this.#data.degrees || [])) {
        this.#degreeIndex.set(d.code, d);
      }
    }
    return this.#degreeIndex.get(code);
  }

  /**
   * Find degrees matching a filter object.
   * Supports `type` and `level` filters.
   * @param {{ type?: string, level?: string }} [filter]
   * @returns {Array<Object>}
   */
  findDegrees(filter) {
    const degrees = this.#data.degrees || [];
    if (!filter || Object.keys(filter).length === 0) return [...degrees];
    return degrees.filter(d => {
      if (filter.type && d.type !== filter.type) return false;
      if (filter.level && d.level !== filter.level) return false;
      return true;
    });
  }

  /**
   * Get the prerequisite graph for this catalog.
   * Lazily built on first call. Returns a PrereqGraph with forward and reverse lookups.
   * @returns {PrereqGraph}
   */
  prereqGraph() {
    if (!this.#prereqGraph) {
      this.#prereqGraph = new PrereqGraph(buildPrereqGraph(this.#data));
    }
    return this.#prereqGraph;
  }

  /**
   * Find programs that reference a given course in their requirements.
   * Requires programs to have `requirements` attached (via withPrograms).
   * Uses static analysis: required = all ancestors are all-of/transparent;
   * elective = inside n-of/any-of/filter.
   * @param {string} subject
   * @param {string} number
   * @returns {Array<{ code: string, context: string }>}
   */
  findProgramsRequiring(subject, number) {
    const programs = this.#data.programs || [];
    const targetKey = courseKey({ subject, number });
    const results = [];

    for (const prog of programs) {
      if (!prog.requirements) continue;
      const context = classifyCourseInTree(prog.requirements, targetKey);
      if (context) {
        results.push({ code: prog.code, context });
      }
    }
    return results;
  }

  /**
   * Assess the impact of retiring a course.
   * Returns dependent courses (from prereq graph) and programs that reference it.
   * @param {string} subject
   * @param {string} number
   * @returns {{ dependentCourses: string[], programs: Array<{ code: string, context: string }> }}
   */
  courseImpact(subject, number) {
    const key = courseKey({ subject, number });
    const graph = this.prereqGraph();
    const dependentCourses = [...graph.transitiveDependents(key)].sort();
    const programs = this.findProgramsRequiring(subject, number);
    return { dependentCourses, programs };
  }

  withPrograms(programMap) {
    const programs = (this.#data.programs || []).map(p => {
      const req = programMap[p.code];
      if (!req) return p;
      return { ...p, requirements: req instanceof Requirement ? req.ast : req };
    });
    for (const [code, req] of Object.entries(programMap)) {
      if (!programs.some(p => p.code === code)) {
        programs.push({ code, requirements: req instanceof Requirement ? req.ast : req });
      }
    }
    return new Catalog({ ...this.#data, programs });
  }
}

// ============================================================
// TranscriptCourse
// ============================================================

class TranscriptCourse {
  #data;

  constructor(data) {
    if (!data || !data.subject || !data.number) {
      throw new Error('TranscriptCourse requires subject and number');
    }
    this.#data = Object.freeze(data);
  }

  get subject() { return this.#data.subject; }
  get number() { return this.#data.number; }
  get grade() { return this.#data.grade ?? null; }
  get credits() { return this.#data.credits ?? 0; }
  get term() { return this.#data.term ?? ''; }
  get status() { return this.#data.status ?? 'completed'; }

  toJSON() { return { ...this.#data }; }
}

// ============================================================
// Transcript
// ============================================================

class Transcript {
  #courses;
  #attainments;
  #declaredPrograms;
  #waivers;
  #substitutions;
  #level;
  #duplicatePolicy;

  constructor(data) {
    if (Array.isArray(data)) {
      throw new Error('Transcript requires a data object with a courses array, not a plain array');
    }
    if (!data || !Array.isArray(data.courses)) {
      throw new Error('Transcript requires a data object with a courses array');
    }
    this.#courses = Object.freeze(
      data.courses.map(e => e instanceof TranscriptCourse ? e : new TranscriptCourse(e))
    );
    this.#attainments = Object.freeze(data.attainments || {});
    this.#declaredPrograms = Object.freeze(
      (data.declaredPrograms || []).map(dp => Object.freeze({ ...dp }))
    );
    this.#waivers = Object.freeze(
      (data.waivers || []).map(w => w instanceof Waiver ? w : null).filter(Boolean)
    );
    this.#substitutions = Object.freeze(
      (data.substitutions || []).map(s => s instanceof Substitution ? s : null).filter(Boolean)
    );
    this.#level = data.level || null;
    this.#duplicatePolicy = data.duplicatePolicy || null;
  }

  get courses() { return this.#courses; }
  get attainments() { return this.#attainments; }
  get declaredPrograms() { return this.#declaredPrograms; }
  get waivers() { return this.#waivers; }
  get substitutions() { return this.#substitutions; }
  get level() { return this.#level; }
  get duplicatePolicy() { return this.#duplicatePolicy; }

  // -- Immutable course mutations --

  addCourse(course) {
    const c = course instanceof TranscriptCourse ? course : new TranscriptCourse(course);
    return new Transcript(this.#toData({ courses: [...this.#courses, c] }));
  }

  removeCourse(subject, number) {
    return new Transcript(this.#toData({
      courses: this.#courses.filter(e => !(e.subject === subject && e.number === number)),
    }));
  }

  // -- Immutable attainment mutations --

  addAttainment(code, value) {
    return new Transcript(this.#toData({
      attainments: { ...this.#attainments, [code]: value },
    }));
  }

  removeAttainment(code) {
    const { [code]: _, ...rest } = this.#attainments;
    return new Transcript(this.#toData({ attainments: rest }));
  }

  // -- Immutable program declaration mutations --

  declareProgram(declaration) {
    return new Transcript(this.#toData({
      declaredPrograms: [...this.#declaredPrograms, declaration],
    }));
  }

  undeclareProgram(code) {
    return new Transcript(this.#toData({
      declaredPrograms: this.#declaredPrograms.filter(d => d.code !== code),
    }));
  }

  // -- Immutable waiver mutations --

  addWaiver(waiver) {
    if (!(waiver instanceof Waiver)) {
      throw new Error('addWaiver() requires a Waiver instance (use reqit.waiver() to create one)');
    }
    return new Transcript(this.#toData({
      waivers: [...this.#waivers, waiver],
    }));
  }

  removeWaiver(target) {
    return new Transcript(this.#toData({
      waivers: this.#waivers.filter(w => !matchesWaiverTarget(w, target)),
    }));
  }

  // -- Immutable substitution mutations --

  addSubstitution(substitution) {
    if (!(substitution instanceof Substitution)) {
      throw new Error('addSubstitution() requires a Substitution instance (use reqit.substitution() to create one)');
    }
    return new Transcript(this.#toData({
      substitutions: [...this.#substitutions, substitution],
    }));
  }

  removeSubstitution(target) {
    return new Transcript(this.#toData({
      substitutions: this.#substitutions.filter(s => !matchesSubstitutionTarget(s, target)),
    }));
  }

  // -- Internal helper to build data object for new Transcript --

  #toData(overrides) {
    return {
      courses: overrides.courses || [...this.#courses],
      attainments: overrides.attainments || { ...this.#attainments },
      declaredPrograms: overrides.declaredPrograms || [...this.#declaredPrograms],
      waivers: overrides.waivers || [...this.#waivers],
      substitutions: overrides.substitutions || [...this.#substitutions],
      level: this.#level,
      duplicatePolicy: this.#duplicatePolicy,
    };
  }
}

/**
 * Match a waiver against a removal target.
 * Target can be a course { subject, number }, or a string matching
 * the score/attainment/quantity/label target value.
 */
function matchesWaiverTarget(waiver, target) {
  const t = waiver.target;
  if (typeof target === 'object' && target.subject && target.number) {
    return t.course && t.course.subject === target.subject && t.course.number === target.number;
  }
  if (typeof target === 'string') {
    return t.score === target || t.attainment === target || t.quantity === target || t.label === target;
  }
  return false;
}

/**
 * Match a substitution against a removal target.
 * Target is { subject, number } matching the original course.
 */
function matchesSubstitutionTarget(sub, target) {
  if (typeof target === 'object' && target.subject && target.number) {
    return sub.original.subject === target.subject && sub.original.number === target.number;
  }
  return false;
}

// ============================================================
// ResolutionResult
// ============================================================

class ResolutionResult {
  #raw;
  #reverseIndex; // Map<courseKey, number[]> — filter indices that matched each course

  constructor(raw) { this.#raw = raw; }

  /** Explicit course references found during resolution. */
  get courses() { return this.#raw.courses; }

  /** Filter nodes and their matched courses. */
  get filters() { return this.#raw.filters; }

  /**
   * All unique courses across explicit references and filter matches.
   * Deduplicated by courseKey.
   * @returns {Array<Object>}
   */
  allCourses() {
    const seen = new Set();
    const result = [];
    for (const c of this.#raw.courses) {
      const key = courseKey(c);
      if (!seen.has(key)) { seen.add(key); result.push(c); }
    }
    for (const f of this.#raw.filters) {
      for (const c of f.matched) {
        const key = courseKey(c);
        if (!seen.has(key)) { seen.add(key); result.push(c); }
      }
    }
    return result;
  }

  /**
   * Courses matched by a specific filter (by index).
   * @param {number} index - Filter index
   * @returns {Array<Object>}
   */
  coursesForFilter(index) {
    const f = this.#raw.filters[index];
    return f ? [...f.matched] : [];
  }

  /**
   * Which filters matched a given course (reverse lookup).
   * @param {string} subject
   * @param {string} number
   * @returns {Array<{ node: Object, index: number }>}
   */
  filtersForCourse(subject, number) {
    if (!this.#reverseIndex) {
      this.#reverseIndex = new Map();
      for (let i = 0; i < this.#raw.filters.length; i++) {
        for (const c of this.#raw.filters[i].matched) {
          const key = courseKey(c);
          if (!this.#reverseIndex.has(key)) this.#reverseIndex.set(key, []);
          this.#reverseIndex.get(key).push(i);
        }
      }
    }
    const key = courseKey({ subject, number });
    const indices = this.#reverseIndex.get(key) || [];
    return indices.map(i => ({ node: this.#raw.filters[i].node, index: i }));
  }

  /** Count of unique courses (explicit + filter-matched). */
  get totalUniqueCourses() {
    return this.allCourses().length;
  }

  /** Set of subject codes across all resolved courses. */
  get subjects() {
    const subjects = new Set();
    for (const c of this.allCourses()) {
      subjects.add(c.subject);
    }
    return subjects;
  }
}

// ============================================================
// AuditResult
// ============================================================

class AuditResult {
  #raw;
  #ast;

  constructor(raw, ast) {
    this.#raw = raw;
    this.#ast = ast;
  }

  get status() { return this.#raw.status; }

  get items() { return this.#raw.result; }

  get warnings() { return this.#raw.warnings; }

  get exceptions() { return this.#raw.exceptions || null; }

  get summary() {
    let r = this.#raw.result;
    // Unwrap scope/variable-ref to find meaningful composite
    if (r.type === 'scope' && r.body) r = r.body;
    if (r.type === 'variable-ref' && r.resolved) r = r.resolved;
    let statuses;
    if (r.items && Array.isArray(r.items)) {
      statuses = r.items.map(i => i.status);
    } else if (r.source && r.source.items) {
      statuses = r.source.items.map(i => i.status);
    } else if (r.requirement) {
      statuses = [r.requirement.status];
    } else {
      statuses = [r.status];
    }
    return buildSummary(statuses);
  }

  walk(callback) { walkResult(this.#raw.result, callback); }

  findUnmet() { return findUnmet(this.#raw.result); }

  findNextEligible(catalog, transcript) {
    return findNextEligible(this.#raw.result, unwrapCatalog(catalog), unwrapTranscript(transcript));
  }

  toHTML(catalog, options) {
    return toHTML(this.#ast, unwrapCatalog(catalog), this.#raw.result, options);
  }

  toOutline(catalog, options) {
    return toOutline(this.#ast, unwrapCatalog(catalog), this.#raw.result, options);
  }

  export(catalog, opts) {
    return exportAudit(this.#raw.result, unwrapCatalog(catalog), opts);
  }
}

// ============================================================
// MultiAuditResult
// ============================================================

class MultiAuditResult {
  #raw;
  #asts;
  #trees;

  constructor(raw, asts) {
    this.#raw = raw;
    this.#asts = asts;
  }

  get trees() {
    if (!this.#trees) {
      const obj = {};
      for (const [code, data] of this.#raw.results) {
        obj[code] = new AuditResult(data, this.#asts[code] || null);
      }
      this.#trees = Object.freeze(obj);
    }
    return this.#trees;
  }

  get overlapResults() { return this.#raw.policyResults || []; }

  get courseAssignments() { return this.#raw.assignments; }

  get warnings() { return this.#raw.warnings; }
}

// ============================================================
// Exports
// ============================================================

module.exports = {
  AuditStatus,
  ProgramType,
  ProgramLevel,
  DegreeType,
  Requirement,
  Catalog,
  Degree,
  TranscriptCourse,
  Transcript,
  ResolutionResult,
  AuditResult,
  MultiAuditResult,
  unwrapCatalog,
  unwrapTranscript,
  extractTranscriptOptions,
  deriveProgramContext,
};
