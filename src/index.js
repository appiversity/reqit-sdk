'use strict';

// reqit SDK — public API (class-based)

const { parse: internalParse } = require('./parser');
const {
  AuditStatus,
  Requirement,
  Catalog,
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
const { auditMulti: internalAuditMulti, CourseAssignmentMap } = require('./audit/multi-tree');
const { prepareAudit } = require('./audit');
const { isPassingGrade, meetsMinGrade, calculateGPA: internalCalculateGPA, isAuditableGrade, DEFAULT_GRADE_CONFIG, isValidGrade } = require('./grade');
const { exportPrereqMatrix } = require('./export/prereq-matrix');
const { exportDependencyMatrix } = require('./export/dependency-matrix');
const { Waiver, Substitution, waiver: waiverFactory, substitution: substitutionFactory } = require('./audit/exceptions');

// ============================================================
// Entity factories
// ============================================================

function parse(text) {
  return new Requirement(internalParse(text));
}

function fromAST(ast) {
  return new Requirement(ast);
}

function catalog(data) {
  return new Catalog(data);
}

function transcript(data) {
  return new Transcript(data);
}

// ============================================================
// calculateGPA — entity-aware wrapper
// ============================================================

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
  // Entity factories
  parse,
  fromAST,
  catalog,
  transcript,
  // Exception factories
  waiver: waiverFactory,
  substitution: substitutionFactory,
  // Entity classes (for instanceof checks)
  Requirement,
  Catalog,
  Transcript,
  TranscriptCourse,
  ResolutionResult,
  AuditResult,
  MultiAuditResult,
  // Exception classes (for instanceof checks)
  Waiver,
  Substitution,
  // Enum
  AuditStatus,
  // Multi-tree
  auditMulti: publicAuditMulti,
  // Catalog-level exports
  exportPrereqMatrix,
  exportDependencyMatrix,
  // Grade utilities
  meetsMinGrade,
  isPassingGrade,
  calculateGPA,
  isValidGrade,
  // Internal-use exports (backward compat for reqit-pg/reqit-catalog)
  CourseAssignmentMap,
  prepareAudit,
  isAuditableGrade,
  DEFAULT_GRADE_CONFIG,
};
