'use strict';

/**
 * find-unmet.js — Extract unmet leaf requirements from an audit result tree.
 *
 * Extracted into its own module so both audit/index.js and
 * audit/next-eligible.js can import it without circular dependency.
 */

const { forEachChild } = require('../ast/children');
const { MET } = require('./status');

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

  function walkResult(node, path) {
    if (!node || typeof node !== 'object') return;

    if (node.status && node.status !== MET) {
      // Only collect leaf-level unmet nodes or nodes with no children
      let hasChildren = false;
      forEachChild(node, () => { hasChildren = true; });
      if (!hasChildren) {
        unmet.push({ node, path, status: node.status });
      }
    }

    // Recurse into children
    forEachChild(node, (child, key) => {
      const prop = node[key];
      if (Array.isArray(prop)) {
        const idx = prop.indexOf(child);
        walkResult(child, [...path, `${key}[${idx}]`]);
      } else {
        walkResult(child, [...path, key]);
      }
    });
  }

  walkResult(result, []);
  return unmet;
}

module.exports = { findUnmet };
