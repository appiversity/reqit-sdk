'use strict';

/**
 * post-constraints.js — Shared post-constraint evaluator.
 *
 * Extracted from single-tree.js and backtrack.js to eliminate the
 * near-duplicate implementations and the inline require() calls
 * they needed to avoid circular dependencies.
 */

const { courseKey } = require('../render/shared');
const { evaluateFilter } = require('../resolve');

/**
 * Evaluate post-constraints against a set of audit result items.
 *
 * Each constraint specifies a { comparison, count, filter } triple.
 * For each item, we collect its matched transcript entries, look up
 * the catalog course, and check whether the entry's catalog course
 * matches the filter.  The count of matching entries is compared
 * against the constraint threshold.
 *
 * @param {object[]} items - Audit result nodes to check
 * @param {object[]} postConstraints - Array of { comparison, count, filter }
 * @param {object} ctx - Audit context (needs ctx.catalogIndex)
 * @returns {object[]} Array of { constraint, actual, met }
 */
function evaluatePostConstraints(items, postConstraints, ctx) {
  // Lazy require to break single-tree ↔ post-constraints circular dependency.
  // single-tree imports post-constraints at top level; loading collectMatchedEntries
  // eagerly would see an incomplete single-tree export.
  const { collectMatchedEntries } = require('./single-tree');

  return postConstraints.map(constraint => {
    const { comparison, count, filter } = constraint;
    let matching = 0;

    for (const item of items) {
      const entries = collectMatchedEntries(item);
      for (const entry of entries) {
        const catalog = entry.catalogCourse
          || ctx.catalogIndex.get(courseKey(entry));
        if (catalog && evaluateFilter(filter, catalog)) {
          matching++;
        }
      }
    }

    let met;
    switch (comparison) {
      case 'at-least': met = matching >= count; break;
      case 'at-most': met = matching <= count; break;
      case 'exactly': met = matching === count; break;
      default: met = false;
    }

    return { constraint, actual: matching, met };
  });
}

module.exports = {
  evaluatePostConstraints,
};
