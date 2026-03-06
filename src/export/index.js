'use strict';

/**
 * export/index.js — Central entry point for export functions.
 */

const { toCSV, toXLSX } = require('./serialize');

/**
 * Format rows as CSV or XLSX based on options.
 *
 * @param {Array<object>} rows - Data rows
 * @param {string[]} headers - Column headers
 * @param {object} [options]
 * @param {string} [options.format='csv'] - 'csv' or 'xlsx'
 * @param {string} [options.sheetName='Sheet1'] - Worksheet name for XLSX
 * @returns {string|Promise<Buffer>} CSV string or XLSX Buffer promise
 */
function formatResult(rows, headers, options) {
  const opts = options || {};
  if (opts.format === 'xlsx') {
    return toXLSX(rows, headers, opts.sheetName);
  }
  return toCSV(rows, headers);
}

/**
 * Check if pathA is an ancestor of pathB.
 * Used by export modules that track labeled groups via a path-based stack.
 *
 * @param {Array} pathA
 * @param {Array} pathB
 * @returns {boolean}
 */
function isAncestorPath(pathA, pathB) {
  if (pathA.length >= pathB.length) return false;
  for (let i = 0; i < pathA.length; i++) {
    if (pathA[i] !== pathB[i]) return false;
  }
  return true;
}

module.exports = {
  toCSV,
  toXLSX,
  formatResult,
  isAncestorPath,
};
