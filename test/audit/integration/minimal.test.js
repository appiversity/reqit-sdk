'use strict';

/**
 * Integration tests for the single-tree auditor using the minimal catalog.
 *
 * These tests construct realistic requirement ASTs and test them against
 * varied transcripts to verify end-to-end audit behavior.
 */

const { audit, prepareAudit, findUnmet, MET, IN_PROGRESS, PARTIAL_PROGRESS, NOT_MET } = require('../../../src/audit');
const { parse } = require('../../../src/parser');
const minimalCatalog = require('../../fixtures/catalogs/minimal.json');

// ============================================================
// CS Major requirements (realistic composite AST)
// ============================================================

const csMajorAst = {
  type: 'scope', name: 'cs-major',
  defs: [
    { type: 'variable-def', name: 'math_core',
      value: {
        type: 'all-of', label: 'Mathematics Core',
        items: [
          { type: 'course', subject: 'MATH', number: '101' },
          { type: 'course', subject: 'MATH', number: '151' },
          { type: 'course', subject: 'MATH', number: '152' },
          { type: 'course', subject: 'MATH', number: '250' },
        ],
      } },
    { type: 'variable-def', name: 'cs_core',
      value: {
        type: 'all-of', label: 'CS Core',
        items: [
          { type: 'course', subject: 'CMPS', number: '130' },
          { type: 'course', subject: 'CMPS', number: '135' },
          { type: 'course', subject: 'CMPS', number: '230' },
          { type: 'course', subject: 'CMPS', number: '310' },
        ],
      } },
    { type: 'variable-def', name: 'electives',
      value: {
        type: 'course-filter',
        filters: [
          { field: 'subject', op: 'eq', value: 'CMPS' },
          { field: 'number', op: 'gte', value: 300 },
        ],
      } },
  ],
  body: {
    type: 'all-of', label: 'B.S. Computer Science',
    items: [
      { type: 'variable-ref', name: 'math_core' },
      { type: 'variable-ref', name: 'cs_core' },
      { type: 'n-of', comparison: 'at-least', count: 2, label: 'CS Electives',
        items: [
          { type: 'course', subject: 'CMPS', number: '320' },
          { type: 'course', subject: 'CMPS', number: '350' },
          { type: 'course', subject: 'CMPS', number: '360' },
          { type: 'course', subject: 'CMPS', number: '380' },
        ] },
      { type: 'all-of', label: 'Capstone',
        items: [
          { type: 'course', subject: 'CMPS', number: '491' },
          { type: 'course', subject: 'CMPS', number: '492' },
        ] },
      { type: 'credits-from', comparison: 'at-least', credits: 12, label: 'Science Credits',
        source: {
          type: 'course-filter',
          filters: [{ field: 'attribute', op: 'eq', value: 'SCI' }],
        } },
    ],
  },
};

// ============================================================
// Transcripts for CS Major
// ============================================================

const seniorComplete = [
  { subject: 'MATH', number: '101', grade: 'B+', credits: 3, term: 'Fall 2023', status: 'completed' },
  { subject: 'MATH', number: '151', grade: 'A-', credits: 4, term: 'Spring 2024', status: 'completed' },
  { subject: 'MATH', number: '152', grade: 'B',  credits: 4, term: 'Fall 2024', status: 'completed' },
  { subject: 'MATH', number: '250', grade: 'A',  credits: 3, term: 'Spring 2025', status: 'completed' },
  { subject: 'CMPS', number: '130', grade: 'A',  credits: 3, term: 'Fall 2023', status: 'completed' },
  { subject: 'CMPS', number: '135', grade: 'B+', credits: 3, term: 'Fall 2023', status: 'completed' },
  { subject: 'CMPS', number: '230', grade: 'B',  credits: 3, term: 'Spring 2024', status: 'completed' },
  { subject: 'CMPS', number: '310', grade: 'A-', credits: 3, term: 'Fall 2024', status: 'completed' },
  { subject: 'CMPS', number: '320', grade: 'B+', credits: 3, term: 'Fall 2024', status: 'completed' },
  { subject: 'CMPS', number: '350', grade: 'A',  credits: 3, term: 'Spring 2025', status: 'completed' },
  { subject: 'CMPS', number: '360', grade: 'B',  credits: 3, term: 'Spring 2025', status: 'completed' },
  { subject: 'CMPS', number: '380', grade: 'A-', credits: 3, term: 'Spring 2025', status: 'completed' },
  { subject: 'CMPS', number: '491', grade: 'A',  credits: 3, term: 'Fall 2025', status: 'completed' },
  { subject: 'CMPS', number: '492', grade: 'A',  credits: 3, term: 'Spring 2026', status: 'completed' },
  { subject: 'PHYS', number: '201', grade: 'B-', credits: 4, term: 'Fall 2024', status: 'completed' },
  { subject: 'CHEM', number: '101', grade: 'C+', credits: 4, term: 'Spring 2024', status: 'completed' },
  { subject: 'BIOL', number: '101', grade: 'B',  credits: 4, term: 'Spring 2025', status: 'completed' },
  { subject: 'HIST', number: '101', grade: 'B+', credits: 3, term: 'Fall 2023', status: 'completed' },
];

const freshman = [
  { subject: 'MATH', number: '101', grade: 'B+', credits: 3, term: 'Fall 2023', status: 'completed' },
  { subject: 'CMPS', number: '130', grade: 'A',  credits: 3, term: 'Fall 2023', status: 'completed' },
  { subject: 'CMPS', number: '135', grade: 'B+', credits: 3, term: 'Fall 2023', status: 'completed' },
  { subject: 'MATH', number: '151', grade: null,  credits: 4, term: 'Spring 2024', status: 'in-progress' },
  { subject: 'CMPS', number: '230', grade: null,  credits: 3, term: 'Spring 2024', status: 'in-progress' },
];

const missingCapstone = [
  { subject: 'MATH', number: '101', grade: 'B+', credits: 3, term: 'Fall 2023', status: 'completed' },
  { subject: 'MATH', number: '151', grade: 'A-', credits: 4, term: 'Spring 2024', status: 'completed' },
  { subject: 'MATH', number: '152', grade: 'B',  credits: 4, term: 'Fall 2024', status: 'completed' },
  { subject: 'MATH', number: '250', grade: 'A',  credits: 3, term: 'Spring 2025', status: 'completed' },
  { subject: 'CMPS', number: '130', grade: 'A',  credits: 3, term: 'Fall 2023', status: 'completed' },
  { subject: 'CMPS', number: '135', grade: 'B+', credits: 3, term: 'Fall 2023', status: 'completed' },
  { subject: 'CMPS', number: '230', grade: 'B',  credits: 3, term: 'Spring 2024', status: 'completed' },
  { subject: 'CMPS', number: '310', grade: 'A-', credits: 3, term: 'Fall 2024', status: 'completed' },
  { subject: 'CMPS', number: '320', grade: 'B+', credits: 3, term: 'Fall 2024', status: 'completed' },
  { subject: 'CMPS', number: '350', grade: 'A',  credits: 3, term: 'Spring 2025', status: 'completed' },
  // Missing CMPS 491, 492 (capstone)
  { subject: 'PHYS', number: '201', grade: 'B-', credits: 4, term: 'Fall 2024', status: 'completed' },
  { subject: 'CHEM', number: '101', grade: 'C+', credits: 4, term: 'Spring 2024', status: 'completed' },
  { subject: 'BIOL', number: '101', grade: 'B',  credits: 4, term: 'Spring 2025', status: 'completed' },
];

const creditShort = [
  { subject: 'MATH', number: '101', grade: 'B+', credits: 3, term: 'Fall 2023', status: 'completed' },
  { subject: 'MATH', number: '151', grade: 'A-', credits: 4, term: 'Spring 2024', status: 'completed' },
  { subject: 'MATH', number: '152', grade: 'B',  credits: 4, term: 'Fall 2024', status: 'completed' },
  { subject: 'MATH', number: '250', grade: 'A',  credits: 3, term: 'Spring 2025', status: 'completed' },
  { subject: 'CMPS', number: '130', grade: 'A',  credits: 3, term: 'Fall 2023', status: 'completed' },
  { subject: 'CMPS', number: '135', grade: 'B+', credits: 3, term: 'Fall 2023', status: 'completed' },
  { subject: 'CMPS', number: '230', grade: 'B',  credits: 3, term: 'Spring 2024', status: 'completed' },
  { subject: 'CMPS', number: '310', grade: 'A-', credits: 3, term: 'Fall 2024', status: 'completed' },
  { subject: 'CMPS', number: '320', grade: 'B+', credits: 3, term: 'Fall 2024', status: 'completed' },
  { subject: 'CMPS', number: '350', grade: 'A',  credits: 3, term: 'Spring 2025', status: 'completed' },
  { subject: 'CMPS', number: '491', grade: 'A',  credits: 3, term: 'Fall 2025', status: 'completed' },
  { subject: 'CMPS', number: '492', grade: 'A',  credits: 3, term: 'Spring 2026', status: 'completed' },
  // Only 4 SCI credits (need 12)
  { subject: 'PHYS', number: '201', grade: 'B-', credits: 4, term: 'Fall 2024', status: 'completed' },
];

// ============================================================
// End-to-end: CS Major with minimal catalog
// ============================================================

describe('CS Major — end-to-end', () => {
  test('senior complete transcript → met', () => {
    const { status, result } = audit(csMajorAst, minimalCatalog, seniorComplete);
    expect(status).toBe(MET);
    expect(result.items[0].status).toBe(MET); // math_core
    expect(result.items[1].status).toBe(MET); // cs_core
    expect(result.items[2].status).toBe(MET); // electives (at-least 2)
    expect(result.items[3].status).toBe(MET); // capstone
    expect(result.items[4].status).toBe(MET); // science credits
  });

  test('freshman transcript → partial-progress', () => {
    const { status, result } = audit(csMajorAst, minimalCatalog, freshman);
    expect(status).toBe(PARTIAL_PROGRESS);
    // Math core: MATH 101 met, MATH 151 ip, MATH 152 & 250 not met → partial
    expect(result.items[0].status).not.toBe(MET);
  });

  test('missing capstone → partial-progress', () => {
    const { status, result } = audit(csMajorAst, minimalCatalog, missingCapstone);
    expect(status).toBe(PARTIAL_PROGRESS);
    // Capstone is the unmet component
    expect(result.items[3].status).toBe(NOT_MET);
  });

  test('credit short → partial-progress', () => {
    const { status, result } = audit(csMajorAst, minimalCatalog, creditShort);
    expect(status).toBe(PARTIAL_PROGRESS);
    // Science credits: only 4, need 12
    expect(result.items[4].status).toBe(PARTIAL_PROGRESS);
    expect(result.items[4].creditsEarned).toBe(4);
  });

  test('empty transcript → not-met', () => {
    const { status } = audit(csMajorAst, minimalCatalog, []);
    expect(status).toBe(NOT_MET);
  });

  test('findUnmet identifies missing requirements', () => {
    const { result } = audit(csMajorAst, minimalCatalog, missingCapstone);
    const unmet = findUnmet(result);
    // Should find CMPS 491 and CMPS 492
    const capstoneUnmet = unmet.filter(
      u => u.node.subject === 'CMPS' && (u.node.number === '491' || u.node.number === '492')
    );
    expect(capstoneUnmet).toHaveLength(2);
  });

  test('prepareAudit produces same results as audit', () => {
    const prepared = prepareAudit(csMajorAst, minimalCatalog);
    const transcripts = [seniorComplete, freshman, missingCapstone, creditShort, []];
    for (const transcript of transcripts) {
      const fromPrepare = prepared.run(transcript);
      const fromAudit = audit(csMajorAst, minimalCatalog, transcript);
      expect(fromPrepare.status).toBe(fromAudit.status);
    }
  });
});

// ============================================================
// Gen-ed distribution requirement (realistic one-from-each)
// ============================================================

const genEdAst = {
  type: 'all-of', label: 'General Education',
  items: [
    { type: 'course', subject: 'ENGL', number: '101' },
    { type: 'one-from-each', label: 'Distribution',
      items: [
        { type: 'course-filter', filters: [{ field: 'attribute', op: 'eq', value: 'HUM' }] },
        { type: 'course-filter', filters: [{ field: 'attribute', op: 'eq', value: 'SCI' }] },
        { type: 'course-filter', filters: [{ field: 'attribute', op: 'eq', value: 'FA' }] },
      ] },
    { type: 'credits-from', comparison: 'at-least', credits: 6, label: 'Writing Intensive',
      source: {
        type: 'course-filter',
        filters: [{ field: 'attribute', op: 'eq', value: 'WI' }],
      } },
  ],
};

describe('Gen-ed distribution — end-to-end', () => {
  // Transcript that satisfies gen-ed: ENGL 101, HUM (HIST 101), SCI (PHYS 201),
  // FA (ART 101), and ≥6 WI credits (ENGL 101 + CMPS 310 = 6)
  const genEdComplete = [
    { subject: 'ENGL', number: '101', grade: 'B',  credits: 3, term: 'Fall 2023', status: 'completed' },
    { subject: 'HIST', number: '101', grade: 'B+', credits: 3, term: 'Fall 2023', status: 'completed' },
    { subject: 'PHYS', number: '201', grade: 'B-', credits: 4, term: 'Fall 2024', status: 'completed' },
    { subject: 'ART',  number: '101', grade: 'A',  credits: 3, term: 'Spring 2024', status: 'completed' },
    { subject: 'CMPS', number: '310', grade: 'A-', credits: 3, term: 'Fall 2024', status: 'completed' },
    { subject: 'CMPS', number: '320', grade: 'B+', credits: 3, term: 'Fall 2024', status: 'completed' },
  ];

  test('complete transcript satisfies gen-ed', () => {
    const { status } = audit(genEdAst, minimalCatalog, genEdComplete);
    expect(status).toBe(MET);
  });

  test('missing fine arts → partial-progress', () => {
    // Transcript with HUM, SCI, and WI but no FA
    const transcript = [
      { subject: 'ENGL', number: '101', grade: 'B', credits: 3, term: 'Fall 2023', status: 'completed' },
      { subject: 'HIST', number: '101', grade: 'B+', credits: 3, term: 'Fall 2023', status: 'completed' },
      { subject: 'PHYS', number: '201', grade: 'B-', credits: 4, term: 'Fall 2024', status: 'completed' },
      { subject: 'CMPS', number: '310', grade: 'A-', credits: 3, term: 'Fall 2024', status: 'completed' },
      { subject: 'CMPS', number: '320', grade: 'B+', credits: 3, term: 'Fall 2024', status: 'completed' },
    ];
    const { status, result } = audit(genEdAst, minimalCatalog, transcript);
    expect(status).toBe(PARTIAL_PROGRESS);
    // Distribution should be partial (HUM and SCI met, FA not met)
    expect(result.items[1].status).toBe(PARTIAL_PROGRESS);
  });
});

// ============================================================
// Grade constraint scenarios
// ============================================================

describe('grade constraint integration', () => {
  const constrainedAst = {
    type: 'with-constraint',
    constraint: { kind: 'min-gpa', value: 3.0 },
    requirement: {
      type: 'all-of',
      items: [
        { type: 'course', subject: 'CMPS', number: '130' },
        { type: 'course', subject: 'CMPS', number: '135' },
        { type: 'course', subject: 'CMPS', number: '230' },
      ],
    },
  };

  test('high GPA → met', () => {
    const transcript = [
      { subject: 'CMPS', number: '130', grade: 'A',  credits: 3, term: 'Fall 2023', status: 'completed' },
      { subject: 'CMPS', number: '135', grade: 'A-', credits: 3, term: 'Fall 2023', status: 'completed' },
      { subject: 'CMPS', number: '230', grade: 'B+', credits: 3, term: 'Spring 2024', status: 'completed' },
    ];
    const { status, result } = audit(constrainedAst, minimalCatalog, transcript);
    expect(status).toBe(MET);
    expect(result.constraintResult.met).toBe(true);
    expect(result.constraintResult.actual).toBeGreaterThanOrEqual(3.0);
  });

  test('low GPA → not-met', () => {
    const transcript = [
      { subject: 'CMPS', number: '130', grade: 'C',  credits: 3, term: 'Fall 2023', status: 'completed' },
      { subject: 'CMPS', number: '135', grade: 'C-', credits: 3, term: 'Fall 2023', status: 'completed' },
      { subject: 'CMPS', number: '230', grade: 'D+', credits: 3, term: 'Spring 2024', status: 'completed' },
    ];
    const { status, result } = audit(constrainedAst, minimalCatalog, transcript);
    expect(status).toBe(NOT_MET);
    expect(result.constraintResult.met).toBe(false);
    expect(result.constraintResult.actual).toBeLessThan(3.0);
  });

  test('in-progress courses with low current GPA → in-progress', () => {
    const transcript = [
      { subject: 'CMPS', number: '130', grade: 'C',  credits: 3, term: 'Fall 2023', status: 'completed' },
      { subject: 'CMPS', number: '135', grade: 'C-', credits: 3, term: 'Fall 2023', status: 'completed' },
      { subject: 'CMPS', number: '230', grade: null,  credits: 3, term: 'Spring 2024', status: 'in-progress' },
    ];
    const { status } = audit(constrainedAst, minimalCatalog, transcript);
    expect(status).toBe(IN_PROGRESS);
  });
});

// ============================================================
// Score/attainment integration
// ============================================================

describe('score and attainment integration', () => {
  const admissionAst = {
    type: 'any-of', label: 'Admission Requirement',
    items: [
      { type: 'score', name: 'SAT', op: 'gte', value: 1200 },
      { type: 'all-of', items: [
        { type: 'score', name: 'SAT', op: 'gte', value: 1100 },
        { type: 'attainment', name: 'PRAXIS' },
      ] },
    ],
  };

  test('high SAT → met via first branch', () => {
    const opts = { attainments: { SAT: { kind: 'score', value: 1350 } } };
    const { status } = audit(admissionAst, minimalCatalog, [], opts);
    expect(status).toBe(MET);
  });

  test('moderate SAT + PRAXIS → met via second branch', () => {
    const opts = {
      attainments: {
        SAT: { kind: 'score', value: 1150 },
        PRAXIS: { kind: 'boolean', value: true },
      },
    };
    const { status } = audit(admissionAst, minimalCatalog, [], opts);
    expect(status).toBe(MET);
  });

  test('low SAT, no PRAXIS → not-met', () => {
    const opts = { attainments: { SAT: { kind: 'score', value: 1050 } } };
    const { status } = audit(admissionAst, minimalCatalog, [], opts);
    expect(status).toBe(NOT_MET);
  });
});

// ============================================================
// Except integration
// ============================================================

describe('except integration', () => {
  test('CS electives excluding specific courses', () => {
    const ast = {
      type: 'credits-from', comparison: 'at-least', credits: 6,
      source: {
        type: 'except',
        source: {
          type: 'course-filter',
          filters: [
            { field: 'subject', op: 'eq', value: 'CMPS' },
            { field: 'number', op: 'gte', value: 300 },
          ],
        },
        exclude: [
          { type: 'course', subject: 'CMPS', number: '491' },
          { type: 'course', subject: 'CMPS', number: '492' },
        ],
      },
    };
    const { status, result } = audit(ast, minimalCatalog, seniorComplete);
    expect(status).toBe(MET);
    // Credits should exclude 491 and 492 (capstone)
    // Available: 310(3), 320(3), 350(3), 360(3), 380(3) = 15
    expect(result.creditsEarned).toBeGreaterThanOrEqual(6);
  });
});

// ============================================================
// Parse-and-audit contract (F10)
// ============================================================

describe('parse-and-audit contract', () => {
  test('parsed all-of requirement audits correctly', () => {
    const ast = parse('all of (MATH 101, CMPS 130)');
    const { status } = audit(ast, minimalCatalog, seniorComplete);
    expect(status).toBe(MET);
  });

  test('parsed n-of requirement audits correctly', () => {
    const ast = parse('at least 2 of (MATH 101, MATH 151, CMPS 130)');
    const { status, result } = audit(ast, minimalCatalog, seniorComplete);
    expect(status).toBe(MET);
    expect(result.summary.met).toBeGreaterThanOrEqual(2);
  });

  test('parsed requirement against empty transcript → not-met', () => {
    const ast = parse('all of (MATH 101, CMPS 130)');
    const { status } = audit(ast, minimalCatalog, []);
    expect(status).toBe(NOT_MET);
  });
});
