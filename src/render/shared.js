'use strict';

/**
 * shared.js — Shared constants, helpers, and lookup utilities for all reqit renderers.
 *
 * MAINTENANCE GUIDE — what to update when the reqit spec changes:
 *
 * New operator        → OP_SYMBOLS + OP_PHRASES here,
 *                       renderScorePhrase + renderQuantityPhrase in to-description.js
 * New node type       → NODE_TYPES here,
 *                       renderNode in to-text / to-description / to-html,
 *                       renderLeaf + renderTree in to-outline
 * New comparison      → comparisonPhrase here
 * New constraint kind → with-constraint case in all 4 renderers
 * New filter field    → renderFilterPhrase here (if special handling needed)
 */

/**
 * Canonical key for a course object or AST course node.
 * Always use this instead of inlining `subject + ':' + number`.
 * @param {{ subject: string, number: string }} course
 * @returns {string} Key in the form "SUBJECT:NUMBER"
 */
function courseKey(course) {
  return course.subject + ':' + course.number;
}

/**
 * Symbolic operators used in the reqit DSL (e.g. `>=`, `!=`).
 * Keyed by the AST's operator string.
 * @type {Object<string, string>}
 */
const OP_SYMBOLS = {
  eq: '=',
  ne: '!=',
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
  in: 'in',
  'not-in': 'not in',
};

/**
 * Human-readable operator phrases (e.g. `is at least`, `is not`).
 * Keyed by the AST's operator string.
 * @type {Object<string, string>}
 */
const OP_PHRASES = {
  eq: 'is',
  ne: 'is not',
  gt: 'is above',
  gte: 'is at least',
  lt: 'is below',
  lte: 'is at most',
  in: 'is one of',
  'not-in': 'is not one of',
};

/**
 * All recognised AST node types, grouped by role.
 * Every renderer must handle every type listed here.
 * @type {ReadonlyArray<string>}
 */
const NODE_TYPES = Object.freeze([
  // Leaf
  'course', 'course-filter', 'score', 'attainment', 'quantity', 'variable-ref',
  // Composite
  'all-of', 'any-of', 'none-of', 'n-of', 'one-from-each', 'from-n-groups', 'credits-from',
  // Wrapper
  'with-constraint', 'except', 'variable-def', 'scope',
  // Policy
  'program', 'program-context-ref', 'overlap-limit', 'outside-program',
  // Program references
  'program-ref', 'program-filter',
]);

/**
 * Convert a comparison keyword (`at-least`, `at-most`, or `exactly`) to a phrase.
 * @param {string} comparison
 * @returns {string}
 */
function comparisonPhrase(comparison) {
  if (comparison === 'at-least') return 'at least';
  if (comparison === 'at-most') return 'at most';
  return 'exactly';
}

// --- lookupTitle with WeakMap-cached index ---

/** @type {WeakMap<Object, Map<string, string>>} */
const _catalogIndex = new WeakMap();

/**
 * Build (or retrieve from cache) an O(1) index from `"SUBJECT:NUMBER"` → title.
 * @param {Object} catalog
 * @returns {Map<string, string>}
 */
function getCatalogIndex(catalog) {
  if (_catalogIndex.has(catalog)) return _catalogIndex.get(catalog);
  const index = new Map();
  for (const c of catalog.courses) {
    index.set(courseKey(c), c.title);
  }
  _catalogIndex.set(catalog, index);
  return index;
}

/**
 * Look up a course title from a catalog. First call per catalog builds an index;
 * subsequent calls are O(1). The WeakMap allows GC when the catalog is released.
 * @param {Object} node - AST node with `subject` and `number` properties
 * @param {Object|null} catalog - Catalog with a `courses` array, or null
 * @returns {string|null} The course title, or null if not found
 */
function lookupTitle(node, catalog) {
  if (!catalog || !catalog.courses) return null;
  const index = getCatalogIndex(catalog);
  return index.get(courseKey(node)) || null;
}

/**
 * Render a filter expression as a human-readable phrase.
 * Callers supply callbacks for value rendering, field escaping, and quote wrapping
 * so each renderer can customise output (e.g. HTML escaping).
 * @param {Object} f - Filter object with `field`, `op`, and `value`
 * @param {Function} renderValue - Renders a course-ref value node
 * @param {Function} [escapeField] - Escapes the field name (identity by default)
 * @param {Function} [quoteValue] - Wraps a string value in quotes (double-quotes by default)
 * @returns {string}
 */
function renderFilterPhrase(f, renderValue, escapeField, quoteValue) {
  if (!escapeField) escapeField = v => v;
  if (!quoteValue) quoteValue = v => '"' + v + '"';

  if (f.field === 'prerequisite-includes' || f.field === 'corequisite-includes') {
    const kind = f.field === 'prerequisite-includes' ? 'prerequisite' : 'corequisite';
    return `${kind} includes ${renderValue(f.value)}`;
  }
  const phrase = OP_PHRASES[f.op];
  if (Array.isArray(f.value)) {
    return `${escapeField(f.field)} ${phrase} ${f.value.map(v => quoteValue(v)).join(', ')}`;
  }
  if (typeof f.value === 'string') {
    return `${escapeField(f.field)} ${phrase} ${quoteValue(f.value)}`;
  }
  return `${escapeField(f.field)} ${phrase} ${f.value}`;
}

/**
 * Extract the source items array from a `credits-from` node.
 * The parser wraps multi-source credits-from in a synthesised `all-of`;
 * this helper normalises both shapes into a flat array.
 * @param {Object} node - A `credits-from` AST node
 * @returns {Array<Object>} The source items
 */
function unwrapCreditsSource(node) {
  return node.source.type === 'all-of' ? node.source.items : [node.source];
}

module.exports = {
  courseKey,
  OP_SYMBOLS,
  OP_PHRASES,
  NODE_TYPES,
  comparisonPhrase,
  lookupTitle,
  renderFilterPhrase,
  unwrapCreditsSource,
};
