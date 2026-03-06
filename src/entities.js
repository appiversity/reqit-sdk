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
const { expand } = require('./ast/expand');
const { exportProgramChecklist } = require('./export/program-checklist');
const { exportAudit } = require('./export/audit-export');
const { buildSummary } = require('./audit/status');
const { walkResult } = require('./audit/walk-result');

// ============================================================
// Helpers (not exported)
// ============================================================

function unwrapCatalog(c) {
  return c instanceof Catalog ? c.data : c;
}

function unwrapTranscript(t) {
  if (t instanceof Transcript) {
    return t.entries.map(e => e instanceof TranscriptEntry ? e.toJSON() : e);
  }
  return t;
}

// ============================================================
// AuditStatus enum
// ============================================================

const AuditStatus = Object.freeze({
  MET: 'met',
  IN_PROGRESS: 'in-progress',
  PARTIAL_PROGRESS: 'partial-progress',
  NOT_MET: 'not-met',
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

  toOutline(catalog) { return toOutline(this.#ast, unwrapCatalog(catalog)); }

  toHTML(catalog) { return toHTML(this.#ast, unwrapCatalog(catalog)); }

  resolve(catalog) {
    return new ResolutionResult(resolve(this.#ast, unwrapCatalog(catalog)));
  }

  audit(catalog, transcript, opts) {
    const raw = audit(this.#ast, unwrapCatalog(catalog), unwrapTranscript(transcript), opts);
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
// Catalog
// ============================================================

class Catalog {
  #data;
  #courseIndex;
  #programIndex;

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
  get gradeConfig() { return this.#data.gradeConfig; }

  findCourse(subject, number) {
    if (!this.#courseIndex) {
      this.#courseIndex = new Map();
      for (const c of this.#data.courses) {
        this.#courseIndex.set(`${c.subject}:${c.number}`, c);
      }
    }
    return this.#courseIndex.get(`${subject}:${number}`);
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
}

// ============================================================
// TranscriptEntry
// ============================================================

class TranscriptEntry {
  #data;

  constructor(data) {
    if (!data || !data.subject || !data.number) {
      throw new Error('TranscriptEntry requires subject and number');
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
  #entries;

  constructor(entries) {
    if (!Array.isArray(entries)) throw new Error('Transcript requires an array of entries');
    this.#entries = Object.freeze(
      entries.map(e => e instanceof TranscriptEntry ? e : new TranscriptEntry(e))
    );
  }

  get entries() { return this.#entries; }

  addEntry(entry) {
    const e = entry instanceof TranscriptEntry ? entry : new TranscriptEntry(entry);
    return new Transcript([...this.#entries, e]);
  }

  removeEntry(subject, number) {
    return new Transcript(
      this.#entries.filter(e => !(e.subject === subject && e.number === number))
    );
  }
}

// ============================================================
// ResolutionResult
// ============================================================

class ResolutionResult {
  #raw;

  constructor(raw) { this.#raw = raw; }

  get courses() { return this.#raw.courses; }
  get filters() { return this.#raw.filters; }
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

  toHTML(catalog) {
    return toHTML(this.#ast, unwrapCatalog(catalog), this.#raw.result);
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
  Requirement,
  Catalog,
  TranscriptEntry,
  Transcript,
  ResolutionResult,
  AuditResult,
  MultiAuditResult,
  unwrapCatalog,
  unwrapTranscript,
};
