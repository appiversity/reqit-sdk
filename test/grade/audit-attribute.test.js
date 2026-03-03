'use strict';

const {
  isAuditableGrade,
  isPassingGrade,
  meetsMinGrade,
  calculateGPA,
  DEFAULT_GRADE_CONFIG,
} = require('../../src/grade');

// Grade config with retake-replaced grades (audit: false)
const RETAKE_CONFIG = {
  scale: [
    { grade: 'A',  points: 4.0 },
    { grade: 'B',  points: 3.0 },
    { grade: 'C',  points: 2.0 },
    { grade: 'D',  points: 1.0 },
    { grade: 'F',  points: 0.0 },
    { grade: 'RD', points: 1.0, audit: false },  // replaced D
    { grade: 'RF', points: 0.0, audit: false },  // replaced F
  ],
  passFail: [
    { grade: 'P',  passing: true },
    { grade: 'NP', passing: false },
    { grade: 'RP', passing: true, audit: false },  // replaced P
  ],
  withdrawal: ['W'],
  incomplete: ['I'],
};

// ============================================================
// isAuditableGrade
// ============================================================

describe('isAuditableGrade', () => {
  test('regular scale grades are auditable', () => {
    expect(isAuditableGrade('A', RETAKE_CONFIG)).toBe(true);
    expect(isAuditableGrade('C', RETAKE_CONFIG)).toBe(true);
    expect(isAuditableGrade('F', RETAKE_CONFIG)).toBe(true);
  });

  test('audit:false scale grades are not auditable', () => {
    expect(isAuditableGrade('RD', RETAKE_CONFIG)).toBe(false);
    expect(isAuditableGrade('RF', RETAKE_CONFIG)).toBe(false);
  });

  test('regular passFail grades are auditable', () => {
    expect(isAuditableGrade('P', RETAKE_CONFIG)).toBe(true);
    expect(isAuditableGrade('NP', RETAKE_CONFIG)).toBe(true);
  });

  test('audit:false passFail grades are not auditable', () => {
    expect(isAuditableGrade('RP', RETAKE_CONFIG)).toBe(false);
  });

  test('withdrawal grades are auditable (handled separately as non-passing)', () => {
    expect(isAuditableGrade('W', RETAKE_CONFIG)).toBe(true);
  });

  test('incomplete grades are auditable (handled separately as non-passing)', () => {
    expect(isAuditableGrade('I', RETAKE_CONFIG)).toBe(true);
  });

  test('unrecognized grades are auditable by default', () => {
    expect(isAuditableGrade('XZ', RETAKE_CONFIG)).toBe(true);
  });

  test('default config grades are all auditable (no audit field)', () => {
    expect(isAuditableGrade('A', DEFAULT_GRADE_CONFIG)).toBe(true);
    expect(isAuditableGrade('F', DEFAULT_GRADE_CONFIG)).toBe(true);
    expect(isAuditableGrade('P', DEFAULT_GRADE_CONFIG)).toBe(true);
  });

  test('uses DEFAULT_GRADE_CONFIG when gradeConfig is null', () => {
    expect(isAuditableGrade('A', null)).toBe(true);
  });

  test('uses DEFAULT_GRADE_CONFIG when gradeConfig is undefined', () => {
    expect(isAuditableGrade('B')).toBe(true);
  });
});

// ============================================================
// meetsMinGrade with audit:false
// ============================================================

describe('meetsMinGrade with audit:false grades', () => {
  test('RD (audit:false, 1.0 points) does not meet min D', () => {
    // RD has the same points as D but audit:false — should not meet any minimum
    expect(meetsMinGrade('RD', 'D', RETAKE_CONFIG)).toBe(false);
  });

  test('RD does not meet min F', () => {
    expect(meetsMinGrade('RD', 'F', RETAKE_CONFIG)).toBe(false);
  });

  test('RF (audit:false, 0.0 points) does not meet min F', () => {
    expect(meetsMinGrade('RF', 'F', RETAKE_CONFIG)).toBe(false);
  });

  test('regular D still meets min D', () => {
    expect(meetsMinGrade('D', 'D', RETAKE_CONFIG)).toBe(true);
  });

  test('regular A still meets min C', () => {
    expect(meetsMinGrade('A', 'C', RETAKE_CONFIG)).toBe(true);
  });
});

// ============================================================
// isPassingGrade with audit:false
// ============================================================

describe('isPassingGrade with audit:false grades', () => {
  test('RD (audit:false, 1.0 points) is not passing', () => {
    expect(isPassingGrade('RD', RETAKE_CONFIG)).toBe(false);
  });

  test('RF (audit:false, 0.0 points) is not passing', () => {
    expect(isPassingGrade('RF', RETAKE_CONFIG)).toBe(false);
  });

  test('RP (audit:false, passing:true) is not passing', () => {
    expect(isPassingGrade('RP', RETAKE_CONFIG)).toBe(false);
  });

  test('regular D (1.0 points, auditable) is still passing', () => {
    expect(isPassingGrade('D', RETAKE_CONFIG)).toBe(true);
  });

  test('regular P (passing:true, auditable) is still passing', () => {
    expect(isPassingGrade('P', RETAKE_CONFIG)).toBe(true);
  });
});

// ============================================================
// calculateGPA with audit:false
// ============================================================

describe('calculateGPA with audit:false grades', () => {
  test('audit:false grades are excluded from GPA', () => {
    const entries = [
      { grade: 'A', credits: 3 },   // 4.0 × 3 = 12.0
      { grade: 'RD', credits: 3 },  // excluded (audit:false)
      { grade: 'B', credits: 3 },   // 3.0 × 3 = 9.0
    ];
    // Only A + B: (12.0 + 9.0) / 6 = 3.5
    expect(calculateGPA(entries, RETAKE_CONFIG)).toBe(3.5);
  });

  test('retake scenario: original D replaced, retake C counted', () => {
    const entries = [
      { grade: 'RD', credits: 3 },  // original D, now replaced — excluded
      { grade: 'C',  credits: 3 },  // retake grade — counted
      { grade: 'A',  credits: 3 },  // other course — counted
    ];
    // Only C + A: (2.0 × 3 + 4.0 × 3) / 6 = 18.0 / 6 = 3.0
    expect(calculateGPA(entries, RETAKE_CONFIG)).toBe(3.0);
  });

  test('all audit:false entries returns 0', () => {
    const entries = [
      { grade: 'RD', credits: 3 },
      { grade: 'RF', credits: 3 },
    ];
    expect(calculateGPA(entries, RETAKE_CONFIG)).toBe(0);
  });

  test('mix of audit:false and non-scale grades, only auditable scale counted', () => {
    const entries = [
      { grade: 'B',  credits: 4 },  // 3.0 × 4 = 12.0 (counted)
      { grade: 'RD', credits: 3 },  // excluded (audit:false)
      { grade: 'P',  credits: 3 },  // excluded (pass/fail, not on scale)
      { grade: 'W',  credits: 3 },  // excluded (withdrawal, not on scale)
    ];
    expect(calculateGPA(entries, RETAKE_CONFIG)).toBe(3.0);
  });
});

// ============================================================
// Backward compatibility: configs without audit field
// ============================================================

describe('backward compatibility (no audit field)', () => {
  test('DEFAULT_GRADE_CONFIG works unchanged for isPassingGrade', () => {
    expect(isPassingGrade('A', DEFAULT_GRADE_CONFIG)).toBe(true);
    expect(isPassingGrade('F', DEFAULT_GRADE_CONFIG)).toBe(false);
    expect(isPassingGrade('P', DEFAULT_GRADE_CONFIG)).toBe(true);
  });

  test('DEFAULT_GRADE_CONFIG works unchanged for meetsMinGrade', () => {
    expect(meetsMinGrade('B', 'C', DEFAULT_GRADE_CONFIG)).toBe(true);
    expect(meetsMinGrade('D', 'C', DEFAULT_GRADE_CONFIG)).toBe(false);
  });

  test('DEFAULT_GRADE_CONFIG works unchanged for calculateGPA', () => {
    const entries = [
      { grade: 'A', credits: 3 },
      { grade: 'B', credits: 3 },
    ];
    expect(calculateGPA(entries, DEFAULT_GRADE_CONFIG)).toBe(3.5);
  });

  test('config with explicit audit:true behaves same as omitted', () => {
    const explicitConfig = {
      scale: [
        { grade: 'A', points: 4.0, audit: true },
        { grade: 'B', points: 3.0, audit: true },
        { grade: 'F', points: 0.0, audit: true },
      ],
      passFail: [],
      withdrawal: [],
      incomplete: [],
    };
    expect(isPassingGrade('A', explicitConfig)).toBe(true);
    expect(isPassingGrade('F', explicitConfig)).toBe(false);
    expect(meetsMinGrade('A', 'B', explicitConfig)).toBe(true);
    expect(calculateGPA([{ grade: 'A', credits: 3 }], explicitConfig)).toBe(4.0);
  });
});
