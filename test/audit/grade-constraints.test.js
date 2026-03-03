'use strict';

const { audit, MET, IN_PROGRESS, NOT_MET } = require('../../src/audit');
const minimalCatalog = require('../fixtures/catalogs/minimal.json');

const complete = require('../fixtures/transcripts/minimal/complete.json');
const empty = require('../fixtures/transcripts/minimal/empty.json');
const inProgress = require('../fixtures/transcripts/minimal/in-progress.json');

// ============================================================
// with-constraint: min-grade
// ============================================================

describe('with-constraint min-grade', () => {
  test('all courses meet min-grade → met', () => {
    // MATH 101 (B+), MATH 151 (A-) both ≥ C
    const ast = {
      type: 'with-constraint',
      constraint: { kind: 'min-grade', value: 'C' },
      requirement: {
        type: 'all-of',
        items: [
          { type: 'course', subject: 'MATH', number: '101' },
          { type: 'course', subject: 'MATH', number: '151' },
        ],
      },
    };
    const { status, result } = audit(ast, minimalCatalog, complete);
    expect(status).toBe(MET);
    expect(result.constraintResult.met).toBe(true);
  });

  test('course below min-grade → not-met', () => {
    // Custom transcript with one grade below threshold
    const transcript = [
      { subject: 'MATH', number: '101', grade: 'D', credits: 3,
        term: 'Fall 2023', status: 'completed' },
      { subject: 'MATH', number: '151', grade: 'A', credits: 4,
        term: 'Spring 2024', status: 'completed' },
    ];
    const ast = {
      type: 'with-constraint',
      constraint: { kind: 'min-grade', value: 'C' },
      requirement: {
        type: 'all-of',
        items: [
          { type: 'course', subject: 'MATH', number: '101' },
          { type: 'course', subject: 'MATH', number: '151' },
        ],
      },
    };
    const { status, result } = audit(ast, minimalCatalog, transcript);
    expect(status).toBe(NOT_MET);
    expect(result.constraintResult.met).toBe(false);
  });

  test('inner requirement not-met → not-met (constraint not evaluated)', () => {
    const ast = {
      type: 'with-constraint',
      constraint: { kind: 'min-grade', value: 'C' },
      requirement: { type: 'course', subject: 'ART', number: '301' },
    };
    const { status, result } = audit(ast, minimalCatalog, empty);
    expect(status).toBe(NOT_MET);
    expect(result.constraintResult).toBeUndefined();
  });

  test('grade exactly at threshold → met', () => {
    const transcript = [
      { subject: 'MATH', number: '101', grade: 'C', credits: 3,
        term: 'Fall 2023', status: 'completed' },
    ];
    const ast = {
      type: 'with-constraint',
      constraint: { kind: 'min-grade', value: 'C' },
      requirement: { type: 'course', subject: 'MATH', number: '101' },
    };
    const { status } = audit(ast, minimalCatalog, transcript);
    expect(status).toBe(MET);
  });

  test('all in-progress → min-grade constraint vacuously met, overall IN_PROGRESS', () => {
    const transcript = [
      { subject: 'MATH', number: '101', grade: null, credits: 3,
        term: 'Fall 2023', status: 'in-progress' },
      { subject: 'MATH', number: '151', grade: null, credits: 4,
        term: 'Spring 2024', status: 'in-progress' },
    ];
    const ast = {
      type: 'with-constraint',
      constraint: { kind: 'min-grade', value: 'B' },
      requirement: {
        type: 'all-of',
        items: [
          { type: 'course', subject: 'MATH', number: '101' },
          { type: 'course', subject: 'MATH', number: '151' },
        ],
      },
    };
    const { status, result } = audit(ast, minimalCatalog, transcript);
    expect(status).toBe(IN_PROGRESS);
    expect(result.constraintResult.met).toBe(true);
    expect(result.constraintResult.gradedCount).toBe(0);
  });

  test('in-progress courses skipped in grade check', () => {
    // MATH 152 is in-progress (null grade) — should be skipped for min-grade
    const ast = {
      type: 'with-constraint',
      constraint: { kind: 'min-grade', value: 'B' },
      requirement: {
        type: 'all-of',
        items: [
          { type: 'course', subject: 'MATH', number: '101' },   // B+, completed
          { type: 'course', subject: 'MATH', number: '152' },   // in-progress
        ],
      },
    };
    const { status, result } = audit(ast, minimalCatalog, inProgress);
    // Inner is in-progress (mix of met + ip), constraint passes on graded entries
    expect(status).toBe(IN_PROGRESS);
    expect(result.constraintResult.met).toBe(true);
  });
});

// ============================================================
// with-constraint: min-gpa
// ============================================================

describe('with-constraint min-gpa', () => {
  test('GPA above threshold → met', () => {
    // All complete transcript courses have good grades
    const ast = {
      type: 'with-constraint',
      constraint: { kind: 'min-gpa', value: 2.0 },
      requirement: {
        type: 'all-of',
        items: [
          { type: 'course', subject: 'MATH', number: '101' },  // B+ (3.3)
          { type: 'course', subject: 'MATH', number: '151' },  // A- (3.7)
          { type: 'course', subject: 'CMPS', number: '130' },  // A  (4.0)
        ],
      },
    };
    const { status, result } = audit(ast, minimalCatalog, complete);
    expect(status).toBe(MET);
    expect(result.constraintResult.met).toBe(true);
    expect(result.constraintResult.actual).toBeGreaterThan(2.0);
  });

  test('GPA below threshold → not-met', () => {
    const transcript = [
      { subject: 'MATH', number: '101', grade: 'D', credits: 3,
        term: 'Fall 2023', status: 'completed' },
      { subject: 'MATH', number: '151', grade: 'D+', credits: 4,
        term: 'Spring 2024', status: 'completed' },
    ];
    const ast = {
      type: 'with-constraint',
      constraint: { kind: 'min-gpa', value: 2.0 },
      requirement: {
        type: 'all-of',
        items: [
          { type: 'course', subject: 'MATH', number: '101' },
          { type: 'course', subject: 'MATH', number: '151' },
        ],
      },
    };
    const { status, result } = audit(ast, minimalCatalog, transcript);
    expect(status).toBe(NOT_MET);
    expect(result.constraintResult.met).toBe(false);
    expect(result.constraintResult.actual).toBeLessThan(2.0);
  });

  test('GPA exactly at threshold → met', () => {
    // C = 2.0. If all courses are C, GPA = 2.0
    const transcript = [
      { subject: 'MATH', number: '101', grade: 'C', credits: 3,
        term: 'Fall 2023', status: 'completed' },
      { subject: 'MATH', number: '151', grade: 'C', credits: 3,
        term: 'Spring 2024', status: 'completed' },
    ];
    const ast = {
      type: 'with-constraint',
      constraint: { kind: 'min-gpa', value: 2.0 },
      requirement: {
        type: 'all-of',
        items: [
          { type: 'course', subject: 'MATH', number: '101' },
          { type: 'course', subject: 'MATH', number: '151' },
        ],
      },
    };
    const { status, result } = audit(ast, minimalCatalog, transcript);
    expect(status).toBe(MET);
    expect(result.constraintResult.actual).toBe(2.0);
  });

  test('all in-progress → min-gpa constraint vacuously met, overall IN_PROGRESS', () => {
    const transcript = [
      { subject: 'MATH', number: '101', grade: null, credits: 3,
        term: 'Fall 2023', status: 'in-progress' },
      { subject: 'MATH', number: '151', grade: null, credits: 4,
        term: 'Spring 2024', status: 'in-progress' },
    ];
    const ast = {
      type: 'with-constraint',
      constraint: { kind: 'min-gpa', value: 3.0 },
      requirement: {
        type: 'all-of',
        items: [
          { type: 'course', subject: 'MATH', number: '101' },
          { type: 'course', subject: 'MATH', number: '151' },
        ],
      },
    };
    const { status, result } = audit(ast, minimalCatalog, transcript);
    expect(status).toBe(IN_PROGRESS);
    expect(result.constraintResult.met).toBe(true);
    expect(result.constraintResult.actual).toBe(0);
    expect(result.constraintResult.gradedCount).toBe(0);
  });

  test('inner not-met → not-met without evaluating GPA', () => {
    const ast = {
      type: 'with-constraint',
      constraint: { kind: 'min-gpa', value: 2.0 },
      requirement: { type: 'course', subject: 'ART', number: '301' },
    };
    const { status, result } = audit(ast, minimalCatalog, empty);
    expect(status).toBe(NOT_MET);
    expect(result.constraintResult).toBeUndefined();
  });

  test('inner in-progress with GPA below → in-progress (GPA may change)', () => {
    // Low GPA but still in-progress — GPA could change when IP courses complete
    const transcript = [
      { subject: 'MATH', number: '101', grade: 'D', credits: 3,
        term: 'Fall 2023', status: 'completed' },
      { subject: 'MATH', number: '151', grade: null, credits: 4,
        term: 'Spring 2024', status: 'in-progress' },
    ];
    const ast = {
      type: 'with-constraint',
      constraint: { kind: 'min-gpa', value: 3.0 },
      requirement: {
        type: 'all-of',
        items: [
          { type: 'course', subject: 'MATH', number: '101' },
          { type: 'course', subject: 'MATH', number: '151' },
        ],
      },
    };
    const { status } = audit(ast, minimalCatalog, transcript);
    // Inner status is in-progress (met + ip), GPA is below 3.0 but could change
    expect(status).toBe(IN_PROGRESS);
  });

  test('constraintResult includes minGpa and actual', () => {
    const ast = {
      type: 'with-constraint',
      constraint: { kind: 'min-gpa', value: 2.0 },
      requirement: { type: 'course', subject: 'MATH', number: '101' },
    };
    const { result } = audit(ast, minimalCatalog, complete);
    expect(result.constraintResult.minGpa).toBe(2.0);
    expect(typeof result.constraintResult.actual).toBe('number');
  });
});
