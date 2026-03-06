'use strict';

const { extractCourses, extractAllReferences } = require('../../src/ast/extract');
const minimalCatalog = require('../fixtures/catalogs/minimal.json');

// ============================================================
// extractCourses
// ============================================================

describe('extractCourses', () => {
  test('finds all course nodes in flat all-of', () => {
    const ast = {
      type: 'all-of',
      items: [
        { type: 'course', subject: 'MATH', number: '101' },
        { type: 'course', subject: 'CMPS', number: '130' },
      ],
    };
    const result = extractCourses(ast);
    expect(result).toHaveLength(2);
    expect(result).toEqual([
      { subject: 'MATH', number: '101' },
      { subject: 'CMPS', number: '130' },
    ]);
  });

  test('finds courses nested in with-constraint, except, scope, variable-def', () => {
    const ast = {
      type: 'all-of',
      items: [
        {
          type: 'with-constraint',
          constraint: { kind: 'min-grade', value: 'C' },
          requirement: { type: 'course', subject: 'MATH', number: '151' },
        },
        {
          type: 'except',
          source: { type: 'course', subject: 'CMPS', number: '230' },
          exclude: [{ type: 'course', subject: 'CMPS', number: '130' }],
        },
        {
          type: 'scope', name: 'test',
          defs: [
            { type: 'variable-def', name: 'x', value: { type: 'course', subject: 'ENGL', number: '101' } },
          ],
          body: { type: 'course', subject: 'HIST', number: '101' },
        },
      ],
    };
    const result = extractCourses(ast);
    expect(result).toHaveLength(5);
    expect(result.map(c => c.subject + ':' + c.number)).toEqual([
      'MATH:151', 'CMPS:230', 'CMPS:130', 'HIST:101', 'ENGL:101',
    ]);
  });

  test('deduplicates repeated courses', () => {
    const ast = {
      type: 'all-of',
      items: [
        { type: 'course', subject: 'MATH', number: '101' },
        { type: 'course', subject: 'MATH', number: '101' },
        { type: 'course', subject: 'CMPS', number: '130' },
      ],
    };
    const result = extractCourses(ast);
    expect(result).toHaveLength(2);
  });

  test('empty AST → empty array', () => {
    const ast = { type: 'all-of', items: [] };
    const result = extractCourses(ast);
    expect(result).toHaveLength(0);
  });

  test('single course node', () => {
    const result = extractCourses({ type: 'course', subject: 'MATH', number: '101' });
    expect(result).toEqual([{ subject: 'MATH', number: '101' }]);
  });

  test('course-filter nodes are not included', () => {
    const ast = {
      type: 'all-of',
      items: [
        { type: 'course-filter', filters: [{ field: 'subject', op: 'eq', value: 'MATH' }] },
        { type: 'course', subject: 'CMPS', number: '130' },
      ],
    };
    const result = extractCourses(ast);
    expect(result).toHaveLength(1);
    expect(result[0].subject).toBe('CMPS');
  });
});

// ============================================================
// extractAllReferences
// ============================================================

describe('extractAllReferences', () => {
  test('explicit courses found', () => {
    const ast = {
      type: 'all-of',
      items: [
        { type: 'course', subject: 'MATH', number: '101' },
        { type: 'course', subject: 'CMPS', number: '130' },
      ],
    };
    const { explicit, filtered } = extractAllReferences(ast, minimalCatalog);
    expect(explicit).toHaveLength(2);
    expect(filtered).toHaveLength(0);
  });

  test('filter matches resolved against catalog', () => {
    const ast = {
      type: 'course-filter',
      filters: [{ field: 'subject', op: 'eq', value: 'ART' }],
    };
    const { explicit, filtered } = extractAllReferences(ast, minimalCatalog);
    expect(explicit).toHaveLength(0);
    // minimal catalog has ART 101, 201, 301, 401
    expect(filtered).toHaveLength(4);
    expect(filtered.every(c => c.subject === 'ART')).toBe(true);
  });

  test('combined: course appears in both explicit and filtered are separate', () => {
    const ast = {
      type: 'all-of',
      items: [
        { type: 'course', subject: 'ART', number: '101' },
        { type: 'course-filter', filters: [{ field: 'subject', op: 'eq', value: 'ART' }] },
      ],
    };
    const { explicit, filtered } = extractAllReferences(ast, minimalCatalog);
    expect(explicit).toHaveLength(1);
    expect(explicit[0]).toEqual({ subject: 'ART', number: '101' });
    // All 4 ART courses appear in filtered
    expect(filtered).toHaveLength(4);
  });

  test('empty catalog → no filtered results', () => {
    const ast = {
      type: 'course-filter',
      filters: [{ field: 'subject', op: 'eq', value: 'MATH' }],
    };
    const { filtered } = extractAllReferences(ast, { courses: [] });
    expect(filtered).toHaveLength(0);
  });
});
