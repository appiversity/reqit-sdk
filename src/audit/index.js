'use strict';

/**
 * audit/index.js — Public API for single-tree and multi-tree auditing.
 */

const {
  prepareCatalog,
  collectDefs,
} = require('../resolve');
const { normalizeTranscript } = require('./transcript');
const { auditNode } = require('./single-tree');
const { MET, IN_PROGRESS, PARTIAL_PROGRESS, NOT_MET, buildSummary } = require('./status');
const { findUnmet } = require('./find-unmet');

/**
 * Audit a requirement AST against a student transcript.
 *
 * @param {object} ast - A validated reqit AST
 * @param {object} catalog - Catalog with courses, gradeConfig, etc.
 * @param {object[]} transcript - Array of transcript entries
 * @param {object} [options] - Options
 * @param {object} [options.attainments] - Student attainments (scores, booleans)
 * @param {boolean} [options.backtrack] - Enable backtracking for post-constraints
 * @returns {{ status, result, warnings }}
 */
function audit(ast, catalog, transcript, options) {
  const prepared = prepareAudit(ast, catalog);
  return prepared.run(transcript, options);
}

/**
 * Pre-resolve a catalog and AST for batch auditing.
 *
 * Builds catalog indexes and collects variable defs once, then returns
 * a reusable object whose `.run()` method audits a transcript without
 * repeating catalog preparation.
 *
 * @param {object} ast - A validated reqit AST
 * @param {object} catalog - Catalog with courses, gradeConfig, etc.
 * @returns {{ run: (transcript: object[], options?: object) => { status, result, warnings } }}
 */
function prepareAudit(ast, catalog) {
  const { norm, catalogIndex, crossListIndex, gradeConfig } = prepareCatalog(catalog);
  const defs = collectDefs(ast, '', new Map());

  return {
    run(transcript, options) {
      const opts = options || {};
      const normTranscript = normalizeTranscript(transcript, gradeConfig, catalogIndex);

      const ctx = {
        catalog: norm,
        courses: norm.courses,
        catalogIndex,
        crossListIndex,
        transcript: normTranscript,
        gradeConfig,
        defs,
        expanding: new Set(),
        attainments: opts.attainments || {},
        backtrack: opts.backtrack || false,
        warnings: [],
      };

      const result = auditNode(ast, ctx);

      return {
        status: result.status,
        result,
        warnings: ctx.warnings,
      };
    },
  };
}

const { auditMulti, CourseAssignmentMap } = require('./multi-tree');
const { findNextEligible } = require('./next-eligible');

module.exports = {
  audit,
  prepareAudit,
  findUnmet,
  findNextEligible,
  auditMulti,
  CourseAssignmentMap,
  MET,
  IN_PROGRESS,
  PARTIAL_PROGRESS,
  NOT_MET,
};
