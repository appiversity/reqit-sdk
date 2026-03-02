'use strict';

const { meetsMinGrade, isPassingGrade, calculateGPA } = require('../../src/grade');

// ============================================================
// Custom scale: 10-point numeric (common in European/Latin American systems)
// ============================================================

const NUMERIC_10_CONFIG = {
  scale: [
    { grade: '10', points: 10.0 },
    { grade: '9',  points: 9.0 },
    { grade: '8',  points: 8.0 },
    { grade: '7',  points: 7.0 },
    { grade: '6',  points: 6.0 },
    { grade: '5',  points: 5.0 },
    { grade: '4',  points: 4.0 },
    { grade: '3',  points: 3.0 },
    { grade: '2',  points: 2.0 },
    { grade: '1',  points: 1.0 },
    { grade: '0',  points: 0.0 },
  ],
  passFail: [
    { grade: 'AP', passing: true },
    { grade: 'NA', passing: false },
  ],
  withdrawal: ['RET'],
  incomplete: ['INC'],
};

describe('10-point numeric scale', () => {
  describe('meetsMinGrade', () => {
    test('8 meets min 6', () => {
      expect(meetsMinGrade('8', '6', NUMERIC_10_CONFIG)).toBe(true);
    });

    test('6 meets min 6 (equal)', () => {
      expect(meetsMinGrade('6', '6', NUMERIC_10_CONFIG)).toBe(true);
    });

    test('5 does not meet min 6', () => {
      expect(meetsMinGrade('5', '6', NUMERIC_10_CONFIG)).toBe(false);
    });

    test('10 meets min 10', () => {
      expect(meetsMinGrade('10', '10', NUMERIC_10_CONFIG)).toBe(true);
    });

    test('AP (pass/fail) does not meet numeric min', () => {
      expect(meetsMinGrade('AP', '6', NUMERIC_10_CONFIG)).toBe(false);
    });

    test('RET (withdrawal) does not meet numeric min', () => {
      expect(meetsMinGrade('RET', '1', NUMERIC_10_CONFIG)).toBe(false);
    });
  });

  describe('isPassingGrade', () => {
    test('6 is passing (points > 0)', () => {
      expect(isPassingGrade('6', NUMERIC_10_CONFIG)).toBe(true);
    });

    test('1 is passing (points > 0)', () => {
      expect(isPassingGrade('1', NUMERIC_10_CONFIG)).toBe(true);
    });

    test('0 is not passing', () => {
      expect(isPassingGrade('0', NUMERIC_10_CONFIG)).toBe(false);
    });

    test('AP is passing', () => {
      expect(isPassingGrade('AP', NUMERIC_10_CONFIG)).toBe(true);
    });

    test('NA is not passing', () => {
      expect(isPassingGrade('NA', NUMERIC_10_CONFIG)).toBe(false);
    });

    test('RET is not passing', () => {
      expect(isPassingGrade('RET', NUMERIC_10_CONFIG)).toBe(false);
    });

    test('INC is not passing', () => {
      expect(isPassingGrade('INC', NUMERIC_10_CONFIG)).toBe(false);
    });
  });

  describe('calculateGPA', () => {
    test('all 10s', () => {
      const entries = [
        { grade: '10', credits: 3 },
        { grade: '10', credits: 4 },
      ];
      expect(calculateGPA(entries, NUMERIC_10_CONFIG)).toBe(10.0);
    });

    test('weighted average', () => {
      // 8 × 4 + 6 × 3 = 32 + 18 = 50 / 7 ≈ 7.142857
      const entries = [
        { grade: '8', credits: 4 },
        { grade: '6', credits: 3 },
      ];
      expect(calculateGPA(entries, NUMERIC_10_CONFIG)).toBeCloseTo(50 / 7, 10);
    });

    test('AP excluded from GPA', () => {
      const entries = [
        { grade: '9', credits: 3 },
        { grade: 'AP', credits: 3 }, // excluded
      ];
      expect(calculateGPA(entries, NUMERIC_10_CONFIG)).toBe(9.0);
    });
  });
});

// ============================================================
// Custom scale: institution with non-standard grade labels
// ============================================================

const CUSTOM_INSTITUTION_CONFIG = {
  scale: [
    { grade: 'HD',  points: 4.0 },  // High Distinction
    { grade: 'D',   points: 3.5 },  // Distinction
    { grade: 'CR',  points: 3.0 },  // Credit
    { grade: 'PP',  points: 2.0 },  // Pass
    { grade: 'NN',  points: 0.0 },  // Fail
  ],
  passFail: [
    { grade: 'SY', passing: true },   // Satisfactory
    { grade: 'US', passing: false },   // Unsatisfactory
  ],
  withdrawal: ['WD'],
  incomplete: [],
};

describe('custom institution scale (HD/D/CR/PP/NN)', () => {
  describe('meetsMinGrade', () => {
    test('HD meets min CR', () => {
      expect(meetsMinGrade('HD', 'CR', CUSTOM_INSTITUTION_CONFIG)).toBe(true);
    });

    test('CR meets min CR', () => {
      expect(meetsMinGrade('CR', 'CR', CUSTOM_INSTITUTION_CONFIG)).toBe(true);
    });

    test('PP does not meet min CR', () => {
      expect(meetsMinGrade('PP', 'CR', CUSTOM_INSTITUTION_CONFIG)).toBe(false);
    });

    test('SY (pass/fail) does not meet min PP', () => {
      expect(meetsMinGrade('SY', 'PP', CUSTOM_INSTITUTION_CONFIG)).toBe(false);
    });
  });

  describe('isPassingGrade', () => {
    test('PP is passing', () => {
      expect(isPassingGrade('PP', CUSTOM_INSTITUTION_CONFIG)).toBe(true);
    });

    test('NN is not passing', () => {
      expect(isPassingGrade('NN', CUSTOM_INSTITUTION_CONFIG)).toBe(false);
    });

    test('SY is passing', () => {
      expect(isPassingGrade('SY', CUSTOM_INSTITUTION_CONFIG)).toBe(true);
    });

    test('US is not passing', () => {
      expect(isPassingGrade('US', CUSTOM_INSTITUTION_CONFIG)).toBe(false);
    });

    test('WD is not passing', () => {
      expect(isPassingGrade('WD', CUSTOM_INSTITUTION_CONFIG)).toBe(false);
    });
  });

  describe('calculateGPA', () => {
    test('HD + CR weighted', () => {
      // HD (4.0 × 3) + CR (3.0 × 4) = 12 + 12 = 24 / 7 ≈ 3.4286
      const entries = [
        { grade: 'HD', credits: 3 },
        { grade: 'CR', credits: 4 },
      ];
      expect(calculateGPA(entries, CUSTOM_INSTITUTION_CONFIG)).toBeCloseTo(24 / 7, 10);
    });

    test('SY excluded, WD excluded', () => {
      const entries = [
        { grade: 'D',  credits: 3 },  // 3.5 × 3 = 10.5
        { grade: 'SY', credits: 3 },  // excluded
        { grade: 'WD', credits: 3 },  // excluded
      ];
      expect(calculateGPA(entries, CUSTOM_INSTITUTION_CONFIG)).toBe(3.5);
    });
  });
});

// ============================================================
// Custom scale: minimal (pass/fail only institution, no letter grades)
// ============================================================

const PASS_FAIL_ONLY_CONFIG = {
  scale: [],
  passFail: [
    { grade: 'S', passing: true },
    { grade: 'U', passing: false },
  ],
  withdrawal: ['W'],
  incomplete: [],
};

describe('pass/fail-only institution', () => {
  test('S is passing', () => {
    expect(isPassingGrade('S', PASS_FAIL_ONLY_CONFIG)).toBe(true);
  });

  test('U is not passing', () => {
    expect(isPassingGrade('U', PASS_FAIL_ONLY_CONFIG)).toBe(false);
  });

  test('calculateGPA returns 0 (no scale grades)', () => {
    const entries = [
      { grade: 'S', credits: 3 },
      { grade: 'S', credits: 4 },
    ];
    expect(calculateGPA(entries, PASS_FAIL_ONLY_CONFIG)).toBe(0);
  });

  test('meetsMinGrade throws when scale is empty', () => {
    expect(() => meetsMinGrade('S', 'S', PASS_FAIL_ONLY_CONFIG))
      .toThrow('not found in grade scale');
  });
});

// ============================================================
// Custom scale: no passFail array
// ============================================================

const NO_PASS_FAIL_CONFIG = {
  scale: [
    { grade: 'A', points: 4.0 },
    { grade: 'B', points: 3.0 },
    { grade: 'F', points: 0.0 },
  ],
  withdrawal: [],
  incomplete: [],
};

describe('config without passFail array', () => {
  test('isPassingGrade works without passFail', () => {
    expect(isPassingGrade('A', NO_PASS_FAIL_CONFIG)).toBe(true);
    expect(isPassingGrade('F', NO_PASS_FAIL_CONFIG)).toBe(false);
  });

  test('unrecognised grade is not passing', () => {
    expect(isPassingGrade('P', NO_PASS_FAIL_CONFIG)).toBe(false);
  });

  test('meetsMinGrade works with minimal scale', () => {
    expect(meetsMinGrade('A', 'B', NO_PASS_FAIL_CONFIG)).toBe(true);
    expect(meetsMinGrade('F', 'B', NO_PASS_FAIL_CONFIG)).toBe(false);
  });

  test('calculateGPA works with minimal scale', () => {
    const entries = [
      { grade: 'A', credits: 3 },
      { grade: 'B', credits: 3 },
    ];
    expect(calculateGPA(entries, NO_PASS_FAIL_CONFIG)).toBe(3.5);
  });
});
