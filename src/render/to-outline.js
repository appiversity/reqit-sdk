'use strict';

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

function lookupTitle(node, catalog) {
  if (!catalog || !catalog.courses) return null;
  const course = catalog.courses.find(
    c => c.subject === node.subject && c.number === node.number
  );
  return course ? course.title : null;
}

function renderFilterPhrase(f) {
  if (f.field === 'prerequisite-includes' || f.field === 'corequisite-includes') {
    const kind = f.field === 'prerequisite-includes' ? 'prerequisite' : 'corequisite';
    return `${kind} includes ${renderLeaf(f.value, null)}`;
  }
  const phrase = OP_PHRASES[f.op];
  if (Array.isArray(f.value)) {
    return `${f.field} ${phrase} ${f.value.map(v => `"${v}"`).join(', ')}`;
  }
  if (typeof f.value === 'string') {
    return `${f.field} ${phrase} "${f.value}"`;
  }
  return `${f.field} ${phrase} ${f.value}`;
}

function renderLeaf(node, catalog) {
  switch (node.type) {
    case 'course': {
      let text = `${node.subject} ${node.number}`;
      const title = lookupTitle(node, catalog);
      if (title) text += ` - ${title}`;
      if (node.concurrentAllowed) text += ' (concurrent)';
      return text;
    }
    case 'course-filter':
      return `Any course where ${node.filters.map(renderFilterPhrase).join(' and ')}`;
    case 'score':
      return `Score ${node.name} ${OP_PHRASES[node.op]} ${node.value}`;
    case 'attainment':
      return `Attainment: ${node.name}`;
    case 'quantity':
      return `Quantity: ${node.name} ${OP_PHRASES[node.op]} ${node.value}`;
    case 'variable-ref':
      return node.scope ? `$${node.scope}.${node.name}` : `$${node.name}`;
    case 'program':
      return node.code
        ? `Program ${node.code} (${node['program-type']}, ${node.level})`
        : `Any program (${node['program-type']}, ${node.level})`;
    case 'program-context-ref':
      return node.role === 'primary-major' ? 'primary major' : 'primary minor';
    default:
      return null; // not a leaf
  }
}

function comparisonPhrase(comparison, count) {
  if (comparison === 'at-least') return `at least ${count}`;
  if (comparison === 'at-most') return `at most ${count}`;
  return `exactly ${count}`;
}

function renderPostConstraintSuffix(node) {
  if (!node.post_constraints) return '';
  return node.post_constraints.map(pc => {
    const comp = comparisonPhrase(pc.comparison, pc.count);
    return ` (where ${comp} have ${renderFilterPhrase(pc.filter)})`;
  }).join('');
}

/**
 * Render a node as a tree.
 * @param {Object} node - AST node
 * @param {Object|null} catalog - catalog for title lookup
 * @param {string} prefix - line prefix for indentation (e.g. "│   ")
 * @param {string} connector - connector prefix (e.g. "├── " or "└── " or "")
 * @returns {string[]} lines
 */
function renderTree(node, catalog, prefix, connector) {
  const lines = [];

  // Try leaf rendering first
  const leaf = renderLeaf(node, catalog);
  if (leaf !== null) {
    lines.push(prefix + connector + leaf);
    return lines;
  }

  // Composite/wrapper nodes
  let label;
  let children = [];

  switch (node.type) {
    case 'all-of':
      label = 'All of the following:' + renderPostConstraintSuffix(node);
      children = node.items;
      break;
    case 'any-of':
      label = 'Any one of the following:' + renderPostConstraintSuffix(node);
      children = node.items;
      break;
    case 'none-of':
      label = 'None of the following:' + renderPostConstraintSuffix(node);
      children = node.items;
      break;
    case 'n-of':
      label = `Complete ${comparisonPhrase(node.comparison, node.count)} of the following:` + renderPostConstraintSuffix(node);
      children = node.items;
      break;
    case 'one-from-each':
      label = 'One from each of the following:' + renderPostConstraintSuffix(node);
      children = node.items;
      break;
    case 'from-n-groups':
      label = `From at least ${node.count} of the following groups:` + renderPostConstraintSuffix(node);
      children = node.items;
      break;
    case 'credits-from': {
      const comp = comparisonPhrase(node.comparison, node.credits);
      label = `Complete ${comp} credits from:` + renderPostConstraintSuffix(node);
      children = node.source.type === 'all-of' ? node.source.items : [node.source];
      break;
    }
    case 'with-constraint': {
      const suffix = node.constraint.kind === 'min-grade'
        ? ` (min grade: ${node.constraint.value})`
        : ` (min GPA: ${node.constraint.value})`;
      const innerLeaf = renderLeaf(node.requirement, catalog);
      if (innerLeaf !== null) {
        lines.push(prefix + connector + innerLeaf + suffix);
        return lines;
      }
      // Inner is composite — render it and append constraint to first line
      const innerLines = renderTree(node.requirement, catalog, prefix, connector);
      if (innerLines.length > 0) {
        innerLines[0] += suffix;
      }
      return innerLines;
    }
    case 'except': {
      const srcLeaf = renderLeaf(node.source, catalog);
      if (srcLeaf !== null) {
        label = srcLeaf + ', except:' + renderPostConstraintSuffix(node);
      } else {
        const srcLines = renderTree(node.source, catalog, '', '');
        label = (srcLines[0] || 'Source') + ', except:' + renderPostConstraintSuffix(node);
      }
      children = node.exclude;
      break;
    }
    case 'variable-def':
      return renderTree(node.value, catalog, prefix, connector);
    case 'scope':
      return renderTree(node.body, catalog, prefix, connector);
    case 'overlap-limit': {
      const left = renderLeaf(node.left, catalog) || 'left';
      const right = renderLeaf(node.right, catalog) || 'right';
      const unit = node.constraint.unit === 'percent' ? '%' : ` ${node.constraint.unit}`;
      label = `Overlap between ${left} and ${right}: at most ${node.constraint.value}${unit}`;
      break;
    }
    case 'outside-program': {
      const prog = renderLeaf(node.program, catalog) || 'program';
      label = `At least ${node.constraint.value} credits from outside ${prog}`;
      break;
    }
    default:
      throw new Error(`Unknown node type: ${node.type}`);
  }

  lines.push(prefix + connector + label);

  // The child prefix is what comes before the connector for children.
  // If this node had a connector, the child prefix extends with either "│   " or "    ".
  const childBase = prefix + (connector === '' ? '' :
    connector === '└── ' ? '    ' : '│   ');

  for (let i = 0; i < children.length; i++) {
    const childIsLast = i === children.length - 1;
    const childConnector = childIsLast ? '└── ' : '├── ';
    const childLines = renderTree(children[i], catalog, childBase, childConnector);
    lines.push(...childLines);
  }

  return lines;
}

/**
 * Render an AST as an indented tree outline.
 * @param {Object} ast - AST node from parse()
 * @param {Object} [catalog] - Optional catalog with `courses` array for title lookup
 * @returns {string} Indented outline string
 */
function toOutline(ast, catalog) {
  return renderTree(ast, catalog || null, '', '').join('\n');
}

module.exports = { toOutline };
