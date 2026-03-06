'use strict';

const { audit, findNextEligible, MET, NOT_MET } = require('../../src/audit');
const minimalCatalog = require('../fixtures/catalogs/minimal.json');

const partial = require('../fixtures/transcripts/minimal/partial.json');
const complete = require('../fixtures/transcripts/minimal/complete.json');
const empty = require('../fixtures/transcripts/minimal/empty.json');
const inProgress = require('../fixtures/transcripts/minimal/in-progress.json');

// ============================================================
// findNextEligible
// ============================================================

describe('findNextEligible', () => {
  test('all requirements met → empty array', () => {
    const ast = {
      type: 'all-of',
      items: [
        { type: 'course', subject: 'MATH', number: '101' },
        { type: 'course', subject: 'CMPS', number: '130' },
      ],
    };
    const { result } = audit(ast, minimalCatalog, partial);
    const eligible = findNextEligible(result, minimalCatalog, partial);
    expect(eligible).toHaveLength(0);
  });

  test('unmet course with no prereqs → eligible', () => {
    // CMPS 130 has no prereqs in the catalog, and empty transcript
    const ast = { type: 'course', subject: 'CMPS', number: '130' };
    const { result } = audit(ast, minimalCatalog, empty);
    const eligible = findNextEligible(result, minimalCatalog, empty);
    expect(eligible).toHaveLength(1);
    expect(eligible[0].subject).toBe('CMPS');
    expect(eligible[0].number).toBe('130');
    expect(eligible[0].title).toBe('Introduction to Programming');
  });

  test('unmet course with met prereqs → eligible', () => {
    // CMPS 310 requires CMPS 230; partial transcript has CMPS 230
    const ast = {
      type: 'all-of',
      items: [
        { type: 'course', subject: 'CMPS', number: '230' },
        { type: 'course', subject: 'CMPS', number: '310' },
      ],
    };
    const { result } = audit(ast, minimalCatalog, partial);
    const eligible = findNextEligible(result, minimalCatalog, partial);
    expect(eligible).toHaveLength(1);
    expect(eligible[0].subject).toBe('CMPS');
    expect(eligible[0].number).toBe('310');
  });

  test('unmet course with unmet prereqs → not eligible', () => {
    // CMPS 491 requires CMPS 310; partial transcript does NOT have CMPS 310
    const ast = { type: 'course', subject: 'CMPS', number: '491' };
    const { result } = audit(ast, minimalCatalog, partial);
    const eligible = findNextEligible(result, minimalCatalog, partial);
    expect(eligible).toHaveLength(0);
  });

  test('course already in transcript (in-progress) → not eligible', () => {
    // in-progress transcript has MATH 152 as in-progress
    const ast = { type: 'course', subject: 'MATH', number: '152' };
    const { result } = audit(ast, minimalCatalog, inProgress);
    const eligible = findNextEligible(result, minimalCatalog, inProgress);
    // MATH 152 is in-progress, so it shouldn't appear as eligible
    expect(eligible).toHaveLength(0);
  });

  test('course-filter unmet → resolved candidates filtered by prereqs', () => {
    // Filter for FA-attribute courses; empty transcript means filter is NOT_MET
    const ast = {
      type: 'course-filter',
      filters: [{ field: 'attribute', op: 'eq', value: 'FA' }],
    };
    const { result } = audit(ast, minimalCatalog, empty);
    const eligible = findNextEligible(result, minimalCatalog, empty);
    // FA courses: ART 101, ART 201, ART 301, ART 401 — all have no prereqs
    expect(eligible).toHaveLength(4);
    for (const c of eligible) {
      expect(c.subject).toBe('ART');
    }
  });

  test('multiple unmet requirements → union of eligible courses (deduplicated)', () => {
    const ast = {
      type: 'all-of',
      items: [
        { type: 'course', subject: 'CMPS', number: '310' },
        { type: 'course', subject: 'CMPS', number: '320' },
        { type: 'course', subject: 'CMPS', number: '310' }, // duplicate
      ],
    };
    const { result } = audit(ast, minimalCatalog, partial);
    const eligible = findNextEligible(result, minimalCatalog, partial);
    // Both CMPS 310 and 320 require CMPS 230 which is in partial transcript
    expect(eligible).toHaveLength(2);
    const keys = eligible.map(c => c.subject + ':' + c.number);
    expect(keys).toContain('CMPS:310');
    expect(keys).toContain('CMPS:320');
  });

  test('course not in catalog → excluded from results', () => {
    // AST references a course not in the catalog
    const ast = { type: 'course', subject: 'ZZZZ', number: '999' };
    const { result } = audit(ast, minimalCatalog, empty);
    const eligible = findNextEligible(result, minimalCatalog, empty);
    // ZZZZ:999 is not in the catalog, so it's excluded
    expect(eligible).toHaveLength(0);
  });

  test('course with only creditsMin → uses creditsMin for output', () => {
    // Add a course with creditsMin only
    const catalog = {
      ...minimalCatalog,
      courses: [
        ...minimalCatalog.courses,
        { subject: 'TEST', number: '100', title: 'Test Course', creditsMin: 2 },
      ],
    };
    const ast = { type: 'course', subject: 'TEST', number: '100' };
    const { result } = audit(ast, catalog, empty);
    const eligible = findNextEligible(result, catalog, empty);
    expect(eligible).toHaveLength(1);
    expect(eligible[0].credits).toBe(2);
  });

  test('course with no credits → credits is 0', () => {
    const catalog = {
      ...minimalCatalog,
      courses: [
        ...minimalCatalog.courses,
        { subject: 'TEST', number: '200', title: 'No Credits' },
      ],
    };
    const ast = { type: 'course', subject: 'TEST', number: '200' };
    const { result } = audit(ast, catalog, empty);
    const eligible = findNextEligible(result, catalog, empty);
    expect(eligible).toHaveLength(1);
    expect(eligible[0].credits).toBe(0);
  });

  test('course with no title → title is empty string', () => {
    const catalog = {
      ...minimalCatalog,
      courses: [
        ...minimalCatalog.courses,
        { subject: 'TEST', number: '300', creditsMin: 1 },
      ],
    };
    const ast = { type: 'course', subject: 'TEST', number: '300' };
    const { result } = audit(ast, catalog, empty);
    const eligible = findNextEligible(result, catalog, empty);
    expect(eligible).toHaveLength(1);
    expect(eligible[0].title).toBe('');
  });

  test('gradeConfig from catalog root used when norm lacks it', () => {
    // If catalog has gradeConfig at root level, findNextEligible should work
    const catalog = {
      courses: minimalCatalog.courses,
      gradeConfig: minimalCatalog.gradeConfig,
    };
    const ast = { type: 'course', subject: 'CMPS', number: '130' };
    const { result } = audit(ast, catalog, empty);
    const eligible = findNextEligible(result, catalog, empty);
    expect(eligible).toHaveLength(1);
  });

  test('eligible courses include credits', () => {
    const ast = { type: 'course', subject: 'CMPS', number: '130' };
    const { result } = audit(ast, minimalCatalog, empty);
    const eligible = findNextEligible(result, minimalCatalog, empty);
    expect(eligible[0].credits).toBe(3);
  });
});
