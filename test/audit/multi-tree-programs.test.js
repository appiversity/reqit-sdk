'use strict';

const { parse } = require('../../src/parser');
const { auditMulti, CourseAssignmentMap } = require('../../src/audit');

const gradeConfig = {
  scale: [
    { grade: 'A', points: 4 },
    { grade: 'B', points: 3 },
    { grade: 'C', points: 2 },
    { grade: 'D', points: 1 },
    { grade: 'F', points: 0 },
  ],
  passFail: [],
  withdrawal: ['W'],
  incomplete: ['I'],
};

describe('multi-tree with program references', () => {
  const catalog = {
    institution: 'TEST',
    ay: '2025-2026',
    courses: [
      { subject: 'DATA', number: '101', title: 'Intro Data', creditsMin: 3, creditsMax: 3 },
      { subject: 'DATA', number: '201', title: 'Data Analysis', creditsMin: 3, creditsMax: 3 },
      { subject: 'MATH', number: '151', title: 'Calc I', creditsMin: 4, creditsMax: 4 },
      { subject: 'MATH', number: '152', title: 'Calc II', creditsMin: 4, creditsMax: 4 },
      { subject: 'STAT', number: '201', title: 'Statistics', creditsMin: 3, creditsMax: 3 },
    ],
    programs: [
      {
        code: 'MATH-MINOR',
        type: 'minor',
        level: 'undergraduate',
        requirements: parse('all of (MATH 151, MATH 152)'),
      },
    ],
    gradeConfig,
  };

  const transcript = [
    { subject: 'DATA', number: '101', grade: 'A', credits: 3, status: 'completed' },
    { subject: 'DATA', number: '201', grade: 'B', credits: 3, status: 'completed' },
    { subject: 'MATH', number: '151', grade: 'A', credits: 4, status: 'completed' },
    { subject: 'MATH', number: '152', grade: 'B', credits: 4, status: 'completed' },
    { subject: 'STAT', number: '201', grade: 'A', credits: 3, status: 'completed' },
  ];

  test('sub-program courses are tracked in CourseAssignmentMap', () => {
    const trees = [
      {
        ast: parse('all of (DATA 101, DATA 201, program "MATH-MINOR")'),
        programCode: 'BS-DATA',
        role: 'primary-major',
      },
    ];

    const result = auditMulti(trees, catalog, transcript, {
      declaredPrograms: [{ code: 'MATH-MINOR', type: 'minor', level: 'undergraduate' }],
    });

    const bsData = result.results.get('BS-DATA');
    expect(bsData.status).toBe('met');

    // MATH 151 and MATH 152 should be assigned to both BS-DATA and MATH-MINOR
    const mathMinorCourses = result.assignments.getCoursesForProgram('MATH-MINOR');
    expect(mathMinorCourses).toContain('MATH:151');
    expect(mathMinorCourses).toContain('MATH:152');

    const bsDataCourses = result.assignments.getCoursesForProgram('BS-DATA');
    expect(bsDataCourses).toContain('MATH:151');
    expect(bsDataCourses).toContain('MATH:152');
    expect(bsDataCourses).toContain('DATA:101');
    expect(bsDataCourses).toContain('DATA:201');
  });

  test('cross-program overlap detection with sub-programs', () => {
    const trees = [
      {
        ast: parse('all of (DATA 101, DATA 201, MATH 151, program "MATH-MINOR")'),
        programCode: 'BS-DATA',
        role: 'primary-major',
      },
      {
        ast: parse('all of (STAT 201, MATH 151)'),
        programCode: 'STAT-MINOR',
        role: 'primary-minor',
      },
    ];

    const result = auditMulti(trees, catalog, transcript, {
      declaredPrograms: [{ code: 'MATH-MINOR', type: 'minor', level: 'undergraduate' }],
    });

    // MATH 151 is shared between BS-DATA and STAT-MINOR
    const shared = result.assignments.getSharedCourses('BS-DATA', 'STAT-MINOR');
    expect(shared).toContain('MATH:151');
  });

  test('collectMatchedEntries traverses sub-audit trees via CHILD_PROPS', () => {
    const trees = [
      {
        ast: parse('program "MATH-MINOR"'),
        programCode: 'BS-DATA',
        role: 'primary-major',
      },
    ];

    const result = auditMulti(trees, catalog, transcript, {
      declaredPrograms: [{ code: 'MATH-MINOR', type: 'minor', level: 'undergraduate' }],
    });

    // The matched entries from the sub-audit should be in the BS-DATA assignment
    const bsDataCourses = result.assignments.getCoursesForProgram('BS-DATA');
    expect(bsDataCourses).toContain('MATH:151');
    expect(bsDataCourses).toContain('MATH:152');
  });
});
