'use strict';

/**
 * walk-result.js — Traverse an audit result tree.
 *
 * Provides a walk() function for audit result nodes, analogous to
 * the AST walk() in ast/walk.js. Visits every node in the result tree,
 * calling the callback with each node and its path from the root.
 */

const { forEachChild } = require('../ast/children');

/**
 * Walk an audit result tree depth-first, calling callback(node, path, parent, depth)
 * for each node.
 *
 * @param {object} root - The root audit result node
 * @param {(node: object, path: string[], parent: object|null, depth: number) => void} callback
 */
function walkResult(root, callback) {
  function visit(node, path, parent, depth) {
    if (!node || typeof node !== 'object') return;
    callback(node, path, parent, depth);
    forEachChild(node, (child, key) => {
      const prop = node[key];
      if (Array.isArray(prop)) {
        visit(child, [...path, `${key}[${prop.indexOf(child)}]`], node, depth + 1);
      } else {
        visit(child, [...path, key], node, depth + 1);
      }
    });
  }
  visit(root, [], null, 0);
}

module.exports = { walkResult };
