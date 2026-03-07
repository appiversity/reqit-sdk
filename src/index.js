'use strict';

/**
 * reqit SDK — public API
 *
 * Primary entry point for the reqit academic requirements toolkit.
 * Parse requirements, build catalogs/transcripts, run degree audits,
 * and render results as HTML or text outlines.
 *
 * Low-level engine internals are available via `require('reqit/advanced')`.
 */

const { parse: internalParse } = require('./parser');
const {
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
} = require('./entities');
const { auditMulti: internalAuditMulti } = require('./audit/multi-tree');
const { isPassingGrade, meetsMinGrade, calculateGPA: internalCalculateGPA, isValidGrade } = require('./grade');
const { exportPrereqMatrix } = require('./export/prereq-matrix');
const { exportDependencyMatrix } = require('./export/dependency-matrix');
const { Waiver, Substitution, waiver: waiverFactory, substitution: substitutionFactory } = require('./audit/exceptions');

const VERSION = require('../package.json').version;

// ============================================================
// Entity factories
// ============================================================

/** Parse a requirement string into a Requirement instance. */
function parse(text) {
  return new Requirement(internalParse(text));
}

/** Wrap a raw AST object in a Requirement instance. */
function fromAST(ast) {
  return new Requirement(ast);
}

/** Create a Catalog instance from catalog data. */
function catalog(data) {
  return new Catalog(data);
}

/** Create a Transcript instance from transcript data. */
function transcript(data) {
  return new Transcript(data);
}

/** Create a Degree instance from degree data. */
function degree(data) {
  return new Degree(data);
}

// ============================================================
// calculateGPA — entity-aware wrapper
// ============================================================

/** Calculate GPA from transcript courses. Accepts Transcript or plain array. */
function calculateGPA(coursesOrTranscript, configOrCatalog) {
  const courses = coursesOrTranscript instanceof Transcript
    ? unwrapTranscript(coursesOrTranscript)
    : Array.isArray(coursesOrTranscript)
      ? coursesOrTranscript.map(e => e instanceof TranscriptCourse ? e.toJSON() : e)
      : coursesOrTranscript;
  const config = configOrCatalog instanceof Catalog
    ? configOrCatalog.gradeConfig
    : configOrCatalog;
  return internalCalculateGPA(courses, config);
}

// ============================================================
// Multi-tree audit facade
// ============================================================

/** Audit multiple requirement trees with shared course assignment. */
function publicAuditMulti(cat, tx, options) {
  const { trees, overlapRules, programContext: explicitProgramContext, ...rest } = options || {};
  const asts = {};
  // Derive programContext from transcript if not explicitly provided
  const programContext = explicitProgramContext || deriveProgramContext(tx);
  const treeArray = Object.entries(trees).map(([name, req]) => {
    const ast = req instanceof Requirement ? req.ast : req;
    asts[name] = ast;
    const entry = { programCode: name, ast };
    if (programContext) {
      for (const [role, code] of Object.entries(programContext)) {
        if (code === name) entry.role = role;
      }
    }
    return entry;
  });
  // Extract transcript options (attainments, declaredPrograms, exceptions)
  const txOpts = extractTranscriptOptions(tx);
  const raw = internalAuditMulti(
    treeArray,
    unwrapCatalog(cat),
    unwrapTranscript(tx),
    { overlapRules, ...txOpts, ...rest },
  );
  return new MultiAuditResult(raw, asts);
}

// ============================================================
// Exports
// ============================================================

module.exports = {
  // -- Factories --
  /** Parse a requirement string into a Requirement instance. */
  parse,
  /** Wrap a raw AST object in a Requirement instance. */
  fromAST,
  /** Create a Catalog instance from catalog data. */
  catalog,
  /** Create a Transcript instance from transcript data. */
  transcript,
  /** Create a Degree instance from degree data. */
  degree,
  /** Create a Waiver exception for audit. */
  waiver: waiverFactory,
  /** Create a Substitution exception for audit. */
  substitution: substitutionFactory,

  // -- Entity classes --
  /** Parsed requirement with rendering, auditing, and analysis methods. */
  Requirement,
  /** Course catalog with lookup and query methods. */
  Catalog,
  /** Degree credential (B.S., M.A., etc.) with metadata. */
  Degree,
  /** Student transcript with immutable mutation methods. */
  Transcript,
  /** Single course entry on a transcript. */
  TranscriptCourse,
  /** Result of resolving filters against a catalog. */
  ResolutionResult,
  /** Result of auditing a single requirement tree. */
  AuditResult,
  /** Result of auditing multiple requirement trees with shared courses. */
  MultiAuditResult,
  /** A waiver exception (course, score, attainment, or label waiver). */
  Waiver,
  /** A course substitution exception. */
  Substitution,

  // -- Enumerations --
  /** Audit status values: MET, IN_PROGRESS, PARTIAL_PROGRESS, NOT_MET, WAIVED, SUBSTITUTED. */
  AuditStatus,
  /** Program type values: MAJOR, MINOR, CERTIFICATE, CONCENTRATION, TRACK, CLUSTER. */
  ProgramType,
  /** Program level values: UNDERGRADUATE, GRADUATE, DOCTORAL, etc. */
  ProgramLevel,
  /** Degree type abbreviations: BA, BS, MA, MS, PHD, etc. */
  DegreeType,

  // -- Multi-tree audit --
  /** Audit multiple requirement trees with shared course assignment and overlap policies. */
  auditMulti: publicAuditMulti,

  // -- Catalog exports --
  /** Export a prerequisite matrix as spreadsheet data. */
  exportPrereqMatrix,
  /** Export a dependency matrix as spreadsheet data. */
  exportDependencyMatrix,

  // -- Grade utilities --
  /** Check if a grade meets a minimum grade threshold. */
  meetsMinGrade,
  /** Check if a grade is a passing grade. */
  isPassingGrade,
  /** Calculate GPA from a list of course entries. */
  calculateGPA,
  /** Check if a grade string is valid in the given configuration. */
  isValidGrade,

  // -- Meta --
  /** SDK version string (from package.json). */
  version: VERSION,
};
