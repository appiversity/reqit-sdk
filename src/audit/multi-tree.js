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
const { MET, NOT_MET } = require('./status');

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
  const multiCtx = { results, assignments, roleMap, catalog, transcript, warnings, normTranscript };
  evaluateMultiTreePolicies(trees, multiCtx);

  return { results, assignments, warnings };
}

/**
 * Evaluate multi-tree policy nodes across all trees.
 *
 * Walks each tree's AST looking for policy nodes (overlap-limit,
 * outside-program, program-context-ref) and evaluates them using
 * the multi-tree context (assignments, role map, etc.).
 *
 * Updates the policyResults map in ctx with evaluation outcomes.
 */
function evaluateMultiTreePolicies(trees, ctx) {
  ctx.policyResults = [];

  for (const tree of trees) {
    walkForPolicies(tree.ast, tree.programCode, ctx);
  }
}

/**
 * Walk an AST looking for policy nodes and evaluate them.
 */
function walkForPolicies(node, ownerProgram, ctx) {
  if (!node || typeof node !== 'object') return;

  switch (node.type) {
    case 'overlap-limit':
      ctx.policyResults.push(evaluateOverlapLimit(node, ownerProgram, ctx));
      break;
    case 'outside-program':
      ctx.policyResults.push(evaluateOutsideProgram(node, ownerProgram, ctx));
      break;
    case 'program-context-ref':
      ctx.policyResults.push(evaluateProgramContextRef(node, ownerProgram, ctx));
      break;
  }

  // Recurse into children
  if (node.items) for (const child of node.items) walkForPolicies(child, ownerProgram, ctx);
  if (node.source) walkForPolicies(node.source, ownerProgram, ctx);
  if (node.requirement) walkForPolicies(node.requirement, ownerProgram, ctx);
  if (node.body) walkForPolicies(node.body, ownerProgram, ctx);
}

// ============================================================
// Policy node evaluators
// ============================================================

/**
 * Evaluate an overlap-limit node.
 *
 * Counts shared courses/credits between two programs and checks
 * against the limit.
 *
 * Node shape:
 *   { type: 'overlap-limit', programA, programB, comparison, value, unit }
 *   unit: 'courses' | 'credits' | 'percent'
 *   comparison: 'at-most'
 */
function evaluateOverlapLimit(node, ownerProgram, ctx) {
  const programA = resolveProgram(node.programA, ctx);
  const programB = resolveProgram(node.programB, ctx);

  if (!programA || !programB) {
    ctx.warnings.push({
      type: 'overlap-limit-unresolved',
      programA: node.programA,
      programB: node.programB,
      message: `Cannot resolve programs for overlap-limit: ${node.programA} / ${node.programB}`,
    });
    return { type: 'overlap-limit', status: NOT_MET, node };
  }

  const shared = ctx.assignments.getSharedCourses(programA, programB);
  const unit = node.unit || 'courses';
  let actual;

  if (unit === 'courses') {
    actual = shared.length;
  } else if (unit === 'credits') {
    actual = sumCredits(shared, ctx);
  } else if (unit === 'percent') {
    const totalA = ctx.assignments.getCoursesForProgram(programA).length;
    actual = totalA > 0 ? Math.round((shared.length / totalA) * 100) : 0;
  } else {
    actual = shared.length;
  }

  const met = actual <= node.value;

  if (!met) {
    ctx.warnings.push({
      type: 'overlap-limit-exceeded',
      programA,
      programB,
      limit: node.value,
      actual,
      unit,
      sharedCourses: shared,
      message: `Overlap limit exceeded: ${actual} ${unit} shared between ${programA} and ${programB} (limit: ${node.value})`,
    });
  }

  return {
    type: 'overlap-limit',
    status: met ? MET : NOT_MET,
    programA,
    programB,
    limit: node.value,
    actual,
    unit,
    sharedCourses: shared,
  };
}

/**
 * Evaluate an outside-program node.
 *
 * Counts courses or credits NOT assigned to a referenced program.
 *
 * Node shape:
 *   { type: 'outside-program', program, comparison, value, unit }
 *   unit: 'credits' | 'courses'
 *   comparison: 'at-least'
 */
function evaluateOutsideProgram(node, ownerProgram, ctx) {
  const program = resolveProgram(node.program, ctx);

  if (!program) {
    ctx.warnings.push({
      type: 'outside-program-unresolved',
      program: node.program,
      message: `Cannot resolve program for outside-program: ${node.program}`,
    });
    return { type: 'outside-program', status: NOT_MET, node };
  }

  const outside = ctx.assignments.getCoursesOutsideProgram(program);
  const unit = node.unit || 'credits';
  let actual;

  if (unit === 'credits') {
    actual = sumCredits(outside, ctx);
  } else {
    actual = outside.length;
  }

  const comparison = node.comparison || 'at-least';
  let met;
  if (comparison === 'at-least') {
    met = actual >= node.value;
  } else if (comparison === 'at-most') {
    met = actual <= node.value;
  } else {
    met = actual === node.value;
  }

  return {
    type: 'outside-program',
    status: met ? MET : NOT_MET,
    program,
    actual,
    required: node.value,
    unit,
    comparison,
  };
}

/**
 * Evaluate a program-context-ref node.
 *
 * Resolves a role (e.g. 'primary-major') to an actual program code
 * using the role map, then returns the referenced program's audit result status.
 *
 * Node shape:
 *   { type: 'program-context-ref', role }
 */
function evaluateProgramContextRef(node, ownerProgram, ctx) {
  const resolved = ctx.roleMap.get(node.role);

  if (!resolved) {
    ctx.warnings.push({
      type: 'program-context-ref-unresolved',
      role: node.role,
      message: `Cannot resolve program-context-ref role: ${node.role}`,
    });
    return { type: 'program-context-ref', status: NOT_MET, role: node.role };
  }

  const auditResult = ctx.results.get(resolved);
  const status = auditResult ? auditResult.status : NOT_MET;

  return {
    type: 'program-context-ref',
    status,
    role: node.role,
    resolvedProgram: resolved,
  };
}

// ============================================================
// Helpers
// ============================================================

/**
 * Resolve a program reference — either a direct program code or a role ref.
 * If it looks like a role (contains '-'), try role map first, else direct.
 */
function resolveProgram(ref, ctx) {
  if (!ref) return null;
  // Try as role first
  const fromRole = ctx.roleMap.get(ref);
  if (fromRole) return fromRole;
  // Try as direct program code — check if it exists in results
  if (ctx.results.has(ref)) return ref;
  return null;
}

/**
 * Sum credits for a list of course keys using the transcript.
 */
function sumCredits(courseKeys, ctx) {
  const normTranscript = ctx.normTranscript;
  let total = 0;
  for (const key of courseKeys) {
    if (normTranscript && normTranscript.byKey) {
      const entry = normTranscript.byKey.get(key);
      if (entry) total += entry.credits;
    }
  }
  return total;
}

module.exports = {
  auditMulti,
  CourseAssignmentMap,
};
