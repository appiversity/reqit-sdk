'use strict';

/**
 * exceptions.js — Waiver and Substitution exception entities.
 *
 * Immutable exception objects applied during audit to override
 * normal requirement evaluation. Constructed via factory functions.
 */

const { courseKey } = require('../render/shared');
const { WAIVED } = require('./status');
const { forEachChild } = require('../ast/children');

// ============================================================
// Waiver
// ============================================================

const WAIVER_TARGET_KEYS = ['course', 'score', 'attainment', 'quantity', 'label'];

class Waiver {
  #data;

  constructor(data) {
    this.#data = Object.freeze({ ...data });
    Object.freeze(this);
  }

  get id() { return this.#data.id || null; }
  get kind() { return 'waiver'; }
  get target() {
    const t = {};
    for (const key of WAIVER_TARGET_KEYS) {
      if (this.#data[key] !== undefined) t[key] = this.#data[key];
    }
    return Object.freeze(t);
  }
  get reason() { return this.#data.reason; }
  get metadata() { return this.#data.metadata || null; }

  toJSON() { return { kind: 'waiver', ...this.#data }; }
}

// ============================================================
// Substitution
// ============================================================

class Substitution {
  #data;

  constructor(data) {
    this.#data = Object.freeze({
      ...data,
      original: Object.freeze({ ...data.original }),
      replacement: Object.freeze({ ...data.replacement }),
    });
    Object.freeze(this);
  }

  get id() { return this.#data.id || null; }
  get kind() { return 'substitution'; }
  get original() { return this.#data.original; }
  get replacement() { return this.#data.replacement; }
  get reason() { return this.#data.reason; }
  get metadata() { return this.#data.metadata || null; }

  toJSON() {
    return {
      kind: 'substitution',
      ...this.#data,
      original: { ...this.#data.original },
      replacement: { ...this.#data.replacement },
    };
  }
}

// ============================================================
// Factory functions
// ============================================================

/**
 * Create a Waiver exception.
 *
 * @param {object} opts
 * @param {object} [opts.course] - { subject, number }
 * @param {string} [opts.score] - score name
 * @param {string} [opts.attainment] - attainment name
 * @param {string} [opts.quantity] - quantity name
 * @param {string} [opts.label] - labeled group name
 * @param {string} opts.reason - reason for waiver (required)
 * @param {object} [opts.metadata] - pass-through application data
 * @returns {Waiver}
 */
function waiver(opts) {
  if (!opts || typeof opts !== 'object') {
    throw new Error('waiver() requires an options object');
  }

  const { reason, metadata, id, ...rest } = opts;

  if (!reason || typeof reason !== 'string' || reason.trim() === '') {
    throw new Error('waiver() requires a non-empty reason string');
  }

  // Determine which target keys are present
  const presentKeys = WAIVER_TARGET_KEYS.filter(k => rest[k] !== undefined);
  if (presentKeys.length === 0) {
    throw new Error('waiver() requires exactly one target key: course, score, attainment, quantity, or label');
  }
  if (presentKeys.length > 1) {
    throw new Error(`waiver() requires exactly one target key, got: ${presentKeys.join(', ')}`);
  }

  const targetKey = presentKeys[0];
  const targetValue = rest[targetKey];

  // Validate target value
  if (targetKey === 'course') {
    if (!targetValue || typeof targetValue !== 'object' || !targetValue.subject || !targetValue.number) {
      throw new Error('waiver() course target requires { subject, number }');
    }
  } else if (targetKey === 'label') {
    if (typeof targetValue !== 'string' || targetValue.trim() === '') {
      throw new Error('waiver() label target requires a non-empty string');
    }
  } else {
    // score, attainment, quantity
    if (typeof targetValue !== 'string' || targetValue.trim() === '') {
      throw new Error(`waiver() ${targetKey} target requires a non-empty string`);
    }
  }

  const normalized = { ...opts, reason: reason.trim() };
  if (targetKey === 'course') {
    normalized.course = { subject: targetValue.subject, number: targetValue.number };
  }

  return new Waiver(normalized);
}

/**
 * Create a Substitution exception.
 *
 * @param {object} opts
 * @param {object} opts.original - { subject, number } — the required course
 * @param {object} opts.replacement - { subject, number } — the actual course taken
 * @param {string} opts.reason - reason for substitution (required)
 * @param {object} [opts.metadata] - pass-through application data
 * @returns {Substitution}
 */
function substitution(opts) {
  if (!opts || typeof opts !== 'object') {
    throw new Error('substitution() requires an options object');
  }

  const { original, replacement, reason, metadata, id } = opts;

  if (!reason || typeof reason !== 'string' || reason.trim() === '') {
    throw new Error('substitution() requires a non-empty reason string');
  }

  if (!original || typeof original !== 'object' || !original.subject || !original.number) {
    throw new Error('substitution() requires original with { subject, number }');
  }

  if (!replacement || typeof replacement !== 'object' || !replacement.subject || !replacement.number) {
    throw new Error('substitution() requires replacement with { subject, number }');
  }

  return new Substitution({
    ...opts,
    original: { subject: original.subject, number: original.number },
    replacement: { subject: replacement.subject, number: replacement.number },
    reason: reason.trim(),
  });
}

// ============================================================
// Exception context builder
// ============================================================

/**
 * Build indexed exception context for O(1) lookup during audit.
 *
 * @param {Array<Waiver|Substitution>} exceptions
 * @returns {{ waivers: object, substitutions: Map }}
 */
function buildExceptionContext(exceptions) {
  const waivers = {
    courses: new Map(),
    scores: new Map(),
    attainments: new Map(),
    quantities: new Map(),
    labels: new Map(),
  };
  const substitutions = new Map();

  for (const ex of exceptions) {
    if (ex.kind === 'waiver') {
      const target = ex.target;
      if (target.course) {
        const key = courseKey(target.course);
        if (!waivers.courses.has(key)) waivers.courses.set(key, ex);
      } else if (target.score) {
        if (!waivers.scores.has(target.score)) waivers.scores.set(target.score, ex);
      } else if (target.attainment) {
        if (!waivers.attainments.has(target.attainment)) waivers.attainments.set(target.attainment, ex);
      } else if (target.quantity) {
        if (!waivers.quantities.has(target.quantity)) waivers.quantities.set(target.quantity, ex);
      } else if (target.label) {
        if (!waivers.labels.has(target.label)) waivers.labels.set(target.label, ex);
      }
    } else if (ex.kind === 'substitution') {
      const key = courseKey(ex.original);
      if (!substitutions.has(key)) substitutions.set(key, ex);
    }
  }

  return { waivers, substitutions };
}

/**
 * Find a leaf-level waiver matching a given AST node.
 *
 * @param {object} node - AST node
 * @param {object} ctx - Audit context with waivers index
 * @returns {Waiver|null}
 */
function findLeafWaiver(node, ctx) {
  if (!ctx.waivers) return null;

  switch (node.type) {
    case 'course':
      return ctx.waivers.courses.get(courseKey(node)) || null;
    case 'score':
      return ctx.waivers.scores.get(node.name) || null;
    case 'attainment':
      return ctx.waivers.attainments.get(node.name) || null;
    case 'quantity':
      return ctx.waivers.quantities.get(node.name) || null;
    default:
      return null;
  }
}

/**
 * Build a waived result node for a leaf waiver match.
 *
 * @param {object} node - AST node
 * @param {Waiver} waiverObj - The matching waiver
 * @param {object} ctx - Audit context
 * @returns {object} Audit result node with status 'waived'
 */
function buildWaivedResult(node, waiverObj, ctx) {
  const result = { type: node.type, status: WAIVED, waiver: waiverObj.toJSON() };

  switch (node.type) {
    case 'course': {
      result.subject = node.subject;
      result.number = node.number;
      // Look up catalog credits for credit counting (use creditsMin if available, fall back to credits)
      const catalogCourse = ctx.catalogIndex && ctx.catalogIndex.get(courseKey(node));
      if (catalogCourse) {
        const cr = catalogCourse.creditsMin != null ? catalogCourse.creditsMin : catalogCourse.credits;
        if (cr != null) result.waivedCredits = cr;
      }
      break;
    }
    case 'score':
      result.name = node.name;
      if (node.op) result.op = node.op;
      if (node.value != null) result.value = node.value;
      break;
    case 'attainment':
      result.name = node.name;
      break;
    case 'quantity':
      result.name = node.name;
      if (node.op) result.op = node.op;
      if (node.value != null) result.value = node.value;
      break;
  }

  return result;
}

/**
 * Build a waived result for a labeled group (composite node).
 * Short-circuits the entire subtree.
 *
 * @param {object} node - Composite AST node with label
 * @param {Waiver} waiverObj - The matching waiver
 * @param {object} ctx - Audit context
 * @returns {object} Audit result node with status 'waived'
 */
function buildGroupWaivedResult(node, waiverObj, ctx) {
  const result = {
    type: node.type,
    status: WAIVED,
    label: node.label,
    waiver: waiverObj.toJSON(),
  };

  // For credit counting, resolve credits from the subtree's courses
  const waivedCredits = resolveWaivedCredits(node, ctx);
  if (waivedCredits > 0) {
    result.waivedCredits = waivedCredits;
  }

  return result;
}

/**
 * Walk an AST subtree and sum catalog credits for all course nodes.
 * Used when a labeled group is waived to provide credit information.
 *
 * Note: course-filter nodes are not resolved against the catalog and
 * contribute zero credits. This is acceptable because waived groups
 * with filter-only children are rare, and the credit count is informational.
 *
 * @param {object} node - AST node
 * @param {object} ctx - Audit context with catalogIndex
 * @returns {number} Total credits
 */
function resolveWaivedCredits(node, ctx) {
  let total = 0;

  function walk(n) {
    if (!n || typeof n !== 'object') return;

    if (n.type === 'course' && ctx.catalogIndex) {
      const catalogCourse = ctx.catalogIndex.get(courseKey(n));
      if (catalogCourse) {
        const cr = catalogCourse.creditsMin != null ? catalogCourse.creditsMin : catalogCourse.credits;
        if (cr != null) total += cr;
      }
    }

    forEachChild(n, walk);
  }

  walk(node);
  return total;
}

/**
 * Apply substitutions by creating virtual transcript entries.
 *
 * For each substitution, if the replacement course exists on the transcript,
 * a virtual entry for the original course is added to the normalized transcript.
 *
 * @param {object} normTranscript - Normalized transcript (has byKey Map)
 * @param {Map<string, Substitution>} substitutions - originalKey → Substitution
 * @returns {object} The mutated normTranscript (entries added in place)
 */
function applySubstitutions(normTranscript, substitutions) {
  for (const [originalKey, sub] of substitutions) {
    const replacementKey = courseKey(sub.replacement);
    const entry = normTranscript.byKey.get(replacementKey);
    if (!entry) continue; // replacement not on transcript — substitution doesn't apply

    // Don't create virtual entry if student already has the original course
    if (normTranscript.byKey.has(originalKey)) continue;

    const virtualEntry = {
      subject: sub.original.subject,
      number: sub.original.number,
      grade: entry.grade,
      credits: entry.credits,
      term: entry.term,
      status: entry.status,
      _substitution: sub,
      _replacedBy: { subject: entry.subject, number: entry.number },
    };

    normTranscript.byKey.set(originalKey, virtualEntry);
    normTranscript.courses.push(virtualEntry);
  }

  return normTranscript;
}

/**
 * Track which exceptions were actually applied during audit.
 * Call after audit completes to partition into applied/unused.
 *
 * @param {Array<Waiver|Substitution>} exceptions - All exceptions passed in
 * @param {object} result - Audit result tree
 * @param {object} normTranscript - Normalized transcript (for substitution tracking)
 * @returns {{ applied: Array, unused: Array }}
 */
function partitionExceptions(exceptions, result, normTranscript) {
  const applied = [];
  const unused = [];

  for (const ex of exceptions) {
    if (isExceptionApplied(ex, result, normTranscript)) {
      applied.push(ex);
    } else {
      unused.push(ex);
    }
  }

  return { applied, unused };
}

/**
 * Check if an exception was applied in the audit result.
 */
function isExceptionApplied(ex, result, normTranscript) {
  if (ex.kind === 'waiver') {
    return wasWaiverApplied(ex, result);
  }
  if (ex.kind === 'substitution') {
    return wasSubstitutionApplied(ex, normTranscript);
  }
  return false;
}

function wasWaiverApplied(waiverObj, result) {
  let found = false;

  function walk(node) {
    if (!node || typeof node !== 'object' || found) return;
    if (node.status === WAIVED && node.waiver) {
      // Match by comparing the waiver's target
      if (matchesWaiver(node, waiverObj)) {
        found = true;
        return;
      }
    }
    forEachChild(node, walk);
  }

  walk(result);
  return found;
}

function matchesWaiver(resultNode, waiverObj) {
  const target = waiverObj.target;
  if (target.course) {
    return resultNode.type === 'course' &&
      resultNode.subject === target.course.subject &&
      resultNode.number === target.course.number;
  }
  if (target.score) return resultNode.type === 'score' && resultNode.name === target.score;
  if (target.attainment) return resultNode.type === 'attainment' && resultNode.name === target.attainment;
  if (target.quantity) return resultNode.type === 'quantity' && resultNode.name === target.quantity;
  if (target.label) return resultNode.label === target.label;
  return false;
}

function wasSubstitutionApplied(sub, normTranscript) {
  const key = courseKey(sub.original);
  const entry = normTranscript.byKey.get(key);
  return entry != null && entry._substitution != null;
}

module.exports = {
  Waiver,
  Substitution,
  waiver,
  substitution,
  buildExceptionContext,
  findLeafWaiver,
  buildWaivedResult,
  buildGroupWaivedResult,
  resolveWaivedCredits,
  applySubstitutions,
  partitionExceptions,
};
