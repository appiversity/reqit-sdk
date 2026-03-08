'use strict';

/**
 * Integration tests using the Lehigh catalog.
 * Focus: cross-listing, variable references, realistic CSE major structure.
 */

const { audit, findUnmet, MET, PROVISIONAL_MET, IN_PROGRESS, NOT_MET } = require('../../../src/audit');
const lehighCatalog = require('../../fixtures/catalogs/lehigh.json');

// Simplified CSE major AST using Lehigh's catalog
const cseMajorAst = {
  type: 'scope', name: 'cse-major',
  defs: [
    { type: 'variable-def', name: 'intro_programming',
      value: {
        type: 'any-of', label: 'Intro Programming',
        items: [
          { type: 'all-of', items: [
            { type: 'course', subject: 'CSE', number: '003' },
            { type: 'course', subject: 'CSE', number: '004' },
          ] },
          { type: 'course', subject: 'CSE', number: '007' },
        ],
      } },
    { type: 'variable-def', name: 'calculus',
      value: {
        type: 'any-of', label: 'Calculus I',
        items: [
          { type: 'course', subject: 'MATH', number: '021' },
          { type: 'course', subject: 'MATH', number: '031' },
          { type: 'course', subject: 'MATH', number: '076' },
        ],
      } },
  ],
  body: {
    type: 'all-of', label: 'B.S. CSE Core',
    items: [
      { type: 'variable-ref', name: 'intro_programming' },
      { type: 'variable-ref', name: 'calculus' },
      { type: 'course', subject: 'MATH', number: '022' },
      { type: 'course', subject: 'CSE', number: '017' },
      { type: 'course', subject: 'CSE', number: '109' },
      { type: 'course', subject: 'CSE', number: '140' },
      { type: 'course', subject: 'CSE', number: '340' },  // cross-listed with MATH 340
      { type: 'course', subject: 'CSE', number: '280' },
      { type: 'course', subject: 'CSE', number: '281' },
    ],
  },
};

// ============================================================
// Transcripts
// ============================================================

const seniorComplete = [
  { subject: 'CSE', number: '007', grade: 'A',  credits: 4, term: 'Fall 2022', status: 'completed' },
  { subject: 'MATH', number: '021', grade: 'B+', credits: 4, term: 'Fall 2022', status: 'completed' },
  { subject: 'MATH', number: '022', grade: 'B',  credits: 4, term: 'Spring 2023', status: 'completed' },
  { subject: 'CSE', number: '017', grade: 'A-', credits: 4, term: 'Spring 2023', status: 'completed' },
  { subject: 'CSE', number: '109', grade: 'B+', credits: 4, term: 'Fall 2023', status: 'completed' },
  { subject: 'CSE', number: '140', grade: 'A',  credits: 4, term: 'Fall 2023', status: 'completed' },
  { subject: 'CSE', number: '340', grade: 'B',  credits: 4, term: 'Spring 2024', status: 'completed' },
  { subject: 'CSE', number: '280', grade: 'A-', credits: 4, term: 'Fall 2024', status: 'completed' },
  { subject: 'CSE', number: '281', grade: 'A',  credits: 4, term: 'Spring 2025', status: 'completed' },
];

const crossListedEquivalent = [
  { subject: 'CSE', number: '007', grade: 'A',  credits: 4, term: 'Fall 2022', status: 'completed' },
  { subject: 'MATH', number: '021', grade: 'B+', credits: 4, term: 'Fall 2022', status: 'completed' },
  { subject: 'MATH', number: '022', grade: 'B',  credits: 4, term: 'Spring 2023', status: 'completed' },
  { subject: 'CSE', number: '017', grade: 'A-', credits: 4, term: 'Spring 2023', status: 'completed' },
  { subject: 'CSE', number: '109', grade: 'B+', credits: 4, term: 'Fall 2023', status: 'completed' },
  { subject: 'CSE', number: '140', grade: 'A',  credits: 4, term: 'Fall 2023', status: 'completed' },
  // Student took MATH 340 instead of CSE 340 — cross-listed
  { subject: 'MATH', number: '340', grade: 'A-', credits: 4, term: 'Spring 2024', status: 'completed' },
  { subject: 'CSE', number: '280', grade: 'A-', credits: 4, term: 'Fall 2024', status: 'completed' },
  { subject: 'CSE', number: '281', grade: 'A',  credits: 4, term: 'Spring 2025', status: 'completed' },
];

const missingCapstone = [
  { subject: 'CSE', number: '007', grade: 'A',  credits: 4, term: 'Fall 2022', status: 'completed' },
  { subject: 'MATH', number: '021', grade: 'B+', credits: 4, term: 'Fall 2022', status: 'completed' },
  { subject: 'MATH', number: '022', grade: 'B',  credits: 4, term: 'Spring 2023', status: 'completed' },
  { subject: 'CSE', number: '017', grade: 'A-', credits: 4, term: 'Spring 2023', status: 'completed' },
  { subject: 'CSE', number: '109', grade: 'B+', credits: 4, term: 'Fall 2023', status: 'completed' },
  { subject: 'CSE', number: '140', grade: 'A',  credits: 4, term: 'Fall 2023', status: 'completed' },
  { subject: 'CSE', number: '340', grade: 'B',  credits: 4, term: 'Spring 2024', status: 'completed' },
  // Missing CSE 280 and 281
];

const altPath = [
  // Took CSE 003 + 004 instead of CSE 007
  { subject: 'CSE', number: '003', grade: 'A',  credits: 2, term: 'Fall 2022', status: 'completed' },
  { subject: 'CSE', number: '004', grade: 'B+', credits: 2, term: 'Fall 2022', status: 'completed' },
  // Took MATH 031 instead of MATH 021
  { subject: 'MATH', number: '031', grade: 'A-', credits: 4, term: 'Fall 2022', status: 'completed' },
  { subject: 'MATH', number: '022', grade: 'B',  credits: 4, term: 'Spring 2023', status: 'completed' },
  { subject: 'CSE', number: '017', grade: 'A-', credits: 4, term: 'Spring 2023', status: 'completed' },
  { subject: 'CSE', number: '109', grade: 'B+', credits: 4, term: 'Fall 2023', status: 'completed' },
  { subject: 'CSE', number: '140', grade: 'A',  credits: 4, term: 'Fall 2023', status: 'completed' },
  { subject: 'CSE', number: '340', grade: 'B',  credits: 4, term: 'Spring 2024', status: 'completed' },
  { subject: 'CSE', number: '280', grade: 'A-', credits: 4, term: 'Fall 2024', status: 'completed' },
  { subject: 'CSE', number: '281', grade: 'A',  credits: 4, term: 'Spring 2025', status: 'completed' },
];

// ============================================================
// Tests
// ============================================================

describe('Lehigh CSE Major — end-to-end', () => {
  test('senior complete → met', () => {
    const { status } = audit(cseMajorAst, lehighCatalog, seniorComplete);
    expect(status).toBe(MET);
  });

  test('cross-listed MATH 340 satisfies CSE 340 requirement → met', () => {
    const { status, warnings } = audit(cseMajorAst, lehighCatalog, crossListedEquivalent);
    expect(status).toBe(MET);
    // Should have cross-listed-match warning
    const xlWarnings = warnings.filter(w => w.type === 'cross-listed-match');
    expect(xlWarnings).toHaveLength(1);
    expect(xlWarnings[0].subject).toBe('CSE');
    expect(xlWarnings[0].number).toBe('340');
    expect(xlWarnings[0].matchedSubject).toBe('MATH');
  });

  test('missing capstone → partial-progress', () => {
    const { status, result } = audit(cseMajorAst, lehighCatalog, missingCapstone);
    expect(status).toBe(IN_PROGRESS);
    // CSE 280 and 281 should be unmet
    const unmet = findUnmet(result);
    const capstoneUnmet = unmet.filter(
      u => u.node.subject === 'CSE' && (u.node.number === '280' || u.node.number === '281')
    );
    expect(capstoneUnmet).toHaveLength(2);
  });

  test('alternative path (CSE 003+004, MATH 031) → met', () => {
    const { status } = audit(cseMajorAst, lehighCatalog, altPath);
    expect(status).toBe(MET);
  });

  test('empty transcript → not-met', () => {
    const { status } = audit(cseMajorAst, lehighCatalog, []);
    expect(status).toBe(NOT_MET);
  });

  test('partial progress — only intro courses', () => {
    const transcript = [
      { subject: 'CSE', number: '007', grade: 'A', credits: 4, term: 'Fall 2022', status: 'completed' },
      { subject: 'MATH', number: '021', grade: 'B+', credits: 4, term: 'Fall 2022', status: 'completed' },
    ];
    const { status } = audit(cseMajorAst, lehighCatalog, transcript);
    expect(status).toBe(IN_PROGRESS);
  });

  test('in-progress capstone → in-progress', () => {
    const transcript = [
      { subject: 'CSE', number: '007', grade: 'A',  credits: 4, term: 'Fall 2022', status: 'completed' },
      { subject: 'MATH', number: '021', grade: 'B+', credits: 4, term: 'Fall 2022', status: 'completed' },
      { subject: 'MATH', number: '022', grade: 'B',  credits: 4, term: 'Spring 2023', status: 'completed' },
      { subject: 'CSE', number: '017', grade: 'A-', credits: 4, term: 'Spring 2023', status: 'completed' },
      { subject: 'CSE', number: '109', grade: 'B+', credits: 4, term: 'Fall 2023', status: 'completed' },
      { subject: 'CSE', number: '140', grade: 'A',  credits: 4, term: 'Fall 2023', status: 'completed' },
      { subject: 'CSE', number: '340', grade: 'B',  credits: 4, term: 'Spring 2024', status: 'completed' },
      { subject: 'CSE', number: '280', grade: 'A-', credits: 4, term: 'Fall 2024', status: 'completed' },
      { subject: 'CSE', number: '281', grade: null,  credits: 4, term: 'Spring 2025', status: 'in-progress' },
    ];
    const { status } = audit(cseMajorAst, lehighCatalog, transcript);
    expect(status).toBe(PROVISIONAL_MET);
  });
});
