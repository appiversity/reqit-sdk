'use strict';

const { parse } = require('../../../src/parser');
const { audit } = require('../../../src/audit');
const { Catalog } = require('../../../src/entities');
const { waiver } = require('../../../src/audit/exceptions');
const { WAIVED } = require('../../../src/audit/status');

/**
 * Integration test: BS-DATA program that requires a MATH-MINOR.
 * Tests the full pipeline from parse → audit with declaredPrograms.
 */
describe('program-reference integration — BS-DATA with MATH-MINOR', () => {
  const catalog = new Catalog({
    institution: 'TEST',
    ay: '2025-2026',
    courses: [
      { subject: 'DATA', number: '101', title: 'Intro to Data Science', creditsMin: 3, creditsMax: 3 },
      { subject: 'DATA', number: '201', title: 'Data Analysis', creditsMin: 3, creditsMax: 3 },
      { subject: 'MATH', number: '151', title: 'Calculus I', creditsMin: 4, creditsMax: 4 },
      { subject: 'MATH', number: '152', title: 'Calculus II', creditsMin: 4, creditsMax: 4 },
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
    gradeConfig: {
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
    },
  });

  test('BS-DATA with MATH-MINOR satisfied', () => {
    const ast = parse('all of (DATA 101, DATA 201, program "MATH-MINOR")');
    const transcript = [
      { subject: 'DATA', number: '101', grade: 'A', credits: 3, status: 'completed' },
      { subject: 'DATA', number: '201', grade: 'B', credits: 3, status: 'completed' },
      { subject: 'MATH', number: '151', grade: 'A', credits: 4, status: 'completed' },
      { subject: 'MATH', number: '152', grade: 'B', credits: 4, status: 'completed' },
    ];

    const result = audit(ast, catalog.data, transcript, {
      declaredPrograms: [{ code: 'MATH-MINOR', type: 'minor', level: 'undergraduate' }],
    });

    expect(result.status).toBe('met');
    expect(result.result.items[2].type).toBe('program-ref');
    expect(result.result.items[2].status).toBe('met');
    expect(result.result.items[2].result).toBeDefined();
    expect(result.result.items[2].result.type).toBe('all-of');
    expect(result.result.items[2].result.status).toBe('met');
  });

  test('BS-DATA with MATH-MINOR not declared', () => {
    const ast = parse('all of (DATA 101, program "MATH-MINOR")');
    const transcript = [
      { subject: 'DATA', number: '101', grade: 'A', credits: 3, status: 'completed' },
    ];

    const result = audit(ast, catalog.data, transcript, {
      // No declaredPrograms
    });

    expect(result.status).not.toBe('met');
    expect(result.result.items[1].type).toBe('program-ref');
    expect(result.result.items[1].notDeclared).toBe(true);
  });

  test('BS-DATA with MATH-MINOR partially complete', () => {
    const ast = parse('all of (DATA 101, program "MATH-MINOR")');
    const transcript = [
      { subject: 'DATA', number: '101', grade: 'A', credits: 3, status: 'completed' },
      { subject: 'MATH', number: '151', grade: 'A', credits: 4, status: 'completed' },
      // MATH 152 not taken
    ];

    const result = audit(ast, catalog.data, transcript, {
      declaredPrograms: [{ code: 'MATH-MINOR', type: 'minor' }],
    });

    expect(result.status).not.toBe('met');
    const programRef = result.result.items[1];
    expect(programRef.type).toBe('program-ref');
    expect(programRef.status).not.toBe('met');
    // Sub-audit has partial results
    expect(programRef.result.items[0].status).toBe('met');    // MATH 151
    expect(programRef.result.items[1].status).toBe('not-met'); // MATH 152
  });

  test('program-filter: any program where type = "minor"', () => {
    const ast = parse('all of (DATA 101, any program where type = "minor")');
    const transcript = [
      { subject: 'DATA', number: '101', grade: 'A', credits: 3, status: 'completed' },
      { subject: 'MATH', number: '151', grade: 'A', credits: 4, status: 'completed' },
      { subject: 'MATH', number: '152', grade: 'B', credits: 4, status: 'completed' },
    ];

    const result = audit(ast, catalog.data, transcript, {
      declaredPrograms: [{ code: 'MATH-MINOR', type: 'minor', level: 'undergraduate' }],
    });

    expect(result.status).toBe('met');
    const pf = result.result.items[1];
    expect(pf.type).toBe('program-filter');
    expect(pf.status).toBe('met');
    expect(pf.items).toHaveLength(1);
    expect(pf.items[0].code).toBe('MATH-MINOR');
    expect(pf.items[0].status).toBe('met');
  });
});

describe('waivers in program-ref sub-audits', () => {
  // Waivers are institution-level decisions that apply regardless of which
  // program tree is being evaluated. A waiver for MATH 152 applies inside
  // a MATH-MINOR sub-audit just as it does in the parent program.
  const catalog = new Catalog({
    institution: 'TEST',
    ay: '2025-2026',
    courses: [
      { subject: 'DATA', number: '101', title: 'Intro', creditsMin: 3, creditsMax: 3 },
      { subject: 'MATH', number: '151', title: 'Calc I', creditsMin: 4, creditsMax: 4 },
      { subject: 'MATH', number: '152', title: 'Calc II', creditsMin: 4, creditsMax: 4 },
    ],
    programs: [
      {
        code: 'MATH-MINOR',
        type: 'minor',
        level: 'undergraduate',
        requirements: parse('all of (MATH 151, MATH 152)'),
      },
    ],
    gradeConfig: {
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
    },
  });

  test('waiver for sub-audit course applies inside program-ref', () => {
    const ast = parse('all of (DATA 101, program "MATH-MINOR")');
    const transcript = [
      { subject: 'DATA', number: '101', grade: 'A', credits: 3, status: 'completed' },
      { subject: 'MATH', number: '151', grade: 'A', credits: 4, status: 'completed' },
      // MATH 152 not taken — but waived
    ];

    const w = waiver({ course: { subject: 'MATH', number: '152' }, reason: 'Transfer credit' });
    const result = audit(ast, catalog.data, transcript, {
      declaredPrograms: [{ code: 'MATH-MINOR', type: 'minor' }],
      exceptions: [w],
    });

    expect(result.status).toBe('met');
    // The program-ref sub-audit should show MATH 152 as waived
    const programRef = result.result.items[1];
    expect(programRef.type).toBe('program-ref');
    expect(programRef.status).toBe('met');
    const math152 = programRef.result.items[1];
    expect(math152.subject).toBe('MATH');
    expect(math152.number).toBe('152');
    expect(math152.status).toBe(WAIVED);
  });
});

describe('Catalog.findPrograms', () => {
  const catalog = new Catalog({
    institution: 'TEST',
    ay: '2025-2026',
    courses: [{ subject: 'X', number: '1', creditsMin: 1, creditsMax: 1 }],
    programs: [
      { code: 'CS-MAJOR', type: 'major', level: 'undergraduate' },
      { code: 'MATH-MINOR', type: 'minor', level: 'undergraduate' },
      { code: 'STAT-MINOR', type: 'minor', level: 'undergraduate' },
      { code: 'MBA', type: 'major', level: 'graduate' },
    ],
  });

  test('no filter → returns all programs', () => {
    expect(catalog.findPrograms()).toHaveLength(4);
    expect(catalog.findPrograms({})).toHaveLength(4);
  });

  test('filter by type', () => {
    const minors = catalog.findPrograms({ type: 'minor' });
    expect(minors).toHaveLength(2);
    expect(minors.every(p => p.type === 'minor')).toBe(true);
  });

  test('filter by level', () => {
    const grad = catalog.findPrograms({ level: 'graduate' });
    expect(grad).toHaveLength(1);
    expect(grad[0].code).toBe('MBA');
  });

  test('filter by code', () => {
    const result = catalog.findPrograms({ code: 'CS-MAJOR' });
    expect(result).toHaveLength(1);
  });

  test('combined filter', () => {
    const result = catalog.findPrograms({ type: 'minor', level: 'undergraduate' });
    expect(result).toHaveLength(2);
  });

  test('no matches', () => {
    expect(catalog.findPrograms({ type: 'certificate' })).toHaveLength(0);
  });
});
