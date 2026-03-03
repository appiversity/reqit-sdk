'use strict';

const { resolve } = require('../../src/resolve');
const lehighCatalog = require('../fixtures/catalogs/lehigh.json');

describe('cross-list group resolution', () => {
  // lehigh catalog has CSE 340 (id:15) and MATH 340 (id:16) sharing crossListGroup "cl-cse340"

  describe('explicit course references', () => {
    it('resolves CSE 340 and also includes MATH 340 (cross-listed)', () => {
      const ast = { type: 'course', subject: 'CSE', number: '340' };
      const result = resolve(ast, lehighCatalog);
      expect(result.courses).toHaveLength(2);
      const keys = result.courses.map(c => c.subject + ':' + c.number).sort();
      expect(keys).toEqual(['CSE:340', 'MATH:340']);
    });

    it('resolves MATH 340 and also includes CSE 340 (cross-listed)', () => {
      const ast = { type: 'course', subject: 'MATH', number: '340' };
      const result = resolve(ast, lehighCatalog);
      expect(result.courses).toHaveLength(2);
      const keys = result.courses.map(c => c.subject + ':' + c.number).sort();
      expect(keys).toEqual(['CSE:340', 'MATH:340']);
    });

    it('referencing both cross-listed courses does not duplicate', () => {
      const ast = {
        type: 'all-of',
        items: [
          { type: 'course', subject: 'CSE', number: '340' },
          { type: 'course', subject: 'MATH', number: '340' },
        ],
      };
      const result = resolve(ast, lehighCatalog);
      // Still only 2 courses (deduplicated)
      expect(result.courses).toHaveLength(2);
    });

    it('does not cross-list courses without crossListGroup', () => {
      const ast = { type: 'course', subject: 'CSE', number: '007' };
      const result = resolve(ast, lehighCatalog);
      expect(result.courses).toHaveLength(1);
      expect(result.courses[0].subject).toBe('CSE');
      expect(result.courses[0].number).toBe('007');
    });

    it('cross-listed courses alongside non-cross-listed', () => {
      const ast = {
        type: 'all-of',
        items: [
          { type: 'course', subject: 'CSE', number: '340' },
          { type: 'course', subject: 'CSE', number: '007' },
        ],
      };
      const result = resolve(ast, lehighCatalog);
      // CSE 340 + MATH 340 (cross-listed) + CSE 007 = 3
      expect(result.courses).toHaveLength(3);
    });
  });

  describe('filter results include cross-listed equivalents', () => {
    it('filter matching CSE 340 also returns MATH 340', () => {
      const ast = {
        type: 'course-filter',
        filters: [
          { field: 'subject', op: 'eq', value: 'CSE' },
          { field: 'number', op: 'eq', value: '340' },
        ],
      };
      const result = resolve(ast, lehighCatalog);
      expect(result.filters).toHaveLength(1);
      const matched = result.filters[0].matched;
      expect(matched).toHaveLength(2);
      const keys = matched.map(c => c.subject + ':' + c.number).sort();
      expect(keys).toEqual(['CSE:340', 'MATH:340']);
    });

    it('subject filter for CSE includes MATH 340 (cross-listed with CSE 340)', () => {
      const ast = {
        type: 'course-filter',
        filters: [{ field: 'subject', op: 'eq', value: 'CSE' }],
      };
      const result = resolve(ast, lehighCatalog);
      // All CSE courses + MATH 340 (cross-listed with CSE 340)
      expect(result.courses.some(c => c.subject === 'MATH' && c.number === '340')).toBe(true);
    });

    it('filter that does not match any cross-listed course returns no extras', () => {
      const ast = {
        type: 'course-filter',
        filters: [
          { field: 'subject', op: 'eq', value: 'WRT' },
        ],
      };
      const result = resolve(ast, lehighCatalog);
      // WRT courses have no crossListGroup
      expect(result.courses.every(c => c.subject === 'WRT')).toBe(true);
    });
  });

  describe('with custom catalog having multiple cross-list groups', () => {
    const catalog = {
      institution: 'test',
      ay: '2025-2026',
      courses: [
        { id: 1, subject: 'A', number: '100', title: 'A100', creditsMin: 3, creditsMax: 3, crossListGroup: 'cl-1' },
        { id: 2, subject: 'B', number: '100', title: 'B100', creditsMin: 3, creditsMax: 3, crossListGroup: 'cl-1' },
        { id: 3, subject: 'C', number: '100', title: 'C100', creditsMin: 3, creditsMax: 3, crossListGroup: 'cl-1' },
        { id: 4, subject: 'D', number: '200', title: 'D200', creditsMin: 3, creditsMax: 3, crossListGroup: 'cl-2' },
        { id: 5, subject: 'E', number: '200', title: 'E200', creditsMin: 3, creditsMax: 3, crossListGroup: 'cl-2' },
        { id: 6, subject: 'F', number: '300', title: 'F300', creditsMin: 3, creditsMax: 3 },
      ],
      programs: [],
      attainments: [],
      gradeConfig: { scale: [], passFail: [], withdrawal: [], incomplete: [] },
    };

    it('resolves all 3 courses in a cross-list group', () => {
      const ast = { type: 'course', subject: 'A', number: '100' };
      const result = resolve(ast, catalog);
      expect(result.courses).toHaveLength(3);
      const keys = result.courses.map(c => c.subject + ':' + c.number).sort();
      expect(keys).toEqual(['A:100', 'B:100', 'C:100']);
    });

    it('different cross-list groups are independent', () => {
      const ast = { type: 'course', subject: 'D', number: '200' };
      const result = resolve(ast, catalog);
      expect(result.courses).toHaveLength(2);
      const keys = result.courses.map(c => c.subject + ':' + c.number).sort();
      expect(keys).toEqual(['D:200', 'E:200']);
    });

    it('non-cross-listed course is resolved alone', () => {
      const ast = { type: 'course', subject: 'F', number: '300' };
      const result = resolve(ast, catalog);
      expect(result.courses).toHaveLength(1);
    });

    it('filter expands cross-listed groups for each matched course', () => {
      const ast = {
        type: 'course-filter',
        filters: [{ field: 'number', op: 'eq', value: '100' }],
      };
      const result = resolve(ast, catalog);
      // A100, B100, C100 all match directly AND are in the same group
      expect(result.courses).toHaveLength(3);
    });

    it('filter matching one group member expands to all', () => {
      const ast = {
        type: 'course-filter',
        filters: [{ field: 'subject', op: 'eq', value: 'D' }],
      };
      const result = resolve(ast, catalog);
      // D200 matched directly, E200 added via cross-list
      expect(result.courses).toHaveLength(2);
      const keys = result.courses.map(c => c.subject + ':' + c.number).sort();
      expect(keys).toEqual(['D:200', 'E:200']);
    });
  });
});
