'use strict';

/**
 * Structural guard: every node type in NODE_TYPES must be handled by
 * the resolver's walkNode without throwing. If someone adds a node type
 * to NODE_TYPES but forgets to add a case in walkNode, this test fails.
 */

const { NODE_TYPES } = require('../../src/render/shared');
const { resolve } = require('../../src/resolve');

const minimalCatalog = {
  institution: 'test',
  ay: '2025-2026',
  courses: [
    { id: 1, subject: 'MATH', number: '151', title: 'Calculus I', creditsMin: 4, creditsMax: 4 },
  ],
  programs: [],
  attainments: [],
  gradeConfig: { scale: [], passFail: [], withdrawal: [], incomplete: [] },
};

const COURSE = { type: 'course', subject: 'MATH', number: '151' };

// Minimal valid AST node for each type — just enough to not crash walkNode.
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
    source: COURSE,
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
};

// Sanity check: our fixture covers every NODE_TYPE
test('minimalNodes fixture covers all NODE_TYPES', () => {
  for (const t of NODE_TYPES) {
    expect(minimalNodes).toHaveProperty(t);
  }
});

describe('resolver walkNode handles every NODE_TYPE', () => {
  for (const nodeType of NODE_TYPES) {
    test(nodeType, () => {
      const node = minimalNodes[nodeType];
      // Should not throw — walkNode must have an explicit case for every type
      expect(() => resolve(node, minimalCatalog)).not.toThrow();
    });
  }
});
