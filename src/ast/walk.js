'use strict';

/**
 * walk.js — Depth-first AST traversal and immutable transformation.
 *
 * Both utilities delegate to `forEachChild` for child enumeration,
 * ensuring all traversals share the same structural knowledge.
 */

const { forEachChild, CHILD_PROPS } = require('./children');

/**
 * Depth-first pre-order traversal of an AST.
 *
 * Calls `callback(node, path, parent)` for every node in the tree.
 * `path` is an array of keys tracing from the root (e.g. `['items', 2, 'source']`).
 *
 * @param {object} ast - Root AST node
 * @param {(node: object, path: Array<string|number>, parent: object|null) => void} callback
 */
function walk(ast, callback) {
  function visit(node, path, parent) {
    if (!node || typeof node !== 'object') return;
    callback(node, path, parent);

    forEachChild(node, (child, key) => {
      const prop = node[key];
      if (Array.isArray(prop)) {
        const idx = prop.indexOf(child);
        visit(child, [...path, key, idx], node);
      } else {
        visit(child, [...path, key], node);
      }
    });
  }

  visit(ast, [], null);
}

/**
 * Immutable depth-first post-order AST transformation.
 *
 * Calls `transformFn(node)` on every node after its children have been
 * transformed. Returns a new AST; the original is never mutated.
 *
 * `transformFn` should return the node unchanged (same reference) to
 * signal no change, or a new object to replace the node.
 *
 * @param {object} ast - Root AST node
 * @param {(node: object) => object} transformFn
 * @returns {object} Transformed AST
 */
function transform(ast, transformFn) {
  function visit(node) {
    if (!node || typeof node !== 'object') return node;

    const props = CHILD_PROPS.get(node.type);
    if (!props) {
      // Unknown type or leaf with no children — just apply transform
      return transformFn(node);
    }

    let changed = false;
    const updates = {};

    for (const { key, array } of props) {
      const value = node[key];
      if (!value) continue;

      if (array) {
        if (Array.isArray(value)) {
          const newArr = value.map(child =>
            (child && typeof child === 'object') ? visit(child) : child
          );
          if (newArr.some((item, i) => item !== value[i])) {
            updates[key] = newArr;
            changed = true;
          }
        }
      } else {
        if (typeof value === 'object') {
          const newChild = visit(value);
          if (newChild !== value) {
            updates[key] = newChild;
            changed = true;
          }
        }
      }
    }

    // Handle `resolved` on audit result nodes
    if (node.resolved && typeof node.resolved === 'object') {
      const newResolved = visit(node.resolved);
      if (newResolved !== node.resolved) {
        updates.resolved = newResolved;
        changed = true;
      }
    }

    const rebuilt = changed ? { ...node, ...updates } : node;
    return transformFn(rebuilt);
  }

  return visit(ast);
}

module.exports = { walk, transform };
