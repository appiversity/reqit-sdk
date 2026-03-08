'use strict';

/**
 * find-unmet.js — Extract unmet leaf requirements from an audit result tree.
 *
 * Extracted into its own module so both audit/index.js and
 * audit/next-eligible.js can import it without circular dependency.
 */

const { forEachChild } = require('../ast/children');
const { MET, PROVISIONAL_MET, WAIVED, SUBSTITUTED } = require('./status');

/**
 * Walk an audit result tree and collect all nodes whose status is not 'met'.
 *
 * Only recurses into children of composites that are NOT_MET or
 * IN_PROGRESS. MET and PROVISIONAL_MET composites are skipped — their
 * children don't need student action.
 *
 * Returns a flat array of nodes that need attention, each annotated with
 * its path from the root. Useful for generating "what's missing" reports.
 *
 * @param {object} result - An audit result tree (from audit() or prepareAudit().run())
 * @returns {object[]} Array of { node, path, status }
 */
function findUnmet(result) {
  const unmet = [];

  function walkResult(node, path) {
    if (!node || typeof node !== 'object') return;

    // Skip satisfied composites — their children don't need action
    if (node.status === MET || node.status === PROVISIONAL_MET ||
        node.status === WAIVED || node.status === SUBSTITUTED) return;

    if (node.status) {
      // Only collect leaf-level unmet nodes (nodes with no children)
      let hasChildren = false;
      forEachChild(node, () => { hasChildren = true; });
      if (!hasChildren) {
        unmet.push({ node, path, status: node.status });
      }
    }

    // Recurse into children of unsatisfied composites
    forEachChild(node, (child, key) => {
      const prop = node[key];
      if (Array.isArray(prop)) {
        const idx = prop.indexOf(child);
        walkResult(child, [...path, key, idx]);
      } else {
        walkResult(child, [...path, key]);
      }
    });
  }

  walkResult(result, []);
  return unmet;
}

module.exports = { findUnmet };
