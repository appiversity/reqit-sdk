'use strict';

const { resolve } = require('../../src/resolve');
const minimalCatalog = require('../fixtures/catalogs/minimal.json');

describe('filter evaluation: prerequisite-includes', () => {
  it('matches courses that have a specific prerequisite', () => {
    // "courses where prerequisite includes (CMPS 230)"
    const ast = {
      type: 'course-filter',
      filters: [{
        field: 'prerequisite-includes',
        op: 'includes',
        value: { type: 'course', subject: 'CMPS', number: '230' },
      }],
    };
    const result = resolve(ast, minimalCatalog);
    // CMPS 310, 320, 350, 360, 380 all have CMPS 230 as a prerequisite
    // (350 has it inside an all-of)
    expect(result.courses.length).toBeGreaterThan(0);
    const numbers = result.courses.map(c => c.subject + ':' + c.number).sort();
    expect(numbers).toEqual([
      'CMPS:310', 'CMPS:320', 'CMPS:350', 'CMPS:360', 'CMPS:380',
    ]);
  });

  it('matches courses with simple prerequisite', () => {
    // "courses where prerequisite includes (MATH 101)"
    const ast = {
      type: 'course-filter',
      filters: [{
        field: 'prerequisite-includes',
        op: 'includes',
        value: { type: 'course', subject: 'MATH', number: '101' },
      }],
    };
    const result = resolve(ast, minimalCatalog);
    // MATH 151 has MATH 101 as a direct prerequisite
    expect(result.courses.some(c => c.subject === 'MATH' && c.number === '151')).toBe(true);
  });

  it('finds prerequisite inside all-of', () => {
    // CMPS 230 has prerequisites: all-of(CMPS 130, CMPS 135)
    const ast = {
      type: 'course-filter',
      filters: [{
        field: 'prerequisite-includes',
        op: 'includes',
        value: { type: 'course', subject: 'CMPS', number: '130' },
      }],
    };
    const result = resolve(ast, minimalCatalog);
    expect(result.courses.some(c => c.subject === 'CMPS' && c.number === '230')).toBe(true);
  });

  it('finds prerequisite inside nested all-of', () => {
    // CMPS 350 has prerequisites: all-of(CMPS 230, MATH 250)
    const ast = {
      type: 'course-filter',
      filters: [{
        field: 'prerequisite-includes',
        op: 'includes',
        value: { type: 'course', subject: 'MATH', number: '250' },
      }],
    };
    const result = resolve(ast, minimalCatalog);
    expect(result.courses.some(c => c.subject === 'CMPS' && c.number === '350')).toBe(true);
  });

  it('does not match courses with null prerequisites', () => {
    // CMPS 130 has no prerequisites
    const ast = {
      type: 'course-filter',
      filters: [{
        field: 'prerequisite-includes',
        op: 'includes',
        value: { type: 'course', subject: 'MATH', number: '999' },
      }],
    };
    const result = resolve(ast, minimalCatalog);
    // CMPS 130, 135, and others without prerequisites should not appear
    expect(result.courses.every(c => {
      // Find this course in catalog to check its prerequisites
      const cat = minimalCatalog.courses.find(
        cc => cc.subject === c.subject && cc.number === c.number
      );
      return cat && cat.prerequisites;
    })).toBe(true);
    // Actually, MATH 999 isn't a prereq for anything
    expect(result.courses).toHaveLength(0);
  });

  it('does not match when the prerequisite is not present', () => {
    const ast = {
      type: 'course-filter',
      filters: [{
        field: 'prerequisite-includes',
        op: 'includes',
        value: { type: 'course', subject: 'ENGL', number: '999' },
      }],
    };
    const result = resolve(ast, minimalCatalog);
    expect(result.courses).toHaveLength(0);
  });

  it('combined with subject filter', () => {
    const ast = {
      type: 'course-filter',
      filters: [
        { field: 'subject', op: 'eq', value: 'CMPS' },
        {
          field: 'prerequisite-includes',
          op: 'includes',
          value: { type: 'course', subject: 'CMPS', number: '230' },
        },
      ],
    };
    const result = resolve(ast, minimalCatalog);
    // Only CMPS courses with CMPS 230 prerequisite
    expect(result.courses.every(c => c.subject === 'CMPS')).toBe(true);
    expect(result.courses).toHaveLength(5);
  });
});

describe('filter evaluation: corequisite-includes', () => {
  it('matches courses that have a specific corequisite', () => {
    // "courses where corequisite includes (CMPS 360)"
    const ast = {
      type: 'course-filter',
      filters: [{
        field: 'corequisite-includes',
        op: 'includes',
        value: { type: 'course', subject: 'CMPS', number: '360' },
      }],
    };
    const result = resolve(ast, minimalCatalog);
    // CMPS 492 has CMPS 360 as a corequisite
    expect(result.courses).toHaveLength(1);
    expect(result.courses[0].subject).toBe('CMPS');
    expect(result.courses[0].number).toBe('492');
  });

  it('does not match courses with null corequisites', () => {
    const ast = {
      type: 'course-filter',
      filters: [{
        field: 'corequisite-includes',
        op: 'includes',
        value: { type: 'course', subject: 'CMPS', number: '310' },
      }],
    };
    const result = resolve(ast, minimalCatalog);
    // No course has CMPS 310 as a corequisite
    expect(result.courses).toHaveLength(0);
  });

  it('does not match when the corequisite is not present', () => {
    const ast = {
      type: 'course-filter',
      filters: [{
        field: 'corequisite-includes',
        op: 'includes',
        value: { type: 'course', subject: 'MATH', number: '101' },
      }],
    };
    const result = resolve(ast, minimalCatalog);
    expect(result.courses).toHaveLength(0);
  });
});

describe('prerequisite-includes with custom catalog', () => {
  const catalog = {
    institution: 'test',
    ay: '2025-2026',
    courses: [
      { id: 1, subject: 'A', number: '100', title: 'A100', creditsMin: 3, creditsMax: 3 },
      { id: 2, subject: 'A', number: '200', title: 'A200', creditsMin: 3, creditsMax: 3,
        prerequisites: { type: 'course', subject: 'A', number: '100' } },
      { id: 3, subject: 'A', number: '300', title: 'A300', creditsMin: 3, creditsMax: 3,
        prerequisites: {
          type: 'any-of',
          items: [
            { type: 'course', subject: 'A', number: '200' },
            { type: 'course', subject: 'B', number: '200' },
          ],
        } },
      { id: 4, subject: 'B', number: '100', title: 'B100', creditsMin: 3, creditsMax: 3 },
      { id: 5, subject: 'B', number: '200', title: 'B200', creditsMin: 3, creditsMax: 3,
        prerequisites: { type: 'course', subject: 'B', number: '100' } },
      { id: 6, subject: 'C', number: '400', title: 'C400', creditsMin: 3, creditsMax: 3,
        prerequisites: {
          type: 'all-of',
          items: [
            { type: 'course', subject: 'A', number: '300' },
            {
              type: 'any-of',
              items: [
                { type: 'course', subject: 'A', number: '100' },
                { type: 'course', subject: 'B', number: '100' },
              ],
            },
          ],
        } },
    ],
    programs: [],
    attainments: [],
    gradeConfig: { scale: [], passFail: [], withdrawal: [], incomplete: [] },
  };

  it('finds prerequisite in any-of', () => {
    const ast = {
      type: 'course-filter',
      filters: [{
        field: 'prerequisite-includes',
        op: 'includes',
        value: { type: 'course', subject: 'B', number: '200' },
      }],
    };
    const result = resolve(ast, catalog);
    // A 300 has B 200 inside any-of
    expect(result.courses.some(c => c.subject === 'A' && c.number === '300')).toBe(true);
  });

  it('finds prerequisite deeply nested', () => {
    const ast = {
      type: 'course-filter',
      filters: [{
        field: 'prerequisite-includes',
        op: 'includes',
        value: { type: 'course', subject: 'A', number: '100' },
      }],
    };
    const result = resolve(ast, catalog);
    // A 200 has direct A 100 prerequisite
    // C 400 has A 100 nested inside all-of → any-of
    expect(result.courses.some(c => c.subject === 'A' && c.number === '200')).toBe(true);
    expect(result.courses.some(c => c.subject === 'C' && c.number === '400')).toBe(true);
  });

  it('courses with no prerequisites never match', () => {
    const ast = {
      type: 'course-filter',
      filters: [{
        field: 'prerequisite-includes',
        op: 'includes',
        value: { type: 'course', subject: 'A', number: '100' },
      }],
    };
    const result = resolve(ast, catalog);
    // A 100 and B 100 have no prerequisites
    expect(result.courses.every(c => !(c.subject === 'A' && c.number === '100'))).toBe(true);
    expect(result.courses.every(c => !(c.subject === 'B' && c.number === '100'))).toBe(true);
  });
});
