'use strict';

/**
 * dependency-matrix.js — Export a course dependency cross-reference matrix.
 *
 * Rows = courses, columns = courses. Cell = "prereq" / "transitive" / empty.
 */

const { courseKey } = require('../render/shared');
const { buildPrereqGraph } = require('./prereq-graph');
const { formatResult } = require('./index');

/**
 * Export a dependency matrix.
 *
 * @param {object} catalog - Catalog with `courses` array
 * @param {object} [options]
 * @param {string} [options.format='csv'] - 'csv' or 'xlsx'
 * @param {boolean} [options.transitive=true] - Include transitive dependencies
 * @returns {string|Promise<Buffer>}
 */
function exportDependencyMatrix(catalog, options) {
  const opts = { transitive: true, ...options };
  const graph = buildPrereqGraph(catalog);

  // Only include courses that have prereqs or are prereqs of something
  const involved = new Set();
  for (const [key, entry] of graph) {
    if (entry.direct.size > 0) {
      involved.add(key);
      for (const d of entry.direct) involved.add(d);
      if (opts.transitive) {
        for (const t of entry.transitive) involved.add(t);
      }
    }
  }

  // Sort course keys for consistent output
  const sortedKeys = [...involved].sort();

  // Build headers: first column is the course, then one column per potential prereq
  const headers = ['Course', ...sortedKeys];

  const rows = [];
  for (const rowKey of sortedKeys) {
    const row = { Course: rowKey };
    const entry = graph.get(rowKey);

    for (const colKey of sortedKeys) {
      if (entry && entry.direct.has(colKey)) {
        row[colKey] = 'prereq';
      } else if (opts.transitive && entry && entry.transitive.has(colKey)) {
        row[colKey] = 'transitive';
      } else {
        row[colKey] = '';
      }
    }

    rows.push(row);
  }

  return formatResult(rows, headers, { format: opts.format, sheetName: 'Dependencies' });
}

module.exports = { exportDependencyMatrix };
