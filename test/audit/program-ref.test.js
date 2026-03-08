'use strict';

const { auditNode } = require('../../src/audit/single-tree');
const { MET, NOT_MET, PROVISIONAL_MET } = require('../../src/audit/status');

/**
 * Helper: build a minimal audit context for program-ref tests.
 */
function makeProgramIndex(programs) {
  const idx = new Map();
  for (const p of programs) idx.set(p.code, p);
  return idx;
}

function makeCtx(overrides = {}) {
  const programs = (overrides.catalog && overrides.catalog.programs) || [];
  return {
    catalog: {
      courses: [
        { subject: 'MATH', number: '151', title: 'Calc I', creditsMin: 4, creditsMax: 4 },
        { subject: 'MATH', number: '152', title: 'Calc II', creditsMin: 4, creditsMax: 4 },
        { subject: 'STAT', number: '201', title: 'Stats', creditsMin: 3, creditsMax: 3 },
      ],
      programs: [],
    },
    courses: [],
    catalogIndex: new Map(),
    crossListIndex: new Map(),
    programIndex: makeProgramIndex(programs),
    transcript: { byKey: new Map(), byCrossListGroup: new Map(), entries: [] },
    gradeConfig: { scale: [{ grade: 'A', points: 4 }, { grade: 'B', points: 3 }, { grade: 'C', points: 2 }, { grade: 'D', points: 1 }, { grade: 'F', points: 0 }], passFail: [], withdrawal: ['W'], incomplete: ['I'] },
    defs: new Map(),
    expanding: new Set(),
    attainments: {},
    backtrack: false,
    warnings: [],
    declaredPrograms: [],
    visitedPrograms: new Set(),
    programCache: new Map(),
    ...overrides,
  };
}

function makeCatalogIndex(courses) {
  const idx = new Map();
  for (const c of courses) idx.set(`${c.subject}:${c.number}`, c);
  return idx;
}

function makeTranscript(entries) {
  const byKey = new Map();
  for (const e of entries) {
    byKey.set(`${e.subject}:${e.number}`, e);
  }
  return { byKey, byCrossListGroup: new Map(), entries };
}

describe('auditProgramRef', () => {
  test('not declared → NOT_MET with notDeclared flag', () => {
    const ctx = makeCtx();
    const result = auditNode({ type: 'program-ref', code: 'MATH-MINOR' }, ctx);
    expect(result.status).toBe(NOT_MET);
    expect(result.notDeclared).toBe(true);
    expect(result.code).toBe('MATH-MINOR');
  });

  test('declared but no catalog entry → NOT_MET with warning', () => {
    const ctx = makeCtx({
      declaredPrograms: [{ code: 'MATH-MINOR', type: 'minor', level: 'undergraduate' }],
    });
    const result = auditNode({ type: 'program-ref', code: 'MATH-MINOR' }, ctx);
    expect(result.status).toBe(NOT_MET);
    expect(ctx.warnings.some(w => w.type === 'program-ref-no-requirements')).toBe(true);
  });

  test('declared + catalog entry with no requirements → NOT_MET with warning', () => {
    const ctx = makeCtx({
      declaredPrograms: [{ code: 'MATH-MINOR', type: 'minor' }],
      catalog: {
        courses: [],
        programs: [{ code: 'MATH-MINOR', type: 'minor' }],
      },
    });
    const result = auditNode({ type: 'program-ref', code: 'MATH-MINOR' }, ctx);
    expect(result.status).toBe(NOT_MET);
    expect(ctx.warnings.some(w => w.type === 'program-ref-no-requirements')).toBe(true);
  });

  test('declared + satisfied sub-audit → MET with result tree', () => {
    const courses = [
      { subject: 'MATH', number: '151', title: 'Calc I', creditsMin: 4, creditsMax: 4 },
    ];
    const transcript = makeTranscript([
      { subject: 'MATH', number: '151', grade: 'A', credits: 4, status: 'completed' },
    ]);

    const ctx = makeCtx({
      declaredPrograms: [{ code: 'MATH-MINOR', type: 'minor' }],
      catalog: {
        courses,
        programs: [{
          code: 'MATH-MINOR',
          type: 'minor',
          requirements: { type: 'course', subject: 'MATH', number: '151' },
        }],
      },
      courses,
      catalogIndex: makeCatalogIndex(courses),
      transcript,
    });

    const result = auditNode({ type: 'program-ref', code: 'MATH-MINOR' }, ctx);
    expect(result.status).toBe(MET);
    expect(result.code).toBe('MATH-MINOR');
    expect(result.result).toBeDefined();
    expect(result.result.type).toBe('course');
    expect(result.result.status).toBe(MET);
  });

  test('declared + partial sub-audit → NOT_MET', () => {
    const courses = [
      { subject: 'MATH', number: '151', title: 'Calc I', creditsMin: 4, creditsMax: 4 },
      { subject: 'MATH', number: '152', title: 'Calc II', creditsMin: 4, creditsMax: 4 },
    ];
    const transcript = makeTranscript([
      { subject: 'MATH', number: '151', grade: 'A', credits: 4, status: 'completed' },
    ]);

    const ctx = makeCtx({
      declaredPrograms: [{ code: 'MATH-MINOR', type: 'minor' }],
      catalog: {
        courses,
        programs: [{
          code: 'MATH-MINOR',
          type: 'minor',
          requirements: {
            type: 'all-of',
            items: [
              { type: 'course', subject: 'MATH', number: '151' },
              { type: 'course', subject: 'MATH', number: '152' },
            ],
          },
        }],
      },
      courses,
      catalogIndex: makeCatalogIndex(courses),
      transcript,
    });

    const result = auditNode({ type: 'program-ref', code: 'MATH-MINOR' }, ctx);
    // all-of with one met and one not-met → partial-progress
    expect(result.status).not.toBe(MET);
    expect(result.result).toBeDefined();
    expect(result.result.type).toBe('all-of');
  });

  test('circular reference → NOT_MET with warning', () => {
    const ctx = makeCtx({
      declaredPrograms: [{ code: 'A' }],
      catalog: {
        courses: [],
        programs: [{
          code: 'A',
          requirements: { type: 'program-ref', code: 'A' },
        }],
      },
    });

    const result = auditNode({ type: 'program-ref', code: 'A' }, ctx);
    expect(result.status).toBe(NOT_MET);
    expect(ctx.warnings.some(w => w.type === 'circular-program-ref')).toBe(true);
  });

  test('program-ref inside composite', () => {
    const courses = [
      { subject: 'MATH', number: '151', title: 'Calc I', creditsMin: 4, creditsMax: 4 },
    ];
    const transcript = makeTranscript([
      { subject: 'MATH', number: '151', grade: 'A', credits: 4, status: 'completed' },
    ]);

    const ctx = makeCtx({
      declaredPrograms: [{ code: 'MATH-MINOR', type: 'minor' }],
      catalog: {
        courses,
        programs: [{
          code: 'MATH-MINOR',
          type: 'minor',
          requirements: { type: 'course', subject: 'MATH', number: '151' },
        }],
      },
      courses,
      catalogIndex: makeCatalogIndex(courses),
      transcript,
    });

    const ast = {
      type: 'all-of',
      items: [
        { type: 'program-ref', code: 'MATH-MINOR' },
        { type: 'course', subject: 'MATH', number: '151' },
      ],
    };

    const result = auditNode(ast, ctx);
    expect(result.type).toBe('all-of');
    expect(result.status).toBe(MET);
    expect(result.items[0].type).toBe('program-ref');
    expect(result.items[0].status).toBe(MET);
  });

  test('caching: same program referenced twice uses cache', () => {
    const courses = [
      { subject: 'MATH', number: '151', title: 'Calc I', creditsMin: 4, creditsMax: 4 },
    ];
    const transcript = makeTranscript([
      { subject: 'MATH', number: '151', grade: 'A', credits: 4, status: 'completed' },
    ]);

    const ctx = makeCtx({
      declaredPrograms: [{ code: 'MATH-MINOR', type: 'minor' }],
      catalog: {
        courses,
        programs: [{
          code: 'MATH-MINOR',
          type: 'minor',
          requirements: { type: 'course', subject: 'MATH', number: '151' },
        }],
      },
      courses,
      catalogIndex: makeCatalogIndex(courses),
      transcript,
    });

    const result1 = auditNode({ type: 'program-ref', code: 'MATH-MINOR' }, ctx);
    const result2 = auditNode({ type: 'program-ref', code: 'MATH-MINOR' }, ctx);

    // Should be the exact same object from cache
    expect(result1).toBe(result2);
    expect(result1.status).toBe(MET);
  });
});
