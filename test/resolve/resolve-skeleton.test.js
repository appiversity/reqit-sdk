'use strict';

const { resolve, normalizeCatalog } = require('../../src/resolve');
const minimalCatalog = require('../fixtures/catalogs/minimal.json');

describe('resolve() skeleton', () => {
  describe('return shape', () => {
    it('returns an object with courses and filters arrays', () => {
      const ast = { type: 'course', subject: 'MATH', number: '101' };
      const result = resolve(ast, minimalCatalog);
      expect(result).toHaveProperty('courses');
      expect(result).toHaveProperty('filters');
      expect(Array.isArray(result.courses)).toBe(true);
      expect(Array.isArray(result.filters)).toBe(true);
    });

    it('returns empty arrays for non-course AST nodes', () => {
      const ast = { type: 'score', code: 'SAT', op: 'gte', value: 1200 };
      const result = resolve(ast, minimalCatalog);
      expect(result.courses).toEqual([]);
      expect(result.filters).toEqual([]);
    });
  });

  describe('course reference resolution', () => {
    it('resolves a single course reference', () => {
      const ast = { type: 'course', subject: 'MATH', number: '101' };
      const result = resolve(ast, minimalCatalog);
      expect(result.courses).toHaveLength(1);
      expect(result.courses[0].subject).toBe('MATH');
      expect(result.courses[0].number).toBe('101');
      expect(result.courses[0].title).toBe('College Algebra');
    });

    it('returns the full normalized catalog course object', () => {
      const ast = { type: 'course', subject: 'CMPS', number: '310' };
      const result = resolve(ast, minimalCatalog);
      const course = result.courses[0];
      expect(course).toHaveProperty('id');
      expect(course).toHaveProperty('subject');
      expect(course).toHaveProperty('number');
      expect(course).toHaveProperty('title');
      expect(course).toHaveProperty('creditsMin');
      expect(course).toHaveProperty('creditsMax');
      expect(course).toHaveProperty('attributes');
    });

    it('returns empty courses for a reference not in the catalog', () => {
      const ast = { type: 'course', subject: 'PSYC', number: '101' };
      const result = resolve(ast, minimalCatalog);
      expect(result.courses).toHaveLength(0);
    });

    it('resolves multiple courses in an all-of', () => {
      const ast = {
        type: 'all-of',
        items: [
          { type: 'course', subject: 'MATH', number: '101' },
          { type: 'course', subject: 'MATH', number: '151' },
          { type: 'course', subject: 'CMPS', number: '130' },
        ],
      };
      const result = resolve(ast, minimalCatalog);
      expect(result.courses).toHaveLength(3);
      const subjects = result.courses.map(c => c.subject + ':' + c.number);
      expect(subjects).toContain('MATH:101');
      expect(subjects).toContain('MATH:151');
      expect(subjects).toContain('CMPS:130');
    });

    it('deduplicates courses referenced multiple times', () => {
      const ast = {
        type: 'all-of',
        items: [
          { type: 'course', subject: 'MATH', number: '101' },
          { type: 'course', subject: 'MATH', number: '101' },
          { type: 'course', subject: 'MATH', number: '151' },
        ],
      };
      const result = resolve(ast, minimalCatalog);
      expect(result.courses).toHaveLength(2);
    });

    it('resolves courses in an any-of', () => {
      const ast = {
        type: 'any-of',
        items: [
          { type: 'course', subject: 'ENGL', number: '101' },
          { type: 'course', subject: 'ENGL', number: '201' },
        ],
      };
      const result = resolve(ast, minimalCatalog);
      expect(result.courses).toHaveLength(2);
    });

    it('resolves courses in an n-of', () => {
      const ast = {
        type: 'n-of',
        comparison: 'at-least',
        count: 2,
        items: [
          { type: 'course', subject: 'CMPS', number: '310' },
          { type: 'course', subject: 'CMPS', number: '320' },
          { type: 'course', subject: 'CMPS', number: '360' },
        ],
      };
      const result = resolve(ast, minimalCatalog);
      expect(result.courses).toHaveLength(3);
    });

    it('resolves courses in a none-of', () => {
      const ast = {
        type: 'none-of',
        items: [
          { type: 'course', subject: 'ART', number: '101' },
          { type: 'course', subject: 'ART', number: '201' },
        ],
      };
      const result = resolve(ast, minimalCatalog);
      expect(result.courses).toHaveLength(2);
    });

    it('resolves courses in one-from-each', () => {
      const ast = {
        type: 'one-from-each',
        items: [
          { type: 'all-of', items: [
            { type: 'course', subject: 'MATH', number: '101' },
            { type: 'course', subject: 'MATH', number: '151' },
          ]},
          { type: 'all-of', items: [
            { type: 'course', subject: 'CMPS', number: '130' },
            { type: 'course', subject: 'CMPS', number: '135' },
          ]},
        ],
      };
      const result = resolve(ast, minimalCatalog);
      expect(result.courses).toHaveLength(4);
    });

    it('resolves courses in from-n-groups', () => {
      const ast = {
        type: 'from-n-groups',
        comparison: 'at-least',
        count: 1,
        items: [
          { type: 'all-of', items: [
            { type: 'course', subject: 'MATH', number: '101' },
          ]},
          { type: 'all-of', items: [
            { type: 'course', subject: 'CMPS', number: '130' },
          ]},
        ],
      };
      const result = resolve(ast, minimalCatalog);
      expect(result.courses).toHaveLength(2);
    });
  });

  describe('nested structures', () => {
    it('resolves courses inside credits-from', () => {
      const ast = {
        type: 'credits-from',
        comparison: 'at-least',
        credits: 12,
        source: {
          type: 'all-of',
          items: [
            { type: 'course', subject: 'CMPS', number: '310' },
            { type: 'course', subject: 'CMPS', number: '320' },
            { type: 'course', subject: 'CMPS', number: '360' },
            { type: 'course', subject: 'CMPS', number: '380' },
          ],
        },
      };
      const result = resolve(ast, minimalCatalog);
      expect(result.courses).toHaveLength(4);
    });

    it('resolves courses inside with-constraint', () => {
      const ast = {
        type: 'with-constraint',
        constraint: { type: 'min-grade', grade: 'C' },
        requirement: {
          type: 'all-of',
          items: [
            { type: 'course', subject: 'MATH', number: '151' },
            { type: 'course', subject: 'MATH', number: '152' },
          ],
        },
      };
      const result = resolve(ast, minimalCatalog);
      expect(result.courses).toHaveLength(2);
    });

    it('resolves courses inside except (both source and exclude)', () => {
      const ast = {
        type: 'except',
        source: {
          type: 'all-of',
          items: [
            { type: 'course', subject: 'CMPS', number: '310' },
            { type: 'course', subject: 'CMPS', number: '320' },
            { type: 'course', subject: 'CMPS', number: '360' },
          ],
        },
        exclude: [
          { type: 'course', subject: 'CMPS', number: '360' },
        ],
      };
      const result = resolve(ast, minimalCatalog);
      // 310, 320, 360 — deduplicated, 360 appears in both source and exclude
      expect(result.courses).toHaveLength(3);
    });

    it('resolves courses inside variable-def', () => {
      const ast = {
        type: 'variable-def',
        name: 'core',
        value: {
          type: 'all-of',
          items: [
            { type: 'course', subject: 'CMPS', number: '230' },
            { type: 'course', subject: 'CMPS', number: '310' },
          ],
        },
      };
      const result = resolve(ast, minimalCatalog);
      expect(result.courses).toHaveLength(2);
    });

    it('resolves courses inside scope (defs and body)', () => {
      const ast = {
        type: 'scope',
        name: 'cs-major',
        defs: [
          {
            type: 'variable-def',
            name: 'core',
            value: {
              type: 'all-of',
              items: [
                { type: 'course', subject: 'CMPS', number: '230' },
                { type: 'course', subject: 'CMPS', number: '310' },
              ],
            },
          },
        ],
        body: {
          type: 'all-of',
          items: [
            { type: 'course', subject: 'MATH', number: '151' },
            { type: 'course', subject: 'MATH', number: '152' },
          ],
        },
      };
      const result = resolve(ast, minimalCatalog);
      expect(result.courses).toHaveLength(4);
    });

    it('resolves deeply nested structures', () => {
      const ast = {
        type: 'all-of',
        items: [
          {
            type: 'with-constraint',
            constraint: { type: 'min-grade', grade: 'C' },
            requirement: {
              type: 'credits-from',
              comparison: 'at-least',
              credits: 9,
              source: {
                type: 'any-of',
                items: [
                  { type: 'course', subject: 'CMPS', number: '310' },
                  { type: 'course', subject: 'CMPS', number: '320' },
                  { type: 'course', subject: 'CMPS', number: '360' },
                  { type: 'course', subject: 'CMPS', number: '380' },
                ],
              },
            },
          },
          {
            type: 'except',
            source: {
              type: 'n-of',
              comparison: 'at-least',
              count: 1,
              items: [
                { type: 'course', subject: 'ART', number: '101' },
                { type: 'course', subject: 'ART', number: '201' },
              ],
            },
            exclude: [
              { type: 'course', subject: 'ART', number: '101' },
            ],
          },
        ],
      };
      const result = resolve(ast, minimalCatalog);
      expect(result.courses).toHaveLength(6);
      const keys = result.courses.map(c => c.subject + ':' + c.number).sort();
      expect(keys).toEqual([
        'ART:101', 'ART:201',
        'CMPS:310', 'CMPS:320', 'CMPS:360', 'CMPS:380',
      ]);
    });
  });

  describe('course-filter nodes', () => {
    it('records a course-filter in filters with matched courses', () => {
      const ast = {
        type: 'course-filter',
        filters: [{ field: 'subject', op: 'eq', value: 'CMPS' }],
      };
      const result = resolve(ast, minimalCatalog);
      expect(result.filters).toHaveLength(1);
      expect(result.filters[0].node).toBe(ast);
      expect(result.filters[0].matched.length).toBeGreaterThan(0);
      expect(result.filters[0].matched.every(c => c.subject === 'CMPS')).toBe(true);
      // Filter-matched courses are also added to result.courses
      expect(result.courses.length).toBe(result.filters[0].matched.length);
    });

    it('records multiple filters from nested structures', () => {
      const ast = {
        type: 'all-of',
        items: [
          {
            type: 'course-filter',
            filters: [{ field: 'subject', op: 'eq', value: 'CMPS' }],
          },
          {
            type: 'course-filter',
            filters: [{ field: 'subject', op: 'eq', value: 'ART' }],
          },
          { type: 'course', subject: 'MATH', number: '101' },
        ],
      };
      const result = resolve(ast, minimalCatalog);
      expect(result.filters).toHaveLength(2);
      // CMPS (11) + ART (4) + MATH 101 (1) = 16 distinct courses
      expect(result.courses).toHaveLength(16);
    });
  });

  describe('non-course node types are handled gracefully', () => {
    it('handles score nodes', () => {
      const ast = { type: 'score', code: 'SAT', op: 'gte', value: 1200 };
      const result = resolve(ast, minimalCatalog);
      expect(result.courses).toEqual([]);
      expect(result.filters).toEqual([]);
    });

    it('handles attainment nodes', () => {
      const ast = { type: 'attainment', code: 'PRAXIS' };
      const result = resolve(ast, minimalCatalog);
      expect(result.courses).toEqual([]);
    });

    it('handles quantity nodes', () => {
      const ast = { type: 'quantity', code: 'HOURS', op: 'gte', value: 500 };
      const result = resolve(ast, minimalCatalog);
      expect(result.courses).toEqual([]);
    });

    it('handles program nodes', () => {
      const ast = { type: 'program', code: 'CS', 'program-type': 'major', level: 'undergraduate' };
      const result = resolve(ast, minimalCatalog);
      expect(result.courses).toEqual([]);
    });

    it('handles program-context-ref nodes', () => {
      const ast = { type: 'program-context-ref', role: 'primary-major' };
      const result = resolve(ast, minimalCatalog);
      expect(result.courses).toEqual([]);
    });

    it('handles overlap-limit nodes', () => {
      const ast = {
        type: 'overlap-limit',
        left: { type: 'program-context-ref', role: 'primary-major' },
        right: { type: 'program-context-ref', role: 'primary-minor' },
        constraint: { comparison: 'at-most', value: 2, unit: 'courses' },
      };
      const result = resolve(ast, minimalCatalog);
      expect(result.courses).toEqual([]);
    });

    it('handles outside-program nodes', () => {
      const ast = {
        type: 'outside-program',
        program: { type: 'program-context-ref', role: 'primary-major' },
        constraint: { comparison: 'at-least', value: 12, unit: 'credits' },
      };
      const result = resolve(ast, minimalCatalog);
      expect(result.courses).toEqual([]);
    });

    it('handles variable-ref nodes (stub)', () => {
      const ast = { type: 'variable-ref', name: 'core' };
      const result = resolve(ast, minimalCatalog);
      expect(result.courses).toEqual([]);
    });

    it('handles mixed course and non-course nodes', () => {
      const ast = {
        type: 'all-of',
        items: [
          { type: 'course', subject: 'MATH', number: '101' },
          { type: 'score', code: 'SAT', op: 'gte', value: 1200 },
          { type: 'attainment', code: 'PRAXIS' },
          { type: 'course', subject: 'CMPS', number: '130' },
        ],
      };
      const result = resolve(ast, minimalCatalog);
      expect(result.courses).toHaveLength(2);
    });
  });
});
