'use strict';

/**
 * reqit/advanced — Low-level exports for downstream packages (reqit-pg, reqit-catalog).
 *
 * These are NOT part of the primary public API. Most consumers should use
 * `require('reqit')` instead. This subpath provides engine internals needed
 * by the reqit ecosystem packages.
 */

const { prepareAudit } = require('./audit');
const { CourseAssignmentMap } = require('./audit/multi-tree');
const { isAuditableGrade, DEFAULT_GRADE_CONFIG } = require('./grade');

module.exports = {
  /** Pre-resolve and prepare an AST for repeated auditing against different transcripts. */
  prepareAudit,
  /** Map tracking which courses have been assigned to which requirement nodes. */
  CourseAssignmentMap,
  /** Check whether a grade string represents an auditable (non-withdrawal, non-incomplete) grade. */
  isAuditableGrade,
  /** The built-in grade configuration (scale, pass/fail, withdrawal, incomplete). */
  DEFAULT_GRADE_CONFIG,
};
