'use strict';

/**
 * children.js — Generic AST child visitor.
 *
 * Centralizes knowledge of which properties hold children for each
 * AST node type. All traversal utilities (walk, transform) and
 * internal traversals (resolve, validate, audit) delegate here.
 *
 * Also works on audit result nodes, which share the same child
 * structure plus `resolved`.
 */

const { NODE_TYPES } = require('../render/shared');

/**
 * Child property descriptors for each node type.
 *
 * Each entry maps a node type to an array of { key, array } descriptors:
 *   - key:   the property name on the node
 *   - array: true if the property is an array of children, false if single child
 *
 * Leaf nodes have empty arrays (no children to visit).
 *
 * @type {Map<string, Array<{ key: string, array: boolean }>>}
 */
const CHILD_PROPS = new Map([
  // Leaf nodes — no children
  ['course', []],
  ['course-filter', []],
  ['score', []],
  ['attainment', []],
  ['quantity', []],
  ['variable-ref', []],

  // Composite nodes — items array
  ['all-of', [{ key: 'items', array: true }]],
  ['any-of', [{ key: 'items', array: true }]],
  ['n-of', [{ key: 'items', array: true }]],
  ['none-of', [{ key: 'items', array: true }]],
  ['one-from-each', [{ key: 'items', array: true }]],
  ['from-n-groups', [{ key: 'items', array: true }]],

  // credits-from — single source child
  ['credits-from', [{ key: 'source', array: false }]],

  // Wrapper nodes
  ['with-constraint', [{ key: 'requirement', array: false }]],
  ['except', [{ key: 'source', array: false }, { key: 'exclude', array: true }]],
  ['variable-def', [{ key: 'value', array: false }]],
  ['scope', [{ key: 'body', array: false }, { key: 'defs', array: true }]],

  // Policy nodes
  ['program', []],
  ['program-context-ref', []],
  ['overlap-limit', [{ key: 'left', array: false }, { key: 'right', array: false }]],
  ['outside-program', [{ key: 'program', array: false }]],
]);

/**
 * Call `callback(child, key)` for every child node of `node`.
 *
 * Works on both AST nodes and audit result nodes (which add `resolved`).
 * Unknown node types are silently skipped (no crash, no callback).
 *
 * @param {object} node - AST or audit result node
 * @param {(child: object, key: string) => void} callback
 */
function forEachChild(node, callback) {
  if (!node || typeof node !== 'object') return;

  const props = CHILD_PROPS.get(node.type);

  if (props) {
    for (const { key, array } of props) {
      const value = node[key];
      if (!value) continue;
      if (array) {
        if (Array.isArray(value)) {
          for (const child of value) {
            if (child && typeof child === 'object') callback(child, key);
          }
        }
      } else {
        if (typeof value === 'object') callback(value, key);
      }
    }
  }

  // Audit result nodes may have a `resolved` child (from variable-ref auditing)
  if (node.resolved && typeof node.resolved === 'object') {
    callback(node.resolved, 'resolved');
  }
}

module.exports = { forEachChild, CHILD_PROPS };
