'use strict';

/**
 * Edge-case tests for the resolver — exercises code paths that
 * the integration tests don't cover (F9 from code review).
 */

const { resolve } = require('../../src/resolve');

const emptyCatalog = {
  institution: 'test',
  ay: '2025-2026',
  courses: [],
  programs: [],
  attainments: [],
  gradeConfig: { scale: [], passFail: [], withdrawal: [], incomplete: [] },
};

const minimalCatalog = {
  institution: 'test',
  ay: '2025-2026',
  courses: [
    { id: 1, subject: 'MATH', number: '151', title: 'Calculus I', creditsMin: 4, creditsMax: 4 },
    { id: 2, subject: 'CMPS', number: '130', title: 'Intro CS', creditsMin: 3, creditsMax: 3, attributes: ['WI'] },
  ],
  programs: [],
  attainments: [],
  gradeConfig: { scale: [], passFail: [], withdrawal: [], incomplete: [] },
};

describe('Resolver edge cases', () => {

  describe('null/undefined AST input', () => {
    it('handles null AST gracefully', () => {
      const result = resolve(null, minimalCatalog);
      expect(result.courses).toHaveLength(0);
      expect(result.filters).toHaveLength(0);
    });

    it('handles undefined AST gracefully', () => {
      const result = resolve(undefined, minimalCatalog);
      expect(result.courses).toHaveLength(0);
      expect(result.filters).toHaveLength(0);
    });
  });

  describe('empty catalog', () => {
    it('resolves course reference against empty catalog with no matches', () => {
      const ast = { type: 'course', subject: 'MATH', number: '151' };
      const result = resolve(ast, emptyCatalog);
      expect(result.courses).toHaveLength(0);
    });

    it('resolves course-filter against empty catalog with no matches', () => {
      const ast = {
        type: 'course-filter',
        filters: [{ field: 'subject', op: 'eq', value: 'MATH' }],
      };
      const result = resolve(ast, emptyCatalog);
      expect(result.courses).toHaveLength(0);
      expect(result.filters).toHaveLength(1);
      expect(result.filters[0].matched).toHaveLength(0);
    });
  });

  describe('unknown filter field', () => {
    it('returns no matches for an unrecognised filter field', () => {
      const ast = {
        type: 'course-filter',
        filters: [{ field: 'department', op: 'eq', value: 'CS' }],
      };
      const result = resolve(ast, minimalCatalog);
      expect(result.filters).toHaveLength(1);
      expect(result.filters[0].matched).toHaveLength(0);
    });
  });

  describe('unknown node type in walkNode', () => {
    it('silently skips an unknown node type without crashing', () => {
      // walkNode has no default case — an unknown type falls through the switch
      // and is silently ignored. This test documents that behaviour.
      const ast = { type: 'future-node-type', items: [] };
      const result = resolve(ast, minimalCatalog);
      expect(result.courses).toHaveLength(0);
      expect(result.filters).toHaveLength(0);
    });
  });

  describe('post_constraints are not walked for course resolution', () => {
    // Design decision: post_constraints contain filter objects, not AST nodes
    // that need catalog resolution. Course references inside post_constraint
    // filter values (e.g. prerequisite-includes) are evaluated at audit time,
    // not resolution time. This test documents the intentional behaviour.
    it('does not resolve course refs inside post_constraints', () => {
      const ast = {
        type: 'all-of',
        items: [{ type: 'course', subject: 'MATH', number: '151' }],
        post_constraints: [{
          comparison: 'at-least',
          count: 1,
          filter: { field: 'subject', op: 'eq', value: 'CMPS' },
        }],
      };
      const result = resolve(ast, minimalCatalog);
      // Only MATH 151 is collected — the post_constraint filter is not evaluated
      expect(result.courses).toHaveLength(1);
      expect(result.courses[0].subject).toBe('MATH');
    });
  });

  describe('course not found in catalog', () => {
    it('silently skips a course reference not in the catalog', () => {
      const ast = { type: 'course', subject: 'PHYS', number: '101' };
      const result = resolve(ast, minimalCatalog);
      expect(result.courses).toHaveLength(0);
    });
  });

  describe('deeply nested structure', () => {
    it('resolves courses through deeply nested composites', () => {
      const ast = {
        type: 'all-of',
        items: [{
          type: 'any-of',
          items: [{
            type: 'n-of',
            comparison: 'at-least',
            count: 1,
            items: [{ type: 'course', subject: 'MATH', number: '151' }],
          }],
        }],
      };
      const result = resolve(ast, minimalCatalog);
      expect(result.courses).toHaveLength(1);
    });
  });

  describe('except filter-result semantics (F12)', () => {
    // Design decision: the resolver collects ALL courses referenced by an
    // except node — both source and exclude sides. The distinction between
    // "included" and "excluded" is the auditor's responsibility, not the
    // resolver's. The resolver's job is to identify which catalog courses
    // are referenced by the AST.

    it('collects courses from both source and exclude', () => {
      const ast = {
        type: 'except',
        source: { type: 'course', subject: 'MATH', number: '151' },
        exclude: [{ type: 'course', subject: 'CMPS', number: '130' }],
      };
      const result = resolve(ast, minimalCatalog);
      // Both source (MATH 151) and exclude (CMPS 130) are collected
      expect(result.courses).toHaveLength(2);
      expect(result.courses.some(c => c.subject === 'MATH' && c.number === '151')).toBe(true);
      expect(result.courses.some(c => c.subject === 'CMPS' && c.number === '130')).toBe(true);
    });

    it('deduplicates when same course appears in both source and exclude', () => {
      const ast = {
        type: 'except',
        source: {
          type: 'all-of',
          items: [
            { type: 'course', subject: 'MATH', number: '151' },
            { type: 'course', subject: 'CMPS', number: '130' },
          ],
        },
        exclude: [{ type: 'course', subject: 'CMPS', number: '130' }],
      };
      const result = resolve(ast, minimalCatalog);
      // CMPS 130 appears in both source and exclude but should only be collected once
      expect(result.courses).toHaveLength(2);
    });

    it('does not annotate source vs exclude in result.courses', () => {
      // This test documents the current design: the resolver returns a flat
      // list of courses with no source/exclude annotation. Source/exclude
      // distinction is an auditor concern.
      const ast = {
        type: 'except',
        source: { type: 'course', subject: 'MATH', number: '151' },
        exclude: [{ type: 'course', subject: 'CMPS', number: '130' }],
      };
      const result = resolve(ast, minimalCatalog);
      // No "excluded" or "source" annotations on courses
      for (const c of result.courses) {
        expect(c).not.toHaveProperty('_excluded');
        expect(c).not.toHaveProperty('_source');
      }
    });

    it('collects filter results from except source', () => {
      const ast = {
        type: 'except',
        source: {
          type: 'course-filter',
          filters: [{ field: 'subject', op: 'eq', value: 'MATH' }],
        },
        exclude: [{ type: 'course', subject: 'MATH', number: '151' }],
      };
      const result = resolve(ast, minimalCatalog);
      // Filter from source is collected
      expect(result.filters).toHaveLength(1);
      expect(result.filters[0].matched).toHaveLength(1);
      // MATH 151 appears in both filter match and exclude — deduplicated
      expect(result.courses).toHaveLength(1);
    });
  });
});
