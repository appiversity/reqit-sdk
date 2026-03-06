'use strict';

// reqit SDK — public API (class-based)

const { parse: internalParse } = require('./parser');
const {
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
} = require('./entities');
const { auditMulti: internalAuditMulti, CourseAssignmentMap } = require('./audit/multi-tree');
const { prepareAudit } = require('./audit');
const { isPassingGrade, meetsMinGrade, calculateGPA: internalCalculateGPA, isAuditableGrade, DEFAULT_GRADE_CONFIG, isValidGrade } = require('./grade');
const { exportPrereqMatrix } = require('./export/prereq-matrix');
const { exportDependencyMatrix } = require('./export/dependency-matrix');

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

function transcript(entries) {
  return new Transcript(entries);
}

// ============================================================
// calculateGPA — entity-aware wrapper
// ============================================================

function calculateGPA(entriesOrTranscript, configOrCatalog) {
  const entries = entriesOrTranscript instanceof Transcript
    ? unwrapTranscript(entriesOrTranscript)
    : Array.isArray(entriesOrTranscript)
      ? entriesOrTranscript.map(e => e instanceof TranscriptEntry ? e.toJSON() : e)
      : entriesOrTranscript;
  const config = configOrCatalog instanceof Catalog
    ? configOrCatalog.gradeConfig
    : configOrCatalog;
  return internalCalculateGPA(entries, config);
}

// ============================================================
// Multi-tree audit facade
// ============================================================

function publicAuditMulti(cat, tx, options) {
  const { trees, overlapRules, programContext, ...rest } = options || {};
  const asts = {};
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
  const raw = internalAuditMulti(
    treeArray,
    unwrapCatalog(cat),
    unwrapTranscript(tx),
    { overlapRules, ...rest },
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
  // Entity classes (for instanceof checks)
  Requirement,
  Catalog,
  Transcript,
  TranscriptEntry,
  ResolutionResult,
  AuditResult,
  MultiAuditResult,
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
