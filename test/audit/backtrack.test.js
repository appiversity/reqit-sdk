'use strict';

const { audit, MET, NOT_MET } = require('../../src/audit');
const minimalCatalog = require('../fixtures/catalogs/minimal.json');

const complete = require('../fixtures/transcripts/minimal/complete.json');

// ============================================================
// Backtracking disabled (default)
// ============================================================

describe('post-constraint without backtracking (default)', () => {
  test('at-most constraint fails on full set → not-met with warning', () => {
    // Require at-least 2, but at-most 1 from CMPS
    // Student has 3 met: CMPS 130, CMPS 135, MATH 101 → 2 CMPS, fails at-most 1
    const ast = {
      type: 'n-of', comparison: 'at-least', count: 2,
      items: [
        { type: 'course', subject: 'CMPS', number: '130' },
        { type: 'course', subject: 'CMPS', number: '135' },
        { type: 'course', subject: 'MATH', number: '101' },
      ],
      post_constraints: [{
        comparison: 'at-most', count: 1,
        filter: { field: 'subject', op: 'eq', value: 'CMPS' },
      }],
    };
    const { status, warnings } = audit(ast, minimalCatalog, complete);
    expect(status).toBe(NOT_MET);
    const pc = warnings.filter(w => w.type === 'post-constraint-failed');
    expect(pc).toHaveLength(1);
  });

  test('at-least constraint satisfied → met, no warning', () => {
    const ast = {
      type: 'n-of', comparison: 'at-least', count: 2,
      items: [
        { type: 'course', subject: 'MATH', number: '101' },
        { type: 'course', subject: 'MATH', number: '151' },
        { type: 'course', subject: 'CMPS', number: '130' },
      ],
      post_constraints: [{
        comparison: 'at-least', count: 1,
        filter: { field: 'subject', op: 'eq', value: 'MATH' },
      }],
    };
    const { status, warnings } = audit(ast, minimalCatalog, complete);
    expect(status).toBe(MET);
    expect(warnings.filter(w => w.type === 'post-constraint-failed')).toHaveLength(0);
  });
});

// ============================================================
// Backtracking enabled
// ============================================================

describe('post-constraint with backtracking', () => {
  const opts = { backtrack: true };

  test('at-most constraint: backtracking finds valid subset → met', () => {
    // Require at-least 2, but at-most 1 from CMPS
    // Student has 3 met: CMPS 130, CMPS 135, MATH 101
    // Greedy: 2 CMPS → fails at-most 1
    // Backtrack: select {CMPS 130, MATH 101} or {CMPS 135, MATH 101} → passes
    const ast = {
      type: 'n-of', comparison: 'at-least', count: 2,
      items: [
        { type: 'course', subject: 'CMPS', number: '130' },
        { type: 'course', subject: 'CMPS', number: '135' },
        { type: 'course', subject: 'MATH', number: '101' },
      ],
      post_constraints: [{
        comparison: 'at-most', count: 1,
        filter: { field: 'subject', op: 'eq', value: 'CMPS' },
      }],
    };
    const { status, result, warnings } = audit(ast, minimalCatalog, complete, opts);
    expect(status).toBe(MET);
    expect(warnings.filter(w => w.type === 'post-constraint-failed')).toHaveLength(0);
    // Should have selectedItems indicating which subset was chosen
    expect(result.selectedItems).toBeDefined();
    expect(result.selectedItems).toHaveLength(2);
  });

  test('no valid subset exists → not-met even with backtracking', () => {
    // Require at-least 2, but at-most 0 from CMPS
    // Student has: CMPS 130, CMPS 135, MATH 101
    // No subset of 2 has 0 CMPS (only 1 MATH course available)
    const ast = {
      type: 'n-of', comparison: 'at-least', count: 2,
      items: [
        { type: 'course', subject: 'CMPS', number: '130' },
        { type: 'course', subject: 'CMPS', number: '135' },
        { type: 'course', subject: 'MATH', number: '101' },
      ],
      post_constraints: [{
        comparison: 'at-most', count: 0,
        filter: { field: 'subject', op: 'eq', value: 'CMPS' },
      }],
    };
    const { status, warnings } = audit(ast, minimalCatalog, complete, opts);
    expect(status).toBe(NOT_MET);
    expect(warnings.filter(w => w.type === 'post-constraint-failed')).toHaveLength(1);
  });

  test('exactly constraint: backtracking selects correct subset', () => {
    // Require at-least 3, exactly 2 from MATH
    // Student has: MATH 101, MATH 151, MATH 152, CMPS 130, CMPS 135
    // All 5 met — 3 are MATH, but need exactly 2
    // Backtrack: select {MATH 101, MATH 151, CMPS 130} → exactly 2 MATH → passes
    const ast = {
      type: 'n-of', comparison: 'at-least', count: 3,
      items: [
        { type: 'course', subject: 'MATH', number: '101' },
        { type: 'course', subject: 'MATH', number: '151' },
        { type: 'course', subject: 'MATH', number: '152' },
        { type: 'course', subject: 'CMPS', number: '130' },
        { type: 'course', subject: 'CMPS', number: '135' },
      ],
      post_constraints: [{
        comparison: 'exactly', count: 2,
        filter: { field: 'subject', op: 'eq', value: 'MATH' },
      }],
    };
    const { status, result } = audit(ast, minimalCatalog, complete, opts);
    expect(status).toBe(MET);
    expect(result.selectedItems).toHaveLength(3);
    // Verify the selected set has exactly 2 MATH
    const mathCount = result.selectedItems.filter(
      item => item.subject === 'MATH'
        || (item.resolved && item.resolved.subject === 'MATH')
        || (item.satisfiedBy && item.satisfiedBy.subject === 'MATH')
    ).length;
    // The selected items are audit result nodes, which include subject on course nodes
    expect(mathCount).toBe(2);
  });

  test('multiple post-constraints: all must be satisfied', () => {
    // Require at-least 3
    // Post: at-least 1 from MATH AND at-most 1 from CMPS
    // Student has: MATH 101, MATH 151, CMPS 130, CMPS 135
    // Select {MATH 101, MATH 151, CMPS 130}: 2 MATH (≥1 ✓), 1 CMPS (≤1 ✓)
    const ast = {
      type: 'n-of', comparison: 'at-least', count: 3,
      items: [
        { type: 'course', subject: 'MATH', number: '101' },
        { type: 'course', subject: 'MATH', number: '151' },
        { type: 'course', subject: 'CMPS', number: '130' },
        { type: 'course', subject: 'CMPS', number: '135' },
      ],
      post_constraints: [
        { comparison: 'at-least', count: 1,
          filter: { field: 'subject', op: 'eq', value: 'MATH' } },
        { comparison: 'at-most', count: 1,
          filter: { field: 'subject', op: 'eq', value: 'CMPS' } },
      ],
    };
    const { status, result } = audit(ast, minimalCatalog, complete, opts);
    expect(status).toBe(MET);
    expect(result.selectedItems).toHaveLength(3);
  });

  test('backtracking not triggered when greedy succeeds', () => {
    const ast = {
      type: 'n-of', comparison: 'at-least', count: 2,
      items: [
        { type: 'course', subject: 'MATH', number: '101' },
        { type: 'course', subject: 'MATH', number: '151' },
        { type: 'course', subject: 'CMPS', number: '130' },
      ],
      post_constraints: [{
        comparison: 'at-least', count: 1,
        filter: { field: 'subject', op: 'eq', value: 'MATH' },
      }],
    };
    const { status, result } = audit(ast, minimalCatalog, complete, opts);
    expect(status).toBe(MET);
    // No selectedItems when greedy succeeds (no backtracking needed)
    expect(result.selectedItems).toBeUndefined();
  });

  test('backtracking only applies to at-least comparison', () => {
    // at-most comparison — backtracking should not be attempted
    const ast = {
      type: 'n-of', comparison: 'at-most', count: 2,
      items: [
        { type: 'course', subject: 'CMPS', number: '130' },
        { type: 'course', subject: 'CMPS', number: '135' },
        { type: 'course', subject: 'MATH', number: '101' },
      ],
      post_constraints: [{
        comparison: 'at-most', count: 0,
        filter: { field: 'subject', op: 'eq', value: 'CMPS' },
      }],
    };
    // at-most 2: all 3 met → not-met (too many)
    // Post-constraint doesn't even apply since n-of itself fails
    const { status } = audit(ast, minimalCatalog, complete, opts);
    expect(status).toBe(NOT_MET);
  });
});

// ============================================================
// Edge cases
// ============================================================

describe('backtracking edge cases', () => {
  const opts = { backtrack: true };

  test('K equals met count — no choices, must use all', () => {
    // 2 met, need 2 — no alternative subsets possible
    const ast = {
      type: 'n-of', comparison: 'at-least', count: 2,
      items: [
        { type: 'course', subject: 'CMPS', number: '130' },
        { type: 'course', subject: 'CMPS', number: '135' },
      ],
      post_constraints: [{
        comparison: 'at-most', count: 1,
        filter: { field: 'subject', op: 'eq', value: 'CMPS' },
      }],
    };
    const { status } = audit(ast, minimalCatalog, complete, opts);
    // Both are CMPS, need at-most 1 — impossible
    expect(status).toBe(NOT_MET);
  });

  test('no post-constraints → backtracking not triggered', () => {
    const ast = {
      type: 'n-of', comparison: 'at-least', count: 2,
      items: [
        { type: 'course', subject: 'MATH', number: '101' },
        { type: 'course', subject: 'CMPS', number: '130' },
      ],
    };
    const { status } = audit(ast, minimalCatalog, complete, opts);
    expect(status).toBe(MET);
  });

  test('combinatorial explosion warning emitted for large input', () => {
    // Create enough items to exceed 100,000 combinations
    // C(20, 10) = 184,756 > 100,000
    const items = [];
    for (let i = 0; i < 20; i++) {
      items.push({ type: 'course', subject: 'ELEC', number: String(100 + i) });
    }
    const ast = {
      type: 'n-of', comparison: 'at-least', count: 10,
      items,
      post_constraints: [{
        comparison: 'at-least', count: 1,
        filter: { field: 'subject', op: 'eq', value: 'MATH' },
      }],
    };
    // Build transcript with all 20 courses completed
    const transcript = items.map(c => ({
      subject: c.subject, number: c.number, grade: 'A', credits: 3,
      term: 'Fall 2023', status: 'completed',
    }));
    // Need a catalog with these courses
    const catalog = {
      ...minimalCatalog,
      courses: [
        ...minimalCatalog.courses,
        ...items.map((c, i) => ({
          id: 100 + i, subject: c.subject, number: c.number,
          title: `Elective ${c.number}`, creditsMin: 3, creditsMax: 3,
        })),
      ],
    };
    const { warnings } = audit(ast, catalog, transcript, opts);
    const explosionWarnings = warnings.filter(w => w.type === 'backtrack-combinatorial-explosion');
    expect(explosionWarnings).toHaveLength(1);
    expect(explosionWarnings[0].count).toBeGreaterThan(100_000);
    expect(explosionWarnings[0].n).toBe(20);
    expect(explosionWarnings[0].k).toBe(10);
  });

  test('combinatorial warning NOT emitted for small input', () => {
    // C(3, 2) = 3, well under threshold
    const ast = {
      type: 'n-of', comparison: 'at-least', count: 2,
      items: [
        { type: 'course', subject: 'CMPS', number: '130' },
        { type: 'course', subject: 'CMPS', number: '135' },
        { type: 'course', subject: 'MATH', number: '101' },
      ],
      post_constraints: [{
        comparison: 'at-most', count: 1,
        filter: { field: 'subject', op: 'eq', value: 'CMPS' },
      }],
    };
    const { warnings } = audit(ast, minimalCatalog, complete, opts);
    const explosionWarnings = warnings.filter(w => w.type === 'backtrack-combinatorial-explosion');
    expect(explosionWarnings).toHaveLength(0);
  });

  test('n-of not met → post-constraints not checked', () => {
    const ast = {
      type: 'n-of', comparison: 'at-least', count: 3,
      items: [
        { type: 'course', subject: 'MATH', number: '101' },
        { type: 'course', subject: 'ART', number: '301' },   // not in partial
        { type: 'course', subject: 'ART', number: '401' },   // not in partial
      ],
      post_constraints: [{
        comparison: 'at-least', count: 1,
        filter: { field: 'subject', op: 'eq', value: 'MATH' },
      }],
    };
    const partial = [
      { subject: 'MATH', number: '101', grade: 'B+', credits: 3,
        term: 'Fall 2023', status: 'completed' },
    ];
    const { status, warnings } = audit(ast, minimalCatalog, partial, opts);
    // Only 1 of 3 met — partial progress, post-constraints not evaluated
    expect(warnings.filter(w => w.type === 'post-constraint-failed')).toHaveLength(0);
  });
});
