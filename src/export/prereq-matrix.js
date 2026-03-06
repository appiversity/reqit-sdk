'use strict';

/**
 * prereq-matrix.js — Export prerequisite relationships as rows.
 *
 * One row per course→prerequisite pair. Supports direct-only or
 * direct + transitive relationships.
 */

const { courseKey } = require('../render/shared');
const { buildPrereqGraph } = require('./prereq-graph');
const { formatResult } = require('./index');

const HEADERS = ['Subject', 'Number', 'Title', 'Prereq Subject', 'Prereq Number', 'Prereq Title', 'Relationship'];

/**
 * Export a prerequisite matrix.
 *
 * @param {object} catalog - Catalog with `courses` array
 * @param {object} [options]
 * @param {string} [options.format='csv'] - 'csv' or 'xlsx'
 * @param {boolean} [options.transitive=false] - Include transitive prerequisites
 * @param {boolean} [options.includeNoPrereqs=false] - Include courses with no prereqs
 * @returns {string|Promise<Buffer>} CSV string or XLSX Buffer promise
 */
function exportPrereqMatrix(catalog, options) {
  const opts = options || {};
  const graph = buildPrereqGraph(catalog);
  const courseIndex = new Map();
  for (const c of catalog.courses) {
    courseIndex.set(courseKey(c), c);
  }

  const rows = [];

  // Sort courses by subject then number
  const sortedKeys = [...graph.keys()].sort();

  for (const key of sortedKeys) {
    const entry = graph.get(key);
    const course = courseIndex.get(key);
    if (!course) continue;

    // Collect prereqs to output
    const prereqs = [];

    for (const prereqKey of [...entry.direct].sort()) {
      prereqs.push({ key: prereqKey, relationship: 'direct' });
    }

    if (opts.transitive) {
      for (const prereqKey of [...entry.transitive].sort()) {
        prereqs.push({ key: prereqKey, relationship: 'transitive' });
      }
    }

    if (prereqs.length === 0 && opts.includeNoPrereqs) {
      rows.push({
        Subject: course.subject,
        Number: course.number,
        Title: course.title || '',
        'Prereq Subject': '',
        'Prereq Number': '',
        'Prereq Title': '',
        Relationship: '',
      });
      continue;
    }

    for (const { key: prereqKey, relationship } of prereqs) {
      const prereqCourse = courseIndex.get(prereqKey);
      rows.push({
        Subject: course.subject,
        Number: course.number,
        Title: course.title || '',
        'Prereq Subject': prereqCourse ? prereqCourse.subject : prereqKey.split(':')[0],
        'Prereq Number': prereqCourse ? prereqCourse.number : prereqKey.split(':')[1],
        'Prereq Title': prereqCourse ? (prereqCourse.title || '') : '',
        Relationship: relationship,
      });
    }
  }

  return formatResult(rows, HEADERS, { format: opts.format, sheetName: 'Prerequisites' });
}

module.exports = { exportPrereqMatrix };
