'use strict';

const { NODE_TYPES } = require('../../src/render/shared');
const { auditNode } = require('../../src/audit/single-tree');
const { MET, NOT_MET } = require('../../src/audit/status');

/**
 * Every NODE_TYPE must be handled by the audit walker without
 * emitting an "unknown-node-type" warning. This test ensures that
 * adding a new node type to NODE_TYPES will fail until the auditor
 * is updated to handle it.
 */
describe('exhaustiveness guard', () => {
  // Minimal context for running auditNode
  const ctx = {
    catalog: { courses: [] },
    courses: [],
    catalogIndex: new Map(),
    crossListIndex: new Map(),
    transcript: { byKey: new Map(), byCrossListGroup: new Map(), entries: [] },
    gradeConfig: { scale: [], passFail: [], withdrawal: [], incomplete: [] },
    defs: new Map(),
    expanding: new Set(),
    attainments: {},
    backtrack: false,
    warnings: [],
  };

  // Build minimal valid AST nodes for each type
  const minimalNodes = {
    'course': { type: 'course', subject: 'X', number: '1' },
    'course-filter': { type: 'course-filter', filters: [] },
    'score': { type: 'score', name: 'SAT', op: 'gte', value: 0 },
    'attainment': { type: 'attainment', name: 'X' },
    'quantity': { type: 'quantity', name: 'X', op: 'gte', value: 0 },
    'variable-ref': { type: 'variable-ref', name: 'x' },
    'all-of': { type: 'all-of', items: [] },
    'any-of': { type: 'any-of', items: [] },
    'none-of': { type: 'none-of', items: [] },
    'n-of': { type: 'n-of', comparison: 'at-least', count: 0, items: [] },
    'one-from-each': { type: 'one-from-each', items: [] },
    'from-n-groups': { type: 'from-n-groups', count: 0, items: [] },
    'credits-from': {
      type: 'credits-from', comparison: 'at-least', credits: 0,
      source: { type: 'all-of', items: [] },
    },
    'with-constraint': {
      type: 'with-constraint',
      constraint: { kind: 'min-grade', value: 'C' },
      requirement: { type: 'course', subject: 'X', number: '1' },
    },
    'except': {
      type: 'except',
      source: { type: 'all-of', items: [] },
      exclude: [],
    },
    'variable-def': { type: 'variable-def', name: 'x', value: null },
    'scope': { type: 'scope', name: 'test', defs: [], body: { type: 'all-of', items: [] } },
    'program': { type: 'program', code: 'X' },
    'program-context-ref': { type: 'program-context-ref', name: 'X' },
    'overlap-limit': { type: 'overlap-limit', max: 0 },
    'outside-program': { type: 'outside-program' },
    'program-ref': { type: 'program-ref', code: 'MATH-MINOR' },
    'program-filter': {
      type: 'program-filter', quantifier: 'any',
      filters: [{ field: 'type', op: 'eq', value: 'minor' }],
    },
  };

  test('every NODE_TYPE has a minimal test node', () => {
    for (const nodeType of NODE_TYPES) {
      expect(minimalNodes[nodeType]).toBeDefined();
    }
  });

  for (const nodeType of NODE_TYPES) {
    test(`${nodeType} is handled without unknown-node-type warning`, () => {
      // Reset warnings for each test
      const testCtx = { ...ctx, warnings: [] };
      const node = minimalNodes[nodeType];
      const result = auditNode(node, testCtx);

      expect(result).toBeDefined();
      expect(typeof result.status).toBe('string');

      const unknownWarnings = testCtx.warnings.filter(
        w => w.type === 'unknown-node-type'
      );
      expect(unknownWarnings).toHaveLength(0);
    });
  }

  test('unknown node type produces warning', () => {
    const testCtx = { ...ctx, warnings: [] };
    const result = auditNode({ type: 'not-a-real-type' }, testCtx);
    expect(result.status).toBe(NOT_MET);
    expect(testCtx.warnings).toHaveLength(1);
    expect(testCtx.warnings[0].type).toBe('unknown-node-type');
  });
});
