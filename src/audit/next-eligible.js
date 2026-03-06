'use strict';

/**
 * next-eligible.js — Find courses the student can take next.
 *
 * Given an audit result, catalog, and transcript, identifies courses
 * that are unmet, not already in the transcript, and whose prerequisites
 * are satisfied.
 */

const { courseKey } = require('../render/shared');
const { evaluateFilters, normalizeCatalog, buildCourseIndex } = require('../resolve');
const { auditNode } = require('./single-tree');
const { normalizeTranscript } = require('./transcript');
const { MET } = require('./status');
const { findUnmet } = require('./find-unmet');

/**
 * Find courses the student is eligible to take next.
 *
 * Algorithm:
 *   1. Find unmet leaf nodes from the audit result
 *   2. Extract explicit course references and resolve course-filter nodes
 *   3. Filter out courses already in the transcript
 *   4. For each remaining candidate, check if prerequisites are satisfied
 *   5. Return eligible courses
 *
 * @param {object} auditResult - The result tree from audit() or prepareAudit().run()
 * @param {object} catalog - Catalog with courses, gradeConfig, etc.
 * @param {object[]} transcript - Student transcript entries
 * @returns {Array<{ subject: string, number: string, title: string, credits: number }>}
 */
function findNextEligible(auditResult, catalog, transcript) {
  const norm = normalizeCatalog(catalog);
  const catalogIndex = buildCourseIndex(norm.courses);
  const gradeConfig = norm.gradeConfig || catalog.gradeConfig;
  const normTranscript = normalizeTranscript(transcript, gradeConfig, catalogIndex);

  // Build set of transcript course keys (completed or in-progress)
  const transcriptKeys = new Set();
  if (normTranscript && normTranscript.byKey) {
    for (const key of normTranscript.byKey.keys()) {
      transcriptKeys.add(key);
    }
  }

  const unmetNodes = findUnmet(auditResult);

  // Collect candidate courses from unmet nodes
  const candidateKeys = new Set();
  const candidates = [];

  for (const { node } of unmetNodes) {
    if (node.type === 'course') {
      const key = courseKey(node);
      if (!candidateKeys.has(key) && !transcriptKeys.has(key)) {
        candidateKeys.add(key);
        const catalogCourse = catalogIndex.get(key);
        if (catalogCourse) {
          candidates.push(catalogCourse);
        }
      }
    } else if (node.type === 'course-filter') {
      const filters = node.filters;
      if (filters) {
        const matched = evaluateFilters(filters, norm.courses);
        for (const course of matched) {
          const key = courseKey(course);
          if (!candidateKeys.has(key) && !transcriptKeys.has(key)) {
            candidateKeys.add(key);
            candidates.push(course);
          }
        }
      }
    }
  }

  // Check prerequisites for each candidate
  const eligible = [];

  for (const course of candidates) {
    const prereqAst = course.prerequisites;

    if (!prereqAst) {
      // No prerequisites — eligible
      eligible.push(formatCourse(course));
      continue;
    }

    // Audit the prerequisite AST against the transcript
    const ctx = {
      catalog: norm,
      courses: norm.courses,
      catalogIndex,
      crossListIndex: new Map(),
      transcript: normTranscript,
      gradeConfig,
      defs: new Map(),
      expanding: new Set(),
      attainments: {},
      backtrack: false,
      warnings: [],
    };

    const prereqResult = auditNode(prereqAst, ctx);
    if (prereqResult.status === MET) {
      eligible.push(formatCourse(course));
    }
  }

  return eligible;
}

/**
 * Format a catalog course for output.
 */
function formatCourse(course) {
  return {
    subject: course.subject,
    number: course.number,
    title: course.title || '',
    credits: course.creditsMax || course.creditsMin || 0,
  };
}

module.exports = { findNextEligible };
