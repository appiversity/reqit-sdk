'use strict';

const { calculateGPA, DEFAULT_GRADE_CONFIG } = require('../../src/grade');

describe('calculateGPA', () => {
  // --- Basic calculations ---

  test('straight A student', () => {
    const entries = [
      { grade: 'A', credits: 3 },
      { grade: 'A', credits: 3 },
      { grade: 'A', credits: 4 },
    ];
    expect(calculateGPA(entries, DEFAULT_GRADE_CONFIG)).toBe(4.0);
  });

  test('straight F student', () => {
    const entries = [
      { grade: 'F', credits: 3 },
      { grade: 'F', credits: 3 },
    ];
    expect(calculateGPA(entries, DEFAULT_GRADE_CONFIG)).toBe(0.0);
  });

  test('mixed grades, equal credits', () => {
    // A (4.0) + B (3.0) + C (2.0) = 9.0 / 3 courses = 3.0
    const entries = [
      { grade: 'A', credits: 3 },
      { grade: 'B', credits: 3 },
      { grade: 'C', credits: 3 },
    ];
    expect(calculateGPA(entries, DEFAULT_GRADE_CONFIG)).toBe(3.0);
  });

  test('credit-weighted calculation', () => {
    // A (4.0 × 4) + C (2.0 × 3) = 16 + 6 = 22 / 7 credits ≈ 3.142857
    const entries = [
      { grade: 'A', credits: 4 },
      { grade: 'C', credits: 3 },
    ];
    const gpa = calculateGPA(entries, DEFAULT_GRADE_CONFIG);
    expect(gpa).toBeCloseTo(22 / 7, 10);
  });

  test('all plus/minus grades', () => {
    // B+ (3.3 × 3) + C- (1.7 × 3) = 9.9 + 5.1 = 15.0 / 6 = 2.5
    const entries = [
      { grade: 'B+', credits: 3 },
      { grade: 'C-', credits: 3 },
    ];
    expect(calculateGPA(entries, DEFAULT_GRADE_CONFIG)).toBeCloseTo(2.5, 10);
  });

  test('single course', () => {
    const entries = [{ grade: 'B-', credits: 3 }];
    expect(calculateGPA(entries, DEFAULT_GRADE_CONFIG)).toBeCloseTo(2.7, 10);
  });

  // --- Non-scale grades excluded ---

  test('P/NP grades are excluded from GPA', () => {
    const entries = [
      { grade: 'A', credits: 3 },
      { grade: 'P', credits: 3 }, // excluded
      { grade: 'B', credits: 3 },
    ];
    // Only A + B: (4.0 × 3 + 3.0 × 3) / 6 = 3.5
    expect(calculateGPA(entries, DEFAULT_GRADE_CONFIG)).toBe(3.5);
  });

  test('withdrawal grades are excluded from GPA', () => {
    const entries = [
      { grade: 'A', credits: 3 },
      { grade: 'W', credits: 3 },  // excluded
      { grade: 'WP', credits: 3 }, // excluded
    ];
    expect(calculateGPA(entries, DEFAULT_GRADE_CONFIG)).toBe(4.0);
  });

  test('incomplete grades are excluded from GPA', () => {
    const entries = [
      { grade: 'B', credits: 3 },
      { grade: 'I', credits: 3 },  // excluded
      { grade: 'IP', credits: 3 }, // excluded
    ];
    expect(calculateGPA(entries, DEFAULT_GRADE_CONFIG)).toBe(3.0);
  });

  test('unrecognised grades are excluded from GPA', () => {
    const entries = [
      { grade: 'A', credits: 3 },
      { grade: 'TR', credits: 3 }, // excluded — not in scale
    ];
    expect(calculateGPA(entries, DEFAULT_GRADE_CONFIG)).toBe(4.0);
  });

  // --- Edge cases ---

  test('empty entries returns 0', () => {
    expect(calculateGPA([], DEFAULT_GRADE_CONFIG)).toBe(0);
  });

  test('all non-scale grades returns 0', () => {
    const entries = [
      { grade: 'P', credits: 3 },
      { grade: 'W', credits: 3 },
      { grade: 'I', credits: 1 },
    ];
    expect(calculateGPA(entries, DEFAULT_GRADE_CONFIG)).toBe(0);
  });

  test('variable credit courses', () => {
    // A (4.0 × 1) + C (2.0 × 4) = 4 + 8 = 12 / 5 = 2.4
    const entries = [
      { grade: 'A', credits: 1 },
      { grade: 'C', credits: 4 },
    ];
    expect(calculateGPA(entries, DEFAULT_GRADE_CONFIG)).toBeCloseTo(2.4, 10);
  });

  test('A+ treated same as A in points (both 4.0)', () => {
    const aPlus = [{ grade: 'A+', credits: 3 }];
    const a = [{ grade: 'A', credits: 3 }];
    expect(calculateGPA(aPlus, DEFAULT_GRADE_CONFIG)).toBe(4.0);
    expect(calculateGPA(a, DEFAULT_GRADE_CONFIG)).toBe(4.0);
  });

  // --- Default config ---

  test('uses DEFAULT_GRADE_CONFIG when gradeConfig is null', () => {
    const entries = [{ grade: 'A', credits: 3 }];
    expect(calculateGPA(entries, null)).toBe(4.0);
  });

  test('uses DEFAULT_GRADE_CONFIG when gradeConfig is undefined', () => {
    const entries = [{ grade: 'B', credits: 3 }];
    expect(calculateGPA(entries)).toBe(3.0);
  });

  // --- Realistic transcript ---

  test('realistic semester transcript', () => {
    const entries = [
      { grade: 'A',  credits: 4 }, // Calculus:   4.0 × 4 = 16.0
      { grade: 'B+', credits: 3 }, // CS:         3.3 × 3 = 9.9
      { grade: 'A-', credits: 3 }, // English:    3.7 × 3 = 11.1
      { grade: 'B',  credits: 3 }, // History:    3.0 × 3 = 9.0
      { grade: 'P',  credits: 1 }, // PE (P/F):   excluded
    ];
    // Total: (16.0 + 9.9 + 11.1 + 9.0) / 13 = 46.0 / 13 ≈ 3.538
    const gpa = calculateGPA(entries, DEFAULT_GRADE_CONFIG);
    expect(gpa).toBeCloseTo(46.0 / 13, 10);
  });
});
