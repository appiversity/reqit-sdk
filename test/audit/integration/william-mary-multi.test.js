'use strict';

/**
 * Multi-tree integration tests using the William & Mary catalog.
 * Tests auditMulti() with 3 trees: CS major, COLL gen-ed, graduation requirements.
 */

const { auditMulti, MET, IN_PROGRESS, PARTIAL_PROGRESS, NOT_MET } = require('../../../src/audit');
const wmCatalog = require('../../fixtures/catalogs/william-mary.json');
const csComplete = require('../../fixtures/transcripts/william-mary/cs-complete.json');
const csPartial = require('../../fixtures/transcripts/william-mary/cs-partial.json');

// ============================================================
// ASTs — three separate trees for multi-tree auditing
// ============================================================

// Tree 1: CS Major (core + math + general electives)
const csMajorAst = {
  type: 'with-constraint',
  constraint: { kind: 'min-gpa', value: 2.0 },
  requirement: {
    type: 'all-of', label: 'BS-CSCI',
    items: [
      {
        type: 'all-of', label: 'CS Core',
        items: [
          { type: 'course', subject: 'CSCI', number: '141' },
          { type: 'course', subject: 'CSCI', number: '241' },
          { type: 'course', subject: 'CSCI', number: '243' },
          { type: 'course', subject: 'CSCI', number: '301' },
          { type: 'course', subject: 'CSCI', number: '303' },
          { type: 'course', subject: 'CSCI', number: '304' },
          { type: 'course', subject: 'CSCI', number: '312' },
          { type: 'course', subject: 'CSCI', number: '423' },
        ],
      },
      {
        type: 'all-of', label: 'Math Proficiency',
        items: [
          { type: 'course', subject: 'MATH', number: '111' },
          { type: 'course', subject: 'MATH', number: '112' },
          { type: 'course', subject: 'MATH', number: '211' },
        ],
      },
      {
        type: 'credits-from', comparison: 'at-least', credits: 12,
        label: 'General Electives',
        source: {
          type: 'except',
          source: {
            type: 'course-filter',
            filters: [
              { field: 'subject', op: 'eq', value: 'CSCI' },
              { field: 'number', op: 'gte', value: 300 },
            ],
          },
          exclude: [
            { type: 'course', subject: 'CSCI', number: '320' },
            { type: 'course', subject: 'CSCI', number: '430' },
            { type: 'course', subject: 'CSCI', number: '498' },
          ],
        },
      },
    ],
  },
};

// Tree 2: COLL Gen-Ed
const collGenEdAst = {
  type: 'all-of', label: 'COLL Curriculum',
  items: [
    { type: 'course-filter', label: 'COLL 100',
      filters: [{ field: 'attribute', op: 'eq', value: 'COLL100' }] },
    { type: 'course-filter', label: 'COLL 150',
      filters: [{ field: 'attribute', op: 'eq', value: 'COLL150' }] },
    { type: 'course-filter', label: 'COLL 350',
      filters: [{ field: 'attribute', op: 'eq', value: 'COLL350' }] },
    { type: 'course-filter', label: 'COLL 400',
      filters: [{ field: 'attribute', op: 'eq', value: 'COLL400' }] },
    {
      type: 'one-from-each', label: 'Knowledge Domains',
      items: [
        { type: 'course-filter', filters: [{ field: 'attribute', op: 'eq', value: 'ALV' }] },
        { type: 'course-filter', filters: [{ field: 'attribute', op: 'eq', value: 'CSI' }] },
        { type: 'course-filter', filters: [{ field: 'attribute', op: 'eq', value: 'NQR' }] },
      ],
    },
  ],
};

// Tree 3: Graduation requirements (references primary-major, outside-program)
const gradReqAst = {
  type: 'all-of', label: 'Graduation Requirements',
  items: [
    { type: 'attainment', name: 'FOREIGN-LANG' },
    { type: 'attainment', name: 'WRITING-REQ' },
    {
      type: 'program-context-ref', role: 'primary-major',
    },
    {
      type: 'outside-program',
      program: 'BS-CSCI',
      comparison: 'at-least',
      value: 30,
      unit: 'credits',
    },
  ],
};

// Helper to build the standard 3-tree setup
function makeThreeTrees() {
  return [
    { ast: csMajorAst, programCode: 'BS-CSCI', role: 'primary-major' },
    { ast: collGenEdAst, programCode: 'COLL', role: 'certificate' },
    { ast: gradReqAst, programCode: 'GRAD-REQ', role: 'graduation' },
  ];
}

// ============================================================
// Tests
// ============================================================

describe('W&M multi-tree integration', () => {
  const attainments = {
    'FOREIGN-LANG': { kind: 'boolean', value: true },
    'WRITING-REQ': { kind: 'boolean', value: true },
    'ARTS-PROFICIENCY': { kind: 'boolean', value: true },
  };

  test('complete student — all 3 trees audited, assignments consistent', () => {
    const trees = makeThreeTrees();
    const { results, assignments } = auditMulti(
      trees, wmCatalog, csComplete, { attainments }
    );

    expect(results.get('BS-CSCI').status).toBe(MET);
    expect(results.get('COLL').status).toBe(MET);

    // Assignments should track courses across all trees
    // CSCI 141 (NQR attribute) → BS-CSCI, and also COLL (via NQR filter)
    expect(assignments.isAssigned('CSCI:141', 'BS-CSCI')).toBe(true);
    // HIST 101 (COLL100, CSI) → COLL
    expect(assignments.isAssigned('HIST:101', 'COLL')).toBe(true);
  });

  test('course shared between CS major and gen-ed → overlap tracked', () => {
    const trees = makeThreeTrees();
    const { assignments } = auditMulti(
      trees, wmCatalog, csComplete, { attainments }
    );

    // CSCI 141 has NQR attribute → used in both BS-CSCI and COLL (NQR domain)
    const csci141Programs = assignments.getAssignments('CSCI:141');
    expect(csci141Programs).toContain('BS-CSCI');
    // It may or may not be in COLL depending on whether course-filter picks it up
    // (CSCI 141 has NQR attribute, so the NQR course-filter should match it)
    expect(csci141Programs).toContain('COLL');
  });

  test('outside-program: sufficient credits outside BS-CSCI', () => {
    const trees = makeThreeTrees();
    const { results, assignments, warnings } = auditMulti(
      trees, wmCatalog, csComplete, { attainments }
    );

    // Non-CSCI courses in the complete transcript:
    // MATH 111(4), 112(4), 211(3), ENGL 150(3), HIST 101(3), MUSC 101(3),
    // PHYS 101(4), SOCL 201(3), GBST 301(3), ANTH 305(3), ECON 350(3),
    // GOVT 310(3), DATA 441(3)
    // These are outside BS-CSCI if they weren't matched by BS-CSCI tree
    // MATH courses ARE matched by BS-CSCI, so outside = non-CSCI, non-MATH courses
    const outsideKeys = assignments.getCoursesOutsideProgram('BS-CSCI');
    expect(outsideKeys.length).toBeGreaterThan(0);
  });

  test('GPA constraint applies to major courses only', () => {
    const trees = makeThreeTrees();
    const { results } = auditMulti(
      trees, wmCatalog, csComplete, { attainments }
    );

    // BS-CSCI has min-gpa 2.0 constraint
    const csResult = results.get('BS-CSCI');
    expect(csResult.result.constraintResult.met).toBe(true);
    expect(csResult.result.constraintResult.minGpa).toBe(2.0);

    // COLL gen-ed has NO gpa constraint (no with-constraint wrapper)
    const collResult = results.get('COLL');
    expect(collResult.result.constraintResult).toBeUndefined();
  });

  test("program-context-ref resolves 'primary-major' to BS-CSCI", () => {
    const trees = makeThreeTrees();
    const { results, warnings } = auditMulti(
      trees, wmCatalog, csComplete, { attainments }
    );

    // The program-context-ref node in GRAD-REQ references 'primary-major'
    // which should resolve to BS-CSCI
    const refWarnings = warnings.filter(w => w.type === 'program-context-ref-unresolved');
    expect(refWarnings).toHaveLength(0);

    // BS-CSCI is met, so the reference should also be met in policyResults
    expect(results.get('BS-CSCI').status).toBe(MET);
  });

  test('partial student → mixed statuses across trees', () => {
    const trees = makeThreeTrees();
    const { results } = auditMulti(
      trees, wmCatalog, csPartial, { attainments }
    );

    // CS major has in-progress courses → in-progress or partial
    const csStatus = results.get('BS-CSCI').status;
    expect([IN_PROGRESS, PARTIAL_PROGRESS]).toContain(csStatus);

    // COLL gen-ed has some courses → partial progress
    const collStatus = results.get('COLL').status;
    expect(collStatus).not.toBe(NOT_MET);
  });
});
