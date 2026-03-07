'use strict';

/**
 * to-html.js — Render an AST as semantic HTML with `reqit-` prefixed CSS classes.
 *
 * All user-supplied text is escaped via `esc()` to prevent XSS.
 * CSS class prefix: `reqit-` (e.g. `.reqit-course`, `.reqit-label`).
 */

const { OP_SYMBOLS, comparisonPhrase, lookupTitle, renderFilterPhrase, unwrapCreditsSource, lookupAttributeName, courseKey } = require('./shared');

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
  if (f.field === 'attribute' && catalog && typeof f.value === 'string') {
    const name = lookupAttributeName(f.value, catalog);
    if (name !== f.value) {
      return `${esc(f.field)} ${OP_SYMBOLS[f.op]} &quot;${esc(name)}&quot;`;
    }
  }
  return renderFilterPhrase(f, v => renderNode(v, catalog), esc, v => '&quot;' + esc(v) + '&quot;');
}

/**
 * Render post-constraint clauses as HTML spans.
 * @param {Object} node - Node potentially carrying `post_constraints`
 * @param {Object|null} catalog - Catalog for title lookup inside filter values
 * @returns {string} HTML string (empty if no constraints)
 */
function renderPostConstraints(node, catalog, pfx) {
  if (!node.post_constraints) return '';
  const p = pfx || 'reqit-';
  return node.post_constraints.map(pc => {
    const comp = comparisonPhrase(pc.comparison);
    const fv = renderFilter(pc.filter, catalog);
    return ` <span class="${p}post-constraint">where ${comp} ${pc.count} have ${fv}</span>`;
  }).join('');
}

/**
 * Generate an HTML label for composite node types.
 * @param {Object} node - AST node
 * @returns {string} HTML string
 */
function compositeLabel(node, pfx) {
  const p = pfx || 'reqit-';
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
    return `<span class="${p}named-label">${esc(node.label)}</span> \u2014 ${base.charAt(0).toLowerCase()}${base.slice(1)}`;
  }
  return base;
}

/**
 * Recursive single-dispatch renderer producing semantic HTML.
 * @param {Object} node - AST node
 * @param {Object|null} catalog - Optional catalog for course title lookup
 * @returns {string} HTML string
 */
function renderNode(node, catalog, pfx, opts) {
  if (!pfx) pfx = 'reqit-';
  if (!opts) opts = {};

  function renderItemList(items) {
    return `<ul class="${pfx}items">` +
      items.map(item => `<li>${renderNode(item, catalog, pfx, opts)}</li>`).join('') +
      '</ul>';
  }

  function applyLabel(defaultLabel) {
    if (opts.labelFormat) return opts.labelFormat(defaultLabel, node, catalog);
    return defaultLabel;
  }

  switch (node.type) {
    case 'course': {
      let html = `<span class="${pfx}course">` +
        `<span class="${pfx}subject">${esc(node.subject)}</span> ` +
        `<span class="${pfx}number">${esc(node.number)}</span>`;
      const title = lookupTitle(node, catalog) || '';
      if (title) {
        html += ` <span class="${pfx}title">${esc(title)}</span>`;
      }
      if (node.concurrentAllowed) {
        html += ` <span class="${pfx}concurrent">(concurrent)</span>`;
      }
      if (opts.annotations) {
        const key = courseKey(node);
        const annots = opts.annotations.get(key);
        if (annots && annots.length > 0) {
          html += ` <span class="${pfx}annotation">(${esc(annots.join(', '))})</span>`;
        }
      }
      html += '</span>';
      return html;
    }

    case 'course-filter':
      return `<span class="${pfx}course-filter">Any course where ${node.filters.map(f => renderFilter(f, catalog)).join(' and ')}</span>`;

    case 'score':
      return `<span class="${pfx}score">Score ${esc(node.name)} ${OP_SYMBOLS[node.op]} ${node.value}</span>`;

    case 'attainment':
      return `<span class="${pfx}attainment">Attainment: ${esc(node.name)}</span>`;

    case 'quantity':
      return `<span class="${pfx}quantity">Quantity: ${esc(node.name)} ${OP_SYMBOLS[node.op]} ${node.value}</span>`;

    case 'variable-ref': {
      const ref = node.scope ? `$${esc(node.scope)}.${esc(node.name)}` : `$${esc(node.name)}`;
      return `<span class="${pfx}variable-ref">${ref}</span>`;
    }

    case 'all-of':
    case 'any-of':
    case 'none-of':
    case 'n-of':
    case 'one-from-each':
    case 'from-n-groups':
      return `<div class="${pfx}requirement ${pfx}${node.type}">` +
        `<p class="${pfx}label">${applyLabel(compositeLabel(node, pfx))}</p>` +
        renderPostConstraints(node, catalog, pfx) +
        renderItemList(node.items) +
        `</div>`;

    case 'credits-from': {
      const comp = comparisonPhrase(node.comparison);
      const sourceItems = unwrapCreditsSource(node);
      const creditsBase = `Complete <strong>${comp} ${node.credits} credits</strong> from:`;
      const creditsHeading = node.label
        ? `<span class="${pfx}named-label">${esc(node.label)}</span> \u2014 ${creditsBase.charAt(0).toLowerCase()}${creditsBase.slice(1)}`
        : creditsBase;
      return `<div class="${pfx}requirement ${pfx}credits-from">` +
        `<p class="${pfx}label">${applyLabel(creditsHeading)}</p>` +
        renderPostConstraints(node, catalog, pfx) +
        renderItemList(sourceItems) +
        `</div>`;
    }

    case 'with-constraint': {
      const inner = renderNode(node.requirement, catalog, pfx, opts);
      const constraint = node.constraint.kind === 'min-grade'
        ? `minimum grade of ${esc(node.constraint.value)}`
        : `minimum GPA of ${node.constraint.value}`;
      return `<div class="${pfx}requirement ${pfx}with-constraint">` +
        inner +
        `<p class="${pfx}constraint">With a ${constraint}</p>` +
        `</div>`;
    }

    case 'except': {
      const source = renderNode(node.source, catalog, pfx, opts);
      return `<div class="${pfx}requirement ${pfx}except">` +
        source +
        `<p class="${pfx}label">Except:</p>` +
        renderPostConstraints(node, catalog, pfx) +
        renderItemList(node.exclude) +
        `</div>`;
    }

    case 'variable-def':
      return renderNode(node.value, catalog, pfx, opts);

    case 'scope':
      return renderNode(node.body, catalog, pfx, opts);

    case 'program': {
      if (node.code) {
        return `<span class="${pfx}program">Program ${esc(node.code)} (${esc(node['program-type'])}, ${esc(node.level)})</span>`;
      }
      return `<span class="${pfx}program">Any program (${esc(node['program-type'])}, ${esc(node.level)})</span>`;
    }

    case 'program-context-ref':
      return `<span class="${pfx}program-context-ref">${node.role === 'primary-major' ? 'primary major' : 'primary minor'}</span>`;

    case 'overlap-limit': {
      const left = renderNode(node.left, catalog, pfx, opts);
      const right = renderNode(node.right, catalog, pfx, opts);
      const unit = node.constraint.unit === 'percent' ? '%' : ` ${node.constraint.unit}`;
      return `<div class="${pfx}requirement ${pfx}overlap-limit">` +
        `<p class="${pfx}label">Overlap between ${left} and ${right}: at most ${node.constraint.value}${unit}</p>` +
        `</div>`;
    }

    case 'outside-program': {
      const prog = renderNode(node.program, catalog, pfx, opts);
      return `<div class="${pfx}requirement ${pfx}outside-program">` +
        `<p class="${pfx}label">At least ${node.constraint.value} credits from outside ${prog}</p>` +
        `</div>`;
    }

    case 'program-ref':
      return `<span class="${pfx}program-ref">Program &quot;${esc(node.code)}&quot;</span>`;

    case 'program-filter': {
      const quantPfx = node.quantifier === 'any' ? 'Any program'
        : node.quantifier === 'all' ? 'All programs'
        : `${comparisonPhrase(node.comparison).charAt(0).toUpperCase() + comparisonPhrase(node.comparison).slice(1)} ${node.count} programs`;
      const fDescs = node.filters.map(f => `${esc(f.field)} ${OP_SYMBOLS[f.op] || esc(f.op)} &quot;${esc(String(f.value))}&quot;`).join(' and ');
      return `<span class="${pfx}program-filter">${quantPfx} where ${fDescs}</span>`;
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
function toHTML(ast, catalog, auditResult, options) {
  const opts = options || {};
  const pfx = opts.classPrefix || 'reqit-';
  let html;
  if (!auditResult) {
    html = renderNode(ast, catalog || null, pfx, opts);
  } else {
    html = renderNodeWithAudit(ast, catalog || null, auditResult, pfx, opts);
  }
  if (opts.wrapperTag) {
    html = `<${esc(opts.wrapperTag)} class="${pfx}root">${html}</${esc(opts.wrapperTag)}>`;
  }
  return html;
}

/**
 * Status CSS class for an audit status.
 */
function statusClass(status, pfx) {
  if (!status) return '';
  return ` ${pfx}status-${status}`;
}

/**
 * Status indicator HTML.
 */
function statusIndicator(status, pfx) {
  if (!status) return '';
  switch (status) {
    case 'met': return `<span class="${pfx}status-indicator">&#10003;</span> `;
    case 'in-progress': return `<span class="${pfx}status-indicator">&#9711;</span> `;
    case 'partial-progress': return `<span class="${pfx}status-indicator">&#9681;</span> `;
    case 'not-met': return `<span class="${pfx}status-indicator">&#9675;</span> `;
    default: return '';
  }
}

/**
 * Render a node with audit overlay (parallel walk of AST and audit result).
 */
function renderNodeWithAudit(node, catalog, auditNode, pfx, opts) {
  if (!pfx) pfx = 'reqit-';
  if (!opts) opts = {};

  const status = auditNode ? auditNode.status : null;
  const sc = statusClass(status, pfx);
  const si = statusIndicator(status, pfx);

  function auditItemList(items, audits) {
    return `<ul class="${pfx}items">` +
      items.map((item, i) =>
        `<li>${renderNodeWithAudit(item, catalog, audits[i] || null, pfx, opts)}</li>`
      ).join('') + '</ul>';
  }

  function applyLabel(defaultLabel) {
    if (opts.labelFormat) return opts.labelFormat(defaultLabel, node, catalog);
    return defaultLabel;
  }

  switch (node.type) {
    case 'course': {
      let html = `<span class="${pfx}course${sc}">` + si +
        `<span class="${pfx}subject">${esc(node.subject)}</span> ` +
        `<span class="${pfx}number">${esc(node.number)}</span>`;
      const title = lookupTitle(node, catalog) || '';
      if (title) {
        html += ` <span class="${pfx}title">${esc(title)}</span>`;
      }
      if (node.concurrentAllowed) {
        html += ` <span class="${pfx}concurrent">(concurrent)</span>`;
      }
      // Add grade/term info from audit
      if (auditNode && auditNode.satisfiedBy) {
        const entry = auditNode.satisfiedBy;
        if (entry.grade) {
          html += ` <span class="${pfx}grade">${esc(entry.grade)}</span>`;
        }
        if (entry.term) {
          html += ` <span class="${pfx}term">${esc(entry.term)}</span>`;
        }
      }
      // Add annotation from options
      if (opts.annotations) {
        const key = courseKey(node);
        const annots = opts.annotations.get(key);
        if (annots && annots.length > 0) {
          html += ` <span class="${pfx}annotation">(${esc(annots.join(', '))})</span>`;
        }
      }
      html += '</span>';
      return html;
    }

    case 'course-filter':
      return `<span class="${pfx}course-filter${sc}">${si}Any course where ${node.filters.map(f => renderFilter(f, catalog)).join(' and ')}</span>`;

    case 'score':
      return `<span class="${pfx}score${sc}">${si}Score ${esc(node.name)} ${OP_SYMBOLS[node.op]} ${node.value}</span>`;

    case 'attainment':
      return `<span class="${pfx}attainment${sc}">${si}Attainment: ${esc(node.name)}</span>`;

    case 'quantity':
      return `<span class="${pfx}quantity${sc}">${si}Quantity: ${esc(node.name)} ${OP_SYMBOLS[node.op]} ${node.value}</span>`;

    case 'variable-ref': {
      const ref = node.scope ? `$${esc(node.scope)}.${esc(node.name)}` : `$${esc(node.name)}`;
      return `<span class="${pfx}variable-ref${sc}">${si}${ref}</span>`;
    }

    case 'all-of':
    case 'any-of':
    case 'none-of':
    case 'n-of':
    case 'one-from-each':
    case 'from-n-groups': {
      const auditItems = auditNode && auditNode.items ? auditNode.items : [];
      return `<div class="${pfx}requirement ${pfx}${node.type}${sc}">` +
        `<p class="${pfx}label">${si}${applyLabel(compositeLabel(node, pfx))}</p>` +
        renderPostConstraints(node, catalog, pfx) +
        auditItemList(node.items, auditItems) +
        `</div>`;
    }

    case 'credits-from': {
      const comp = comparisonPhrase(node.comparison);
      const sourceItems = unwrapCreditsSource(node);
      const sourceAudit = auditNode ? auditNode.source : null;
      // For credits-from, source audit may be an all-of wrapping the items
      const sourceAuditItems = sourceAudit && sourceAudit.items ? sourceAudit.items : [];
      const creditsBaseAudit = `Complete <strong>${comp} ${node.credits} credits</strong> from:`;
      const creditsHeadingAudit = node.label
        ? `<span class="${pfx}named-label">${esc(node.label)}</span> \u2014 ${creditsBaseAudit.charAt(0).toLowerCase()}${creditsBaseAudit.slice(1)}`
        : creditsBaseAudit;
      return `<div class="${pfx}requirement ${pfx}credits-from${sc}">` +
        `<p class="${pfx}label">${si}${applyLabel(creditsHeadingAudit)}</p>` +
        renderPostConstraints(node, catalog, pfx) +
        auditItemList(sourceItems, sourceAuditItems.length > 0 ? sourceAuditItems : sourceItems.map(() => sourceAudit)) +
        `</div>`;
    }

    case 'with-constraint': {
      const innerAudit = auditNode ? auditNode.requirement : null;
      const inner = renderNodeWithAudit(node.requirement, catalog, innerAudit, pfx, opts);
      const constraint = node.constraint.kind === 'min-grade'
        ? `minimum grade of ${esc(node.constraint.value)}`
        : `minimum GPA of ${node.constraint.value}`;
      return `<div class="${pfx}requirement ${pfx}with-constraint${sc}">` +
        inner +
        `<p class="${pfx}constraint">${si}With a ${constraint}</p>` +
        `</div>`;
    }

    case 'except': {
      const sourceAudit = auditNode ? auditNode.source : null;
      const source = renderNodeWithAudit(node.source, catalog, sourceAudit, pfx, opts);
      const excludeAudits = auditNode && auditNode.exclude ? auditNode.exclude : [];
      return `<div class="${pfx}requirement ${pfx}except${sc}">` +
        source +
        `<p class="${pfx}label">Except:</p>` +
        renderPostConstraints(node, catalog, pfx) +
        auditItemList(node.exclude, excludeAudits) +
        `</div>`;
    }

    case 'variable-def':
      return renderNodeWithAudit(node.value, catalog, auditNode, pfx, opts);

    case 'scope':
      return renderNodeWithAudit(node.body, catalog, auditNode, pfx, opts);

    case 'program-ref': {
      let html = `<span class="${pfx}program-ref${sc}">${si}Program &quot;${esc(node.code)}&quot;`;
      if (auditNode && auditNode.notDeclared) {
        html += ' <em>(not declared)</em>';
      }
      html += '</span>';
      return html;
    }

    case 'program-filter': {
      const quantPfx = node.quantifier === 'any' ? 'Any program'
        : node.quantifier === 'all' ? 'All programs'
        : `${comparisonPhrase(node.comparison).charAt(0).toUpperCase() + comparisonPhrase(node.comparison).slice(1)} ${node.count} programs`;
      const fDescs = node.filters.map(f => `${esc(f.field)} ${OP_SYMBOLS[f.op] || esc(f.op)} &quot;${esc(String(f.value))}&quot;`).join(' and ');
      return `<span class="${pfx}program-filter${sc}">${si}${quantPfx} where ${fDescs}</span>`;
    }

    // Remaining types: fall through to non-audit rendering
    default:
      return renderNode(node, catalog, pfx, opts);
  }
}

module.exports = { toHTML };
