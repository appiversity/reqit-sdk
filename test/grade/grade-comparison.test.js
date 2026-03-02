'use strict';

const { meetsMinGrade, isPassingGrade, DEFAULT_GRADE_CONFIG } = require('../../src/grade');

// ============================================================
// meetsMinGrade
// ============================================================

describe('meetsMinGrade', () => {
  // --- Basic comparisons (default config) ---

  test('A meets min C', () => {
    expect(meetsMinGrade('A', 'C', DEFAULT_GRADE_CONFIG)).toBe(true);
  });

  test('C meets min C (equal)', () => {
    expect(meetsMinGrade('C', 'C', DEFAULT_GRADE_CONFIG)).toBe(true);
  });

  test('C- does not meet min C', () => {
    expect(meetsMinGrade('C-', 'C', DEFAULT_GRADE_CONFIG)).toBe(false);
  });

  test('D does not meet min C', () => {
    expect(meetsMinGrade('D', 'C', DEFAULT_GRADE_CONFIG)).toBe(false);
  });

  test('F does not meet min C', () => {
    expect(meetsMinGrade('F', 'C', DEFAULT_GRADE_CONFIG)).toBe(false);
  });

  test('B+ meets min B', () => {
    expect(meetsMinGrade('B+', 'B', DEFAULT_GRADE_CONFIG)).toBe(true);
  });

  test('A+ meets min A+', () => {
    expect(meetsMinGrade('A+', 'A+', DEFAULT_GRADE_CONFIG)).toBe(true);
  });

  test('A meets min A+ (same points, but A+ comes first in scale)', () => {
    // A+ is at index 0, A is at index 1 — A does NOT meet min A+
    expect(meetsMinGrade('A', 'A+', DEFAULT_GRADE_CONFIG)).toBe(false);
  });

  test('F meets min F', () => {
    expect(meetsMinGrade('F', 'F', DEFAULT_GRADE_CONFIG)).toBe(true);
  });

  // --- Plus/minus boundary cases ---

  test('B- does not meet min B', () => {
    expect(meetsMinGrade('B-', 'B', DEFAULT_GRADE_CONFIG)).toBe(false);
  });

  test('C+ meets min C', () => {
    expect(meetsMinGrade('C+', 'C', DEFAULT_GRADE_CONFIG)).toBe(true);
  });

  test('D+ does not meet min C-', () => {
    expect(meetsMinGrade('D+', 'C-', DEFAULT_GRADE_CONFIG)).toBe(false);
  });

  // --- Non-scale grades (pass/fail, withdrawal, incomplete) ---

  test('P does not meet min C', () => {
    expect(meetsMinGrade('P', 'C', DEFAULT_GRADE_CONFIG)).toBe(false);
  });

  test('NP does not meet min F', () => {
    expect(meetsMinGrade('NP', 'F', DEFAULT_GRADE_CONFIG)).toBe(false);
  });

  test('W does not meet min D-', () => {
    expect(meetsMinGrade('W', 'D-', DEFAULT_GRADE_CONFIG)).toBe(false);
  });

  test('I does not meet min D-', () => {
    expect(meetsMinGrade('I', 'D-', DEFAULT_GRADE_CONFIG)).toBe(false);
  });

  test('unrecognised grade does not meet min C', () => {
    expect(meetsMinGrade('XZ', 'C', DEFAULT_GRADE_CONFIG)).toBe(false);
  });

  // --- Error: minGrade not in scale ---

  test('throws if minGrade not in scale', () => {
    expect(() => meetsMinGrade('A', 'P', DEFAULT_GRADE_CONFIG))
      .toThrow('Grade "P" not found in grade scale');
  });

  test('throws if minGrade is unknown string', () => {
    expect(() => meetsMinGrade('A', 'Excellent', DEFAULT_GRADE_CONFIG))
      .toThrow('Grade "Excellent" not found in grade scale');
  });

  // --- Uses default config when not provided ---

  test('uses DEFAULT_GRADE_CONFIG when gradeConfig is null', () => {
    expect(meetsMinGrade('B', 'C', null)).toBe(true);
    expect(meetsMinGrade('D', 'C', null)).toBe(false);
  });

  test('uses DEFAULT_GRADE_CONFIG when gradeConfig is undefined', () => {
    expect(meetsMinGrade('A', 'B')).toBe(true);
  });
});

// ============================================================
// isPassingGrade
// ============================================================

describe('isPassingGrade', () => {
  // --- Scale grades ---

  test('A is passing', () => {
    expect(isPassingGrade('A', DEFAULT_GRADE_CONFIG)).toBe(true);
  });

  test('C is passing', () => {
    expect(isPassingGrade('C', DEFAULT_GRADE_CONFIG)).toBe(true);
  });

  test('D- is passing (points 0.7 > 0)', () => {
    expect(isPassingGrade('D-', DEFAULT_GRADE_CONFIG)).toBe(true);
  });

  test('F is not passing (points 0.0)', () => {
    expect(isPassingGrade('F', DEFAULT_GRADE_CONFIG)).toBe(false);
  });

  // --- Pass/fail grades ---

  test('P is passing', () => {
    expect(isPassingGrade('P', DEFAULT_GRADE_CONFIG)).toBe(true);
  });

  test('NP is not passing', () => {
    expect(isPassingGrade('NP', DEFAULT_GRADE_CONFIG)).toBe(false);
  });

  // --- Withdrawal grades ---

  test('W is not passing', () => {
    expect(isPassingGrade('W', DEFAULT_GRADE_CONFIG)).toBe(false);
  });

  test('WP is not passing', () => {
    expect(isPassingGrade('WP', DEFAULT_GRADE_CONFIG)).toBe(false);
  });

  test('WF is not passing', () => {
    expect(isPassingGrade('WF', DEFAULT_GRADE_CONFIG)).toBe(false);
  });

  // --- Incomplete grades ---

  test('I is not passing', () => {
    expect(isPassingGrade('I', DEFAULT_GRADE_CONFIG)).toBe(false);
  });

  test('IP is not passing', () => {
    expect(isPassingGrade('IP', DEFAULT_GRADE_CONFIG)).toBe(false);
  });

  // --- Unrecognised ---

  test('unrecognised grade is not passing', () => {
    expect(isPassingGrade('XZ', DEFAULT_GRADE_CONFIG)).toBe(false);
  });

  // --- Default config ---

  test('uses DEFAULT_GRADE_CONFIG when gradeConfig is null', () => {
    expect(isPassingGrade('B', null)).toBe(true);
    expect(isPassingGrade('F', null)).toBe(false);
  });

  test('uses DEFAULT_GRADE_CONFIG when gradeConfig is undefined', () => {
    expect(isPassingGrade('A')).toBe(true);
  });
});
