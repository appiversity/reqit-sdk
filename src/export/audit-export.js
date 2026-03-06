'use strict';

/**
 * audit-export.js — Export an audit result as rows.
 *
 * Walks the audit result tree, produces one row per leaf requirement.
 */

const { walk } = require('../ast/walk');
const { lookupTitle } = require('../render/shared');
const { formatResult, isAncestorPath } = require('./index');

const HEADERS = ['Group', 'Requirement', 'Status', 'Satisfied By', 'Term', 'Grade', 'Credits'];

/**
 * Export an audit result.
 *
 * @param {object} auditResult - Audit result tree
 * @param {object} [catalog] - Optional catalog for title lookup
 * @param {object} [options]
 * @param {string} [options.format='csv'] - 'csv' or 'xlsx'
 * @returns {string|Promise<Buffer>}
 */
function exportAudit(auditResult, catalog, options) {
  const opts = options || {};
  const rows = [];
  const labelStack = [];

  walk(auditResult, (node, path) => {
    // Track labeled parents for the Group column
    while (labelStack.length > 0 && !isAncestorPath(labelStack[labelStack.length - 1].path, path)) {
      labelStack.pop();
    }

    if (node.label) {
      labelStack.push({ label: node.label, path });
    }

    const group = labelStack.length > 0 ? labelStack[labelStack.length - 1].label : '';

    switch (node.type) {
      case 'course': {
        const title = lookupTitle(node, catalog);
        const desc = title
          ? `${node.subject} ${node.number} — ${title}`
          : `${node.subject} ${node.number}`;
        const entry = node.satisfiedBy;
        rows.push({
          Group: group,
          Requirement: desc,
          Status: node.status,
          'Satisfied By': entry ? `${entry.subject} ${entry.number}` : '',
          Term: entry ? (entry.term || '') : '',
          Grade: entry ? (entry.grade || '') : '',
          Credits: entry ? String(entry.credits || '') : '',
        });
        break;
      }
      case 'course-filter': {
        const matched = node.matchedCourses || [];
        const inProg = node.inProgressCourses || [];
        const courses = [...matched, ...inProg];
        const courseStr = courses.map(c => `${c.subject} ${c.number}`).join('; ');
        const filterDesc = node.filters
          .map(f => `${f.field} ${f.op} ${JSON.stringify(f.value)}`)
          .join(' and ');
        rows.push({
          Group: group,
          Requirement: `Courses where ${filterDesc}`,
          Status: node.status,
          'Satisfied By': courseStr,
          Term: '',
          Grade: '',
          Credits: '',
        });
        break;
      }
      case 'score':
        rows.push({
          Group: group,
          Requirement: `Score ${node.name}`,
          Status: node.status,
          'Satisfied By': node.actual != null ? String(node.actual) : '',
          Term: '',
          Grade: '',
          Credits: '',
        });
        break;
      case 'attainment':
        rows.push({
          Group: group,
          Requirement: `Attainment: ${node.name}`,
          Status: node.status,
          'Satisfied By': '',
          Term: '',
          Grade: '',
          Credits: '',
        });
        break;
    }
  });

  return formatResult(rows, HEADERS, { format: opts.format, sheetName: 'Audit' });
}

module.exports = { exportAudit };
