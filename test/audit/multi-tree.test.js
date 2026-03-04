'use strict';

/**
 * Unit tests for the multi-tree auditor.
 * Phase 8.1: skeleton + CourseAssignmentMap
 */

const { auditMulti, CourseAssignmentMap, MET, IN_PROGRESS, NOT_MET } = require('../../src/audit');
const minimalCatalog = require('../fixtures/catalogs/minimal.json');

// ============================================================
// CourseAssignmentMap unit tests
// ============================================================

describe('CourseAssignmentMap', () => {
  test('assign and retrieve course assignments', () => {
    const map = new CourseAssignmentMap();
    map.assign('MATH:101', 'BS-CSCI');
    map.assign('MATH:101', 'GEN-ED');
    map.assign('CMPS:130', 'BS-CSCI');

    expect(map.getAssignments('MATH:101')).toEqual(['BS-CSCI', 'GEN-ED']);
    expect(map.getAssignments('CMPS:130')).toEqual(['BS-CSCI']);
    expect(map.getAssignments('PHYS:201')).toEqual([]);
  });

  test('isAssigned checks specific program', () => {
    const map = new CourseAssignmentMap();
    map.assign('MATH:101', 'BS-CSCI');

    expect(map.isAssigned('MATH:101', 'BS-CSCI')).toBe(true);
    expect(map.isAssigned('MATH:101', 'GEN-ED')).toBe(false);
  });

  test('duplicate assign is idempotent', () => {
    const map = new CourseAssignmentMap();
    map.assign('MATH:101', 'BS-CSCI');
    map.assign('MATH:101', 'BS-CSCI');

    expect(map.getAssignments('MATH:101')).toEqual(['BS-CSCI']);
  });

  test('getSharedCourses between two programs', () => {
    const map = new CourseAssignmentMap();
    map.assign('MATH:101', 'BS-CSCI');
    map.assign('MATH:101', 'GEN-ED');
    map.assign('CMPS:130', 'BS-CSCI');
    map.assign('ENGL:101', 'GEN-ED');

    const shared = map.getSharedCourses('BS-CSCI', 'GEN-ED');
    expect(shared).toEqual(['MATH:101']);
  });

  test('getCoursesForProgram and getCoursesOutsideProgram', () => {
    const map = new CourseAssignmentMap();
    map.assign('MATH:101', 'BS-CSCI');
    map.assign('CMPS:130', 'BS-CSCI');
    map.assign('ENGL:101', 'GEN-ED');

    expect(map.getCoursesForProgram('BS-CSCI').sort()).toEqual(['CMPS:130', 'MATH:101']);
    expect(map.getCoursesOutsideProgram('BS-CSCI')).toEqual(['ENGL:101']);
  });
});

// ============================================================
// auditMulti — basic multi-tree tests
// ============================================================

// Two independent ASTs that don't share courses
const mathAst = {
  type: 'all-of', label: 'Math Requirement',
  items: [
    { type: 'course', subject: 'MATH', number: '101' },
    { type: 'course', subject: 'MATH', number: '151' },
  ],
};

const csAst = {
  type: 'all-of', label: 'CS Requirement',
  items: [
    { type: 'course', subject: 'CMPS', number: '130' },
    { type: 'course', subject: 'CMPS', number: '135' },
  ],
};

// AST that shares MATH 101 with mathAst
const genEdAst = {
  type: 'all-of', label: 'Gen-Ed',
  items: [
    { type: 'course', subject: 'MATH', number: '101' },
    { type: 'course', subject: 'ENGL', number: '101' },
  ],
};

const completeTranscript = [
  { subject: 'MATH', number: '101', grade: 'B+', credits: 3, term: 'Fall 2023', status: 'completed' },
  { subject: 'MATH', number: '151', grade: 'A-', credits: 4, term: 'Spring 2024', status: 'completed' },
  { subject: 'CMPS', number: '130', grade: 'A',  credits: 3, term: 'Fall 2023', status: 'completed' },
  { subject: 'CMPS', number: '135', grade: 'B+', credits: 3, term: 'Fall 2023', status: 'completed' },
  { subject: 'ENGL', number: '101', grade: 'B',  credits: 3, term: 'Fall 2023', status: 'completed' },
];

describe('auditMulti — basic', () => {
  test('2 independent trees with no overlap → both MET', () => {
    const trees = [
      { ast: mathAst, programCode: 'MATH-CERT', role: 'primary-major' },
      { ast: csAst, programCode: 'CS-CERT', role: 'primary-minor' },
    ];
    const { results, assignments, warnings } = auditMulti(trees, minimalCatalog, completeTranscript);

    expect(results.get('MATH-CERT').status).toBe(MET);
    expect(results.get('CS-CERT').status).toBe(MET);

    // No shared courses
    const shared = assignments.getSharedCourses('MATH-CERT', 'CS-CERT');
    expect(shared).toHaveLength(0);
  });

  test('2 trees sharing a course → course assigned to both', () => {
    const trees = [
      { ast: mathAst, programCode: 'MATH-CERT', role: 'primary-major' },
      { ast: genEdAst, programCode: 'GEN-ED', role: 'certificate' },
    ];
    const { results, assignments } = auditMulti(trees, minimalCatalog, completeTranscript);

    expect(results.get('MATH-CERT').status).toBe(MET);
    expect(results.get('GEN-ED').status).toBe(MET);

    // MATH:101 is shared
    expect(assignments.isAssigned('MATH:101', 'MATH-CERT')).toBe(true);
    expect(assignments.isAssigned('MATH:101', 'GEN-ED')).toBe(true);
    const shared = assignments.getSharedCourses('MATH-CERT', 'GEN-ED');
    expect(shared).toEqual(['MATH:101']);
  });

  test('assignments map tracks all course-to-program mappings', () => {
    const trees = [
      { ast: mathAst, programCode: 'MATH-CERT', role: 'primary-major' },
      { ast: csAst, programCode: 'CS-CERT', role: 'primary-minor' },
      { ast: genEdAst, programCode: 'GEN-ED', role: 'certificate' },
    ];
    const { assignments } = auditMulti(trees, minimalCatalog, completeTranscript);

    // MATH 101 → MATH-CERT + GEN-ED
    expect(assignments.getAssignments('MATH:101').sort()).toEqual(['GEN-ED', 'MATH-CERT']);
    // MATH 151 → MATH-CERT only
    expect(assignments.getAssignments('MATH:151')).toEqual(['MATH-CERT']);
    // CMPS 130 → CS-CERT only
    expect(assignments.getAssignments('CMPS:130')).toEqual(['CS-CERT']);
    // ENGL 101 → GEN-ED only
    expect(assignments.getAssignments('ENGL:101')).toEqual(['GEN-ED']);
  });

  test('empty transcript → all NOT_MET', () => {
    const trees = [
      { ast: mathAst, programCode: 'MATH-CERT', role: 'primary-major' },
      { ast: csAst, programCode: 'CS-CERT', role: 'primary-minor' },
    ];
    const { results, assignments } = auditMulti(trees, minimalCatalog, []);

    expect(results.get('MATH-CERT').status).toBe(NOT_MET);
    expect(results.get('CS-CERT').status).toBe(NOT_MET);
    expect(assignments.size).toBe(0);
  });

  test('warnings from individual trees are aggregated with programCode', () => {
    // Use an AST with an unknown node type to trigger a warning
    const badAst = { type: 'frobnicate', items: [] };
    const trees = [
      { ast: badAst, programCode: 'BAD', role: 'primary-major' },
      { ast: mathAst, programCode: 'MATH-CERT', role: 'primary-minor' },
    ];
    const { warnings } = auditMulti(trees, minimalCatalog, completeTranscript);

    const badWarnings = warnings.filter(w => w.programCode === 'BAD');
    expect(badWarnings.length).toBeGreaterThan(0);
    expect(badWarnings[0].type).toBe('unknown-node-type');
  });
});
