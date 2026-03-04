'use strict';

/**
 * Integration tests using the RCNJ catalog.
 * Focus: test score prerequisites, pervasive grade constraints,
 * keystones + distribution gen-ed, CS minor.
 */

const { audit, findUnmet, MET, IN_PROGRESS, PARTIAL_PROGRESS, NOT_MET } = require('../../../src/audit');
const rcnjCatalog = require('../../fixtures/catalogs/rcnj.json');
const csComplete = require('../../fixtures/transcripts/rcnj/cs-complete.json');
const csScoreAlt = require('../../fixtures/transcripts/rcnj/cs-score-alternative.json');
const csGradeFail = require('../../fixtures/transcripts/rcnj/cs-grade-fail.json');
const minorComplete = require('../../fixtures/transcripts/rcnj/minor-complete.json');

// ============================================================
// ASTs — CS Major components
// ============================================================

// Prerequisite for CMPS 147: MATH 101 with D or better, OR SAT-MATH ≥ 580
const cmps147PrereqAst = {
  type: 'any-of', label: 'CMPS 147 Prerequisite',
  items: [
    {
      type: 'with-constraint',
      constraint: { kind: 'min-grade', value: 'D' },
      requirement: { type: 'course', subject: 'MATH', number: '101' },
    },
    { type: 'score', name: 'SAT-MATH', op: 'gte', value: 580 },
  ],
};

// CS core with min-grade C constraint
const csCoreAst = {
  type: 'with-constraint',
  constraint: { kind: 'min-grade', value: 'C' },
  requirement: {
    type: 'all-of', label: 'CS Core',
    items: [
      { type: 'course', subject: 'CMPS', number: '147' },
      { type: 'course', subject: 'CMPS', number: '148' },
      { type: 'course', subject: 'CMPS', number: '231' },
      { type: 'course', subject: 'CMPS', number: '220' },
      { type: 'course', subject: 'CMPS', number: '345' },
      { type: 'course', subject: 'CMPS', number: '361' },
      { type: 'course', subject: 'CMPS', number: '364' },
      { type: 'course', subject: 'CMPS', number: '366' },
      { type: 'course', subject: 'CMPS', number: '450' },
    ],
  },
};

// Math requirements
const mathReqAst = {
  type: 'all-of', label: 'Mathematics',
  items: [
    { type: 'course', subject: 'MATH', number: '121' },
    {
      type: 'any-of', label: 'Discrete Math',
      items: [
        { type: 'course', subject: 'MATH', number: '205' },
        { type: 'course', subject: 'MATH', number: '237' },
      ],
    },
    {
      type: 'n-of', comparison: 'at-least', count: 2, label: 'Math Electives',
      items: [
        { type: 'course', subject: 'MATH', number: '108' },
        { type: 'course', subject: 'MATH', number: '210' },
        { type: 'course', subject: 'MATH', number: '237' },
        { type: 'course', subject: 'MATH', number: '101' },
      ],
    },
  ],
};

// CS electives: at least 7 courses from CMPS 300+
const csElectivesAst = {
  type: 'n-of', comparison: 'at-least', count: 7,
  label: 'CS Electives (300+)',
  items: [
    { type: 'course', subject: 'CMPS', number: '305' },
    { type: 'course', subject: 'CMPS', number: '310' },
    { type: 'course', subject: 'CMPS', number: '311' },
    { type: 'course', subject: 'CMPS', number: '315' },
    { type: 'course', subject: 'CMPS', number: '320' },
    { type: 'course', subject: 'CMPS', number: '327' },
    { type: 'course', subject: 'CMPS', number: '331' },
    { type: 'course', subject: 'CMPS', number: '342' },
    { type: 'course', subject: 'CMPS', number: '350' },
    { type: 'course', subject: 'CMPS', number: '357' },
    { type: 'course', subject: 'CMPS', number: '367' },
    { type: 'course', subject: 'CMPS', number: '369' },
    { type: 'course', subject: 'CMPS', number: '370' },
    { type: 'course', subject: 'CMPS', number: '373' },
    { type: 'course', subject: 'CMPS', number: '375' },
  ],
};

// Gen-ed keystones
const genEdKeystonesAst = {
  type: 'all-of', label: 'Gen-Ed Keystones',
  items: [
    { type: 'course-filter', label: 'FYS', filters: [{ field: 'attribute', op: 'eq', value: 'GE-FYS' }] },
    { type: 'course-filter', label: 'Critical Reading', filters: [{ field: 'attribute', op: 'eq', value: 'WI' }] },
    { type: 'course-filter', label: 'A&H', filters: [{ field: 'attribute', op: 'eq', value: 'GE-AH' }] },
    { type: 'course-filter', label: 'SS', filters: [{ field: 'attribute', op: 'eq', value: 'GE-SS' }] },
    { type: 'course-filter', label: 'HP', filters: [{ field: 'attribute', op: 'eq', value: 'GE-HP' }] },
    { type: 'course-filter', label: 'GA', filters: [{ field: 'attribute', op: 'eq', value: 'GE-GA' }] },
    { type: 'course-filter', label: 'QR', filters: [{ field: 'attribute', op: 'eq', value: 'GE-QR' }] },
    { type: 'course-filter', label: 'SR', filters: [{ field: 'attribute', op: 'eq', value: 'GE-SR' }] },
  ],
};

// Gen-ed distribution: 2 of 3 categories (CC, VE, SYS)
const genEdDistributionAst = {
  type: 'from-n-groups', count: 2, label: 'Distribution (2 of 3)',
  items: [
    { type: 'course-filter', label: 'CC', filters: [{ field: 'attribute', op: 'eq', value: 'GE-CC' }] },
    { type: 'course-filter', label: 'VE', filters: [{ field: 'attribute', op: 'eq', value: 'GE-VE' }] },
    { type: 'course-filter', label: 'SYS', filters: [{ field: 'attribute', op: 'eq', value: 'GE-SYS' }] },
  ],
};

// Full gen-ed
const genEdAst = {
  type: 'all-of', label: 'General Education',
  items: [genEdKeystonesAst, genEdDistributionAst],
};

// Complete CS major
const csMajorAst = {
  type: 'all-of', label: 'BS-CMPS',
  items: [csCoreAst, mathReqAst, csElectivesAst, genEdAst],
};

// CS minor
const csMinorAst = {
  type: 'all-of', label: 'CS Minor',
  items: [
    { type: 'course', subject: 'CMPS', number: '147' },
    { type: 'course', subject: 'CMPS', number: '148' },
    { type: 'course', subject: 'CMPS', number: '231' },
    {
      type: 'n-of', comparison: 'at-least', count: 3, label: 'Minor Electives',
      items: [
        { type: 'course', subject: 'CMPS', number: '305' },
        { type: 'course', subject: 'CMPS', number: '310' },
        { type: 'course', subject: 'CMPS', number: '311' },
        { type: 'course', subject: 'CMPS', number: '320' },
        { type: 'course', subject: 'CMPS', number: '327' },
        { type: 'course', subject: 'CMPS', number: '331' },
        { type: 'course', subject: 'CMPS', number: '345' },
        { type: 'course', subject: 'CMPS', number: '361' },
        { type: 'course', subject: 'CMPS', number: '364' },
        { type: 'course', subject: 'CMPS', number: '366' },
        { type: 'course', subject: 'CMPS', number: '369' },
      ],
    },
  ],
};

// ============================================================
// Tests
// ============================================================

describe('RCNJ CS Major — test score prerequisites', () => {
  test('CMPS 147 prereq met via MATH 101 with grade ≥ D → met', () => {
    const { status } = audit(cmps147PrereqAst, rcnjCatalog, csComplete);
    expect(status).toBe(MET);
  });

  test('CMPS 147 prereq met via SAT-MATH ≥ 580 (score alternative) → met', () => {
    const opts = {
      attainments: { 'SAT-MATH': { kind: 'score', value: 620 } },
    };
    // csScoreAlt has no MATH 101 — uses score instead
    const { status, result } = audit(cmps147PrereqAst, rcnjCatalog, csScoreAlt, opts);
    expect(status).toBe(MET);
  });

  test('no qualifying course or score → not-met', () => {
    // Empty transcript, no attainments
    const { status } = audit(cmps147PrereqAst, rcnjCatalog, []);
    expect(status).toBe(NOT_MET);
  });
});

describe('RCNJ CS Major — pervasive grade constraints', () => {
  test('all CS core courses with grades ≥ C → met', () => {
    const { status, result } = audit(csCoreAst, rcnjCatalog, csComplete);
    expect(status).toBe(MET);
    expect(result.constraintResult.met).toBe(true);
  });

  test('one CS core course with grade D → not-met', () => {
    // csGradeFail has CMPS 147 with grade D (below required C)
    const { status, result } = audit(csCoreAst, rcnjCatalog, csGradeFail);
    expect(status).toBe(NOT_MET);
    expect(result.constraintResult.met).toBe(false);
    expect(result.constraintResult.minGrade).toBe('C');
  });

  test('in-progress course (no grade yet) → in-progress', () => {
    const transcript = [
      { subject: 'CMPS', number: '147', grade: 'B+', credits: 4, term: 'Fall 2022', status: 'completed' },
      { subject: 'CMPS', number: '148', grade: 'B',  credits: 4, term: 'Spring 2023', status: 'completed' },
      { subject: 'CMPS', number: '231', grade: 'A-', credits: 4, term: 'Fall 2023', status: 'completed' },
      { subject: 'CMPS', number: '220', grade: 'B+', credits: 4, term: 'Fall 2023', status: 'completed' },
      { subject: 'CMPS', number: '345', grade: 'B',  credits: 4, term: 'Spring 2024', status: 'completed' },
      { subject: 'CMPS', number: '361', grade: 'A-', credits: 4, term: 'Spring 2024', status: 'completed' },
      { subject: 'CMPS', number: '364', grade: 'B+', credits: 4, term: 'Fall 2024', status: 'completed' },
      { subject: 'CMPS', number: '366', grade: 'B',  credits: 4, term: 'Fall 2024', status: 'completed' },
      { subject: 'CMPS', number: '450', grade: null,  credits: 4, term: 'Spring 2025', status: 'in-progress' },
    ];
    const { status } = audit(csCoreAst, rcnjCatalog, transcript);
    expect(status).toBe(IN_PROGRESS);
  });
});

describe('RCNJ Gen-ed — keystones + distribution', () => {
  test('all 8 keystones + 2-of-3 distribution → met', () => {
    const { status } = audit(genEdAst, rcnjCatalog, csComplete);
    expect(status).toBe(MET);
  });

  test('missing one keystone → partial-progress', () => {
    // Transcript missing GE-GA (SPAN 101)
    const transcript = [
      { subject: 'INTD', number: '101', grade: 'B+', credits: 3, term: 'Fall 2022', status: 'completed' },
      { subject: 'CRWT', number: '102', grade: 'B',  credits: 3, term: 'Fall 2022', status: 'completed' },
      { subject: 'AIID', number: '201', grade: 'A',  credits: 3, term: 'Spring 2023', status: 'completed' },
      { subject: 'SOSC', number: '110', grade: 'B+', credits: 3, term: 'Spring 2023', status: 'completed' },
      { subject: 'HIST', number: '101', grade: 'B',  credits: 3, term: 'Fall 2023', status: 'completed' },
      // Missing SPAN 101 (GE-GA)
      { subject: 'CMPS', number: '147', grade: 'B+', credits: 4, term: 'Fall 2022', status: 'completed' },
      { subject: 'ENSC', number: '103', grade: 'B+', credits: 4, term: 'Spring 2024', status: 'completed' },
      { subject: 'MUSC', number: '201', grade: 'B',  credits: 3, term: 'Spring 2024', status: 'completed' },
      { subject: 'PHIL', number: '210', grade: 'A',  credits: 3, term: 'Fall 2024', status: 'completed' },
      { subject: 'SUST', number: '201', grade: 'B+', credits: 3, term: 'Spring 2025', status: 'completed' },
    ];
    const { status, result } = audit(genEdAst, rcnjCatalog, transcript);
    expect(status).toBe(PARTIAL_PROGRESS);
    // Keystones missing GA
    const keystones = result.items[0];
    const gaFilter = keystones.items[5]; // GA is 6th keystone (index 5)
    expect(gaFilter.status).toBe(NOT_MET);
  });

  test('distribution: only 1 of 3 categories met → not-met', () => {
    // Only CC category met
    const transcript = [
      { subject: 'MUSC', number: '201', grade: 'B', credits: 3, term: 'Spring 2024', status: 'completed' },
    ];
    const { status } = audit(genEdDistributionAst, rcnjCatalog, transcript);
    expect(status).toBe(PARTIAL_PROGRESS);
  });

  test('distribution: exactly 2 of 3 categories met → met', () => {
    const transcript = [
      { subject: 'MUSC', number: '201', grade: 'B',  credits: 3, term: 'Spring 2024', status: 'completed' },
      { subject: 'PHIL', number: '210', grade: 'A',  credits: 3, term: 'Fall 2024', status: 'completed' },
    ];
    const { status } = audit(genEdDistributionAst, rcnjCatalog, transcript);
    expect(status).toBe(MET);
  });
});

describe('RCNJ CS Major — complete program audit', () => {
  test('full CS major → met', () => {
    const { status, result } = audit(csMajorAst, rcnjCatalog, csComplete);
    expect(status).toBe(MET);
    expect(result.items[0].status).toBe(MET); // core
    expect(result.items[1].status).toBe(MET); // math
    expect(result.items[2].status).toBe(MET); // electives
    expect(result.items[3].status).toBe(MET); // gen-ed
  });

  test('partial progress → findUnmet shows remaining courses', () => {
    // Transcript with only core and math, no electives or gen-ed
    const transcript = [
      { subject: 'CMPS', number: '147', grade: 'B+', credits: 4, term: 'Fall 2022', status: 'completed' },
      { subject: 'CMPS', number: '148', grade: 'B',  credits: 4, term: 'Spring 2023', status: 'completed' },
      { subject: 'CMPS', number: '231', grade: 'A-', credits: 4, term: 'Fall 2023', status: 'completed' },
      { subject: 'MATH', number: '121', grade: 'B+', credits: 4, term: 'Fall 2022', status: 'completed' },
    ];
    const { status, result } = audit(csMajorAst, rcnjCatalog, transcript);
    expect(status).toBe(PARTIAL_PROGRESS);
    const unmet = findUnmet(result);
    expect(unmet.length).toBeGreaterThan(0);
    // Should include missing core courses
    const missingCmps = unmet.filter(u => u.node.subject === 'CMPS');
    expect(missingCmps.length).toBeGreaterThan(0);
  });
});

describe('RCNJ CS Minor', () => {
  test('minor complete → met', () => {
    const { status } = audit(csMinorAst, rcnjCatalog, minorComplete);
    expect(status).toBe(MET);
  });

  test('minor with insufficient electives → partial-progress', () => {
    // Only core courses, no electives
    const transcript = [
      { subject: 'CMPS', number: '147', grade: 'B+', credits: 4, term: 'Fall 2022', status: 'completed' },
      { subject: 'CMPS', number: '148', grade: 'B',  credits: 4, term: 'Spring 2023', status: 'completed' },
      { subject: 'CMPS', number: '231', grade: 'A-', credits: 4, term: 'Fall 2023', status: 'completed' },
    ];
    const { status, result } = audit(csMinorAst, rcnjCatalog, transcript);
    expect(status).toBe(PARTIAL_PROGRESS);
    // Electives n-of should be not-met
    expect(result.items[3].status).toBe(NOT_MET);
  });
});
