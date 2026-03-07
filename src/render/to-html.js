'use strict';

/**
 * to-html.js — Render an AST as semantic HTML with `reqit-` prefixed CSS classes.
 *
 * All user-supplied text is escaped via `esc()` to prevent XSS.
 * CSS class prefix: `reqit-` (e.g. `.reqit-course`, `.reqit-label`).
 */

const { OP_SYMBOLS, comparisonPhrase, lookupTitle, renderFilterPhrase, unwrapCreditsSource } = require('./shared');

/**
 * HTML-escape a string (guards against XSS in user-supplied values).
 * @param {string} str
 * @returns {string}
 */
function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Render a single filter clause as HTML, delegating to shared `renderFilterPhrase`
 * with HTML-safe escaping and quoting callbacks.
 * @param {Object} f - Filter with `field`, `op`, `value`
 * @param {Object|null} catalog - Catalog for title lookup inside prerequisite-includes values
 * @returns {string} HTML fragment
 */
function renderFilter(f, catalog) {
  return renderFilterPhrase(f, v => renderNode(v, catalog), esc, v => '&quot;' + esc(v) + '&quot;');
}

/**
 * Render post-constraint clauses as HTML spans.
 * @param {Object} node - Node potentially carrying `post_constraints`
 * @param {Object|null} catalog - Catalog for title lookup inside filter values
 * @returns {string} HTML string (empty if no constraints)
 */
function renderPostConstraints(node, catalog) {
  if (!node.post_constraints) return '';
  return node.post_constraints.map(pc => {
    const comp = comparisonPhrase(pc.comparison);
    const fv = renderFilter(pc.filter, catalog);
    return ` <span class="reqit-post-constraint">where ${comp} ${pc.count} have ${fv}</span>`;
  }).join('');
}

/**
 * Render a list of child items as an HTML `<ul>`.
 * @param {Array<Object>} items
 * @param {Object|null} catalog
 * @returns {string}
 */
function renderItemList(items, catalog) {
  return '<ul class="reqit-items">' +
    items.map(item => `<li>${renderNode(item, catalog)}</li>`).join('') +
    '</ul>';
}

/**
 * Generate an HTML label for composite node types.
 * @param {Object} node - AST node
 * @returns {string} HTML string
 */
function compositeLabel(node) {
  let base;
  switch (node.type) {
    case 'all-of': base = 'Complete <strong>all</strong> of the following:'; break;
    case 'any-of': base = 'Complete <strong>any one</strong> of the following:'; break;
    case 'none-of': base = '<strong>None</strong> of the following may be used:'; break;
    case 'n-of': base = `Complete <strong>${comparisonPhrase(node.comparison)} ${node.count}</strong> of the following:`; break;
    case 'one-from-each': base = 'Complete <strong>one from each</strong> of the following:'; break;
    case 'from-n-groups': base = `Complete courses from <strong>at least ${node.count}</strong> of the following groups:`; break;
    default: base = node.type;
  }
  if (node.label) {
    return `<span class="reqit-named-label">${esc(node.label)}</span> \u2014 ${base.charAt(0).toLowerCase()}${base.slice(1)}`;
  }
  return base;
}

/**
 * Recursive single-dispatch renderer producing semantic HTML.
 * @param {Object} node - AST node
 * @param {Object|null} catalog - Optional catalog for course title lookup
 * @returns {string} HTML string
 */
function renderNode(node, catalog) {
  switch (node.type) {
    case 'course': {
      let html = `<span class="reqit-course">` +
        `<span class="reqit-subject">${esc(node.subject)}</span> ` +
        `<span class="reqit-number">${esc(node.number)}</span>`;
      const title = lookupTitle(node, catalog) || '';
      if (title) {
        html += ` <span class="reqit-title">${esc(title)}</span>`;
      }
      if (node.concurrentAllowed) {
        html += ' <span class="reqit-concurrent">(concurrent)</span>';
      }
      html += '</span>';
      return html;
    }

    case 'course-filter':
      return `<span class="reqit-course-filter">Any course where ${node.filters.map(f => renderFilter(f, catalog)).join(' and ')}</span>`;

    case 'score':
      return `<span class="reqit-score">Score ${esc(node.name)} ${OP_SYMBOLS[node.op]} ${node.value}</span>`;

    case 'attainment':
      return `<span class="reqit-attainment">Attainment: ${esc(node.name)}</span>`;

    case 'quantity':
      return `<span class="reqit-quantity">Quantity: ${esc(node.name)} ${OP_SYMBOLS[node.op]} ${node.value}</span>`;

    case 'variable-ref': {
      const ref = node.scope ? `$${esc(node.scope)}.${esc(node.name)}` : `$${esc(node.name)}`;
      return `<span class="reqit-variable-ref">${ref}</span>`;
    }

    case 'all-of':
    case 'any-of':
    case 'none-of':
    case 'n-of':
    case 'one-from-each':
    case 'from-n-groups':
      return `<div class="reqit-requirement reqit-${node.type}">` +
        `<p class="reqit-label">${compositeLabel(node)}</p>` +
        renderPostConstraints(node, catalog) +
        renderItemList(node.items, catalog) +
        `</div>`;

    case 'credits-from': {
      const comp = comparisonPhrase(node.comparison);
      const sourceItems = unwrapCreditsSource(node);
      const creditsBase = `Complete <strong>${comp} ${node.credits} credits</strong> from:`;
      const creditsHeading = node.label
        ? `<span class="reqit-named-label">${esc(node.label)}</span> \u2014 ${creditsBase.charAt(0).toLowerCase()}${creditsBase.slice(1)}`
        : creditsBase;
      return `<div class="reqit-requirement reqit-credits-from">` +
        `<p class="reqit-label">${creditsHeading}</p>` +
        renderPostConstraints(node, catalog) +
        renderItemList(sourceItems, catalog) +
        `</div>`;
    }

    case 'with-constraint': {
      const inner = renderNode(node.requirement, catalog);
      const constraint = node.constraint.kind === 'min-grade'
        ? `minimum grade of ${esc(node.constraint.value)}`
        : `minimum GPA of ${node.constraint.value}`;
      return `<div class="reqit-requirement reqit-with-constraint">` +
        inner +
        `<p class="reqit-constraint">With a ${constraint}</p>` +
        `</div>`;
    }

    case 'except': {
      const source = renderNode(node.source, catalog);
      return `<div class="reqit-requirement reqit-except">` +
        source +
        `<p class="reqit-label">Except:</p>` +
        renderPostConstraints(node, catalog) +
        renderItemList(node.exclude, catalog) +
        `</div>`;
    }

    case 'variable-def':
      return renderNode(node.value, catalog);

    case 'scope':
      return renderNode(node.body, catalog);

    case 'program': {
      if (node.code) {
        return `<span class="reqit-program">Program ${esc(node.code)} (${esc(node['program-type'])}, ${esc(node.level)})</span>`;
      }
      return `<span class="reqit-program">Any program (${esc(node['program-type'])}, ${esc(node.level)})</span>`;
    }

    case 'program-context-ref':
      return `<span class="reqit-program-context-ref">${node.role === 'primary-major' ? 'primary major' : 'primary minor'}</span>`;

    case 'overlap-limit': {
      const left = renderNode(node.left, catalog);
      const right = renderNode(node.right, catalog);
      const unit = node.constraint.unit === 'percent' ? '%' : ` ${node.constraint.unit}`;
      return `<div class="reqit-requirement reqit-overlap-limit">` +
        `<p class="reqit-label">Overlap between ${left} and ${right}: at most ${node.constraint.value}${unit}</p>` +
        `</div>`;
    }

    case 'outside-program': {
      const prog = renderNode(node.program, catalog);
      return `<div class="reqit-requirement reqit-outside-program">` +
        `<p class="reqit-label">At least ${node.constraint.value} credits from outside ${prog}</p>` +
        `</div>`;
    }

    default:
      throw new Error(`Unknown node type: ${node.type}`);
  }
}

/**
 * Render an AST as semantic HTML with reqit- CSS classes.
 *
 * When `auditResult` is provided, adds status CSS classes (`reqit-status-met`,
 * `reqit-status-not-met`, `reqit-status-in-progress`), status indicators,
 * and grade/term info for met courses.
 *
 * @param {Object} ast - AST node from parse()
 * @param {Object} [catalog] - Optional catalog for course title lookup
 * @param {Object} [auditResult] - Optional audit result tree (parallel structure to AST)
 * @returns {string} HTML string
 */
function toHTML(ast, catalog, auditResult) {
  if (!auditResult) {
    return renderNode(ast, catalog || null);
  }
  return renderNodeWithAudit(ast, catalog || null, auditResult);
}

/**
 * Status CSS class for an audit status.
 */
function statusClass(status) {
  if (!status) return '';
  return ` reqit-status-${status}`;
}

/**
 * Status indicator HTML.
 */
function statusIndicator(status) {
  if (!status) return '';
  switch (status) {
    case 'met': return '<span class="reqit-status-indicator">&#10003;</span> ';
    case 'in-progress': return '<span class="reqit-status-indicator">&#9711;</span> ';
    case 'partial-progress': return '<span class="reqit-status-indicator">&#9681;</span> ';
    case 'not-met': return '<span class="reqit-status-indicator">&#9675;</span> ';
    default: return '';
  }
}

/**
 * Render a node with audit overlay (parallel walk of AST and audit result).
 */
function renderNodeWithAudit(node, catalog, auditNode) {
  const status = auditNode ? auditNode.status : null;
  const sc = statusClass(status);
  const si = statusIndicator(status);

  switch (node.type) {
    case 'course': {
      let html = `<span class="reqit-course${sc}">` + si +
        `<span class="reqit-subject">${esc(node.subject)}</span> ` +
        `<span class="reqit-number">${esc(node.number)}</span>`;
      const title = lookupTitle(node, catalog) || '';
      if (title) {
        html += ` <span class="reqit-title">${esc(title)}</span>`;
      }
      if (node.concurrentAllowed) {
        html += ' <span class="reqit-concurrent">(concurrent)</span>';
      }
      // Add grade/term info from audit
      if (auditNode && auditNode.satisfiedBy) {
        const entry = auditNode.satisfiedBy;
        if (entry.grade) {
          html += ` <span class="reqit-grade">${esc(entry.grade)}</span>`;
        }
        if (entry.term) {
          html += ` <span class="reqit-term">${esc(entry.term)}</span>`;
        }
      }
      html += '</span>';
      return html;
    }

    case 'course-filter':
      return `<span class="reqit-course-filter${sc}">${si}Any course where ${node.filters.map(f => renderFilter(f, catalog)).join(' and ')}</span>`;

    case 'score':
      return `<span class="reqit-score${sc}">${si}Score ${esc(node.name)} ${OP_SYMBOLS[node.op]} ${node.value}</span>`;

    case 'attainment':
      return `<span class="reqit-attainment${sc}">${si}Attainment: ${esc(node.name)}</span>`;

    case 'quantity':
      return `<span class="reqit-quantity${sc}">${si}Quantity: ${esc(node.name)} ${OP_SYMBOLS[node.op]} ${node.value}</span>`;

    case 'variable-ref': {
      const ref = node.scope ? `$${esc(node.scope)}.${esc(node.name)}` : `$${esc(node.name)}`;
      return `<span class="reqit-variable-ref${sc}">${si}${ref}</span>`;
    }

    case 'all-of':
    case 'any-of':
    case 'none-of':
    case 'n-of':
    case 'one-from-each':
    case 'from-n-groups': {
      const auditItems = auditNode && auditNode.items ? auditNode.items : [];
      const itemsHtml = '<ul class="reqit-items">' +
        node.items.map((item, i) =>
          `<li>${renderNodeWithAudit(item, catalog, auditItems[i] || null)}</li>`
        ).join('') + '</ul>';
      return `<div class="reqit-requirement reqit-${node.type}${sc}">` +
        `<p class="reqit-label">${si}${compositeLabel(node)}</p>` +
        renderPostConstraints(node, catalog) +
        itemsHtml +
        `</div>`;
    }

    case 'credits-from': {
      const comp = comparisonPhrase(node.comparison);
      const sourceItems = unwrapCreditsSource(node);
      const sourceAudit = auditNode ? auditNode.source : null;
      // For credits-from, source audit may be an all-of wrapping the items
      const sourceAuditItems = sourceAudit && sourceAudit.items ? sourceAudit.items : [];
      const itemsHtml = '<ul class="reqit-items">' +
        sourceItems.map((item, i) =>
          `<li>${renderNodeWithAudit(item, catalog, sourceAuditItems[i] || sourceAudit)}</li>`
        ).join('') + '</ul>';
      const creditsBaseAudit = `Complete <strong>${comp} ${node.credits} credits</strong> from:`;
      const creditsHeadingAudit = node.label
        ? `<span class="reqit-named-label">${esc(node.label)}</span> \u2014 ${creditsBaseAudit.charAt(0).toLowerCase()}${creditsBaseAudit.slice(1)}`
        : creditsBaseAudit;
      return `<div class="reqit-requirement reqit-credits-from${sc}">` +
        `<p class="reqit-label">${si}${creditsHeadingAudit}</p>` +
        renderPostConstraints(node, catalog) +
        itemsHtml +
        `</div>`;
    }

    case 'with-constraint': {
      const innerAudit = auditNode ? auditNode.requirement : null;
      const inner = renderNodeWithAudit(node.requirement, catalog, innerAudit);
      const constraint = node.constraint.kind === 'min-grade'
        ? `minimum grade of ${esc(node.constraint.value)}`
        : `minimum GPA of ${node.constraint.value}`;
      return `<div class="reqit-requirement reqit-with-constraint${sc}">` +
        inner +
        `<p class="reqit-constraint">${si}With a ${constraint}</p>` +
        `</div>`;
    }

    case 'except': {
      const sourceAudit = auditNode ? auditNode.source : null;
      const source = renderNodeWithAudit(node.source, catalog, sourceAudit);
      const excludeAudits = auditNode && auditNode.exclude ? auditNode.exclude : [];
      const excludeHtml = '<ul class="reqit-items">' +
        node.exclude.map((item, i) =>
          `<li>${renderNodeWithAudit(item, catalog, excludeAudits[i] || null)}</li>`
        ).join('') + '</ul>';
      return `<div class="reqit-requirement reqit-except${sc}">` +
        source +
        `<p class="reqit-label">Except:</p>` +
        renderPostConstraints(node, catalog) +
        excludeHtml +
        `</div>`;
    }

    case 'variable-def':
      return renderNodeWithAudit(node.value, catalog, auditNode);

    case 'scope':
      return renderNodeWithAudit(node.body, catalog, auditNode);

    // Remaining types: fall through to non-audit rendering
    default:
      return renderNode(node, catalog);
  }
}

module.exports = { toHTML };
