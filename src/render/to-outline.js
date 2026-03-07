'use strict';

/**
 * to-outline.js — Render an AST as an indented tree outline with box-drawing connectors.
 *
 * Unlike the other renderers (single `renderNode` dispatch), this module uses a
 * two-level dispatch: `renderLeaf` for terminal nodes and `renderTree` for
 * composite/wrapper nodes. The split exists because tree formatting needs to
 * distinguish leaf vs composite when choosing connector prefixes (`├──` / `└──`)
 * and propagating indentation.
 */

const { OP_PHRASES, comparisonPhrase, lookupTitle, renderFilterPhrase, unwrapCreditsSource } = require('./shared');

/**
 * Generate a label for composite node types in outline format.
 * @param {Object} node - AST node
 * @returns {string}
 */
function compositeLabel(node) {
  let base;
  switch (node.type) {
    case 'all-of': base = 'All of the following:'; break;
    case 'any-of': base = 'Any one of the following:'; break;
    case 'none-of': base = 'None of the following:'; break;
    case 'n-of': base = `Complete ${comparisonPhrase(node.comparison)} ${node.count} of the following:`; break;
    case 'one-from-each': base = 'One from each of the following:'; break;
    case 'from-n-groups': base = `From at least ${node.count} of the following groups:`; break;
    default: base = node.type;
  }
  return node.label ? `${node.label} \u2014 ${base}` : base;
}

/**
 * Render a leaf (terminal) node as a single line of text.
 * Returns `null` for non-leaf nodes so `renderTree` can handle them.
 * @param {Object} node - AST node
 * @param {Object|null} catalog - Catalog for title lookup
 * @returns {string|null} Single-line text, or null if not a leaf
 */
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
      return `Any course where ${node.filters.map(f => renderFilterPhrase(f, v => renderLeaf(v, catalog))).join(' and ')}`;
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

/**
 * Render inline post-constraint suffixes (e.g. ` (where at least 2 have ...)`).
 * @param {Object} node - Node potentially carrying `post_constraints`
 * @param {Object|null} catalog - Catalog for title lookup inside filter values
 * @returns {string} Suffix string (empty if no constraints)
 */
function renderPostConstraints(node, catalog) {
  if (!node.post_constraints) return '';
  return node.post_constraints.map(pc => {
    const comp = comparisonPhrase(pc.comparison) + ' ' + pc.count;
    return ` (where ${comp} have ${renderFilterPhrase(pc.filter, v => renderLeaf(v, catalog))})`;
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
    case 'any-of':
    case 'none-of':
    case 'n-of':
    case 'one-from-each':
    case 'from-n-groups':
      label = compositeLabel(node) + renderPostConstraints(node, catalog);
      children = node.items;
      break;
    case 'credits-from': {
      const comp = comparisonPhrase(node.comparison) + ' ' + node.credits;
      const creditsBase = `Complete ${comp} credits from:`;
      label = (node.label ? `${node.label} \u2014 ${creditsBase}` : creditsBase) + renderPostConstraints(node, catalog);
      children = unwrapCreditsSource(node);
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
        // Source is a leaf — use compact single-line format
        label = srcLeaf + ', except:' + renderPostConstraints(node, catalog);
        children = node.exclude;
      } else {
        // Source is composite — render source and exclude as named subtrees
        label = 'Except:' + renderPostConstraints(node, catalog);
        // Manually render the two subtrees (Source: and Except:)
        const childBase = prefix + (connector === '' ? '' :
          connector === '└── ' ? '    ' : '│   ');
        lines.push(prefix + connector + label);
        // Source subtree
        lines.push(childBase + '├── Source:');
        const srcBase = childBase + '│   ';
        const srcItems = node.source.items || [node.source];
        for (let i = 0; i < srcItems.length; i++) {
          const isLast = i === srcItems.length - 1;
          const srcConn = isLast ? '└── ' : '├── ';
          const srcChildLines = renderTree(srcItems[i], catalog, srcBase, srcConn);
          lines.push(...srcChildLines);
        }
        // Exclude subtree
        lines.push(childBase + '└── Except:');
        const excBase = childBase + '    ';
        for (let i = 0; i < node.exclude.length; i++) {
          const isLast = i === node.exclude.length - 1;
          const excConn = isLast ? '└── ' : '├── ';
          const excChildLines = renderTree(node.exclude[i], catalog, excBase, excConn);
          lines.push(...excChildLines);
        }
        return lines;
      }
      break;
    }
    case 'variable-def':
      return renderTree(node.value, catalog, prefix, connector);
    case 'scope':
      return renderTree(node.body, catalog, prefix, connector);
    case 'overlap-limit': {
      const left = renderLeaf(node.left, catalog);
      const right = renderLeaf(node.right, catalog);
      const unit = node.constraint.unit === 'percent' ? '%' : ` ${node.constraint.unit}`;
      label = `Overlap between ${left} and ${right}: at most ${node.constraint.value}${unit}`;
      break;
    }
    case 'outside-program': {
      const prog = renderLeaf(node.program, catalog);
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
