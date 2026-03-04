'use strict';

/**
 * multi-tree.js — Multi-tree audit orchestration.
 *
 * Handles auditing a student against multiple requirement trees
 * (e.g. major + minor + gen-ed) with shared course tracking,
 * overlap limits, outside-program checks, and program context refs.
 *
 * Strategy: greedy sequential.
 *   1. Audit each tree independently via single-tree audit()
 *   2. Track course assignments across trees
 *   3. Evaluate multi-tree policy nodes (overlap-limit, outside-program, etc.)
 *   4. Optionally backtrack to resolve overlap violations
 */

const {
  normalizeCatalog,
  buildCourseIndex,
  buildCrossListIndex,
  collectDefs,
} = require('../resolve');
const { normalizeTranscript } = require('./transcript');
const { auditNode, collectMatchedEntries } = require('./single-tree');
const { courseKey } = require('../render/shared');

// ============================================================
// CourseAssignmentMap — tracks which courses are used by which trees
// ============================================================

class CourseAssignmentMap {
  constructor() {
    /** @type {Map<string, string[]>} courseKey → array of programCodes */
    this._map = new Map();
  }

  /**
   * Assign a course to a program.
   * @param {string} key - courseKey (e.g. "MATH:151")
   * @param {string} programCode - program code (e.g. "BS-CSCI")
   */
  assign(key, programCode) {
    if (!this._map.has(key)) {
      this._map.set(key, []);
    }
    const programs = this._map.get(key);
    if (!programs.includes(programCode)) {
      programs.push(programCode);
    }
  }

  /**
   * Get all program codes a course is assigned to.
   * @param {string} key - courseKey
   * @returns {string[]} array of programCodes (empty if unassigned)
   */
  getAssignments(key) {
    return this._map.get(key) || [];
  }

  /**
   * Check if a course is assigned to a specific program.
   * @param {string} key - courseKey
   * @param {string} programCode
   * @returns {boolean}
   */
  isAssigned(key, programCode) {
    const programs = this._map.get(key);
    return programs ? programs.includes(programCode) : false;
  }

  /**
   * Get all course keys that are shared between two programs.
   * @param {string} programA
   * @param {string} programB
   * @returns {string[]} array of courseKeys
   */
  getSharedCourses(programA, programB) {
    const shared = [];
    for (const [key, programs] of this._map) {
      if (programs.includes(programA) && programs.includes(programB)) {
        shared.push(key);
      }
    }
    return shared;
  }

  /**
   * Get all course keys assigned to a specific program.
   * @param {string} programCode
   * @returns {string[]}
   */
  getCoursesForProgram(programCode) {
    const courses = [];
    for (const [key, programs] of this._map) {
      if (programs.includes(programCode)) {
        courses.push(key);
      }
    }
    return courses;
  }

  /**
   * Get all course keys NOT assigned to a specific program.
   * @param {string} programCode
   * @returns {string[]}
   */
  getCoursesOutsideProgram(programCode) {
    const outside = [];
    for (const [key, programs] of this._map) {
      if (!programs.includes(programCode)) {
        outside.push(key);
      }
    }
    return outside;
  }

  /** Total number of tracked course keys. */
  get size() {
    return this._map.size;
  }

  /** Iterate over [courseKey, programCodes[]] entries. */
  entries() {
    return this._map.entries();
  }
}

// ============================================================
// auditMulti — main entry point
// ============================================================

/**
 * Audit a student against multiple requirement trees.
 *
 * @param {object[]} trees - Array of { ast, programCode, role }
 *   role: 'primary-major' | 'secondary-major' | 'primary-minor' | etc.
 * @param {object} catalog - Shared catalog
 * @param {object[]} transcript - Student transcript entries
 * @param {object} [options] - Options (passed to individual audit() calls)
 * @returns {{
 *   results: Map<string, object>,  // programCode → audit result
 *   assignments: CourseAssignmentMap,
 *   warnings: object[]
 * }}
 */
function auditMulti(trees, catalog, transcript, options) {
  const opts = options || {};
  const assignments = new CourseAssignmentMap();
  const results = new Map();
  const warnings = [];

  // Build role → programCode lookup for program-context-ref resolution
  const roleMap = new Map();
  for (const tree of trees) {
    if (tree.role) {
      roleMap.set(tree.role, tree.programCode);
    }
  }

  // Pre-build shared catalog structures
  const norm = normalizeCatalog(catalog);
  const catalogIndex = buildCourseIndex(norm.courses);
  const crossListIndex = buildCrossListIndex(norm.courses);
  const gradeConfig = norm.gradeConfig || catalog.gradeConfig;
  const normTranscript = normalizeTranscript(transcript, gradeConfig, catalogIndex);

  // --- Pass 1: Audit each tree independently ---
  for (const tree of trees) {
    const defs = collectDefs(tree.ast, '', new Map());
    const ctx = {
      catalog: norm,
      courses: norm.courses,
      catalogIndex,
      crossListIndex,
      transcript: normTranscript,
      gradeConfig,
      defs,
      expanding: new Set(),
      attainments: opts.attainments || {},
      backtrack: opts.backtrack || false,
      warnings: [],
    };

    const result = auditNode(tree.ast, ctx);
    const auditResult = { status: result.status, result, warnings: ctx.warnings };
    results.set(tree.programCode, auditResult);

    // Track course assignments: collect all matched entries and assign
    const matchedEntries = collectMatchedEntries(result);
    for (const entry of matchedEntries) {
      assignments.assign(courseKey(entry), tree.programCode);
    }

    // Collect warnings
    for (const w of ctx.warnings) {
      warnings.push({ ...w, programCode: tree.programCode });
    }
  }

  // --- Pass 2: Evaluate multi-tree policy nodes ---
  // (overlap-limit, outside-program, program-context-ref)
  // Delegated to evaluateMultiTreePolicies when those nodes exist
  const multiCtx = { results, assignments, roleMap, catalog, transcript, warnings };
  evaluateMultiTreePolicies(trees, multiCtx);

  return { results, assignments, warnings };
}

/**
 * Evaluate multi-tree policy nodes across all trees.
 * Placeholder for Phase 8 commit 6 — currently a no-op.
 */
function evaluateMultiTreePolicies(trees, ctx) {
  // Will be implemented in commit 6
}

module.exports = {
  auditMulti,
  CourseAssignmentMap,
};
