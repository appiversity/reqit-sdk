'use strict';

const { resolve } = require('../../src/resolve');
const minimalCatalog = require('../fixtures/catalogs/minimal.json');

describe('variable expansion', () => {
  describe('basic variable-ref resolution', () => {
    it('expands a variable ref to its definition value', () => {
      const ast = {
        type: 'scope',
        name: 'test',
        defs: [
          {
            type: 'variable-def',
            name: 'core',
            value: {
              type: 'all-of',
              items: [
                { type: 'course', subject: 'MATH', number: '101' },
                { type: 'course', subject: 'MATH', number: '151' },
              ],
            },
          },
        ],
        body: { type: 'variable-ref', name: 'core' },
      };
      const result = resolve(ast, minimalCatalog);
      expect(result.courses).toHaveLength(2);
      const keys = result.courses.map(c => c.subject + ':' + c.number).sort();
      expect(keys).toEqual(['MATH:101', 'MATH:151']);
    });

    it('expands variable-ref alongside other nodes', () => {
      const ast = {
        type: 'scope',
        name: 'test',
        defs: [
          {
            type: 'variable-def',
            name: 'electives',
            value: {
              type: 'any-of',
              items: [
                { type: 'course', subject: 'CMPS', number: '350' },
                { type: 'course', subject: 'CMPS', number: '380' },
              ],
            },
          },
        ],
        body: {
          type: 'all-of',
          items: [
            { type: 'course', subject: 'CMPS', number: '230' },
            { type: 'variable-ref', name: 'electives' },
          ],
        },
      };
      const result = resolve(ast, minimalCatalog);
      expect(result.courses).toHaveLength(3);
    });

    it('expands variable containing a course-filter', () => {
      const ast = {
        type: 'scope',
        name: 'test',
        defs: [
          {
            type: 'variable-def',
            name: 'writing',
            value: {
              type: 'course-filter',
              filters: [{ field: 'attribute', op: 'eq', value: 'WI' }],
            },
          },
        ],
        body: { type: 'variable-ref', name: 'writing' },
      };
      const result = resolve(ast, minimalCatalog);
      expect(result.courses).toHaveLength(5);
      expect(result.filters).toHaveLength(1);
    });
  });

  describe('scope resolution', () => {
    it('resolves scoped variable reference (scope.name)', () => {
      const ast = {
        type: 'all-of',
        items: [
          {
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
            body: { type: 'variable-ref', name: 'core' },
          },
          // Reference from outside using scoped name
          { type: 'variable-ref', name: 'core', scope: 'cs-major' },
        ],
      };
      const result = resolve(ast, minimalCatalog);
      // Both references resolve to the same courses (deduplicated)
      expect(result.courses).toHaveLength(2);
    });

    it('resolves unscoped variable in institution-wide context', () => {
      const ast = {
        type: 'all-of',
        items: [
          {
            type: 'variable-def',
            name: 'math-core',
            value: {
              type: 'all-of',
              items: [
                { type: 'course', subject: 'MATH', number: '101' },
                { type: 'course', subject: 'MATH', number: '151' },
              ],
            },
          },
          { type: 'variable-ref', name: 'math-core' },
        ],
      };
      const result = resolve(ast, minimalCatalog);
      expect(result.courses).toHaveLength(2);
    });

    it('scoped def is also accessible by unscoped name', () => {
      const ast = {
        type: 'all-of',
        items: [
          {
            type: 'scope',
            name: 'my-scope',
            defs: [
              {
                type: 'variable-def',
                name: 'elecs',
                value: {
                  type: 'all-of',
                  items: [
                    { type: 'course', subject: 'ART', number: '101' },
                    { type: 'course', subject: 'ART', number: '201' },
                  ],
                },
              },
            ],
            body: { type: 'variable-ref', name: 'elecs' },
          },
          // Access the scoped def by unscoped name from outside
          { type: 'variable-ref', name: 'elecs' },
        ],
      };
      const result = resolve(ast, minimalCatalog);
      expect(result.courses).toHaveLength(2);
    });
  });

  describe('multiple variables', () => {
    it('expands multiple variable references in one tree', () => {
      const ast = {
        type: 'scope',
        name: 'program',
        defs: [
          {
            type: 'variable-def',
            name: 'math',
            value: {
              type: 'all-of',
              items: [
                { type: 'course', subject: 'MATH', number: '101' },
                { type: 'course', subject: 'MATH', number: '151' },
              ],
            },
          },
          {
            type: 'variable-def',
            name: 'cs',
            value: {
              type: 'all-of',
              items: [
                { type: 'course', subject: 'CMPS', number: '130' },
                { type: 'course', subject: 'CMPS', number: '135' },
              ],
            },
          },
        ],
        body: {
          type: 'all-of',
          items: [
            { type: 'variable-ref', name: 'math' },
            { type: 'variable-ref', name: 'cs' },
          ],
        },
      };
      const result = resolve(ast, minimalCatalog);
      expect(result.courses).toHaveLength(4);
    });
  });

  describe('nested variable references', () => {
    it('expands variable that references another variable', () => {
      const ast = {
        type: 'scope',
        name: 'test',
        defs: [
          {
            type: 'variable-def',
            name: 'base',
            value: {
              type: 'all-of',
              items: [
                { type: 'course', subject: 'MATH', number: '101' },
              ],
            },
          },
          {
            type: 'variable-def',
            name: 'extended',
            value: {
              type: 'all-of',
              items: [
                { type: 'variable-ref', name: 'base' },
                { type: 'course', subject: 'MATH', number: '151' },
              ],
            },
          },
        ],
        body: { type: 'variable-ref', name: 'extended' },
      };
      const result = resolve(ast, minimalCatalog);
      expect(result.courses).toHaveLength(2);
    });
  });

  describe('circular reference protection', () => {
    it('does not infinite-loop on circular variable references', () => {
      // This AST is invalid (would fail validation) but resolve should not crash
      const ast = {
        type: 'all-of',
        items: [
          {
            type: 'variable-def',
            name: 'a',
            value: { type: 'variable-ref', name: 'b' },
          },
          {
            type: 'variable-def',
            name: 'b',
            value: { type: 'variable-ref', name: 'a' },
          },
          { type: 'variable-ref', name: 'a' },
        ],
      };
      // Should complete without infinite recursion
      const result = resolve(ast, minimalCatalog);
      expect(result.courses).toEqual([]);
    });

    it('does not infinite-loop on self-referencing variable', () => {
      const ast = {
        type: 'all-of',
        items: [
          {
            type: 'variable-def',
            name: 'self',
            value: { type: 'variable-ref', name: 'self' },
          },
          { type: 'variable-ref', name: 'self' },
        ],
      };
      const result = resolve(ast, minimalCatalog);
      expect(result.courses).toEqual([]);
    });
  });

  describe('undefined variable references', () => {
    it('silently ignores undefined variable refs', () => {
      const ast = {
        type: 'all-of',
        items: [
          { type: 'course', subject: 'MATH', number: '101' },
          { type: 'variable-ref', name: 'nonexistent' },
        ],
      };
      const result = resolve(ast, minimalCatalog);
      // Still resolves the explicit course ref
      expect(result.courses).toHaveLength(1);
    });
  });

  describe('scope defs resolve only through references', () => {
    it('does not resolve unreferenced variable defs inside a scope', () => {
      // The scope has a def that is never referenced by $core.
      // The resolver should NOT walk the def's value — it should only
      // resolve courses that are reachable through the scope body.
      const ast = {
        type: 'scope',
        name: 'test',
        defs: [
          {
            type: 'variable-def',
            name: 'core',
            value: { type: 'course', subject: 'MATH', number: '101' },
          },
        ],
        body: { type: 'course', subject: 'MATH', number: '151' },
      };
      const result = resolve(ast, minimalCatalog);
      // Only MATH 151 (from body) should be resolved, not MATH 101 (from unreferenced def)
      expect(result.courses).toHaveLength(1);
      expect(result.courses[0].number).toBe('151');
    });

    it('resolves scoped variable defs only when referenced', () => {
      const ast = {
        type: 'scope',
        name: 'test',
        defs: [
          {
            type: 'variable-def',
            name: 'core',
            value: { type: 'course', subject: 'MATH', number: '101' },
          },
        ],
        body: {
          type: 'all-of',
          items: [
            { type: 'variable-ref', name: 'core' },
            { type: 'course', subject: 'MATH', number: '151' },
          ],
        },
      };
      const result = resolve(ast, minimalCatalog);
      // Both MATH 101 (via $core) and MATH 151 (direct) should be resolved
      expect(result.courses).toHaveLength(2);
    });
  });
});
