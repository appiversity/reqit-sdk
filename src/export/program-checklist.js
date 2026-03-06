'use strict';

/**
 * program-checklist.js — Export a program's requirements as a checklist.
 *
 * Walks the AST, produces one row per leaf requirement.
 */

const { walk } = require('../ast/walk');
const { courseKey, lookupTitle, comparisonPhrase } = require('../render/shared');
const { formatResult, isAncestorPath } = require('./index');

const HEADERS = ['Group', 'Requirement', 'Type', 'Courses', 'Credits'];

/**
 * Export a program requirements checklist.
 *
 * @param {object} ast - A reqit AST
 * @param {object} [catalog] - Optional catalog for title lookup
 * @param {object} [options]
 * @param {string} [options.format='csv'] - 'csv' or 'xlsx'
 * @returns {string|Promise<Buffer>}
 */
function exportProgramChecklist(ast, catalog, options) {
  const opts = options || {};
  const rows = [];
  const labelStack = [];

  walk(ast, (node, path, parent) => {
    // Track labeled parents for the Group column
    // We maintain this by checking path depth
    while (labelStack.length > 0 && !isAncestorPath(labelStack[labelStack.length - 1].path, path)) {
      labelStack.pop();
    }

    if (node.label) {
      labelStack.push({ label: node.label, path });
    }

    const group = labelStack.length > 0 ? labelStack[labelStack.length - 1].label : '';

    // Only produce rows for leaf nodes
    switch (node.type) {
      case 'course': {
        const title = lookupTitle(node, catalog);
        const desc = title
          ? `${node.subject} ${node.number} — ${title}`
          : `${node.subject} ${node.number}`;
        rows.push({
          Group: group,
          Requirement: desc,
          Type: 'required',
          Courses: `${node.subject} ${node.number}`,
          Credits: '',
        });
        break;
      }
      case 'course-filter': {
        const desc = node.filters
          .map(f => `${f.field} ${f.op} ${JSON.stringify(f.value)}`)
          .join(' and ');
        rows.push({
          Group: group,
          Requirement: `Courses where ${desc}`,
          Type: 'filter',
          Courses: '',
          Credits: '',
        });
        break;
      }
      case 'score':
        rows.push({
          Group: group,
          Requirement: `Score ${node.name} ${node.op} ${node.value}`,
          Type: 'score',
          Courses: '',
          Credits: '',
        });
        break;
      case 'attainment':
        rows.push({
          Group: group,
          Requirement: `Attainment: ${node.name}`,
          Type: 'attainment',
          Courses: '',
          Credits: '',
        });
        break;
      case 'quantity':
        rows.push({
          Group: group,
          Requirement: `Quantity: ${node.name} ${node.op} ${node.value}`,
          Type: 'quantity',
          Courses: '',
          Credits: '',
        });
        break;
      case 'n-of':
      case 'from-n-groups': {
        // Add a group-level row for n-of nodes
        if (!node.label) {
          const comp = comparisonPhrase(node.comparison || 'at-least');
          rows.push({
            Group: group,
            Requirement: `Choose ${comp} ${node.count}`,
            Type: `choose-${node.count}`,
            Courses: '',
            Credits: '',
          });
        }
        break;
      }
      case 'credits-from': {
        const comp = comparisonPhrase(node.comparison || 'at-least');
        rows.push({
          Group: group,
          Requirement: `${comp} ${node.credits} credits`,
          Type: 'credits',
          Courses: '',
          Credits: String(node.credits),
        });
        break;
      }
    }
  });

  return formatResult(rows, HEADERS, { format: opts.format, sheetName: 'Checklist' });
}

module.exports = { exportProgramChecklist };
