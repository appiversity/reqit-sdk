'use strict';

/**
 * backtrack.js — Post-constraint backtracking solver for n-of nodes.
 *
 * When greedy post-constraint evaluation fails, the backtracking solver
 * searches for a subset of K items from the met items that satisfies all
 * post-constraints. This is needed when the student has met more than K
 * items, but an at-most constraint on the selection disqualifies the full set.
 *
 * Example:
 *   n-of at-least 3 of [A, B, C, D, E] where at-most 1 from CMPS
 *   Student met all 5, but 2 are CMPS → greedy fails.
 *   Backtracking finds {A, B, D} with only 1 CMPS → passes.
 */

const { evaluatePostConstraints } = require('./post-constraints');

/**
 * Try to find a subset of exactly K items from metItems that satisfies
 * all post-constraints.
 *
 * @param {object[]} metItems - Audit result nodes with status === 'met'
 * @param {number} k - Number of items to select
 * @param {object[]} postConstraints - Array of { comparison, count, filter }
 * @param {object} ctx - Audit context (for catalogIndex)
 * @returns {{ found: boolean, selected: object[] | null, constraintResults: object[] | null }}
 */
function backtrackPostConstraints(metItems, k, postConstraints, ctx) {
  // If K >= metItems.length, no choice — must use all
  if (k >= metItems.length) {
    return { found: false, selected: null, constraintResults: null };
  }

  // Generate combinations of size K and test each
  const result = { found: false, selected: null, constraintResults: null };

  function* combinations(arr, size) {
    if (size === 0) { yield []; return; }
    for (let i = 0; i <= arr.length - size; i++) {
      for (const rest of combinations(arr.slice(i + 1), size - 1)) {
        yield [arr[i], ...rest];
      }
    }
  }

  for (const combo of combinations(metItems, k)) {
    const constraintResults = evaluatePostConstraints(combo, postConstraints, ctx);
    const allMet = constraintResults.every(c => c.met);
    if (allMet) {
      result.found = true;
      result.selected = combo;
      result.constraintResults = constraintResults;
      return result;
    }
  }

  return result;
}

module.exports = {
  backtrackPostConstraints,
};
