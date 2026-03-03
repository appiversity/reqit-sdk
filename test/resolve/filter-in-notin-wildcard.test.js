'use strict';

const { resolve } = require('../../src/resolve');
const minimalCatalog = require('../fixtures/catalogs/minimal.json');

describe('filter evaluation: in operator', () => {
  describe('subject in', () => {
    it('matches courses whose subject is in the list', () => {
      const ast = {
        type: 'course-filter',
        filters: [{ field: 'subject', op: 'in', value: ['CMPS', 'MATH'] }],
      };
      const result = resolve(ast, minimalCatalog);
      expect(result.courses.every(c => ['CMPS', 'MATH'].includes(c.subject))).toBe(true);
      // 11 CMPS + 4 MATH = 15
      expect(result.courses).toHaveLength(15);
    });

    it('handles single-element list', () => {
      const ast = {
        type: 'course-filter',
        filters: [{ field: 'subject', op: 'in', value: ['ART'] }],
      };
      const result = resolve(ast, minimalCatalog);
      expect(result.courses).toHaveLength(4);
    });

    it('returns empty when no subject matches', () => {
      const ast = {
        type: 'course-filter',
        filters: [{ field: 'subject', op: 'in', value: ['PSYC', 'SOCI'] }],
      };
      const result = resolve(ast, minimalCatalog);
      expect(result.courses).toHaveLength(0);
    });
  });

  describe('attribute in', () => {
    it('matches courses that have any attribute in the list', () => {
      const ast = {
        type: 'course-filter',
        filters: [{ field: 'attribute', op: 'in', value: ['QR', 'FA'] }],
      };
      const result = resolve(ast, minimalCatalog);
      expect(result.courses.every(c =>
        c.attributes.includes('QR') || c.attributes.includes('FA')
      )).toBe(true);
      // QR: MATH 101, 151, 152 (3) + FA: ART 101, 201, 301, 401 (4) = 7
      expect(result.courses).toHaveLength(7);
    });

    it('handles single-element attribute list', () => {
      const ast = {
        type: 'course-filter',
        filters: [{ field: 'attribute', op: 'in', value: ['WI'] }],
      };
      const result = resolve(ast, minimalCatalog);
      expect(result.courses).toHaveLength(5);
    });

    it('returns empty when no course has any attribute in the list', () => {
      const ast = {
        type: 'course-filter',
        filters: [{ field: 'attribute', op: 'in', value: ['PE', 'LAB'] }],
      };
      const result = resolve(ast, minimalCatalog);
      expect(result.courses).toHaveLength(0);
    });
  });
});

describe('filter evaluation: not-in operator', () => {
  describe('subject not-in', () => {
    it('excludes courses whose subject is in the list', () => {
      const ast = {
        type: 'course-filter',
        filters: [{ field: 'subject', op: 'not-in', value: ['CMPS', 'MATH'] }],
      };
      const result = resolve(ast, minimalCatalog);
      expect(result.courses.every(c => !['CMPS', 'MATH'].includes(c.subject))).toBe(true);
      // 25 - 15 = 10
      expect(result.courses).toHaveLength(10);
    });

    it('keeps all courses when excluded subjects are not present', () => {
      const ast = {
        type: 'course-filter',
        filters: [{ field: 'subject', op: 'not-in', value: ['PSYC'] }],
      };
      const result = resolve(ast, minimalCatalog);
      expect(result.courses).toHaveLength(25);
    });
  });

  describe('attribute not-in', () => {
    it('excludes courses that have any attribute in the list', () => {
      const ast = {
        type: 'course-filter',
        filters: [{ field: 'attribute', op: 'not-in', value: ['WI', 'QR'] }],
      };
      const result = resolve(ast, minimalCatalog);
      expect(result.courses.every(c =>
        !c.attributes.includes('WI') && !c.attributes.includes('QR')
      )).toBe(true);
      // 25 total - 5 WI - 3 QR = 17
      expect(result.courses).toHaveLength(17);
    });
  });
});

describe('filter evaluation: wildcard operator', () => {
  it('matches all courses (subject = "*")', () => {
    const ast = {
      type: 'course-filter',
      filters: [{ field: 'subject', op: 'wildcard', value: '*' }],
    };
    const result = resolve(ast, minimalCatalog);
    expect(result.courses).toHaveLength(25);
  });

  it('wildcard combined with other filters narrows results', () => {
    const ast = {
      type: 'course-filter',
      filters: [
        { field: 'subject', op: 'wildcard', value: '*' },
        { field: 'number', op: 'gte', value: 300 },
      ],
    };
    const result = resolve(ast, minimalCatalog);
    // All courses with number >= 300
    expect(result.courses.every(c => parseInt(c.number, 10) >= 300)).toBe(true);
    expect(result.courses).toHaveLength(10);
  });

  it('wildcard combined with attribute filter', () => {
    const ast = {
      type: 'course-filter',
      filters: [
        { field: 'subject', op: 'wildcard', value: '*' },
        { field: 'attribute', op: 'eq', value: 'SCI' },
      ],
    };
    const result = resolve(ast, minimalCatalog);
    expect(result.courses).toHaveLength(4);
  });
});

describe('filter evaluation: != (ne) operator', () => {
  // ne is already tested in subject and attribute tests but adding explicit
  // tests here for the plan step completeness

  it('subject != excludes matching subject', () => {
    const ast = {
      type: 'course-filter',
      filters: [{ field: 'subject', op: 'ne', value: 'ENGL' }],
    };
    const result = resolve(ast, minimalCatalog);
    expect(result.courses.every(c => c.subject !== 'ENGL')).toBe(true);
    // 25 - 2 ENGL = 23
    expect(result.courses).toHaveLength(23);
  });

  it('number != excludes matching number', () => {
    const ast = {
      type: 'course-filter',
      filters: [{ field: 'number', op: 'ne', value: '101' }],
    };
    const result = resolve(ast, minimalCatalog);
    expect(result.courses.every(c => c.number !== '101')).toBe(true);
  });

  it('attribute != excludes courses with that attribute', () => {
    const ast = {
      type: 'course-filter',
      filters: [{ field: 'attribute', op: 'ne', value: 'FA' }],
    };
    const result = resolve(ast, minimalCatalog);
    expect(result.courses.every(c => !c.attributes.includes('FA'))).toBe(true);
    // 25 - 4 FA = 21
    expect(result.courses).toHaveLength(21);
  });
});

describe('combined in/not-in/wildcard with other filters', () => {
  it('subject in + number range + attribute filter', () => {
    const ast = {
      type: 'course-filter',
      filters: [
        { field: 'subject', op: 'in', value: ['CMPS', 'ENGL'] },
        { field: 'attribute', op: 'eq', value: 'WI' },
      ],
    };
    const result = resolve(ast, minimalCatalog);
    // CMPS WI courses: 310, 320, 360 (3) + ENGL WI: 101, 201 (2) = 5
    expect(result.courses).toHaveLength(5);
  });

  it('subject not-in + credits filter', () => {
    const ast = {
      type: 'course-filter',
      filters: [
        { field: 'subject', op: 'not-in', value: ['CMPS', 'MATH'] },
        { field: 'credits', op: 'gte', value: 4 },
      ],
    };
    const result = resolve(ast, minimalCatalog);
    // Non-CMPS/MATH courses with >= 4 credits: PHYS 201 (4), CHEM 101 (4), BIOL 101 (4)
    expect(result.courses).toHaveLength(3);
  });
});
