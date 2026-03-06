'use strict';

/**
 * Unit tests for the multi-tree auditor.
 * Phase 8.1: skeleton + CourseAssignmentMap
 * Phase 8.2-8.4: overlap rules, outside-program, program-context-ref
 */

const { auditMulti, CourseAssignmentMap, MET, IN_PROGRESS, PARTIAL_PROGRESS, NOT_MET } = require('../../src/audit');
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

  test('size reflects number of distinct course keys', () => {
    const map = new CourseAssignmentMap();
    expect(map.size).toBe(0);

    map.assign('MATH:101', 'BS-CSCI');
    map.assign('MATH:101', 'GEN-ED'); // same key, different program
    expect(map.size).toBe(1);

    map.assign('CMPS:130', 'BS-CSCI');
    map.assign('ENGL:101', 'GEN-ED');
    expect(map.size).toBe(3);
  });

  test('entries() iterates over all [courseKey, programCodes] pairs', () => {
    const map = new CourseAssignmentMap();
    map.assign('MATH:101', 'BS-CSCI');
    map.assign('MATH:101', 'GEN-ED');
    map.assign('CMPS:130', 'BS-CSCI');

    const collected = Object.fromEntries(map.entries());
    expect(collected).toEqual({
      'MATH:101': ['BS-CSCI', 'GEN-ED'],
      'CMPS:130': ['BS-CSCI'],
    });
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

// ============================================================
// Overlap-limit tests (8.2) — using overlapRules option
// ============================================================

// Transcript with several shared courses between two programs
const overlapTranscript = [
  { subject: 'MATH', number: '101', grade: 'B+', credits: 3, term: 'Fall 2023', status: 'completed' },
  { subject: 'MATH', number: '151', grade: 'A-', credits: 4, term: 'Spring 2024', status: 'completed' },
  { subject: 'MATH', number: '152', grade: 'B',  credits: 4, term: 'Fall 2024', status: 'completed' },
  { subject: 'CMPS', number: '130', grade: 'A',  credits: 3, term: 'Fall 2023', status: 'completed' },
  { subject: 'CMPS', number: '135', grade: 'B+', credits: 3, term: 'Fall 2023', status: 'completed' },
  { subject: 'CMPS', number: '230', grade: 'B',  credits: 3, term: 'Spring 2024', status: 'completed' },
  { subject: 'ENGL', number: '101', grade: 'B',  credits: 3, term: 'Fall 2023', status: 'completed' },
  { subject: 'HIST', number: '101', grade: 'B+', credits: 3, term: 'Fall 2023', status: 'completed' },
  { subject: 'ART',  number: '101', grade: 'A',  credits: 3, term: 'Spring 2024', status: 'completed' },
  { subject: 'PHYS', number: '201', grade: 'B-', credits: 4, term: 'Fall 2024', status: 'completed' },
];

// Program A: uses MATH 101, MATH 151, CMPS 130
const programAAst = {
  type: 'all-of', items: [
    { type: 'course', subject: 'MATH', number: '101' },
    { type: 'course', subject: 'MATH', number: '151' },
    { type: 'course', subject: 'CMPS', number: '130' },
  ],
};

// Program B: uses MATH 101, MATH 151, MATH 152 — shares MATH 101, MATH 151 with A
const programBAst = {
  type: 'all-of', items: [
    { type: 'course', subject: 'MATH', number: '101' },
    { type: 'course', subject: 'MATH', number: '151' },
    { type: 'course', subject: 'MATH', number: '152' },
  ],
};

// Spec-shape overlap-limit rule helper
function overlapRule(limit, unit) {
  return {
    type: 'overlap-limit',
    left: { type: 'program-ref', code: 'PROG-A' },
    right: { type: 'program-ref', code: 'PROG-B' },
    constraint: { comparison: 'at-most', value: limit, unit: unit || 'courses' },
  };
}

describe('auditMulti — overlap-limit', () => {
  test('2 trees share 2 courses, limit is 3 → no warning', () => {
    const trees = [
      { ast: programAAst, programCode: 'PROG-A', role: 'primary-major' },
      { ast: programBAst, programCode: 'PROG-B', role: 'secondary-major' },
    ];
    const { policyResults, warnings } = auditMulti(
      trees, minimalCatalog, overlapTranscript,
      { overlapRules: [overlapRule(3)] }
    );
    const overlapWarnings = warnings.filter(w => w.type === 'overlap-limit-exceeded');
    expect(overlapWarnings).toHaveLength(0);

    expect(policyResults).toHaveLength(1);
    expect(policyResults[0].status).toBe(MET);
    expect(policyResults[0].actual).toBe(2);
    expect(policyResults[0].limit).toBe(3);
  });

  test('2 trees share 2 courses, limit is 1 → overlap-limit-exceeded warning', () => {
    const trees = [
      { ast: programAAst, programCode: 'PROG-A', role: 'primary-major' },
      { ast: programBAst, programCode: 'PROG-B', role: 'secondary-major' },
    ];
    const { policyResults, warnings } = auditMulti(
      trees, minimalCatalog, overlapTranscript,
      { overlapRules: [overlapRule(1)] }
    );
    const overlapWarnings = warnings.filter(w => w.type === 'overlap-limit-exceeded');
    expect(overlapWarnings).toHaveLength(1);
    expect(overlapWarnings[0].actual).toBe(2);
    expect(overlapWarnings[0].limit).toBe(1);
    expect(overlapWarnings[0].sharedCourses).toHaveLength(2);

    expect(policyResults[0].status).toBe(NOT_MET);
  });

  test('overlap with credits mode: shared courses = 7 credits, limit = 6 → exceeded', () => {
    const trees = [
      { ast: programAAst, programCode: 'PROG-A', role: 'primary-major' },
      { ast: programBAst, programCode: 'PROG-B', role: 'secondary-major' },
    ];
    const { policyResults, warnings } = auditMulti(
      trees, minimalCatalog, overlapTranscript,
      { overlapRules: [overlapRule(6, 'credits')] }
    );
    const overlapWarnings = warnings.filter(w => w.type === 'overlap-limit-exceeded');
    // MATH 101 (3 credits) + MATH 151 (4 credits) = 7 credits > 6
    expect(overlapWarnings).toHaveLength(1);
    expect(overlapWarnings[0].actual).toBe(7);
    expect(overlapWarnings[0].unit).toBe('credits');

    expect(policyResults[0].status).toBe(NOT_MET);
    expect(policyResults[0].actual).toBe(7);
  });

  test('overlap limit met exactly → no warning', () => {
    const trees = [
      { ast: programAAst, programCode: 'PROG-A', role: 'primary-major' },
      { ast: programBAst, programCode: 'PROG-B', role: 'secondary-major' },
    ];
    const { policyResults, warnings } = auditMulti(
      trees, minimalCatalog, overlapTranscript,
      { overlapRules: [overlapRule(2)] }
    );
    const overlapWarnings = warnings.filter(w => w.type === 'overlap-limit-exceeded');
    expect(overlapWarnings).toHaveLength(0);

    expect(policyResults[0].status).toBe(MET);
    expect(policyResults[0].actual).toBe(2);
  });

  test('overlap with percent mode: based on credits, not course count', () => {
    // PROG-A: MATH 101(3) + MATH 151(4) + CMPS 130(3) = 10 credits
    // Shared: MATH 101(3) + MATH 151(4) = 7 credits
    // Percent: 7/10 * 100 = 70%
    const trees = [
      { ast: programAAst, programCode: 'PROG-A', role: 'primary-major' },
      { ast: programBAst, programCode: 'PROG-B', role: 'secondary-major' },
    ];

    // Limit 60% → 70% > 60% → exceeded
    const { policyResults: pr1, warnings: w1 } = auditMulti(
      trees, minimalCatalog, overlapTranscript,
      { overlapRules: [overlapRule(60, 'percent')] }
    );
    expect(pr1[0].status).toBe(NOT_MET);
    expect(pr1[0].actual).toBe(70);
    expect(w1.filter(w => w.type === 'overlap-limit-exceeded')).toHaveLength(1);

    // Limit 75% → 70% ≤ 75% → met
    const { policyResults: pr2, warnings: w2 } = auditMulti(
      trees, minimalCatalog, overlapTranscript,
      { overlapRules: [overlapRule(75, 'percent')] }
    );
    expect(pr2[0].status).toBe(MET);
    expect(pr2[0].actual).toBe(70);
    expect(w2.filter(w => w.type === 'overlap-limit-exceeded')).toHaveLength(0);
  });

  test('overlap-limit with role-based references via program-context-ref', () => {
    const trees = [
      { ast: programAAst, programCode: 'PROG-A', role: 'primary-major' },
      { ast: programBAst, programCode: 'PROG-B', role: 'secondary-major' },
    ];
    // Use role references instead of direct program codes
    const roleOverlapRule = {
      type: 'overlap-limit',
      left: { type: 'program-context-ref', role: 'primary-major' },
      right: { type: 'program-context-ref', role: 'secondary-major' },
      constraint: { comparison: 'at-most', value: 1, unit: 'courses' },
    };
    const { policyResults, warnings } = auditMulti(
      trees, minimalCatalog, overlapTranscript,
      { overlapRules: [roleOverlapRule] }
    );

    // Roles resolve to PROG-A and PROG-B → 2 shared courses > 1 limit
    expect(policyResults[0].status).toBe(NOT_MET);
    expect(policyResults[0].programA).toBe('PROG-A');
    expect(policyResults[0].programB).toBe('PROG-B');
    expect(policyResults[0].actual).toBe(2);
    expect(warnings.filter(w => w.type === 'overlap-limit-exceeded')).toHaveLength(1);
  });
});

// ============================================================
// Outside-program tests (8.3) — using overlapRules option
// ============================================================

describe('auditMulti — outside-program', () => {
  // Transcript has: MATH 101(3), 151(4), 152(4), CMPS 130(3), 135(3), 230(3),
  // ENGL 101(3), HIST 101(3), ART 101(3), PHYS 201(4) = 33 total credits
  // PROG-A uses MATH 101(3), 151(4), CMPS 130(3) = 10 credits
  // Outside PROG-A = 33 - 10 = 23 credits

  test('sufficient credits outside program → MET policy result', () => {
    const trees = [
      { ast: programAAst, programCode: 'PROG-A', role: 'primary-major' },
    ];
    const outsideRule = {
      type: 'outside-program',
      program: { type: 'program-ref', code: 'PROG-A' },
      constraint: { comparison: 'at-least', value: 20, unit: 'credits' },
    };
    const { policyResults, warnings } = auditMulti(
      trees, minimalCatalog, overlapTranscript,
      { overlapRules: [outsideRule] }
    );
    const outsideWarnings = warnings.filter(w => w.type === 'outside-program-unresolved');
    expect(outsideWarnings).toHaveLength(0);

    expect(policyResults).toHaveLength(1);
    expect(policyResults[0].status).toBe(MET);
    expect(policyResults[0].actual).toBe(23);
    expect(policyResults[0].required).toBe(20);
  });

  test('insufficient credits outside program → NOT_MET policy result', () => {
    const trees = [
      { ast: programAAst, programCode: 'PROG-A', role: 'primary-major' },
    ];
    const outsideRule = {
      type: 'outside-program',
      program: { type: 'program-ref', code: 'PROG-A' },
      constraint: { comparison: 'at-least', value: 50, unit: 'credits' },
    };
    const { policyResults } = auditMulti(
      trees, minimalCatalog, overlapTranscript,
      { overlapRules: [outsideRule] }
    );

    expect(policyResults).toHaveLength(1);
    expect(policyResults[0].status).toBe(NOT_MET);
    expect(policyResults[0].actual).toBe(23);
    expect(policyResults[0].required).toBe(50);
  });
});

// ============================================================
// Program-context-ref tests (8.4) — inline in ASTs (valid)
// ============================================================

describe('auditMulti — program-context-ref', () => {
  test("resolves 'primary-major' to correct program code", () => {
    const gradAst = {
      type: 'all-of', items: [
        { type: 'course', subject: 'ENGL', number: '101' },
        { type: 'program-context-ref', role: 'primary-major' },
      ],
    };
    const trees = [
      { ast: mathAst, programCode: 'MATH-CERT', role: 'primary-major' },
      { ast: gradAst, programCode: 'GRAD', role: 'certificate' },
    ];
    const { results, policyResults } = auditMulti(trees, minimalCatalog, completeTranscript);

    // MATH-CERT is met (all courses present)
    expect(results.get('MATH-CERT').status).toBe(MET);
    // GRAD: ENGL 101 met, program-context-ref patched to MET after pass 2
    expect(results.get('GRAD').status).toBe(MET);

    // Policy results should include the resolved program-context-ref
    const refResult = policyResults.find(r => r.type === 'program-context-ref');
    expect(refResult).toBeDefined();
    expect(refResult.resolvedProgram).toBe('MATH-CERT');
    expect(refResult.status).toBe(MET);
  });

  test('unknown role → warning', () => {
    const gradAst = {
      type: 'all-of', items: [
        { type: 'course', subject: 'ENGL', number: '101' },
        { type: 'program-context-ref', role: 'tertiary-minor' },
      ],
    };
    const trees = [
      { ast: mathAst, programCode: 'MATH-CERT', role: 'primary-major' },
      { ast: gradAst, programCode: 'GRAD', role: 'certificate' },
    ];
    const { warnings } = auditMulti(trees, minimalCatalog, completeTranscript);
    const refWarnings = warnings.filter(w => w.type === 'program-context-ref-unresolved');
    expect(refWarnings).toHaveLength(1);
    expect(refWarnings[0].role).toBe('tertiary-minor');
  });

  test('unresolved overlap-limit programs → warning and NOT_MET', () => {
    const trees = [
      { ast: programAAst, programCode: 'PROG-A', role: 'primary-major' },
    ];
    const badRule = {
      type: 'overlap-limit',
      left: { type: 'program-ref', code: 'NONEXISTENT-A' },
      right: { type: 'program-ref', code: 'NONEXISTENT-B' },
      constraint: { comparison: 'at-most', value: 2, unit: 'courses' },
    };
    const { policyResults, warnings } = auditMulti(
      trees, minimalCatalog, overlapTranscript,
      { overlapRules: [badRule] }
    );
    const unresolvedWarnings = warnings.filter(w => w.type === 'overlap-limit-unresolved');
    expect(unresolvedWarnings).toHaveLength(1);
    expect(policyResults[0].status).toBe(NOT_MET);
  });

  test('overlap-limit with unknown unit → falls back to course count', () => {
    const trees = [
      { ast: programAAst, programCode: 'PROG-A', role: 'primary-major' },
      { ast: programBAst, programCode: 'PROG-B', role: 'secondary-major' },
    ];
    const rule = {
      type: 'overlap-limit',
      left: { type: 'program-ref', code: 'PROG-A' },
      right: { type: 'program-ref', code: 'PROG-B' },
      constraint: { comparison: 'at-most', value: 5, unit: 'bananas' },
    };
    const { policyResults } = auditMulti(
      trees, minimalCatalog, overlapTranscript,
      { overlapRules: [rule] }
    );
    // Falls back to course count: 2 shared courses ≤ 5
    expect(policyResults[0].status).toBe(MET);
    expect(policyResults[0].actual).toBe(2);
  });

  test('unresolved outside-program → warning and NOT_MET', () => {
    const trees = [
      { ast: programAAst, programCode: 'PROG-A', role: 'primary-major' },
    ];
    const badRule = {
      type: 'outside-program',
      program: { type: 'program-ref', code: 'NONEXISTENT' },
      constraint: { comparison: 'at-least', value: 10, unit: 'credits' },
    };
    const { policyResults, warnings } = auditMulti(
      trees, minimalCatalog, overlapTranscript,
      { overlapRules: [badRule] }
    );
    const unresolvedWarnings = warnings.filter(w => w.type === 'outside-program-unresolved');
    expect(unresolvedWarnings).toHaveLength(1);
    expect(policyResults[0].status).toBe(NOT_MET);
  });

  test('outside-program with courses unit', () => {
    const trees = [
      { ast: programAAst, programCode: 'PROG-A', role: 'primary-major' },
    ];
    const rule = {
      type: 'outside-program',
      program: { type: 'program-ref', code: 'PROG-A' },
      constraint: { comparison: 'at-least', value: 5, unit: 'courses' },
    };
    const { policyResults } = auditMulti(
      trees, minimalCatalog, overlapTranscript,
      { overlapRules: [rule] }
    );
    // PROG-A uses 3 courses, transcript has 10 → 7 outside
    expect(policyResults[0].status).toBe(MET);
    expect(policyResults[0].actual).toBe(7);
    expect(policyResults[0].unit).toBe('courses');
  });

  test('outside-program with at-most comparison', () => {
    const trees = [
      { ast: programAAst, programCode: 'PROG-A', role: 'primary-major' },
    ];
    const rule = {
      type: 'outside-program',
      program: { type: 'program-ref', code: 'PROG-A' },
      constraint: { comparison: 'at-most', value: 5, unit: 'courses' },
    };
    const { policyResults } = auditMulti(
      trees, minimalCatalog, overlapTranscript,
      { overlapRules: [rule] }
    );
    // 7 outside > 5 → NOT_MET
    expect(policyResults[0].status).toBe(NOT_MET);
  });

  test('outside-program with exact comparison', () => {
    const trees = [
      { ast: programAAst, programCode: 'PROG-A', role: 'primary-major' },
    ];
    const rule = {
      type: 'outside-program',
      program: { type: 'program-ref', code: 'PROG-A' },
      constraint: { comparison: 'exactly', value: 7, unit: 'courses' },
    };
    const { policyResults } = auditMulti(
      trees, minimalCatalog, overlapTranscript,
      { overlapRules: [rule] }
    );
    // 7 outside === 7 → MET
    expect(policyResults[0].status).toBe(MET);
  });

  test('program-context-ref patches through with-constraint wrapper', () => {
    const gradAst = {
      type: 'with-constraint',
      constraint: { kind: 'min-grade', value: 'C' },
      requirement: { type: 'program-context-ref', role: 'primary-major' },
    };
    const trees = [
      { ast: mathAst, programCode: 'MATH-CERT', role: 'primary-major' },
      { ast: gradAst, programCode: 'GRAD', role: 'certificate' },
    ];
    const { results, policyResults } = auditMulti(trees, minimalCatalog, completeTranscript);
    expect(results.get('MATH-CERT').status).toBe(MET);
    const refResult = policyResults.find(r => r.type === 'program-context-ref');
    expect(refResult.status).toBe(MET);
  });

  test('program-context-ref patches through scope body', () => {
    const gradAst = {
      type: 'scope', name: 'test',
      defs: [],
      body: { type: 'program-context-ref', role: 'primary-major' },
    };
    const trees = [
      { ast: mathAst, programCode: 'MATH-CERT', role: 'primary-major' },
      { ast: gradAst, programCode: 'GRAD', role: 'certificate' },
    ];
    const { results } = auditMulti(trees, minimalCatalog, completeTranscript);
    expect(results.get('MATH-CERT').status).toBe(MET);
    // GRAD should be patched to MET since body (program-context-ref) resolves to MET
    expect(results.get('GRAD').status).toBe(MET);
  });

  test('resolves role and returns referenced program status', () => {
    const gradAst = {
      type: 'all-of', items: [
        { type: 'program-context-ref', role: 'primary-major' },
      ],
    };
    const trees = [
      { ast: mathAst, programCode: 'MATH-CERT', role: 'primary-major' },
      { ast: gradAst, programCode: 'GRAD', role: 'certificate' },
    ];
    // Empty transcript — MATH-CERT is NOT_MET
    const { results, policyResults } = auditMulti(trees, minimalCatalog, []);
    expect(results.get('MATH-CERT').status).toBe(NOT_MET);

    // Policy result reflects that the referenced program is NOT_MET
    const refResult = policyResults.find(r => r.type === 'program-context-ref');
    expect(refResult.status).toBe(NOT_MET);
    expect(refResult.resolvedProgram).toBe('MATH-CERT');

    // GRAD tree status is patched: program-context-ref → NOT_MET
    expect(results.get('GRAD').status).toBe(NOT_MET);
  });
});
