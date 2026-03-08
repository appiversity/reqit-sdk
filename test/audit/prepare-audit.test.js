'use strict';

const { audit, prepareAudit, MET, PROVISIONAL_MET, NOT_MET } = require('../../src/audit');
const minimalCatalog = require('../fixtures/catalogs/minimal.json');

const complete = require('../fixtures/transcripts/minimal/complete.json');
const empty = require('../fixtures/transcripts/minimal/empty.json');
const partial = require('../fixtures/transcripts/minimal/partial.json');
const inProgress = require('../fixtures/transcripts/minimal/in-progress.json');

const ast = {
  type: 'all-of',
  items: [
    { type: 'course', subject: 'MATH', number: '101' },
    { type: 'course', subject: 'MATH', number: '151' },
    { type: 'course', subject: 'CMPS', number: '130' },
    { type: 'course', subject: 'CMPS', number: '135' },
  ],
};

// ============================================================
// prepareAudit
// ============================================================

describe('prepareAudit', () => {
  test('returns object with run method', () => {
    const prepared = prepareAudit(ast, minimalCatalog);
    expect(prepared).toBeDefined();
    expect(typeof prepared.run).toBe('function');
  });

  test('run() produces same result as audit()', () => {
    const prepared = prepareAudit(ast, minimalCatalog);
    const fromPrepare = prepared.run(complete);
    const fromAudit = audit(ast, minimalCatalog, complete);

    expect(fromPrepare.status).toBe(fromAudit.status);
    expect(fromPrepare.warnings).toEqual(fromAudit.warnings);
    // Deep compare result structure
    expect(fromPrepare.result.type).toBe(fromAudit.result.type);
    expect(fromPrepare.result.items.length).toBe(fromAudit.result.items.length);
    for (let i = 0; i < fromPrepare.result.items.length; i++) {
      expect(fromPrepare.result.items[i].status).toBe(fromAudit.result.items[i].status);
    }
  });

  test('run() can be called multiple times with different transcripts', () => {
    const prepared = prepareAudit(ast, minimalCatalog);

    const r1 = prepared.run(complete);
    const r2 = prepared.run(partial);
    const r3 = prepared.run(empty);

    expect(r1.status).toBe(MET);
    expect(r2.status).toBe(MET);  // All 4 courses are in partial
    expect(r3.status).toBe(NOT_MET);
  });

  test('each run() has independent warnings', () => {
    const xlCatalog = {
      ...minimalCatalog,
      courses: [
        ...minimalCatalog.courses,
        { id: 100, subject: 'CMPS', number: '340', title: 'Combinatorics',
          creditsMin: 3, creditsMax: 3, crossListGroup: 'xlg-combo' },
        { id: 101, subject: 'MATH', number: '340', title: 'Combinatorics',
          creditsMin: 3, creditsMax: 3, crossListGroup: 'xlg-combo' },
      ],
    };
    const xlAst = { type: 'course', subject: 'CMPS', number: '340' };
    const prepared = prepareAudit(xlAst, xlCatalog);

    // First run — cross-list match
    const transcript1 = [
      { subject: 'MATH', number: '340', grade: 'A', credits: 3,
        term: 'Fall 2024', status: 'completed' },
    ];
    const r1 = prepared.run(transcript1);
    expect(r1.warnings).toHaveLength(1);

    // Second run — no match, no warnings
    const r2 = prepared.run([]);
    expect(r2.warnings).toHaveLength(0);

    // Third run — cross-list match again
    const r3 = prepared.run(transcript1);
    expect(r3.warnings).toHaveLength(1);
  });

  test('run() accepts options with attainments', () => {
    const scoreAst = { type: 'score', name: 'SAT', op: 'gte', value: 1200 };
    const prepared = prepareAudit(scoreAst, minimalCatalog);

    const r1 = prepared.run(empty, { attainments: { SAT: { kind: 'score', value: 1350 } } });
    const r2 = prepared.run(empty, { attainments: { SAT: { kind: 'score', value: 1100 } } });
    const r3 = prepared.run(empty);

    expect(r1.status).toBe(MET);
    expect(r2.status).toBe(NOT_MET);
    expect(r3.status).toBe(NOT_MET);
  });

  test('batch audit of N transcripts produces correct results', () => {
    const prepared = prepareAudit(ast, minimalCatalog);

    const transcripts = [complete, partial, inProgress, empty];
    const results = transcripts.map(t => prepared.run(t));

    expect(results[0].status).toBe(MET);       // complete — all met
    expect(results[1].status).toBe(MET);        // partial — all 4 courses present
    expect(results[2].status).toBe(MET);        // in-progress — these 4 are completed
    expect(results[3].status).toBe(NOT_MET);    // empty — none met
  });
});

// ============================================================
// audit() delegates to prepareAudit()
// ============================================================

describe('audit() consistency with prepareAudit()', () => {
  const complexAst = {
    type: 'all-of',
    items: [
      { type: 'credits-from', comparison: 'at-least', credits: 6,
        source: {
          type: 'course-filter',
          filters: [{ field: 'subject', op: 'eq', value: 'MATH' }],
        },
      },
      { type: 'n-of', comparison: 'at-least', count: 2,
        items: [
          { type: 'course', subject: 'CMPS', number: '130' },
          { type: 'course', subject: 'CMPS', number: '135' },
          { type: 'course', subject: 'CMPS', number: '230' },
        ],
      },
    ],
  };

  test('identical status for complex AST', () => {
    const prepared = prepareAudit(complexAst, minimalCatalog);

    for (const transcript of [complete, partial, inProgress, empty]) {
      const fromPrepare = prepared.run(transcript);
      const fromAudit = audit(complexAst, minimalCatalog, transcript);
      expect(fromPrepare.status).toBe(fromAudit.status);
    }
  });

  test('identical credit counts for complex AST', () => {
    const prepared = prepareAudit(complexAst, minimalCatalog);
    const fromPrepare = prepared.run(complete);
    const fromAudit = audit(complexAst, minimalCatalog, complete);

    expect(fromPrepare.result.items[0].creditsEarned)
      .toBe(fromAudit.result.items[0].creditsEarned);
  });
});
