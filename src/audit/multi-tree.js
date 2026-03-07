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
  prepareCatalog,
  collectDefs,
} = require('../resolve');
const { normalizeTranscript } = require('./transcript');
const { auditNode, collectMatchedEntries } = require('./single-tree');
const { courseKey } = require('../render/shared');
const { MET, NOT_MET, allOf, anyOf, nOf } = require('./status');
const { forEachChild } = require('../ast/children');
const { buildExceptionContext, applySubstitutions } = require('./exceptions');

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
 * @param {object} [options] - Options
 * @param {object[]} [options.overlapRules] - Policy nodes evaluated in pass 2
 *   (overlap-limit, outside-program). These are cross-tree policies, not
 *   inline requirements. Per spec validation rule 13.
 * @param {object} [options.attainments] - Student attainments
 * @param {boolean} [options.backtrack] - Enable backtracking
 * @returns {{
 *   results: Map<string, object>,  // programCode → audit result
 *   assignments: CourseAssignmentMap,
 *   policyResults: object[],       // evaluated overlap rules
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
  const { norm, catalogIndex, crossListIndex, gradeConfig } = prepareCatalog(catalog);
  const programIndex = new Map();
  for (const p of norm.programs || []) {
    programIndex.set(p.code, p);
  }
  const normTranscript = normalizeTranscript(transcript, gradeConfig, catalogIndex);

  // Build exception context once, share across all tree audits
  const exceptions = opts.exceptions || [];
  const exCtx = exceptions.length > 0
    ? buildExceptionContext(exceptions)
    : null;

  // Apply substitutions — create virtual transcript entries (once, shared)
  if (exCtx && exCtx.substitutions.size > 0) {
    applySubstitutions(normTranscript, exCtx.substitutions);
  }

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
      // Exception context (shared across all trees)
      waivers: exCtx ? exCtx.waivers : null,
      substitutions: exCtx ? exCtx.substitutions : null,
      // Program reference context
      programIndex,
      declaredPrograms: opts.declaredPrograms || [],
      visitedPrograms: new Set(),
      // Per-tree cache: not shared across trees because different trees have
      // independent visitedPrograms sets and course availability may differ
      // after overlap assignment.
      programCache: new Map(),
    };

    const result = auditNode(tree.ast, ctx);
    const auditResult = { status: result.status, result, warnings: ctx.warnings };
    results.set(tree.programCode, auditResult);

    // Track course assignments: collect all matched entries and assign
    const matchedEntries = collectMatchedEntries(result);
    for (const entry of matchedEntries) {
      assignments.assign(courseKey(entry), tree.programCode);
    }

    // Track sub-program assignments from program-ref results
    collectSubProgramAssignments(result, assignments);

    // Collect warnings
    for (const w of ctx.warnings) {
      warnings.push({ ...w, programCode: tree.programCode });
    }
  }

  // --- Pass 2: Evaluate multi-tree policies ---
  const multiCtx = { results, assignments, roleMap, warnings, normTranscript };
  const policyResults = evaluateMultiTreePolicies(trees, opts.overlapRules || [], multiCtx);

  // --- Pass 3: Patch inline program-context-ref statuses into result trees ---
  // Build lookup: role → evaluated status from pass 2
  const refLookup = new Map();
  for (const pr of policyResults) {
    if (pr.type === 'program-context-ref' && pr.role) {
      refLookup.set(pr.role, pr.status);
    }
  }
  if (refLookup.size > 0) {
    for (const tree of trees) {
      const auditResult = results.get(tree.programCode);
      if (auditResult) {
        const patched = patchContextRefs(auditResult.result, refLookup);
        auditResult.result = patched;
        auditResult.status = patched.status;
      }
    }
  }

  return { results, assignments, policyResults, warnings };
}

/**
 * Evaluate multi-tree policy nodes.
 *
 * 1. Evaluate overlap rules (overlap-limit, outside-program) from the
 *    overlapRules array — these are cross-tree policies, not inline.
 * 2. Walk each tree's AST for program-context-ref nodes — these ARE
 *    valid inline requirements (e.g. "primary major must be met").
 *
 * @returns {object[]} Array of policy evaluation results
 */
function evaluateMultiTreePolicies(trees, overlapRules, ctx) {
  const policyResults = [];

  // Evaluate overlap rules (provided separately, not inline)
  for (const rule of overlapRules) {
    switch (rule.type) {
      case 'overlap-limit':
        policyResults.push(evaluateOverlapLimit(rule, ctx));
        break;
      case 'outside-program':
        policyResults.push(evaluateOutsideProgram(rule, ctx));
        break;
    }
  }

  // Walk trees for inline program-context-ref nodes
  for (const tree of trees) {
    walkForContextRefs(tree.ast, tree.programCode, ctx, policyResults);
  }

  return policyResults;
}

/**
 * Walk an AST looking for program-context-ref nodes and evaluate them.
 * Only program-context-ref is valid inline — overlap-limit and outside-program
 * belong in overlapRules.
 */
function walkForContextRefs(node, ownerProgram, ctx, policyResults) {
  if (!node || typeof node !== 'object') return;

  if (node.type === 'program-context-ref') {
    policyResults.push(evaluateProgramContextRef(node, ownerProgram, ctx));
  }

  // Recurse into children
  forEachChild(node, (child) => walkForContextRefs(child, ownerProgram, ctx, policyResults));
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
 * Spec node shape (03-ast.md):
 *   {
 *     type: 'overlap-limit',
 *     left: { type: 'program-context-ref', role: '...' } | { type: 'program-ref', code: '...' },
 *     right: { type: 'program-context-ref', role: '...' } | { type: 'program-ref', code: '...' },
 *     constraint: { comparison: 'at-most', value: N, unit: 'courses'|'credits'|'percent' }
 *   }
 */
function evaluateOverlapLimit(node, ctx) {
  const programA = resolveProgramNode(node.left, ctx);
  const programB = resolveProgramNode(node.right, ctx);
  const { comparison, value, unit } = node.constraint;

  if (!programA || !programB) {
    ctx.warnings.push({
      type: 'overlap-limit-unresolved',
      left: node.left,
      right: node.right,
      message: `Cannot resolve programs for overlap-limit`,
    });
    return { type: 'overlap-limit', status: NOT_MET, node };
  }

  const shared = ctx.assignments.getSharedCourses(programA, programB);
  const effectiveUnit = unit || 'courses';
  let actual;

  if (effectiveUnit === 'courses') {
    actual = shared.length;
  } else if (effectiveUnit === 'credits') {
    actual = sumCredits(shared, ctx);
  } else if (effectiveUnit === 'percent') {
    const totalCreditsA = sumCredits(ctx.assignments.getCoursesForProgram(programA), ctx);
    const sharedCredits = sumCredits(shared, ctx);
    actual = totalCreditsA > 0 ? Math.round((sharedCredits / totalCreditsA) * 100) : 0;
  } else {
    actual = shared.length;
  }

  const met = actual <= value;

  if (!met) {
    ctx.warnings.push({
      type: 'overlap-limit-exceeded',
      programA,
      programB,
      limit: value,
      actual,
      unit: effectiveUnit,
      sharedCourses: shared,
      message: `Overlap limit exceeded: ${actual} ${effectiveUnit} shared between ${programA} and ${programB} (limit: ${value})`,
    });
  }

  return {
    type: 'overlap-limit',
    status: met ? MET : NOT_MET,
    programA,
    programB,
    limit: value,
    actual,
    unit: effectiveUnit,
    sharedCourses: shared,
  };
}

/**
 * Evaluate an outside-program node.
 *
 * Counts courses or credits NOT assigned to a referenced program.
 *
 * Spec node shape (03-ast.md):
 *   {
 *     type: 'outside-program',
 *     program: { type: 'program-context-ref', role: '...' } | { type: 'program-ref', code: '...' },
 *     constraint: { comparison: 'at-least', value: N, unit: 'credits'|'courses' }
 *   }
 */
function evaluateOutsideProgram(node, ctx) {
  const program = resolveProgramNode(node.program, ctx);
  const { comparison, value, unit } = node.constraint;

  if (!program) {
    ctx.warnings.push({
      type: 'outside-program-unresolved',
      program: node.program,
      message: `Cannot resolve program for outside-program`,
    });
    return { type: 'outside-program', status: NOT_MET, node };
  }

  // Collect ALL transcript courses that are not assigned to the referenced program.
  // This includes courses not matched by any tree — they are still "outside" the program.
  const programCourses = new Set(ctx.assignments.getCoursesForProgram(program));
  const outside = [];
  if (ctx.normTranscript && ctx.normTranscript.byKey) {
    for (const key of ctx.normTranscript.byKey.keys()) {
      if (!programCourses.has(key)) {
        outside.push(key);
      }
    }
  }

  const effectiveUnit = unit || 'credits';
  let actual;

  if (effectiveUnit === 'credits') {
    actual = sumCredits(outside, ctx);
  } else {
    actual = outside.length;
  }

  const effectiveComparison = comparison || 'at-least';
  let met;
  if (effectiveComparison === 'at-least') {
    met = actual >= value;
  } else if (effectiveComparison === 'at-most') {
    met = actual <= value;
  } else {
    met = actual === value;
  }

  return {
    type: 'outside-program',
    status: met ? MET : NOT_MET,
    program,
    actual,
    required: value,
    unit: effectiveUnit,
    comparison: effectiveComparison,
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
 * Resolve a program reference node to a program code.
 *
 * Handles:
 * - { type: 'program-context-ref', role: '...' } → resolve via roleMap
 * - { type: 'program-ref', code: '...' } → direct program code
 * - string → try as role, then as direct program code (for program-context-ref inline)
 */
function resolveProgramNode(ref, ctx) {
  if (!ref) return null;

  // AST node references
  if (typeof ref === 'object') {
    if (ref.type === 'program-context-ref') {
      return ctx.roleMap.get(ref.role) || null;
    }
    if (ref.type === 'program-ref') {
      return ctx.results.has(ref.code) ? ref.code : null;
    }
    return null;
  }

  // String reference (used by program-context-ref inline role resolution)
  const fromRole = ctx.roleMap.get(ref);
  if (fromRole) return fromRole;
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

/**
 * Patch program-context-ref nodes in an audit result tree with their
 * evaluated statuses from pass 2, then recompute composite statuses.
 *
 * Post-order traversal: patch leaves first, then recompute parents.
 */
function patchContextRefs(node, refLookup) {
  if (!node || typeof node !== 'object') return node;

  // Patch program-context-ref leaf nodes
  if (node.type === 'program-context-ref' && node.role && refLookup.has(node.role)) {
    return { ...node, status: refLookup.get(node.role) };
  }

  // Recurse into children and recompute composite statuses
  let patched = node;
  const updates = {};
  let changed = false;

  forEachChild(node, (child, key) => {
    const prop = node[key];
    if (Array.isArray(prop)) {
      // Array child — build new array if any element changed
      if (!updates[key]) {
        const newArr = prop.map(c => patchContextRefs(c, refLookup));
        if (newArr.some((item, i) => item !== prop[i])) {
          updates[key] = newArr;
          changed = true;
        }
      }
    } else {
      // Single child
      const newChild = patchContextRefs(child, refLookup);
      if (newChild !== child) {
        updates[key] = newChild;
        changed = true;
      }
    }
  });

  if (changed) {
    patched = { ...node, ...updates };

    // Recompute status based on what changed
    if (updates.items) {
      patched.status = recomputeStatus(patched);
    }
    if (updates.requirement) {
      if (patched.type === 'with-constraint') {
        patched.status = patched.constraintResult && !patched.constraintResult.met
          ? NOT_MET : updates.requirement.status;
      } else {
        patched.status = updates.requirement.status;
      }
    }
    if (updates.body) {
      patched.status = updates.body.status;
    }
  }

  return patched;
}

/**
 * Recompute the status of a composite node from its children.
 */
function recomputeStatus(node) {
  if (!node.items || !Array.isArray(node.items)) return node.status;

  const childStatuses = node.items.map(item => item.status);

  switch (node.type) {
    case 'all-of':
      return allOf(childStatuses);
    case 'any-of':
      return anyOf(childStatuses);
    case 'n-of':
      return nOf(childStatuses, node.comparison || 'at-least', node.count || 1);
    case 'one-from-each':
      return allOf(childStatuses);
    default:
      return node.status;
  }
}

/**
 * Walk an audit result tree, find program-ref nodes with sub-audit results,
 * and assign matched courses to the sub-program code in the assignment map.
 */
function collectSubProgramAssignments(result, assignments) {
  if (!result || typeof result !== 'object') return;

  if (result.type === 'program-ref' && result.code && result.result) {
    const subEntries = collectMatchedEntries(result.result);
    for (const entry of subEntries) {
      assignments.assign(courseKey(entry), result.code);
    }
  }

  // Recurse into children
  forEachChild(result, (child) => collectSubProgramAssignments(child, assignments));
}

module.exports = {
  auditMulti,
  CourseAssignmentMap,
};
