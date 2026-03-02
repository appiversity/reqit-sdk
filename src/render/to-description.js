'use strict';

/**
 * to-description.js — Render an AST as a human-readable prose description.
 *
 * Output is not round-trippable — it is meant for display to end users
 * (e.g. academic advisors, students) who should not need to understand the DSL.
 */

const { comparisonPhrase, renderFilterPhrase, unwrapCreditsSource } = require('./shared');

/**
 * Render child items as an indented bulleted list (multi-item) or inline (single item).
 * @param {Array<Object>} items
 * @param {number} [indent]
 * @returns {string}
 */
function renderItems(items, indent) {
  if (items.length === 1) {
    return ' ' + renderNode(items[0], indent);
  }
  const prefix = indent ? '  '.repeat(indent) : '  ';
  return '\n' + items.map(item => `${prefix}- ${renderNode(item, (indent || 1) + 1)}`).join('\n');
}

/**
 * Convert a score node into a natural-language phrase.
 * Operator-dependent — throws on unrecognised operators.
 * @param {string} op - Operator (eq, ne, gt, gte, lt, lte)
 * @param {number} value
 * @param {string} name - Score name
 * @returns {string}
 */
function renderScorePhrase(op, value, name) {
  switch (op) {
    case 'gte': return `Score of ${value} or higher on ${name}`;
    case 'gt': return `Score above ${value} on ${name}`;
    case 'lte': return `Score of ${value} or lower on ${name}`;
    case 'lt': return `Score below ${value} on ${name}`;
    case 'eq': return `Score of exactly ${value} on ${name}`;
    case 'ne': return `Score other than ${value} on ${name}`;
    default: throw new Error(`Unknown score operator: ${op}`);
  }
}

/**
 * Convert a quantity node into a natural-language phrase.
 * Operator-dependent — throws on unrecognised operators.
 * @param {string} op - Operator (eq, ne, gt, gte, lt, lte)
 * @param {number} value
 * @param {string} name - Quantity name
 * @returns {string}
 */
function renderQuantityPhrase(op, value, name) {
  switch (op) {
    case 'gte': return `At least ${value} ${name}`;
    case 'gt': return `More than ${value} ${name}`;
    case 'lte': return `At most ${value} ${name}`;
    case 'lt': return `Fewer than ${value} ${name}`;
    case 'eq': return `Exactly ${value} ${name}`;
    case 'ne': return `Not ${value} ${name}`;
    default: throw new Error(`Unknown quantity operator: ${op}`);
  }
}

/**
 * Append post-constraint clauses as prose (e.g. ", where at least 2 must have ...").
 * @param {Object} node - Node potentially carrying `post_constraints`
 * @param {string} text - Text accumulated so far
 * @returns {string}
 */
function renderPostConstraints(node, text) {
  if (!node.post_constraints) return text;
  for (const pc of node.post_constraints) {
    const comp = comparisonPhrase(pc.comparison) + ' ' + pc.count;
    const fv = renderFilterPhrase(pc.filter, v => renderNode(v));
    text += `, where ${comp} must have ${fv}`;
  }
  return text;
}

/**
 * Recursive single-dispatch renderer producing prose output.
 * @param {Object} node - AST node
 * @param {number} [indent] - Current indentation depth
 * @returns {string}
 */
function renderNode(node, indent) {
  switch (node.type) {
    case 'course': {
      let text = `${node.subject} ${node.number}`;
      if (node.concurrentAllowed) text += ' (may be taken concurrently)';
      return text;
    }

    case 'course-filter':
      return `Any course where ${node.filters.map(f => renderFilterPhrase(f, v => renderNode(v))).join(' and ')}`;

    case 'score':
      return renderScorePhrase(node.op, node.value, node.name);

    case 'attainment':
      return `Completion of ${node.name}`;

    case 'quantity':
      return renderQuantityPhrase(node.op, node.value, node.name);

    case 'variable-ref':
      return node.scope ? `(see $${node.scope}.${node.name})` : `(see $${node.name})`;

    case 'all-of': {
      let text = `Complete all of the following:${renderItems(node.items, indent)}`;
      return renderPostConstraints(node, text);
    }

    case 'any-of': {
      let text = `Complete any one of the following:${renderItems(node.items, indent)}`;
      return renderPostConstraints(node, text);
    }

    case 'none-of': {
      let text = `None of the following may be used:${renderItems(node.items, indent)}`;
      return renderPostConstraints(node, text);
    }

    case 'n-of': {
      const comp = comparisonPhrase(node.comparison) + ' ' + node.count;
      let text = `Complete ${comp} of the following:${renderItems(node.items, indent)}`;
      return renderPostConstraints(node, text);
    }

    case 'one-from-each': {
      let text = `Complete one course from each of the following areas:${renderItems(node.items, indent)}`;
      return renderPostConstraints(node, text);
    }

    case 'from-n-groups': {
      let text = `Complete courses from at least ${node.count} of the following groups:${renderItems(node.items, indent)}`;
      return renderPostConstraints(node, text);
    }

    case 'credits-from': {
      const comp = comparisonPhrase(node.comparison) + ' ' + node.credits;
      const sourceItems = unwrapCreditsSource(node);
      let text = `Complete ${comp} credits from:${renderItems(sourceItems, indent)}`;
      return renderPostConstraints(node, text);
    }

    case 'with-constraint': {
      const inner = renderNode(node.requirement, indent);
      if (node.constraint.kind === 'min-grade') {
        return `${inner} with a minimum grade of ${node.constraint.value}`;
      }
      return `${inner} with a minimum GPA of ${node.constraint.value}`;
    }

    case 'except': {
      const source = renderNode(node.source, indent);
      let text = `${source}, except:${renderItems(node.exclude, indent)}`;
      return renderPostConstraints(node, text);
    }

    case 'variable-def':
      return renderNode(node.value, indent);

    case 'scope':
      return renderNode(node.body, indent);

    case 'program': {
      if (node.code) {
        return `Program ${node.code} (${node['program-type']}, ${node.level})`;
      }
      return `Any program (${node['program-type']}, ${node.level})`;
    }

    case 'program-context-ref':
      return node.role === 'primary-major' ? 'primary major' : 'primary minor';

    case 'overlap-limit': {
      const left = renderNode(node.left, indent);
      const right = renderNode(node.right, indent);
      const unit = node.constraint.unit === 'percent' ? '%' : ` ${node.constraint.unit}`;
      return `Overlap between ${left} and ${right}: at most ${node.constraint.value}${unit}`;
    }

    case 'outside-program': {
      const prog = renderNode(node.program, indent);
      return `At least ${node.constraint.value} credits must come from outside ${prog}`;
    }

    default:
      throw new Error(`Unknown node type: ${node.type}`);
  }
}

/**
 * Render an AST as a human-readable description.
 * @param {Object} ast - AST node from parse()
 * @returns {string} Human-readable paragraph text
 */
function toDescription(ast) {
  return renderNode(ast);
}

module.exports = { toDescription };
