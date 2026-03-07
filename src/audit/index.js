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
const { buildExceptionContext, applySubstitutions, partitionExceptions } = require('./exceptions');

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

      // Build exception context if exceptions provided
      const exceptions = opts.exceptions || [];
      const exCtx = exceptions.length > 0
        ? buildExceptionContext(exceptions)
        : null;

      // Apply substitutions — create virtual transcript entries
      if (exCtx && exCtx.substitutions.size > 0) {
        applySubstitutions(normTranscript, exCtx.substitutions);
      }

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
        // Exception context (null when no exceptions)
        waivers: exCtx ? exCtx.waivers : null,
        substitutions: exCtx ? exCtx.substitutions : null,
        // Program reference context
        declaredPrograms: opts.declaredPrograms || [],
        visitedPrograms: new Set(),
        programCache: new Map(),
      };

      const result = auditNode(ast, ctx);

      // Partition exceptions into applied/unused
      const auditResult = {
        status: result.status,
        result,
        warnings: ctx.warnings,
      };

      if (exceptions.length > 0) {
        const { applied, unused } = partitionExceptions(exceptions, result, normTranscript);
        auditResult.exceptions = { applied, unused };
        // Warn about unused exceptions
        for (const ex of unused) {
          const desc = ex.kind === 'waiver'
            ? describeWaiverTarget(ex)
            : `${ex.original.subject} ${ex.original.number} → ${ex.replacement.subject} ${ex.replacement.number}`;
          ctx.warnings.push({
            type: 'unused-exception',
            exception: ex.toJSON(),
            message: `${ex.kind === 'waiver' ? 'Waiver' : 'Substitution'} for ${desc} did not match any requirement node`,
          });
        }
      }

      return auditResult;
    },
  };
}

function describeWaiverTarget(w) {
  const t = w.target;
  if (t.course) return `${t.course.subject} ${t.course.number}`;
  if (t.score) return `score ${t.score}`;
  if (t.attainment) return `attainment ${t.attainment}`;
  if (t.quantity) return `quantity ${t.quantity}`;
  if (t.label) return `label "${t.label}"`;
  return 'unknown target';
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
