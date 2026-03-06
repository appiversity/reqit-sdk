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
 * Walk an audit result tree depth-first, calling callback(node, path) for each node.
 *
 * @param {object} root - The root audit result node
 * @param {(node: object, path: string[]) => void} callback
 */
function walkResult(root, callback) {
  function visit(node, path) {
    if (!node || typeof node !== 'object') return;
    callback(node, path);
    forEachChild(node, (child, key) => {
      const prop = node[key];
      if (Array.isArray(prop)) {
        visit(child, [...path, `${key}[${prop.indexOf(child)}]`]);
      } else {
        visit(child, [...path, key]);
      }
    });
  }
  visit(root, []);
}

module.exports = { walkResult };
