'use strict';

const { OP_SYMBOLS, comparisonPhrase } = require('./shared');

function renderOp(op) {
  return OP_SYMBOLS[op];
}

function renderFilterValue(value) {
  if (Array.isArray(value)) {
    return '(' + value.map(v => `"${v}"`).join(', ') + ')';
  }
  if (typeof value === 'string') {
    return `"${value}"`;
  }
  return String(value);
}

function renderFilter(f) {
  if (f.field === 'prerequisite-includes' || f.field === 'corequisite-includes') {
    const keyword = f.field === 'prerequisite-includes' ? 'prerequisite' : 'corequisite';
    return `${keyword} includes (${renderNode(f.value)})`;
  }
  return `${f.field} ${renderOp(f.op)} ${renderFilterValue(f.value)}`;
}

function renderPostConstraints(node, text) {
  if (!node.post_constraints) return text;
  for (const pc of node.post_constraints) {
    const filterValue = renderFilterValue(pc.filter.value);
    text += ` where ${comparisonPhrase(pc.comparison)} ${pc.count} match (${pc.filter.field} ${renderOp(pc.filter.op)} ${filterValue})`;
  }
  return text;
}

function renderItems(items) {
  return items.map(renderNode).join(', ');
}

function renderNode(node) {
  let text;

  switch (node.type) {
    // --- Leaf nodes ---
    case 'course':
      text = `${node.subject} ${node.number}`;
      if (node.concurrentAllowed) text += ' (concurrent)';
      return text;

    case 'course-filter':
      return `courses where ${node.filters.map(renderFilter).join(' and ')}`;

    case 'score':
      return `score ${node.name} ${renderOp(node.op)} ${node.value}`;

    case 'attainment':
      return `attainment ${node.name}`;

    case 'quantity':
      return `quantity ${node.name} ${renderOp(node.op)} ${node.value}`;

    case 'variable-ref':
      return node.scope ? `$${node.scope}.${node.name}` : `$${node.name}`;

    // --- Composite nodes ---
    case 'all-of':
      text = `all of (${renderItems(node.items)})`;
      return renderPostConstraints(node, text);

    case 'any-of':
      text = `any of (${renderItems(node.items)})`;
      return renderPostConstraints(node, text);

    case 'none-of':
      text = `none of (${renderItems(node.items)})`;
      return renderPostConstraints(node, text);

    case 'n-of':
      text = `${comparisonPhrase(node.comparison)} ${node.count} of (${renderItems(node.items)})`;
      return renderPostConstraints(node, text);

    case 'one-from-each':
      text = `one from each of (${renderItems(node.items)})`;
      return renderPostConstraints(node, text);

    case 'from-n-groups':
      text = `from at least ${node.count} of (${renderItems(node.items)})`;
      return renderPostConstraints(node, text);

    case 'credits-from': {
      const prefix = comparisonPhrase(node.comparison);
      // Unwrap synthesized all-of
      let sourceItems;
      if (node.source.type === 'all-of') {
        sourceItems = renderItems(node.source.items);
      } else {
        sourceItems = renderNode(node.source);
      }
      text = `${prefix} ${node.credits} credits from (${sourceItems})`;
      return renderPostConstraints(node, text);
    }

    // --- Wrapper/modifier nodes ---
    case 'with-constraint': {
      const inner = renderNode(node.requirement);
      if (node.constraint.kind === 'min-grade') {
        return `${inner} with grade >= "${node.constraint.value}"`;
      }
      // GPA must render with decimal point for parser round-trip
      const gpa = Number.isInteger(node.constraint.value)
        ? node.constraint.value.toFixed(1)
        : String(node.constraint.value);
      return `${inner} with gpa >= ${gpa}`;
    }

    case 'except': {
      const source = renderNode(node.source);
      let result = `${source} except (${renderItems(node.exclude)})`;
      return renderPostConstraints(node, result);
    }

    case 'variable-def':
      return `$${node.name} = ${renderNode(node.value)}`;

    case 'scope': {
      const defs = node.defs.map(d => `$${d.name} = ${renderNode(d.value)}`).join(' ');
      const body = renderNode(node.body);
      if (defs) {
        return `scope "${node.name}" { ${defs} ${body} }`;
      }
      return `scope "${node.name}" { ${body} }`;
    }

    // --- Policy nodes ---
    case 'program':
      if (node.code) {
        return `program ${node.code} ${node['program-type']} ${node.level}`;
      }
      return `any program ${node['program-type']} ${node.level}`;

    case 'program-context-ref':
      return node.role === 'primary-major' ? 'primary major' : 'primary minor';

    case 'overlap-limit': {
      const left = renderNode(node.left);
      const right = renderNode(node.right);
      const unit = node.constraint.unit === 'percent' ? '%' : node.constraint.unit;
      return `overlap between (${left}, ${right}) at most ${node.constraint.value} ${unit}`;
    }

    case 'outside-program': {
      const prog = renderNode(node.program);
      return `outside (${prog}) at least ${node.constraint.value} ${node.constraint.unit}`;
    }

    default:
      throw new Error(`Unknown node type: ${node.type}`);
  }
}

/**
 * Render an AST back to reqit DSL text.
 * Round-trip guarantee: parse(toText(parse(text))) ≡ parse(text)
 * @param {Object} ast - AST node from parse()
 * @returns {string} Reqit DSL text
 */
function toText(ast) {
  return renderNode(ast);
}

module.exports = { toText };
