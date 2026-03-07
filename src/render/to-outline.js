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

const { OP_PHRASES, comparisonPhrase, lookupTitle, renderFilterPhrase, unwrapCreditsSource, courseKey } = require('./shared');

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
    case 'program-ref':
      return `Program: "${node.code}"`;
    case 'program-filter': {
      const pfx = node.quantifier === 'any' ? 'Any program'
        : node.quantifier === 'all' ? 'All programs'
        : `${comparisonPhrase(node.comparison).charAt(0).toUpperCase() + comparisonPhrase(node.comparison).slice(1)} ${node.count} programs`;
      const fDescs = node.filters.map(f => `${f.field} ${OP_PHRASES[f.op] || f.op} "${f.value}"`).join(' and ');
      return `${pfx} where ${fDescs}`;
    }
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

// ============================================================
// Audit-aware rendering
// ============================================================

/**
 * Map an audit status string to a Unicode status icon.
 * @param {string} status
 * @returns {string}
 */
function statusIcon(status) {
  switch (status) {
    case 'met': return '\u2713';         // ✓
    case 'not-met': return '\u2717';     // ✗
    case 'in-progress': return '\u25D1'; // ◑
    case 'partial-progress': return '\u25D4'; // ◔
    case 'waived': return '\u2298';      // ⊘
    case 'substituted': return '\u21C4'; // ⇄
    default: return '\u2717';            // ✗ fallback
  }
}

/**
 * Build inline summary text from an audit node's summary field.
 * @param {Object} auditNode
 * @returns {string} e.g. " (2/3 met)" or ""
 */
function summaryText(auditNode) {
  if (!auditNode || !auditNode.summary) return '';
  const s = auditNode.summary;
  const met = s.met + (s.waived || 0) + (s.substituted || 0);
  return ` (${met}/${s.total} met)`;
}

/**
 * Build inline matched-course info from satisfiedBy.
 * @param {Object} auditNode
 * @returns {string} e.g. "  [A, Fall 2023]" or ""
 */
function matchedInfo(auditNode) {
  if (!auditNode || !auditNode.satisfiedBy) return '';
  const entry = auditNode.satisfiedBy;
  const parts = [];
  if (entry.grade) parts.push(entry.grade);
  if (entry.term) parts.push(entry.term);
  if (parts.length === 0) return '';
  return `  [${parts.join(', ')}]`;
}

/**
 * Build annotation suffix from options.annotations Map.
 * @param {Object} node - AST node (course)
 * @param {Object} options
 * @returns {string} e.g. " (shared)" or ""
 */
function annotationText(node, options) {
  if (!options || !options.annotations) return '';
  const key = courseKey(node);
  const annots = options.annotations.get(key);
  if (!annots || annots.length === 0) return '';
  return ` (${annots.join(', ')})`;
}

/**
 * Render a leaf node with audit overlay.
 * Returns null for nodes that should be rendered as composites in audit mode.
 * @param {Object} node - AST node
 * @param {Object|null} catalog
 * @param {Object} auditNode
 * @param {Object} options
 * @returns {string|null}
 */
function renderLeafWithAudit(node, catalog, auditNode, options) {
  const icon = statusIcon(auditNode ? auditNode.status : 'not-met');

  switch (node.type) {
    case 'course': {
      let text = `${node.subject} ${node.number}`;
      const title = lookupTitle(node, catalog);
      if (title) text += ` - ${title}`;
      if (node.concurrentAllowed) text += ' (concurrent)';
      text += matchedInfo(auditNode);
      text += annotationText(node, options);
      return `${icon} ${text}`;
    }
    case 'course-filter':
      return `${icon} Any course where ${node.filters.map(f => renderFilterPhrase(f, v => renderLeaf(v, catalog))).join(' and ')}`;
    case 'score': {
      let text = `Score ${node.name} ${OP_PHRASES[node.op]} ${node.value}`;
      if (auditNode && auditNode.actual != null) text += ` (actual: ${auditNode.actual})`;
      return `${icon} ${text}`;
    }
    case 'attainment':
      return `${icon} Attainment: ${node.name}`;
    case 'quantity':
      return `${icon} Quantity: ${node.name} ${OP_PHRASES[node.op]} ${node.value}`;
    case 'variable-ref':
      // In audit mode, render the resolved subtree instead
      return null;
    case 'program':
      return `${icon} ${node.code
        ? `Program ${node.code} (${node['program-type']}, ${node.level})`
        : `Any program (${node['program-type']}, ${node.level})`}`;
    case 'program-context-ref':
      return `${icon} ${node.role === 'primary-major' ? 'primary major' : 'primary minor'}`;
    case 'program-ref':
      // If audit has a sub-result, render as composite
      if (auditNode && auditNode.result) return null;
      if (auditNode && auditNode.notDeclared) {
        return `${icon} Program: "${node.code}" (not declared)`;
      }
      return `${icon} Program: "${node.code}"`;
    case 'program-filter':
      // If audit has items, render as composite
      if (auditNode && auditNode.items && auditNode.items.length > 0) return null;
      return `${icon} ${renderLeaf(node, catalog)}`;
    default:
      return null;
  }
}

/**
 * Render a node tree with audit overlay.
 * @param {Object} node - AST node
 * @param {Object|null} catalog
 * @param {Object} auditNode - Parallel audit result node
 * @param {Object} options
 * @param {string} prefix
 * @param {string} connector
 * @returns {string[]}
 */
function renderTreeWithAudit(node, catalog, auditNode, options, prefix, connector) {
  const lines = [];
  const icon = statusIcon(auditNode ? auditNode.status : 'not-met');

  // Try leaf rendering first
  const leaf = renderLeafWithAudit(node, catalog, auditNode, options);
  if (leaf !== null) {
    lines.push(prefix + connector + leaf);
    return lines;
  }

  // Composite/wrapper nodes
  let label;
  let children = [];
  let childAudits = [];

  switch (node.type) {
    case 'all-of':
    case 'any-of':
    case 'none-of':
    case 'n-of':
    case 'one-from-each':
    case 'from-n-groups':
      label = icon + ' ' + compositeLabel(node) + renderPostConstraints(node, catalog) + summaryText(auditNode);
      children = node.items;
      childAudits = (auditNode && auditNode.items) ? auditNode.items : [];
      break;

    case 'credits-from': {
      const comp = comparisonPhrase(node.comparison) + ' ' + node.credits;
      const creditsBase = `Complete ${comp} credits from:`;
      label = icon + ' ' + (node.label ? `${node.label} \u2014 ${creditsBase}` : creditsBase) + renderPostConstraints(node, catalog);
      children = unwrapCreditsSource(node);
      const sourceAudit = auditNode ? auditNode.source : null;
      childAudits = sourceAudit && sourceAudit.items ? sourceAudit.items : [];
      // Single source: pair directly
      if (children.length === 1 && childAudits.length === 0 && sourceAudit) {
        childAudits = [sourceAudit];
      }
      break;
    }

    case 'with-constraint': {
      const suffix = node.constraint.kind === 'min-grade'
        ? ` (min grade: ${node.constraint.value})`
        : ` (min GPA: ${node.constraint.value})`;
      const innerAudit = auditNode ? auditNode.requirement : null;
      const innerLeaf = renderLeafWithAudit(node.requirement, catalog, innerAudit, options);
      if (innerLeaf !== null) {
        lines.push(prefix + connector + innerLeaf + suffix);
        return lines;
      }
      const innerLines = renderTreeWithAudit(node.requirement, catalog, innerAudit, options, prefix, connector);
      if (innerLines.length > 0) {
        innerLines[0] += suffix;
      }
      return innerLines;
    }

    case 'except': {
      const sourceAudit = auditNode ? auditNode.source : null;
      const excludeAudits = auditNode && auditNode.exclude ? auditNode.exclude : [];
      const srcLeaf = renderLeafWithAudit(node.source, catalog, sourceAudit, options);
      if (srcLeaf !== null) {
        label = srcLeaf + ', except:' + renderPostConstraints(node, catalog);
        children = node.exclude;
        childAudits = excludeAudits;
      } else {
        const srcIcon = statusIcon(sourceAudit ? sourceAudit.status : 'not-met');
        label = srcIcon + ' Except:' + renderPostConstraints(node, catalog);
        const childBase = prefix + (connector === '' ? '' :
          connector === '└── ' ? '    ' : '│   ');
        lines.push(prefix + connector + label);
        // Source subtree
        lines.push(childBase + '├── Source:');
        const srcBase = childBase + '│   ';
        const srcItems = node.source.items || [node.source];
        const srcAuditItems = sourceAudit && sourceAudit.items ? sourceAudit.items : [];
        for (let i = 0; i < srcItems.length; i++) {
          const isLast = i === srcItems.length - 1;
          const srcConn = isLast ? '└── ' : '├── ';
          const srcChildAudit = srcAuditItems[i] || (srcItems.length === 1 ? sourceAudit : null);
          const srcChildLines = renderTreeWithAudit(srcItems[i], catalog, srcChildAudit, options, srcBase, srcConn);
          lines.push(...srcChildLines);
        }
        // Exclude subtree
        lines.push(childBase + '└── Except:');
        const excBase = childBase + '    ';
        for (let i = 0; i < node.exclude.length; i++) {
          const isLast = i === node.exclude.length - 1;
          const excConn = isLast ? '└── ' : '├── ';
          const excChildLines = renderTreeWithAudit(node.exclude[i], catalog, excludeAudits[i] || null, options, excBase, excConn);
          lines.push(...excChildLines);
        }
        return lines;
      }
      break;
    }

    case 'variable-def':
      return renderTreeWithAudit(node.value, catalog, auditNode, options, prefix, connector);

    case 'scope':
      return renderTreeWithAudit(node.body, catalog, auditNode, options, prefix, connector);

    case 'variable-ref': {
      // Render resolved subtree in audit mode
      if (auditNode && auditNode.resolved) {
        return renderTreeWithAudit(auditNode.resolved, catalog, auditNode.resolved, options, prefix, connector);
      }
      // No resolved content — render as leaf
      const ref = node.scope ? `$${node.scope}.${node.name}` : `$${node.name}`;
      lines.push(prefix + connector + icon + ' ' + ref);
      return lines;
    }

    case 'program-ref': {
      // Sub-audit: render as composite with sub-result children
      if (auditNode && auditNode.result) {
        label = icon + ' Program: "' + node.code + '"' + summaryText(auditNode.result);
        const subResult = auditNode.result;
        // The sub-result may itself be a composite, scope, variable-def, etc.
        const childBase = prefix + (connector === '' ? '' :
          connector === '└── ' ? '    ' : '│   ');
        lines.push(prefix + connector + label);
        // Render the sub-audit tree as children
        const subLines = renderTreeWithAudit(
          subResult, catalog, subResult, options, childBase, '└── '
        );
        lines.push(...subLines);
        return lines;
      }
      // No result — render as leaf
      lines.push(prefix + connector + icon + ' Program: "' + node.code + '"');
      return lines;
    }

    case 'program-filter': {
      // Audit has evaluated items — render each as a sub-tree
      if (auditNode && auditNode.items && auditNode.items.length > 0) {
        const pfxText = renderLeaf(node, catalog);
        label = icon + ' ' + pfxText + summaryText(auditNode);
        const childBase = prefix + (connector === '' ? '' :
          connector === '└── ' ? '    ' : '│   ');
        lines.push(prefix + connector + label);
        for (let i = 0; i < auditNode.items.length; i++) {
          const item = auditNode.items[i];
          const isLast = i === auditNode.items.length - 1;
          const childConn = isLast ? '└── ' : '├── ';
          const itemIcon = statusIcon(item.status);
          if (item.result) {
            // Program with sub-audit
            lines.push(childBase + childConn + itemIcon + ' Program: "' + item.code + '"' + summaryText(item.result));
            const subBase = childBase + (isLast ? '    ' : '│   ');
            const subLines = renderTreeWithAudit(item.result, catalog, item.result, options, subBase, '└── ');
            lines.push(...subLines);
          } else {
            // Program without sub-audit (not declared, no requirements, etc.)
            let itemLabel = itemIcon + ' Program: "' + item.code + '"';
            if (item.notDeclared) itemLabel += ' (not declared)';
            lines.push(childBase + childConn + itemLabel);
          }
        }
        return lines;
      }
      // No items — render as leaf
      lines.push(prefix + connector + icon + ' ' + renderLeaf(node, catalog));
      return lines;
    }

    case 'overlap-limit': {
      const left = renderLeaf(node.left, catalog);
      const right = renderLeaf(node.right, catalog);
      const unit = node.constraint.unit === 'percent' ? '%' : ` ${node.constraint.unit}`;
      label = icon + ` Overlap between ${left} and ${right}: at most ${node.constraint.value}${unit}`;
      break;
    }

    case 'outside-program': {
      const prog = renderLeaf(node.program, catalog);
      label = icon + ` At least ${node.constraint.value} credits from outside ${prog}`;
      break;
    }

    default:
      throw new Error(`Unknown node type: ${node.type}`);
  }

  lines.push(prefix + connector + label);

  const childBase = prefix + (connector === '' ? '' :
    connector === '└── ' ? '    ' : '│   ');

  for (let i = 0; i < children.length; i++) {
    const childIsLast = i === children.length - 1;
    const childConnector = childIsLast ? '└── ' : '├── ';
    const childLines = renderTreeWithAudit(children[i], catalog, childAudits[i] || null, options, childBase, childConnector);
    lines.push(...childLines);
  }

  return lines;
}

/**
 * Render an AST as an indented tree outline.
 *
 * When `auditResult` is provided, adds status icons and audit details
 * (grade/term, summary counts) to each node.
 *
 * @param {Object} ast - AST node from parse()
 * @param {Object} [catalog] - Optional catalog with `courses` array for title lookup
 * @param {Object} [auditResult] - Optional audit result tree (parallel structure to AST)
 * @param {Object} [options] - Options (e.g. annotations Map)
 * @returns {string} Indented outline string
 */
function toOutline(ast, catalog, auditResult, options) {
  if (!auditResult) {
    return renderTree(ast, catalog || null, '', '').join('\n');
  }
  return renderTreeWithAudit(ast, catalog || null, auditResult, options || {}, '', '').join('\n');
}

module.exports = { toOutline };
