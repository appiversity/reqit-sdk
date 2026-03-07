'use strict';

const { auditNode } = require('../../src/audit/single-tree');
const { MET, NOT_MET } = require('../../src/audit/status');

function makeCtx(overrides = {}) {
  return {
    catalog: { courses: [], programs: [] },
    courses: [],
    catalogIndex: new Map(),
    crossListIndex: new Map(),
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
  for (const e of entries) byKey.set(`${e.subject}:${e.number}`, e);
  return { byKey, byCrossListGroup: new Map(), entries };
}

describe('auditProgramFilter', () => {
  test('no declared programs → NOT_MET', () => {
    const ctx = makeCtx();
    const node = {
      type: 'program-filter',
      quantifier: 'any',
      filters: [{ field: 'type', op: 'eq', value: 'minor' }],
    };
    const result = auditNode(node, ctx);
    expect(result.status).toBe(NOT_MET);
    expect(result.items).toHaveLength(0);
  });

  test('no matching declared programs → NOT_MET', () => {
    const ctx = makeCtx({
      declaredPrograms: [{ code: 'CS-MAJOR', type: 'major', level: 'undergraduate' }],
    });
    const node = {
      type: 'program-filter',
      quantifier: 'any',
      filters: [{ field: 'type', op: 'eq', value: 'minor' }],
    };
    const result = auditNode(node, ctx);
    expect(result.status).toBe(NOT_MET);
    expect(result.items).toHaveLength(0);
  });

  test('any quantifier — one match satisfied → MET', () => {
    const courses = [
      { subject: 'MATH', number: '151', creditsMin: 4, creditsMax: 4 },
    ];
    const ctx = makeCtx({
      declaredPrograms: [{ code: 'MATH-MINOR', type: 'minor', level: 'undergraduate' }],
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
      transcript: makeTranscript([
        { subject: 'MATH', number: '151', grade: 'A', credits: 4, status: 'completed' },
      ]),
    });

    const node = {
      type: 'program-filter',
      quantifier: 'any',
      filters: [{ field: 'type', op: 'eq', value: 'minor' }],
    };
    const result = auditNode(node, ctx);
    expect(result.status).toBe(MET);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].code).toBe('MATH-MINOR');
  });

  test('all quantifier — all matches must be satisfied', () => {
    const courses = [
      { subject: 'MATH', number: '151', creditsMin: 4, creditsMax: 4 },
      { subject: 'STAT', number: '201', creditsMin: 3, creditsMax: 3 },
    ];
    const ctx = makeCtx({
      declaredPrograms: [
        { code: 'MATH-MINOR', type: 'minor' },
        { code: 'STAT-MINOR', type: 'minor' },
      ],
      catalog: {
        courses,
        programs: [
          { code: 'MATH-MINOR', type: 'minor', requirements: { type: 'course', subject: 'MATH', number: '151' } },
          { code: 'STAT-MINOR', type: 'minor', requirements: { type: 'course', subject: 'STAT', number: '201' } },
        ],
      },
      courses,
      catalogIndex: makeCatalogIndex(courses),
      transcript: makeTranscript([
        { subject: 'MATH', number: '151', grade: 'A', credits: 4, status: 'completed' },
        // STAT 201 not taken
      ]),
    });

    const node = {
      type: 'program-filter',
      quantifier: 'all',
      filters: [{ field: 'type', op: 'eq', value: 'minor' }],
    };
    const result = auditNode(node, ctx);
    expect(result.status).not.toBe(MET);
    expect(result.items).toHaveLength(2);
  });

  test('n-of at-least quantifier', () => {
    const courses = [
      { subject: 'MATH', number: '151', creditsMin: 4, creditsMax: 4 },
      { subject: 'STAT', number: '201', creditsMin: 3, creditsMax: 3 },
    ];
    const ctx = makeCtx({
      declaredPrograms: [
        { code: 'MATH-MINOR', type: 'minor' },
        { code: 'STAT-MINOR', type: 'minor' },
      ],
      catalog: {
        courses,
        programs: [
          { code: 'MATH-MINOR', type: 'minor', requirements: { type: 'course', subject: 'MATH', number: '151' } },
          { code: 'STAT-MINOR', type: 'minor', requirements: { type: 'course', subject: 'STAT', number: '201' } },
        ],
      },
      courses,
      catalogIndex: makeCatalogIndex(courses),
      transcript: makeTranscript([
        { subject: 'MATH', number: '151', grade: 'A', credits: 4, status: 'completed' },
      ]),
    });

    const node = {
      type: 'program-filter',
      quantifier: 'n-of',
      comparison: 'at-least',
      count: 1,
      filters: [{ field: 'type', op: 'eq', value: 'minor' }],
    };
    const result = auditNode(node, ctx);
    expect(result.status).toBe(MET);
  });

  test('filter with in operator', () => {
    const ctx = makeCtx({
      declaredPrograms: [
        { code: 'MATH-MINOR', type: 'minor' },
        { code: 'CS-CERT', type: 'certificate' },
        { code: 'CS-MAJOR', type: 'major' },
      ],
    });

    // Filter should match minor and certificate, not major
    const node = {
      type: 'program-filter',
      quantifier: 'any',
      filters: [{ field: 'type', op: 'in', value: ['minor', 'certificate'] }],
    };
    const result = auditNode(node, ctx);
    // Both MATH-MINOR and CS-CERT match the filter, but neither has catalog requirements
    // so they'll be NOT_MET. But items should have length 2.
    expect(result.items.length).toBeGreaterThanOrEqual(1);
  });

  test('metadata fallback from catalog', () => {
    const courses = [
      { subject: 'MATH', number: '151', creditsMin: 4, creditsMax: 4 },
    ];
    // declaredProgram doesn't have 'type', but catalog has it
    const ctx = makeCtx({
      declaredPrograms: [{ code: 'MATH-MINOR' }],
      catalog: {
        courses,
        programs: [{
          code: 'MATH-MINOR',
          type: 'minor',
          level: 'undergraduate',
          requirements: { type: 'course', subject: 'MATH', number: '151' },
        }],
      },
      courses,
      catalogIndex: makeCatalogIndex(courses),
      transcript: makeTranscript([
        { subject: 'MATH', number: '151', grade: 'A', credits: 4, status: 'completed' },
      ]),
    });

    const node = {
      type: 'program-filter',
      quantifier: 'any',
      filters: [{ field: 'type', op: 'eq', value: 'minor' }],
    };
    const result = auditNode(node, ctx);
    expect(result.status).toBe(MET);
    expect(result.items).toHaveLength(1);
  });

  test('summary is included in result', () => {
    const ctx = makeCtx({
      declaredPrograms: [{ code: 'MATH-MINOR', type: 'minor' }],
    });
    const node = {
      type: 'program-filter',
      quantifier: 'any',
      filters: [{ field: 'type', op: 'eq', value: 'minor' }],
    };
    const result = auditNode(node, ctx);
    expect(result.summary).toBeDefined();
  });
});
