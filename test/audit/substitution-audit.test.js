'use strict';

/**
 * Integration tests for audit with substitutions.
 *
 * Uses the internal audit() function with exception options
 * to verify substitution processing via virtual transcript entries.
 */

const { audit } = require('../../src/audit');
const { substitution, waiver } = require('../../src/audit/exceptions');
const { SUBSTITUTED, MET, NOT_MET, PROVISIONAL_MET, WAIVED } = require('../../src/audit/status');
const minimalCatalog = require('../fixtures/catalogs/minimal.json');
const { findUnmet } = require('../../src/audit/find-unmet');

// ============================================================
// Basic substitution
// ============================================================

describe('basic substitution', () => {
  test('substituted course returns status substituted', () => {
    const ast = { type: 'course', subject: 'MATH', number: '151' };
    const sub = substitution({
      original: { subject: 'MATH', number: '151' },
      replacement: { subject: 'PHYS', number: '201' },
      reason: 'Department approval',
    });
    const tx = [
      { subject: 'PHYS', number: '201', grade: 'B+', credits: 4, status: 'completed' },
    ];
    const result = audit(ast, minimalCatalog, tx, { exceptions: [sub] });

    expect(result.status).toBe(SUBSTITUTED);
    expect(result.result.status).toBe(SUBSTITUTED);
    expect(result.result.substitution).toBeDefined();
    expect(result.result.substitution.kind).toBe('substitution');
    expect(result.result.substitution.reason).toBe('Department approval');
  });

  test('substituted course carries replacement info in satisfiedBy', () => {
    const ast = { type: 'course', subject: 'MATH', number: '151' };
    const sub = substitution({
      original: { subject: 'MATH', number: '151' },
      replacement: { subject: 'PHYS', number: '201' },
      reason: 'approved',
    });
    const tx = [
      { subject: 'PHYS', number: '201', grade: 'A', credits: 4, status: 'completed' },
    ];
    const result = audit(ast, minimalCatalog, tx, { exceptions: [sub] });

    // The virtual entry has MATH:151 as subject/number but grade/credits from PHYS 201
    expect(result.result.satisfiedBy.grade).toBe('A');
    expect(result.result.satisfiedBy.credits).toBe(4);
  });

  test('substitution does not apply when replacement not on transcript', () => {
    const ast = { type: 'course', subject: 'MATH', number: '151' };
    const sub = substitution({
      original: { subject: 'MATH', number: '151' },
      replacement: { subject: 'PHYS', number: '201' },
      reason: 'approved',
    });
    const result = audit(ast, minimalCatalog, [], { exceptions: [sub] });

    expect(result.status).toBe(NOT_MET);
  });

  test('direct match takes priority over substitution', () => {
    const ast = { type: 'course', subject: 'MATH', number: '151' };
    const sub = substitution({
      original: { subject: 'MATH', number: '151' },
      replacement: { subject: 'PHYS', number: '201' },
      reason: 'approved',
    });
    const tx = [
      { subject: 'MATH', number: '151', grade: 'A', credits: 4, status: 'completed' },
      { subject: 'PHYS', number: '201', grade: 'B', credits: 4, status: 'completed' },
    ];
    const result = audit(ast, minimalCatalog, tx, { exceptions: [sub] });

    // Direct match wins — status should be MET not SUBSTITUTED
    expect(result.status).toBe(MET);
    expect(result.result.substitution).toBeUndefined();
  });
});

// ============================================================
// Evaluation order: waiver > direct > substitution
// ============================================================

describe('evaluation order', () => {
  test('waiver takes priority over substitution', () => {
    const ast = { type: 'course', subject: 'MATH', number: '151' };
    const w = waiver({ course: { subject: 'MATH', number: '151' }, reason: 'AP credit' });
    const sub = substitution({
      original: { subject: 'MATH', number: '151' },
      replacement: { subject: 'PHYS', number: '201' },
      reason: 'approved',
    });
    const tx = [
      { subject: 'PHYS', number: '201', grade: 'A', credits: 4, status: 'completed' },
    ];
    const result = audit(ast, minimalCatalog, tx, { exceptions: [w, sub] });

    expect(result.status).toBe(WAIVED);
  });
});

// ============================================================
// Substitution in composites
// ============================================================

describe('substitution in composites', () => {
  test('substituted course in all-of propagates as met-equivalent', () => {
    const ast = {
      type: 'all-of',
      items: [
        { type: 'course', subject: 'MATH', number: '151' },
        { type: 'course', subject: 'CMPS', number: '130' },
      ],
    };
    const sub = substitution({
      original: { subject: 'MATH', number: '151' },
      replacement: { subject: 'PHYS', number: '201' },
      reason: 'approved',
    });
    const tx = [
      { subject: 'PHYS', number: '201', grade: 'A', credits: 4, status: 'completed' },
      { subject: 'CMPS', number: '130', grade: 'B', credits: 3, status: 'completed' },
    ];
    const result = audit(ast, minimalCatalog, tx, { exceptions: [sub] });

    expect(result.status).toBe(MET);
    expect(result.result.items[0].status).toBe(SUBSTITUTED);
    expect(result.result.items[1].status).toBe(MET);
  });

  test('substituted course excluded from findUnmet', () => {
    const ast = {
      type: 'all-of',
      items: [
        { type: 'course', subject: 'MATH', number: '151' },
        { type: 'course', subject: 'ENGL', number: '101' },
      ],
    };
    const sub = substitution({
      original: { subject: 'MATH', number: '151' },
      replacement: { subject: 'PHYS', number: '201' },
      reason: 'approved',
    });
    const tx = [
      { subject: 'PHYS', number: '201', grade: 'A', credits: 4, status: 'completed' },
    ];
    const result = audit(ast, minimalCatalog, tx, { exceptions: [sub] });

    const unmet = findUnmet(result.result);
    expect(unmet).toHaveLength(1);
    expect(unmet[0].node.subject).toBe('ENGL');
  });
});

// ============================================================
// Constraint interaction with substitutions
// ============================================================

describe('substitution + with-constraint interaction', () => {
  test('replacement grade used for min-grade constraint', () => {
    const ast = {
      type: 'with-constraint',
      constraint: { kind: 'min-grade', value: 'B' },
      requirement: { type: 'course', subject: 'MATH', number: '151' },
    };
    const sub = substitution({
      original: { subject: 'MATH', number: '151' },
      replacement: { subject: 'PHYS', number: '201' },
      reason: 'approved',
    });
    // Replacement has A grade — meets B minimum
    const tx = [
      { subject: 'PHYS', number: '201', grade: 'A', credits: 4, status: 'completed' },
    ];
    const result = audit(ast, minimalCatalog, tx, { exceptions: [sub] });

    expect(result.status).toBe(SUBSTITUTED);
  });

  test('replacement grade that fails min-grade constraint → not-met', () => {
    const ast = {
      type: 'with-constraint',
      constraint: { kind: 'min-grade', value: 'A' },
      requirement: { type: 'course', subject: 'MATH', number: '151' },
    };
    const sub = substitution({
      original: { subject: 'MATH', number: '151' },
      replacement: { subject: 'PHYS', number: '201' },
      reason: 'approved',
    });
    // Replacement has C grade — fails A minimum
    const tx = [
      { subject: 'PHYS', number: '201', grade: 'C', credits: 4, status: 'completed' },
    ];
    const result = audit(ast, minimalCatalog, tx, { exceptions: [sub] });

    expect(result.status).toBe(NOT_MET);
  });
});

// ============================================================
// credits-from with substitutions
// ============================================================

describe('credits-from with substitutions', () => {
  test('substituted course contributes its transcript credits', () => {
    const ast = {
      type: 'credits-from',
      comparison: 'at-least',
      credits: 6,
      source: {
        type: 'all-of',
        items: [
          { type: 'course', subject: 'MATH', number: '151' },
          { type: 'course', subject: 'CMPS', number: '130' },
        ],
      },
    };
    const sub = substitution({
      original: { subject: 'MATH', number: '151' },
      replacement: { subject: 'PHYS', number: '201' },
      reason: 'approved',
    });
    const tx = [
      { subject: 'PHYS', number: '201', grade: 'A', credits: 4, status: 'completed' },
      { subject: 'CMPS', number: '130', grade: 'B', credits: 3, status: 'completed' },
    ];
    const result = audit(ast, minimalCatalog, tx, { exceptions: [sub] });

    expect(result.status).toBe(MET);
    expect(result.result.creditsEarned).toBe(7); // 4 + 3
  });
});

// ============================================================
// In-progress substitution
// ============================================================

describe('in-progress substitution', () => {
  test('in-progress replacement gives in-progress status', () => {
    const ast = { type: 'course', subject: 'MATH', number: '151' };
    const sub = substitution({
      original: { subject: 'MATH', number: '151' },
      replacement: { subject: 'PHYS', number: '201' },
      reason: 'approved',
    });
    const tx = [
      { subject: 'PHYS', number: '201', grade: null, credits: 4, status: 'in-progress' },
    ];
    const result = audit(ast, minimalCatalog, tx, { exceptions: [sub] });

    expect(result.status).toBe(PROVISIONAL_MET);
  });
});

// ============================================================
// Summary with substitutions
// ============================================================

describe('summary with substituted items', () => {
  test('buildSummary counts substituted separately', () => {
    const ast = {
      type: 'all-of',
      items: [
        { type: 'course', subject: 'MATH', number: '151' },
        { type: 'course', subject: 'CMPS', number: '130' },
      ],
    };
    const sub = substitution({
      original: { subject: 'MATH', number: '151' },
      replacement: { subject: 'PHYS', number: '201' },
      reason: 'approved',
    });
    const tx = [
      { subject: 'PHYS', number: '201', grade: 'A', credits: 4, status: 'completed' },
      { subject: 'CMPS', number: '130', grade: 'B', credits: 3, status: 'completed' },
    ];
    const result = audit(ast, minimalCatalog, tx, { exceptions: [sub] });

    const summary = result.result.summary;
    expect(summary.substituted).toBe(1);
    expect(summary.met).toBe(1);
  });
});
