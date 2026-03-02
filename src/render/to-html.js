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
      return `<div class="reqit-requirement reqit-all-of">` +
        `<p class="reqit-label">Complete <strong>all</strong> of the following:</p>` +
        renderPostConstraints(node, catalog) +
        renderItemList(node.items, catalog) +
        `</div>`;

    case 'any-of':
      return `<div class="reqit-requirement reqit-any-of">` +
        `<p class="reqit-label">Complete <strong>any one</strong> of the following:</p>` +
        renderPostConstraints(node, catalog) +
        renderItemList(node.items, catalog) +
        `</div>`;

    case 'none-of':
      return `<div class="reqit-requirement reqit-none-of">` +
        `<p class="reqit-label"><strong>None</strong> of the following may be used:</p>` +
        renderPostConstraints(node, catalog) +
        renderItemList(node.items, catalog) +
        `</div>`;

    case 'n-of': {
      const comp = comparisonPhrase(node.comparison);
      return `<div class="reqit-requirement reqit-n-of">` +
        `<p class="reqit-label">Complete <strong>${comp} ${node.count}</strong> of the following:</p>` +
        renderPostConstraints(node, catalog) +
        renderItemList(node.items, catalog) +
        `</div>`;
    }

    case 'one-from-each':
      return `<div class="reqit-requirement reqit-one-from-each">` +
        `<p class="reqit-label">Complete <strong>one from each</strong> of the following:</p>` +
        renderPostConstraints(node, catalog) +
        renderItemList(node.items, catalog) +
        `</div>`;

    case 'from-n-groups':
      return `<div class="reqit-requirement reqit-from-n-groups">` +
        `<p class="reqit-label">Complete courses from <strong>at least ${node.count}</strong> of the following groups:</p>` +
        renderPostConstraints(node, catalog) +
        renderItemList(node.items, catalog) +
        `</div>`;

    case 'credits-from': {
      const comp = comparisonPhrase(node.comparison);
      const sourceItems = unwrapCreditsSource(node);
      return `<div class="reqit-requirement reqit-credits-from">` +
        `<p class="reqit-label">Complete <strong>${comp} ${node.credits} credits</strong> from:</p>` +
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
 * @param {Object} ast - AST node from parse()
 * @param {Object} [catalog] - Optional catalog for course title lookup
 * @returns {string} HTML string
 */
function toHTML(ast, catalog) {
  return renderNode(ast, catalog || null);
}

module.exports = { toHTML };
