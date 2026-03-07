'use strict';

/**
 * Structural guard: every node type in NODE_TYPES must be handled by every renderer.
 * If someone adds a type to NODE_TYPES but forgets a renderer, this test fails.
 */

const { NODE_TYPES } = require('../../src/render/shared');
const { toText } = require('../../src/render/to-text');
const { toDescription } = require('../../src/render/to-description');
const { toOutline } = require('../../src/render/to-outline');
const { toHTML } = require('../../src/render/to-html');

// Minimal valid AST node for each type — just enough structure to avoid property errors.
const COURSE = { type: 'course', subject: 'MATH', number: '151' };

const minimalNodes = {
  'course': COURSE,
  'course-filter': {
    type: 'course-filter',
    filters: [{ field: 'subject', op: 'eq', value: 'MATH' }],
  },
  'score': { type: 'score', name: 'SAT', op: 'gte', value: 500 },
  'attainment': { type: 'attainment', name: 'Orientation' },
  'quantity': { type: 'quantity', name: 'credits', op: 'gte', value: 30 },
  'variable-ref': { type: 'variable-ref', name: 'x' },
  'all-of': { type: 'all-of', items: [COURSE] },
  'any-of': { type: 'any-of', items: [COURSE] },
  'none-of': { type: 'none-of', items: [COURSE] },
  'n-of': { type: 'n-of', comparison: 'at-least', count: 2, items: [COURSE, COURSE] },
  'one-from-each': { type: 'one-from-each', items: [{ type: 'all-of', items: [COURSE] }] },
  'from-n-groups': { type: 'from-n-groups', count: 2, items: [{ type: 'all-of', items: [COURSE] }] },
  'credits-from': {
    type: 'credits-from',
    comparison: 'at-least',
    credits: 6,
    source: COURSE,
  },
  'with-constraint': {
    type: 'with-constraint',
    requirement: COURSE,
    constraint: { kind: 'min-grade', value: 'C' },
  },
  'except': {
    type: 'except',
    source: { type: 'all-of', items: [COURSE] },
    exclude: [COURSE],
  },
  'variable-def': {
    type: 'variable-def',
    name: 'x',
    value: COURSE,
  },
  'scope': {
    type: 'scope',
    name: 'test',
    defs: [],
    body: COURSE,
  },
  'program': {
    type: 'program',
    code: 'CS-BS',
    'program-type': 'major',
    level: 'undergraduate',
  },
  'program-context-ref': { type: 'program-context-ref', role: 'primary-major' },
  'overlap-limit': {
    type: 'overlap-limit',
    left: { type: 'program', code: 'CS-BS', 'program-type': 'major', level: 'undergraduate' },
    right: { type: 'program', code: 'MATH-BS', 'program-type': 'major', level: 'undergraduate' },
    constraint: { value: 12, unit: 'credits' },
  },
  'outside-program': {
    type: 'outside-program',
    program: { type: 'program', code: 'CS-BS', 'program-type': 'major', level: 'undergraduate' },
    constraint: { value: 30, unit: 'credits' },
  },
  'program-ref': { type: 'program-ref', code: 'MATH-MINOR' },
  'program-filter': {
    type: 'program-filter',
    quantifier: 'any',
    filters: [{ field: 'type', op: 'eq', value: 'minor' }],
  },
};

// Sanity check: our fixture covers every NODE_TYPE
test('minimalNodes fixture covers all NODE_TYPES', () => {
  for (const t of NODE_TYPES) {
    expect(minimalNodes).toHaveProperty(t);
  }
});

describe.each([
  ['toText', toText],
  ['toDescription', toDescription],
  ['toOutline', toOutline],
  ['toHTML', toHTML],
])('%s handles every NODE_TYPE', (name, renderer) => {
  for (const nodeType of NODE_TYPES) {
    test(nodeType, () => {
      const node = minimalNodes[nodeType];
      // Should not throw "Unknown node type"
      const result = renderer(node);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  }
});
