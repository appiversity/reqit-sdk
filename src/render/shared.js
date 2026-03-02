'use strict';

const OP_SYMBOLS = {
  eq: '=',
  ne: '!=',
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
  in: 'in',
  'not-in': 'not in',
};

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

function comparisonPhrase(comparison) {
  if (comparison === 'at-least') return 'at least';
  if (comparison === 'at-most') return 'at most';
  return 'exactly';
}

function lookupTitle(node, catalog) {
  if (!catalog || !catalog.courses) return null;
  const course = catalog.courses.find(
    c => c.subject === node.subject && c.number === node.number
  );
  return course ? course.title : null;
}

function renderFilterPhrase(f, renderValue, escapeField, quoteValue) {
  if (!escapeField) escapeField = v => v;
  if (!quoteValue) quoteValue = v => '"' + v + '"';

  if (f.field === 'prerequisite-includes' || f.field === 'corequisite-includes') {
    const kind = f.field === 'prerequisite-includes' ? 'prerequisite' : 'corequisite';
    return `${kind} includes ${renderValue(f.value)}`;
  }
  const phrase = OP_PHRASES[f.op];
  if (Array.isArray(f.value)) {
    return `${escapeField(f.field)} ${phrase} ${f.value.map(v => quoteValue(v)).join(', ')}`;
  }
  if (typeof f.value === 'string') {
    return `${escapeField(f.field)} ${phrase} ${quoteValue(f.value)}`;
  }
  return `${escapeField(f.field)} ${phrase} ${f.value}`;
}

module.exports = { OP_SYMBOLS, OP_PHRASES, comparisonPhrase, lookupTitle, renderFilterPhrase };
