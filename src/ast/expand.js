'use strict';

/**
 * expand.js — Inline variable references, producing a flat AST.
 *
 * Given a scope AST (with variable-def nodes and variable-ref nodes),
 * returns the body with all variable references replaced by their
 * definition values. The scope wrapper is removed.
 *
 * If the input is not a scope node, it is returned unchanged.
 */

const { forEachChild, CHILD_PROPS } = require('./children');

/**
 * Build a variable map from scope defs.
 * Keys are variable names; values are cloned AST subtrees.
 *
 * @param {object[]} defs - Array of variable-def nodes
 * @param {string|null} scopeName - Scope name (for scoped refs)
 * @returns {Map<string, object>}
 */
function buildVarMap(defs, scopeName) {
  const vars = new Map();
  for (const def of defs) {
    vars.set(def.name, structuredClone(def.value));
    if (scopeName) {
      vars.set(`${scopeName}.${def.name}`, structuredClone(def.value));
    }
  }
  return vars;
}

/**
 * Recursively replace variable-ref nodes with their definitions.
 *
 * @param {object} node - AST node
 * @param {Map<string, object>} vars - Variable name → value map
 * @param {Set<string>} expanding - Circular reference guard
 * @returns {object} New AST node with variable refs inlined
 */
function inlineRefs(node, vars, expanding) {
  if (!node || typeof node !== 'object') return node;

  if (node.type === 'variable-ref') {
    const key = node.scope ? `${node.scope}.${node.name}` : node.name;
    const value = vars.get(key);
    if (!value) return node; // unresolved cross-scope ref — leave as-is
    if (expanding.has(key)) {
      throw new Error(`Circular variable reference: ${key}`);
    }
    expanding.add(key);
    const expanded = inlineRefs(structuredClone(value), vars, expanding);
    expanding.delete(key);
    return expanded;
  }

  // Rebuild the node with inlined children
  const props = CHILD_PROPS.get(node.type);
  if (!props || props.length === 0) return node;

  const result = { ...node };
  for (const { key, array } of props) {
    const child = node[key];
    if (!child) continue;
    if (array) {
      if (Array.isArray(child)) {
        result[key] = child.map(c =>
          (c && typeof c === 'object') ? inlineRefs(c, vars, expanding) : c
        );
      }
    } else {
      if (typeof child === 'object') {
        result[key] = inlineRefs(child, vars, expanding);
      }
    }
  }
  return result;
}

/**
 * Expand all variable references in an AST.
 *
 * If the node is a scope, builds a variable map from its defs,
 * inlines all variable references in the body, and returns the
 * expanded body (scope wrapper removed).
 *
 * Non-scope nodes are returned as-is.
 *
 * @param {object} ast - AST node (typically a scope)
 * @returns {object} Expanded AST without scope/variable wrappers
 */
function expand(ast) {
  if (!ast || typeof ast !== 'object') return ast;
  if (ast.type !== 'scope') return ast;

  const vars = buildVarMap(ast.defs || [], ast.name);

  // Variable defs may reference other variables — expand them in definition order
  for (const [name, value] of vars) {
    vars.set(name, inlineRefs(value, vars, new Set([name])));
  }

  return inlineRefs(ast.body, vars, new Set());
}

module.exports = { expand };
