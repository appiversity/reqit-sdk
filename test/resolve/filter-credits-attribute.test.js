'use strict';

const { resolve } = require('../../src/resolve');
const minimalCatalog = require('../fixtures/catalogs/minimal.json');

describe('filter evaluation: credits', () => {
  describe('eq operator (value within credit range)', () => {
    it('matches fixed-credit courses where credits equals the value', () => {
      const ast = {
        type: 'course-filter',
        filters: [{ field: 'credits', op: 'eq', value: 3 }],
      };
      const result = resolve(ast, minimalCatalog);
      expect(result.courses.every(c => c.creditsMin <= 3 && 3 <= c.creditsMax)).toBe(true);
    });

    it('matches variable-credit courses where value falls within range', () => {
      const ast = {
        type: 'course-filter',
        filters: [{ field: 'credits', op: 'eq', value: 2 }],
      };
      const result = resolve(ast, minimalCatalog);
      // CMPS 490 has creditsMin:1, creditsMax:4 — 2 is in range
      expect(result.courses.some(c => c.number === '490')).toBe(true);
    });

    it('does not match when value is outside range', () => {
      const ast = {
        type: 'course-filter',
        filters: [{ field: 'credits', op: 'eq', value: 5 }],
      };
      const result = resolve(ast, minimalCatalog);
      // No course in minimal catalog can be 5 credits
      expect(result.courses).toHaveLength(0);
    });

    it('matches variable-credit course for boundary values', () => {
      const ast = {
        type: 'course-filter',
        filters: [
          { field: 'subject', op: 'eq', value: 'CMPS' },
          { field: 'credits', op: 'eq', value: 1 },
        ],
      };
      const result = resolve(ast, minimalCatalog);
      // CMPS 490 (1-4 credits) matches at the lower boundary
      expect(result.courses).toHaveLength(1);
      expect(result.courses[0].number).toBe('490');
    });
  });

  describe('ne operator', () => {
    it('excludes courses where value falls within range', () => {
      const ast = {
        type: 'course-filter',
        filters: [
          { field: 'subject', op: 'eq', value: 'CMPS' },
          { field: 'credits', op: 'ne', value: 3 },
        ],
      };
      const result = resolve(ast, minimalCatalog);
      // All CMPS courses are 3 credits except CMPS 490 (1-4, so 3 is in range → excluded)
      expect(result.courses).toHaveLength(0);
    });
  });

  describe('gte operator (creditsMax >= value)', () => {
    it('matches courses that can provide at least the threshold', () => {
      const ast = {
        type: 'course-filter',
        filters: [{ field: 'credits', op: 'gte', value: 4 }],
      };
      const result = resolve(ast, minimalCatalog);
      expect(result.courses.every(c => c.creditsMax >= 4)).toBe(true);
      // MATH 151,152 (4), CMPS 490 (max 4), PHYS 201 (4), CHEM 101 (4), BIOL 101 (4)
      expect(result.courses.length).toBeGreaterThan(0);
    });

    it('includes variable-credit courses where max meets threshold', () => {
      const ast = {
        type: 'course-filter',
        filters: [{ field: 'credits', op: 'gte', value: 4 }],
      };
      const result = resolve(ast, minimalCatalog);
      // CMPS 490 (1-4) has creditsMax=4, so >=4 matches
      expect(result.courses.some(c => c.number === '490')).toBe(true);
    });
  });

  describe('gt operator (creditsMax > value)', () => {
    it('matches courses with max credits strictly greater than threshold', () => {
      const ast = {
        type: 'course-filter',
        filters: [{ field: 'credits', op: 'gt', value: 3 }],
      };
      const result = resolve(ast, minimalCatalog);
      expect(result.courses.every(c => c.creditsMax > 3)).toBe(true);
    });

    it('does not include courses whose max equals the threshold', () => {
      const ast = {
        type: 'course-filter',
        filters: [{ field: 'credits', op: 'gt', value: 4 }],
      };
      const result = resolve(ast, minimalCatalog);
      // No course has creditsMax > 4
      expect(result.courses).toHaveLength(0);
    });
  });

  describe('lte operator (creditsMin <= value)', () => {
    it('matches courses that can cost at most the threshold', () => {
      const ast = {
        type: 'course-filter',
        filters: [{ field: 'credits', op: 'lte', value: 3 }],
      };
      const result = resolve(ast, minimalCatalog);
      expect(result.courses.every(c => c.creditsMin <= 3)).toBe(true);
    });

    it('includes variable-credit courses where min is at or below threshold', () => {
      const ast = {
        type: 'course-filter',
        filters: [{ field: 'credits', op: 'lte', value: 2 }],
      };
      const result = resolve(ast, minimalCatalog);
      // CMPS 490 (creditsMin=1) matches
      expect(result.courses.some(c => c.number === '490')).toBe(true);
    });
  });

  describe('lt operator (creditsMin < value)', () => {
    it('matches courses with min credits strictly less than threshold', () => {
      const ast = {
        type: 'course-filter',
        filters: [{ field: 'credits', op: 'lt', value: 3 }],
      };
      const result = resolve(ast, minimalCatalog);
      expect(result.courses.every(c => c.creditsMin < 3)).toBe(true);
      // CMPS 490 (creditsMin=1)
      expect(result.courses).toHaveLength(1);
    });

    it('does not include courses whose min equals the threshold', () => {
      const ast = {
        type: 'course-filter',
        filters: [{ field: 'credits', op: 'lt', value: 1 }],
      };
      const result = resolve(ast, minimalCatalog);
      expect(result.courses).toHaveLength(0);
    });
  });

  describe('combined credit filters', () => {
    it('credits range with subject filter', () => {
      const ast = {
        type: 'course-filter',
        filters: [
          { field: 'subject', op: 'eq', value: 'MATH' },
          { field: 'credits', op: 'gte', value: 4 },
        ],
      };
      const result = resolve(ast, minimalCatalog);
      // MATH 151 (4), MATH 152 (4) — MATH 101 is 3 credits, MATH 250 is 3 credits
      expect(result.courses).toHaveLength(2);
      expect(result.courses.every(c => c.subject === 'MATH' && c.creditsMax >= 4)).toBe(true);
    });
  });
});

describe('filter evaluation: attribute', () => {
  describe('eq operator', () => {
    it('matches courses with the specified attribute', () => {
      const ast = {
        type: 'course-filter',
        filters: [{ field: 'attribute', op: 'eq', value: 'WI' }],
      };
      const result = resolve(ast, minimalCatalog);
      expect(result.courses.every(c => c.attributes.includes('WI'))).toBe(true);
      // CMPS 310, 320, 360, ENGL 101, ENGL 201
      expect(result.courses).toHaveLength(5);
    });

    it('matches courses with QR attribute', () => {
      const ast = {
        type: 'course-filter',
        filters: [{ field: 'attribute', op: 'eq', value: 'QR' }],
      };
      const result = resolve(ast, minimalCatalog);
      // MATH 101, 151, 152
      expect(result.courses).toHaveLength(3);
      expect(result.courses.every(c => c.attributes.includes('QR'))).toBe(true);
    });

    it('matches courses with HUM attribute', () => {
      const ast = {
        type: 'course-filter',
        filters: [{ field: 'attribute', op: 'eq', value: 'HUM' }],
      };
      const result = resolve(ast, minimalCatalog);
      // ENGL 201, HIST 101, ART 201
      expect(result.courses).toHaveLength(3);
    });

    it('matches courses with SCI attribute', () => {
      const ast = {
        type: 'course-filter',
        filters: [{ field: 'attribute', op: 'eq', value: 'SCI' }],
      };
      const result = resolve(ast, minimalCatalog);
      // HIST 101, PHYS 201, CHEM 101, BIOL 101
      expect(result.courses).toHaveLength(4);
    });

    it('matches courses with FA attribute', () => {
      const ast = {
        type: 'course-filter',
        filters: [{ field: 'attribute', op: 'eq', value: 'FA' }],
      };
      const result = resolve(ast, minimalCatalog);
      // ART 101, 201, 301, 401
      expect(result.courses).toHaveLength(4);
    });

    it('returns empty for attribute not in any course', () => {
      const ast = {
        type: 'course-filter',
        filters: [{ field: 'attribute', op: 'eq', value: 'PE' }],
      };
      const result = resolve(ast, minimalCatalog);
      expect(result.courses).toHaveLength(0);
    });

    it('does not match courses with empty attributes', () => {
      // Use a catalog where a course has no attributes
      const catalog = {
        institution: 'test',
        ay: '2025-2026',
        courses: [
          { id: 1, subject: 'MATH', number: '101', title: 'Algebra', creditsMin: 3, creditsMax: 3 },
        ],
        programs: [],
        attainments: [],
        gradeConfig: { scale: [], passFail: [], withdrawal: [], incomplete: [] },
      };
      const ast = {
        type: 'course-filter',
        filters: [{ field: 'attribute', op: 'eq', value: 'QR' }],
      };
      const result = resolve(ast, catalog);
      expect(result.courses).toHaveLength(0);
    });
  });

  describe('ne operator', () => {
    it('excludes courses with the specified attribute', () => {
      const ast = {
        type: 'course-filter',
        filters: [{ field: 'attribute', op: 'ne', value: 'WI' }],
      };
      const result = resolve(ast, minimalCatalog);
      expect(result.courses.every(c => !c.attributes.includes('WI'))).toBe(true);
      // 25 total - 5 WI courses = 20
      expect(result.courses).toHaveLength(20);
    });
  });

  describe('combined attribute filters', () => {
    it('attribute with subject filter', () => {
      const ast = {
        type: 'course-filter',
        filters: [
          { field: 'subject', op: 'eq', value: 'CMPS' },
          { field: 'attribute', op: 'eq', value: 'WI' },
        ],
      };
      const result = resolve(ast, minimalCatalog);
      // CMPS 310, 320, 360
      expect(result.courses).toHaveLength(3);
    });

    it('attribute with number range', () => {
      const ast = {
        type: 'course-filter',
        filters: [
          { field: 'attribute', op: 'eq', value: 'SCI' },
          { field: 'number', op: 'gte', value: 200 },
        ],
      };
      const result = resolve(ast, minimalCatalog);
      // PHYS 201 (SCI, >=200)
      expect(result.courses).toHaveLength(1);
      expect(result.courses[0].subject).toBe('PHYS');
    });

    it('courses with multiple attributes', () => {
      const ast = {
        type: 'course-filter',
        filters: [
          { field: 'attribute', op: 'eq', value: 'FA' },
          { field: 'attribute', op: 'eq', value: 'HUM' },
        ],
      };
      const result = resolve(ast, minimalCatalog);
      // ART 201 has both FA and HUM
      expect(result.courses).toHaveLength(1);
      expect(result.courses[0].number).toBe('201');
      expect(result.courses[0].subject).toBe('ART');
    });
  });
});
