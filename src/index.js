'use strict';

// reqit SDK — public API

const { audit, prepareAudit, findUnmet, MET, IN_PROGRESS, PARTIAL_PROGRESS, NOT_MET } = require('./audit');
const { resolve } = require('./resolve');
const { parse } = require('./parser');
const { validate } = require('./ast/validate');
const { renderText } = require('./render/to-text');
const { renderDescription } = require('./render/to-description');
const { renderHtml } = require('./render/to-html');
const { renderOutline } = require('./render/to-outline');
const { isPassingGrade, meetsMinGrade, calculateGPA, isAuditableGrade, DEFAULT_GRADE_CONFIG } = require('./grade');

module.exports = {
  // Parser
  parse,
  // Validator
  validate,
  // Resolver
  resolve,
  // Renderers
  renderText,
  renderDescription,
  renderHtml,
  renderOutline,
  // Audit
  audit,
  prepareAudit,
  findUnmet,
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
};
