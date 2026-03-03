'use strict';

const { audit, MET, NOT_MET } = require('../../src/audit');
const minimalCatalog = require('../fixtures/catalogs/minimal.json');

const complete = require('../fixtures/transcripts/minimal/complete.json');
const empty = require('../fixtures/transcripts/minimal/empty.json');

// ============================================================
// cross-listed-match warning
// ============================================================

describe('cross-listed-match warning', () => {
  const xlCatalog = {
    ...minimalCatalog,
    courses: [
      ...minimalCatalog.courses,
      { id: 100, subject: 'CMPS', number: '340', title: 'Combinatorics',
        creditsMin: 3, creditsMax: 3, crossListGroup: 'xlg-combo' },
      { id: 101, subject: 'MATH', number: '340', title: 'Combinatorics',
        creditsMin: 3, creditsMax: 3, crossListGroup: 'xlg-combo' },
    ],
  };

  test('emits warning when cross-list match used', () => {
    const ast = { type: 'course', subject: 'CMPS', number: '340' };
    const transcript = [
      { subject: 'MATH', number: '340', grade: 'A', credits: 3,
        term: 'Fall 2024', status: 'completed' },
    ];
    const { warnings } = audit(ast, xlCatalog, transcript);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].type).toBe('cross-listed-match');
    expect(warnings[0].subject).toBe('CMPS');
    expect(warnings[0].number).toBe('340');
    expect(warnings[0].matchedSubject).toBe('MATH');
    expect(warnings[0].matchedNumber).toBe('340');
    expect(warnings[0].message).toContain('cross-listing');
  });

  test('no warning when direct match available', () => {
    const ast = { type: 'course', subject: 'CMPS', number: '340' };
    const transcript = [
      { subject: 'CMPS', number: '340', grade: 'B', credits: 3,
        term: 'Fall 2024', status: 'completed' },
    ];
    const { warnings } = audit(ast, xlCatalog, transcript);
    const xlWarnings = warnings.filter(w => w.type === 'cross-listed-match');
    expect(xlWarnings).toHaveLength(0);
  });
});

// ============================================================
// unknown-node-type warning
// ============================================================

describe('unknown-node-type warning', () => {
  test('emits warning for unknown AST node type', () => {
    const ast = { type: 'hypothetical-future-node' };
    const { warnings } = audit(ast, minimalCatalog, empty);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].type).toBe('unknown-node-type');
    expect(warnings[0].nodeType).toBe('hypothetical-future-node');
    expect(warnings[0].message).toContain('hypothetical-future-node');
  });

  test('multiple unknown nodes emit multiple warnings', () => {
    const ast = {
      type: 'all-of',
      items: [
        { type: 'future-a' },
        { type: 'future-b' },
      ],
    };
    const { warnings } = audit(ast, minimalCatalog, empty);
    const unknowns = warnings.filter(w => w.type === 'unknown-node-type');
    expect(unknowns).toHaveLength(2);
    expect(unknowns[0].nodeType).toBe('future-a');
    expect(unknowns[1].nodeType).toBe('future-b');
  });
});

// ============================================================
// post-constraint-failed warning
// ============================================================

describe('post-constraint-failed warning', () => {
  test('emits warning when post-constraint fails', () => {
    // n-of with post_constraints: select 2, but require at least 1 from MATH
    // Give it 2 CMPS courses that are met — MATH constraint should fail
    const ast = {
      type: 'n-of', comparison: 'at-least', count: 2,
      items: [
        { type: 'course', subject: 'CMPS', number: '130' },
        { type: 'course', subject: 'CMPS', number: '135' },
        { type: 'course', subject: 'MATH', number: '101' },
      ],
      post_constraints: [{
        comparison: 'at-least',
        count: 2,
        filter: { field: 'subject', op: 'eq', value: 'MATH' },
      }],
    };
    // All 3 met, n-of at-least 2 is met, but post-constraint needs 2 MATH
    // Only 1 MATH course is met
    const { status, warnings } = audit(ast, minimalCatalog, complete);
    // The n-of should report the post-constraint failure
    const pcWarnings = warnings.filter(w => w.type === 'post-constraint-failed');
    expect(pcWarnings).toHaveLength(1);
    expect(pcWarnings[0].actual).toBeDefined();
  });

  test('no warning when post-constraint succeeds', () => {
    const ast = {
      type: 'n-of', comparison: 'at-least', count: 2,
      items: [
        { type: 'course', subject: 'MATH', number: '101' },
        { type: 'course', subject: 'MATH', number: '151' },
        { type: 'course', subject: 'CMPS', number: '130' },
      ],
      post_constraints: [{
        comparison: 'at-least',
        count: 1,
        filter: { field: 'subject', op: 'eq', value: 'MATH' },
      }],
    };
    const { warnings } = audit(ast, minimalCatalog, complete);
    const pcWarnings = warnings.filter(w => w.type === 'post-constraint-failed');
    expect(pcWarnings).toHaveLength(0);
  });
});

// ============================================================
// Warnings are non-fatal
// ============================================================

describe('warnings are non-fatal', () => {
  test('audit always completes even with warnings', () => {
    const ast = {
      type: 'all-of',
      items: [
        { type: 'course', subject: 'MATH', number: '101' },
        { type: 'unknown-type' },
      ],
    };
    const { status, result, warnings } = audit(ast, minimalCatalog, complete);
    // Audit completes — status determined from children
    expect(result).toBeDefined();
    expect(result.type).toBe('all-of');
    // Unknown type child produces warning + not-met
    expect(warnings.length).toBeGreaterThan(0);
  });

  test('no warnings for normal audit', () => {
    const ast = { type: 'course', subject: 'MATH', number: '101' };
    const { warnings } = audit(ast, minimalCatalog, complete);
    expect(warnings).toHaveLength(0);
  });
});
