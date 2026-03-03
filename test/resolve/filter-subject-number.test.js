'use strict';

const { resolve } = require('../../src/resolve');
const minimalCatalog = require('../fixtures/catalogs/minimal.json');

describe('filter evaluation: subject', () => {
  describe('eq operator', () => {
    it('matches courses with the given subject', () => {
      const ast = {
        type: 'course-filter',
        filters: [{ field: 'subject', op: 'eq', value: 'CMPS' }],
      };
      const result = resolve(ast, minimalCatalog);
      expect(result.courses.length).toBeGreaterThan(0);
      expect(result.courses.every(c => c.subject === 'CMPS')).toBe(true);
    });

    it('returns all CMPS courses from minimal catalog', () => {
      const ast = {
        type: 'course-filter',
        filters: [{ field: 'subject', op: 'eq', value: 'CMPS' }],
      };
      const result = resolve(ast, minimalCatalog);
      // minimal catalog has 11 CMPS courses (130,135,230,310,320,350,360,380,490,491,492)
      expect(result.courses).toHaveLength(11);
    });

    it('returns all MATH courses from minimal catalog', () => {
      const ast = {
        type: 'course-filter',
        filters: [{ field: 'subject', op: 'eq', value: 'MATH' }],
      };
      const result = resolve(ast, minimalCatalog);
      // minimal catalog has 4 MATH courses (101,151,152,250)
      expect(result.courses).toHaveLength(4);
    });

    it('returns empty for subject not in catalog', () => {
      const ast = {
        type: 'course-filter',
        filters: [{ field: 'subject', op: 'eq', value: 'PSYC' }],
      };
      const result = resolve(ast, minimalCatalog);
      expect(result.courses).toHaveLength(0);
    });

    it('is case-sensitive (subjects are uppercase in catalog)', () => {
      const ast = {
        type: 'course-filter',
        filters: [{ field: 'subject', op: 'eq', value: 'cmps' }],
      };
      const result = resolve(ast, minimalCatalog);
      expect(result.courses).toHaveLength(0);
    });
  });

  describe('ne operator', () => {
    it('excludes courses with the given subject', () => {
      const ast = {
        type: 'course-filter',
        filters: [{ field: 'subject', op: 'ne', value: 'CMPS' }],
      };
      const result = resolve(ast, minimalCatalog);
      expect(result.courses.every(c => c.subject !== 'CMPS')).toBe(true);
      // 25 total courses - 11 CMPS = 14
      expect(result.courses).toHaveLength(14);
    });
  });

  describe('filter populates both courses and filters', () => {
    it('adds matched courses to result.courses', () => {
      const ast = {
        type: 'course-filter',
        filters: [{ field: 'subject', op: 'eq', value: 'ART' }],
      };
      const result = resolve(ast, minimalCatalog);
      expect(result.courses).toHaveLength(4); // ART 101, 201, 301, 401
      expect(result.filters).toHaveLength(1);
      expect(result.filters[0].matched).toHaveLength(4);
      expect(result.filters[0].node).toBe(ast);
    });

    it('filter-matched courses and explicit refs are deduplicated', () => {
      const ast = {
        type: 'all-of',
        items: [
          { type: 'course', subject: 'ART', number: '101' },
          {
            type: 'course-filter',
            filters: [{ field: 'subject', op: 'eq', value: 'ART' }],
          },
        ],
      };
      const result = resolve(ast, minimalCatalog);
      // ART 101 appears as explicit ref AND in filter result — deduplicated to 4
      expect(result.courses).toHaveLength(4);
    });
  });
});

describe('filter evaluation: number', () => {
  describe('eq operator (exact string match)', () => {
    it('matches courses with the exact number string', () => {
      const ast = {
        type: 'course-filter',
        filters: [{ field: 'number', op: 'eq', value: '101' }],
      };
      const result = resolve(ast, minimalCatalog);
      expect(result.courses.every(c => c.number === '101')).toBe(true);
      // MATH 101, ENGL 101, HIST 101, ART 101, CHEM 101, BIOL 101
      expect(result.courses).toHaveLength(6);
    });

    it('handles numeric value coerced to string', () => {
      const ast = {
        type: 'course-filter',
        filters: [{ field: 'number', op: 'eq', value: 101 }],
      };
      const result = resolve(ast, minimalCatalog);
      expect(result.courses).toHaveLength(6);
    });
  });

  describe('ne operator (exact string mismatch)', () => {
    it('excludes courses with the exact number string', () => {
      const ast = {
        type: 'course-filter',
        filters: [{ field: 'number', op: 'ne', value: '101' }],
      };
      const result = resolve(ast, minimalCatalog);
      expect(result.courses.every(c => c.number !== '101')).toBe(true);
      // 25 total - 6 with number "101" = 19
      expect(result.courses).toHaveLength(19);
    });
  });

  describe('gte operator (numeric coercion)', () => {
    it('matches courses with number >= threshold', () => {
      const ast = {
        type: 'course-filter',
        filters: [{ field: 'number', op: 'gte', value: 300 }],
      };
      const result = resolve(ast, minimalCatalog);
      expect(result.courses.every(c => parseInt(c.number, 10) >= 300)).toBe(true);
      // CMPS 310,320,350,360,380,490,491,492 + ART 301,401
      expect(result.courses).toHaveLength(10);
    });

    it('includes boundary value', () => {
      const ast = {
        type: 'course-filter',
        filters: [{ field: 'number', op: 'gte', value: 310 }],
      };
      const result = resolve(ast, minimalCatalog);
      expect(result.courses.some(c => c.number === '310')).toBe(true);
    });
  });

  describe('gt operator', () => {
    it('matches courses with number > threshold', () => {
      const ast = {
        type: 'course-filter',
        filters: [{ field: 'number', op: 'gt', value: 400 }],
      };
      const result = resolve(ast, minimalCatalog);
      // CMPS 490, 491, 492 + ART 401
      expect(result.courses.every(c => parseInt(c.number, 10) > 400)).toBe(true);
      expect(result.courses).toHaveLength(4);
    });

    it('excludes boundary value', () => {
      const ast = {
        type: 'course-filter',
        filters: [{ field: 'number', op: 'gt', value: 310 }],
      };
      const result = resolve(ast, minimalCatalog);
      expect(result.courses.some(c => c.number === '310')).toBe(false);
    });
  });

  describe('lte operator', () => {
    it('matches courses with number <= threshold', () => {
      const ast = {
        type: 'course-filter',
        filters: [{ field: 'number', op: 'lte', value: 150 }],
      };
      const result = resolve(ast, minimalCatalog);
      expect(result.courses.every(c => parseInt(c.number, 10) <= 150)).toBe(true);
    });

    it('includes boundary value', () => {
      const ast = {
        type: 'course-filter',
        filters: [{ field: 'number', op: 'lte', value: 130 }],
      };
      const result = resolve(ast, minimalCatalog);
      expect(result.courses.some(c => c.number === '130')).toBe(true);
    });
  });

  describe('lt operator', () => {
    it('matches courses with number < threshold', () => {
      const ast = {
        type: 'course-filter',
        filters: [{ field: 'number', op: 'lt', value: 200 }],
      };
      const result = resolve(ast, minimalCatalog);
      expect(result.courses.every(c => parseInt(c.number, 10) < 200)).toBe(true);
    });

    it('excludes boundary value', () => {
      const ast = {
        type: 'course-filter',
        filters: [{ field: 'number', op: 'lt', value: 130 }],
      };
      const result = resolve(ast, minimalCatalog);
      expect(result.courses.some(c => c.number === '130')).toBe(false);
    });
  });

  describe('combined subject + number filters (AND logic)', () => {
    it('applies subject and number filters together', () => {
      const ast = {
        type: 'course-filter',
        filters: [
          { field: 'subject', op: 'eq', value: 'CMPS' },
          { field: 'number', op: 'gte', value: 300 },
        ],
      };
      const result = resolve(ast, minimalCatalog);
      expect(result.courses.every(c =>
        c.subject === 'CMPS' && parseInt(c.number, 10) >= 300
      )).toBe(true);
      // CMPS 310,320,350,360,380,490,491,492
      expect(result.courses).toHaveLength(8);
    });

    it('applies subject and number range', () => {
      const ast = {
        type: 'course-filter',
        filters: [
          { field: 'subject', op: 'eq', value: 'CMPS' },
          { field: 'number', op: 'gte', value: 300 },
          { field: 'number', op: 'lt', value: 400 },
        ],
      };
      const result = resolve(ast, minimalCatalog);
      // CMPS 310, 320, 350, 360, 380
      expect(result.courses).toHaveLength(5);
      expect(result.courses.every(c => {
        const n = parseInt(c.number, 10);
        return c.subject === 'CMPS' && n >= 300 && n < 400;
      })).toBe(true);
    });

    it('returns empty when no courses match all filters', () => {
      const ast = {
        type: 'course-filter',
        filters: [
          { field: 'subject', op: 'eq', value: 'ART' },
          { field: 'number', op: 'gte', value: 500 },
        ],
      };
      const result = resolve(ast, minimalCatalog);
      expect(result.courses).toHaveLength(0);
    });
  });

  describe('number with alphanumeric course numbers', () => {
    it('extracts leading digits for numeric comparisons', () => {
      const catalog = {
        institution: 'test',
        ay: '2025-2026',
        courses: [
          { id: 1, subject: 'CHEM', number: '101A', title: 'Chem A', creditsMin: 4, creditsMax: 4 },
          { id: 2, subject: 'CHEM', number: '101B', title: 'Chem B', creditsMin: 4, creditsMax: 4 },
          { id: 3, subject: 'CHEM', number: '201', title: 'Org Chem', creditsMin: 4, creditsMax: 4 },
          { id: 4, subject: 'CHEM', number: '301', title: 'Phys Chem', creditsMin: 4, creditsMax: 4 },
        ],
        programs: [],
        attainments: [],
        gradeConfig: { scale: [], passFail: [], withdrawal: [], incomplete: [] },
      };
      const ast = {
        type: 'course-filter',
        filters: [{ field: 'number', op: 'gte', value: 200 }],
      };
      const result = resolve(ast, catalog);
      // 201 and 301 (101A and 101B have leading numeric 101, which is < 200)
      expect(result.courses).toHaveLength(2);
    });

    it('uses exact string for eq with alphanumeric numbers', () => {
      const catalog = {
        institution: 'test',
        ay: '2025-2026',
        courses: [
          { id: 1, subject: 'CHEM', number: '101A', title: 'Chem A', creditsMin: 4, creditsMax: 4 },
          { id: 2, subject: 'CHEM', number: '101B', title: 'Chem B', creditsMin: 4, creditsMax: 4 },
          { id: 3, subject: 'CHEM', number: '101', title: 'Chem', creditsMin: 4, creditsMax: 4 },
        ],
        programs: [],
        attainments: [],
        gradeConfig: { scale: [], passFail: [], withdrawal: [], incomplete: [] },
      };
      const ast = {
        type: 'course-filter',
        filters: [{ field: 'number', op: 'eq', value: '101A' }],
      };
      const result = resolve(ast, catalog);
      expect(result.courses).toHaveLength(1);
      expect(result.courses[0].number).toBe('101A');
    });

    it('handles dotted course numbers for numeric comparisons', () => {
      const catalog = {
        institution: 'test',
        ay: '2025-2026',
        courses: [
          { id: 1, subject: 'MATH', number: '220.1', title: 'Part 1', creditsMin: 2, creditsMax: 2 },
          { id: 2, subject: 'MATH', number: '220.2', title: 'Part 2', creditsMin: 2, creditsMax: 2 },
          { id: 3, subject: 'MATH', number: '221', title: 'Next', creditsMin: 3, creditsMax: 3 },
        ],
        programs: [],
        attainments: [],
        gradeConfig: { scale: [], passFail: [], withdrawal: [], incomplete: [] },
      };
      const ast = {
        type: 'course-filter',
        filters: [{ field: 'number', op: 'gte', value: 220.2 }],
      };
      const result = resolve(ast, catalog);
      // 220.2 and 221 match (220.1 < 220.2)
      expect(result.courses).toHaveLength(2);
    });
  });
});
