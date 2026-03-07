'use strict';

/**
 * to-description.js — Render an AST as a human-readable prose description.
 *
 * Output is not round-trippable — it is meant for display to end users
 * (e.g. academic advisors, students) who should not need to understand the DSL.
 */

const { OP_PHRASES, comparisonPhrase, renderFilterPhrase, unwrapCreditsSource } = require('./shared');

/**
 * Generate a human-readable label for composite node types.
 * @param {Object} node - AST node
 * @returns {string}
 */
function compositeLabel(node) {
  let base;
  switch (node.type) {
    case 'all-of': base = 'Complete all of the following'; break;
    case 'any-of': base = 'Complete any one of the following'; break;
    case 'none-of': base = 'None of the following may be used'; break;
    case 'n-of': base = `Complete ${comparisonPhrase(node.comparison)} ${node.count} of the following`; break;
    case 'one-from-each': base = 'Complete one course from each of the following areas'; break;
    case 'from-n-groups': base = `Complete courses from at least ${node.count} of the following groups`; break;
    default: base = node.type;
  }
  if (node.label) {
    return `${node.label} \u2014 ${base.charAt(0).toLowerCase()}${base.slice(1)}`;
  }
  return base;
}

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
 * Render post-constraint clauses as a standalone prose fragment.
 * Returns an empty string if no post_constraints exist.
 * @param {Object} node - Node potentially carrying `post_constraints`
 * @returns {string}
 */
function renderPostConstraints(node) {
  if (!node.post_constraints) return '';
  return node.post_constraints.map(pc => {
    const comp = comparisonPhrase(pc.comparison) + ' ' + pc.count;
    const fv = renderFilterPhrase(pc.filter, v => renderNode(v));
    return `, where ${comp} must have ${fv}`;
  }).join('');
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

    case 'all-of':
    case 'any-of':
    case 'none-of':
    case 'n-of':
    case 'one-from-each':
    case 'from-n-groups':
      return `${compositeLabel(node)}:${renderItems(node.items, indent)}` + renderPostConstraints(node);

    case 'credits-from': {
      const comp = comparisonPhrase(node.comparison) + ' ' + node.credits;
      const sourceItems = unwrapCreditsSource(node);
      const heading = node.label
        ? `${node.label} \u2014 complete ${comp} credits from:`
        : `Complete ${comp} credits from:`;
      return `${heading}${renderItems(sourceItems, indent)}` + renderPostConstraints(node);
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
      return `${source}, except:${renderItems(node.exclude, indent)}` + renderPostConstraints(node);
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

    case 'program-ref':
      return `Program "${node.code}"`;

    case 'program-filter': {
      const pfxDesc = node.quantifier === 'any' ? 'Any declared program'
        : node.quantifier === 'all' ? 'All declared programs'
        : `${comparisonPhrase(node.comparison).charAt(0).toUpperCase() + comparisonPhrase(node.comparison).slice(1)} ${node.count} declared programs`;
      const filterDescs = node.filters.map(f => `${f.field} ${OP_PHRASES[f.op] || f.op} "${f.value}"`).join(' and ');
      return `${pfxDesc} where ${filterDescs}`;
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
