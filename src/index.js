'use strict';

// reqit SDK — public API

const { audit, prepareAudit, findUnmet, findNextEligible, auditMulti, CourseAssignmentMap, MET, IN_PROGRESS, PARTIAL_PROGRESS, NOT_MET } = require('./audit');
const { resolve } = require('./resolve');
const { parse } = require('./parser');
const { validate } = require('./ast/validate');
const { toText } = require('./render/to-text');
const { toDescription } = require('./render/to-description');
const { toHTML } = require('./render/to-html');
const { toOutline } = require('./render/to-outline');
const { isPassingGrade, meetsMinGrade, calculateGPA, isAuditableGrade, DEFAULT_GRADE_CONFIG } = require('./grade');
const { walk, transform } = require('./ast/walk');
const { extractCourses, extractAllReferences } = require('./ast/extract');
const { diff } = require('./ast/diff');
// Export
const { exportPrereqMatrix } = require('./export/prereq-matrix');
const { exportProgramChecklist } = require('./export/program-checklist');
const { exportAudit } = require('./export/audit-export');
const { exportDependencyMatrix } = require('./export/dependency-matrix');

module.exports = {
  // Parser
  parse,
  // Validator
  validate,
  // Resolver
  resolve,
  // Renderers
  toText,
  toDescription,
  toHTML,
  toOutline,
  // Audit
  audit,
  prepareAudit,
  findUnmet,
  findNextEligible,
  auditMulti,
  CourseAssignmentMap,
  // Audit status constants
  MET,
  IN_PROGRESS,
  PARTIAL_PROGRESS,
  NOT_MET,
  // Grade
  isPassingGrade,
  meetsMinGrade,
  calculateGPA,
  isAuditableGrade,
  DEFAULT_GRADE_CONFIG,
  // AST utilities
  walk,
  transform,
  extractCourses,
  extractAllReferences,
  diff,
  // Export
  exportPrereqMatrix,
  exportProgramChecklist,
  exportAudit,
  exportDependencyMatrix,
};
