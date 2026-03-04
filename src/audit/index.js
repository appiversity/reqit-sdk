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

/**
 * Walk an audit result tree and collect all nodes whose status is not 'met'.
 *
 * Returns a flat array of nodes that need attention, each annotated with
 * its path from the root. Useful for generating "what's missing" reports.
 *
 * @param {object} result - An audit result tree (from audit() or prepareAudit().run())
 * @returns {object[]} Array of { node, path, status }
 */
function findUnmet(result) {
  const unmet = [];

  function walk(node, path) {
    if (!node || typeof node !== 'object') return;

    if (node.status && node.status !== MET) {
      // Only collect leaf-level unmet nodes or nodes with no children
      const isLeaf = !node.items && !node.source && !node.requirement && !node.resolved && !node.exclude;
      if (isLeaf) {
        unmet.push({ node, path, status: node.status });
      }
    }

    // Recurse into children
    if (node.items && Array.isArray(node.items)) {
      for (let i = 0; i < node.items.length; i++) {
        walk(node.items[i], [...path, `items[${i}]`]);
      }
    }
    if (node.source) walk(node.source, [...path, 'source']);
    if (node.requirement) walk(node.requirement, [...path, 'requirement']);
    if (node.resolved) walk(node.resolved, [...path, 'resolved']);
    if (node.exclude && Array.isArray(node.exclude)) {
      for (let i = 0; i < node.exclude.length; i++) {
        walk(node.exclude[i], [...path, `exclude[${i}]`]);
      }
    }
  }

  walk(result, []);
  return unmet;
}

const { auditMulti, CourseAssignmentMap } = require('./multi-tree');

module.exports = {
  audit,
  prepareAudit,
  findUnmet,
  auditMulti,
  CourseAssignmentMap,
  MET,
  IN_PROGRESS,
  PARTIAL_PROGRESS,
  NOT_MET,
};
