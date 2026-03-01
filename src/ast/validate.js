'use strict';

/**
 * Validates a Reqit AST for semantic correctness.
 *
 * Returns { valid: true } if the AST is valid, or
 * { valid: false, errors: [...] } with all collected errors.
 *
 * Each error: { rule: <number>, message: <string>, path: <string> }
 */
function validate(ast) {
  const defs = collectDefs(ast, '', new Map());
  const ctx = { errors: [], defs, visiting: new Set() };
  walkNode(ast, ctx, '(root)', true);
  if (ctx.errors.length === 0) {
    return { valid: true };
  }
  return { valid: false, errors: ctx.errors };
}

/**
 * Pre-pass: collect all variable-def nodes and register them in the defs map.
 * Defs inside a scope register under both "scope.name" and "name".
 * Unscoped defs register under "name".
 */
function collectDefs(node, scopeName, defs) {
  if (!node || typeof node !== 'object') return defs;

  if (node.type === 'scope') {
    const scope = node.name || '';
    if (Array.isArray(node.items)) {
      for (const child of node.items) {
        collectDefs(child, scope, defs);
      }
    }
    return defs;
  }

  if (node.type === 'variable-def') {
    const name = node.name;
    if (scopeName) {
      defs.set(`${scopeName}.${name}`, node);
      defs.set(name, node);
    } else {
      defs.set(name, node);
    }
    if (node.value) {
      collectDefs(node.value, scopeName, defs);
    }
    return defs;
  }

  // Recurse into children
  if (Array.isArray(node.items)) {
    for (const child of node.items) {
      collectDefs(child, scopeName, defs);
    }
  }
  if (node.expression) {
    collectDefs(node.expression, scopeName, defs);
  }
  if (node.value) {
    collectDefs(node.value, scopeName, defs);
  }
  if (node.source) {
    collectDefs(node.source, scopeName, defs);
  }
  if (node.left) {
    collectDefs(node.left, scopeName, defs);
  }
  if (node.right) {
    collectDefs(node.right, scopeName, defs);
  }
  if (node.target) {
    collectDefs(node.target, scopeName, defs);
  }

  return defs;
}

/**
 * Main recursive walk — runs validation rules on each node.
 */
function walkNode(node, ctx, path, isTopLevel) {
  if (!node || typeof node !== 'object') return;

  // Rule 1: Node must have a type string property
  if (typeof node.type !== 'string' || node.type === '') {
    ctx.errors.push({
      rule: 1,
      message: 'Node is missing a valid "type" string property',
      path
    });
    return; // Can't validate further without a type
  }

  // Rule 2: items array must be non-empty for list-based nodes
  const listTypes = ['all-of', 'any-of', 'none-of', 'n-of', 'one-from-each', 'from-n-groups'];
  if (listTypes.includes(node.type)) {
    if (!Array.isArray(node.items) || node.items.length === 0) {
      ctx.errors.push({
        rule: 2,
        message: `"${node.type}" node must have a non-empty items array`,
        path
      });
    }
  }

  // Rule 3: count must be positive integer; for at-most/exactly, count <= items.length
  if (node.type === 'n-of' || node.type === 'from-n-groups') {
    if (!Number.isInteger(node.count) || node.count < 1) {
      ctx.errors.push({
        rule: 3,
        message: `"${node.type}" node must have a positive integer count, got ${node.count}`,
        path
      });
    } else if (Array.isArray(node.items) && node.items.length > 0) {
      const comparison = node.comparison;
      if ((comparison === 'at-most' || comparison === 'exactly') && node.count > node.items.length) {
        ctx.errors.push({
          rule: 3,
          message: `"${node.type}" with "${comparison}" has count ${node.count} but only ${node.items.length} items`,
          path
        });
      }
    }
  }

  // Rule 4: credits must be positive number
  if (node.type === 'credits-from') {
    if (typeof node.credits !== 'number' || node.credits <= 0) {
      ctx.errors.push({
        rule: 4,
        message: `"credits-from" node must have a positive credits value, got ${node.credits}`,
        path
      });
    }
  }

  // Recurse into children
  if (Array.isArray(node.items)) {
    for (let i = 0; i < node.items.length; i++) {
      walkNode(node.items[i], ctx, joinPath(path, `items[${i}]`), false);
    }
  }
  if (node.expression) {
    walkNode(node.expression, ctx, joinPath(path, 'expression'), false);
  }
  if (node.value) {
    walkNode(node.value, ctx, joinPath(path, 'value'), false);
  }
  if (node.source) {
    walkNode(node.source, ctx, joinPath(path, 'source'), false);
  }
  if (node.left) {
    walkNode(node.left, ctx, joinPath(path, 'left'), false);
  }
  if (node.right) {
    walkNode(node.right, ctx, joinPath(path, 'right'), false);
  }
  if (node.target) {
    walkNode(node.target, ctx, joinPath(path, 'target'), false);
  }
}

/**
 * Build a dot-path string for error reporting.
 */
function joinPath(base, segment) {
  if (base === '(root)') return segment;
  return `${base}.${segment}`;
}

module.exports = { validate };
