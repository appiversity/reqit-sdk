'use strict';

/**
 * extract.js — Extract course references from ASTs.
 */

const { walk } = require('./walk');
const { courseKey } = require('../render/shared');
const { evaluateFilters, normalizeCatalog } = require('../resolve');

/**
 * Extract all explicit course nodes from an AST.
 *
 * Returns a deduplicated array of `{ subject, number }` objects for
 * every `course` node in the tree.
 *
 * @param {object} ast - A reqit AST
 * @returns {Array<{ subject: string, number: string }>}
 */
function extractCourses(ast) {
  const seen = new Set();
  const courses = [];

  walk(ast, (node) => {
    if (node.type === 'course') {
      const key = courseKey(node);
      if (!seen.has(key)) {
        seen.add(key);
        courses.push({ subject: node.subject, number: node.number });
      }
    }
  });

  return courses;
}

/**
 * Extract all course references from an AST, including filter-resolved matches.
 *
 * Returns `{ explicit, filtered }`:
 *   - `explicit`: all `course` nodes (same as `extractCourses`)
 *   - `filtered`: all courses matched by `course-filter` nodes resolved against the catalog
 *
 * Each category is independently deduplicated by `courseKey()`.
 *
 * @param {object} ast - A reqit AST
 * @param {object} catalog - Catalog with `courses` array
 * @returns {{ explicit: Array<{ subject: string, number: string }>, filtered: Array<{ subject: string, number: string }> }}
 */
function extractAllReferences(ast, catalog) {
  const norm = normalizeCatalog(catalog);
  const explicitSeen = new Set();
  const filteredSeen = new Set();
  const explicit = [];
  const filtered = [];

  walk(ast, (node) => {
    if (node.type === 'course') {
      const key = courseKey(node);
      if (!explicitSeen.has(key)) {
        explicitSeen.add(key);
        explicit.push({ subject: node.subject, number: node.number });
      }
    } else if (node.type === 'course-filter') {
      const matched = evaluateFilters(node.filters, norm.courses);
      for (const course of matched) {
        const key = courseKey(course);
        if (!filteredSeen.has(key)) {
          filteredSeen.add(key);
          filtered.push({ subject: course.subject, number: course.number });
        }
      }
    }
  });

  return { explicit, filtered };
}

module.exports = { extractCourses, extractAllReferences };
