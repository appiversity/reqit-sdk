'use strict';

const { audit, MET, PROVISIONAL_MET, NOT_MET } = require('../../src/audit');
const minimalCatalog = require('../fixtures/catalogs/minimal.json');

const complete = require('../fixtures/transcripts/minimal/complete.json');
const empty = require('../fixtures/transcripts/minimal/empty.json');
const partial = require('../fixtures/transcripts/minimal/partial.json');
const inProgress = require('../fixtures/transcripts/minimal/in-progress.json');

// ============================================================
// except
// ============================================================

describe('except', () => {
  test('source matched, exclude not matched → met', () => {
    const ast = {
      type: 'except',
      source: {
        type: 'course-filter',
        filters: [{ field: 'subject', op: 'eq', value: 'MATH' }],
      },
      exclude: [
        { type: 'course', subject: 'MATH', number: '250' },
      ],
    };
    // Complete has MATH 101, 151, 152, 250 — after excluding 250,
    // there are still matched courses
    const { status, result } = audit(ast, minimalCatalog, complete);
    expect(status).toBe(MET);
    // matchedCourses should not contain MATH 250
    const excluded = result.matchedCourses.find(
      c => c.subject === 'MATH' && c.number === '250'
    );
    expect(excluded).toBeUndefined();
  });

  test('all source courses excluded → not-met', () => {
    // Partial has MATH 101, MATH 151 only in MATH
    const ast = {
      type: 'except',
      source: {
        type: 'course-filter',
        filters: [{ field: 'subject', op: 'eq', value: 'MATH' }],
      },
      exclude: [
        { type: 'course', subject: 'MATH', number: '101' },
        { type: 'course', subject: 'MATH', number: '151' },
      ],
    };
    const { status } = audit(ast, minimalCatalog, partial);
    expect(status).toBe(NOT_MET);
  });

  test('source not matched → not-met', () => {
    const ast = {
      type: 'except',
      source: {
        type: 'course-filter',
        filters: [{ field: 'subject', op: 'eq', value: 'PHYS' }],
      },
      exclude: [],
    };
    const { status } = audit(ast, minimalCatalog, empty);
    expect(status).toBe(NOT_MET);
  });

  test('source has in-progress, completed excluded → in-progress', () => {
    // In-progress transcript: MATH 101 (completed), MATH 151 (completed), MATH 152 (ip)
    // Exclude MATH 101 and MATH 151 — only MATH 152 (ip) remains
    const ast = {
      type: 'except',
      source: {
        type: 'course-filter',
        filters: [{ field: 'subject', op: 'eq', value: 'MATH' }],
      },
      exclude: [
        { type: 'course', subject: 'MATH', number: '101' },
        { type: 'course', subject: 'MATH', number: '151' },
      ],
    };
    const { status } = audit(ast, minimalCatalog, inProgress);
    expect(status).toBe(PROVISIONAL_MET);
  });

  test('result shape includes source and exclude results', () => {
    const ast = {
      type: 'except',
      source: {
        type: 'course-filter',
        filters: [{ field: 'subject', op: 'eq', value: 'MATH' }],
      },
      exclude: [
        { type: 'course', subject: 'MATH', number: '250' },
      ],
    };
    const { result } = audit(ast, minimalCatalog, complete);
    expect(result.type).toBe('except');
    expect(result.source).toBeDefined();
    expect(result.source.type).toBe('course-filter');
    expect(result.exclude).toHaveLength(1);
    expect(result.exclude[0].type).toBe('course');
  });

  test('except with explicit course source', () => {
    // Source is an any-of with specific courses
    const ast = {
      type: 'except',
      source: {
        type: 'any-of',
        items: [
          { type: 'course', subject: 'CMPS', number: '130' },
          { type: 'course', subject: 'CMPS', number: '135' },
          { type: 'course', subject: 'CMPS', number: '230' },
        ],
      },
      exclude: [
        { type: 'course', subject: 'CMPS', number: '130' },
      ],
    };
    const { status, result } = audit(ast, minimalCatalog, complete);
    expect(status).toBe(MET);
    // CMPS 130 excluded; CMPS 135 and 230 remain
    const hasExcluded = result.matchedCourses.some(
      c => c.subject === 'CMPS' && c.number === '130'
    );
    expect(hasExcluded).toBe(false);
  });
});

// ============================================================
// Variable-ref in composite context
// ============================================================

describe('variable-ref in composite context', () => {
  test('variable-ref used inside all-of → resolves correctly', () => {
    const ast = {
      type: 'scope', name: 'cs',
      defs: [
        { type: 'variable-def', name: 'math_core',
          value: {
            type: 'all-of',
            items: [
              { type: 'course', subject: 'MATH', number: '101' },
              { type: 'course', subject: 'MATH', number: '151' },
            ],
          } },
      ],
      body: {
        type: 'all-of',
        items: [
          { type: 'variable-ref', name: 'math_core' },
          { type: 'course', subject: 'CMPS', number: '130' },
        ],
      },
    };
    const { status, result } = audit(ast, minimalCatalog, complete);
    expect(status).toBe(MET);
    expect(result.items[0].type).toBe('variable-ref');
    expect(result.items[0].status).toBe(MET);
    expect(result.items[0].resolved.type).toBe('all-of');
  });

  test('variable-ref to course-filter', () => {
    const ast = {
      type: 'scope', name: 'cs',
      defs: [
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
        type: 'credits-from', comparison: 'at-least', credits: 9,
        source: { type: 'variable-ref', name: 'electives' },
      },
    };
    const { status, result } = audit(ast, minimalCatalog, complete);
    expect(status).toBe(MET);
    expect(result.creditsEarned).toBeGreaterThanOrEqual(9);
  });

  test('multiple variable-refs to same def reuse resolution', () => {
    const ast = {
      type: 'scope', name: 'test',
      defs: [
        { type: 'variable-def', name: 'intro',
          value: { type: 'course', subject: 'CMPS', number: '130' } },
      ],
      body: {
        type: 'all-of',
        items: [
          { type: 'variable-ref', name: 'intro' },
          { type: 'all-of', items: [
            { type: 'variable-ref', name: 'intro' },
          ] },
        ],
      },
    };
    const { status, result } = audit(ast, minimalCatalog, complete);
    expect(status).toBe(MET);
    // Both refs should resolve to met
    expect(result.items[0].status).toBe(MET);
    expect(result.items[1].items[0].status).toBe(MET);
  });
});

// ============================================================
// Scope with defs
// ============================================================

describe('scope', () => {
  test('scope body is audited directly', () => {
    const ast = {
      type: 'scope', name: 'cs',
      defs: [],
      body: { type: 'course', subject: 'MATH', number: '101' },
    };
    const { status } = audit(ast, minimalCatalog, complete);
    expect(status).toBe(MET);
  });

  test('nested scopes resolve vars correctly', () => {
    const ast = {
      type: 'scope', name: 'outer',
      defs: [
        { type: 'variable-def', name: 'x',
          value: { type: 'course', subject: 'MATH', number: '101' } },
      ],
      body: {
        type: 'scope', name: 'inner',
        defs: [
          { type: 'variable-def', name: 'y',
            value: { type: 'course', subject: 'CMPS', number: '130' } },
        ],
        body: {
          type: 'all-of',
          items: [
            { type: 'variable-ref', name: 'x' },
            { type: 'variable-ref', name: 'y' },
          ],
        },
      },
    };
    const { status } = audit(ast, minimalCatalog, complete);
    expect(status).toBe(MET);
  });
});
