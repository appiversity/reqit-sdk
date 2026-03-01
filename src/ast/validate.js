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

  // Rule 5: Every variable-ref must have a matching variable-def
  // Rule 6 (part 1): Check if ref targets a def we're currently walking (circular)
  if (node.type === 'variable-ref') {
    const refName = node.name;
    const scope = node.scope;
    const key = scope ? `${scope}.${refName}` : refName;
    if (!ctx.defs.has(key)) {
      ctx.errors.push({
        rule: 5,
        message: `Variable reference "$${scope ? scope + '.' : ''}${refName}" has no matching definition`,
        path
      });
    } else if (ctx.visiting.has(key)) {
      ctx.errors.push({
        rule: 6,
        message: `Circular variable reference detected: "$${scope ? scope + '.' : ''}${refName}"`,
        path
      });
    } else {
      // Walk into the referenced def's value to detect indirect circularity
      const def = ctx.defs.get(key);
      if (def && def.value) {
        ctx.visiting.add(key);
        walkNode(def.value, ctx, joinPath(path, `->$${key}`), false);
        ctx.visiting.delete(key);
      }
    }
    return; // variable-ref has no children to recurse into
  }

  // Rule 6 (part 2): Track variable-def in visiting set while walking its value
  if (node.type === 'variable-def') {
    const name = node.name;
    ctx.visiting.add(name);
    if (node.value) {
      walkNode(node.value, ctx, joinPath(path, 'value'), false);
    }
    ctx.visiting.delete(name);
    return; // Already walked value above, skip normal recursion
  }

  // Rule 7: Course subject format (2–6 uppercase alphanumeric)
  if (node.type === 'course') {
    if (typeof node.subject !== 'string' || !/^[A-Z0-9]{2,6}$/.test(node.subject)) {
      ctx.errors.push({
        rule: 7,
        message: `Invalid course subject "${node.subject}" — must be 2–6 uppercase alphanumeric characters`,
        path
      });
    }
  }

  // Rule 8: Course number format (1–6 chars, starts with digit)
  if (node.type === 'course') {
    if (typeof node.number !== 'string' || !/^[0-9][A-Z0-9.]{0,5}$/.test(node.number)) {
      ctx.errors.push({
        rule: 8,
        message: `Invalid course number "${node.number}" — must be 1–6 characters starting with a digit`,
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
