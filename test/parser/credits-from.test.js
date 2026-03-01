'use strict';

const { parse } = require('../../src/parser');

describe('at least N credits from (...)', () => {
  test('credits from a course filter', () => {
    expect(parse('at least 12 credits from (courses where subject = "CMPS" and number >= 300)')).toEqual({
      type: 'credits-from',
      comparison: 'at-least',
      credits: 12,
      source: {
        type: 'course-filter',
        filters: [
          { field: 'subject', op: 'eq', value: 'CMPS' },
          { field: 'number', op: 'gte', value: 300 },
        ],
      },
    });
  });

  test('credits from explicit course list (wraps in all-of)', () => {
    expect(parse('at least 6 credits from (CMPS 301, CMPS 302, CMPS 350, CMPS 360)')).toEqual({
      type: 'credits-from',
      comparison: 'at-least',
      credits: 6,
      source: {
        type: 'all-of',
        items: [
          { type: 'course', subject: 'CMPS', number: '301' },
          { type: 'course', subject: 'CMPS', number: '302' },
          { type: 'course', subject: 'CMPS', number: '350' },
          { type: 'course', subject: 'CMPS', number: '360' },
        ],
      },
    });
  });

  test('credits from single course (no wrapping)', () => {
    expect(parse('at least 3 credits from (MATH 151)')).toEqual({
      type: 'credits-from',
      comparison: 'at-least',
      credits: 3,
      source: { type: 'course', subject: 'MATH', number: '151' },
    });
  });

  // Lehigh case study: 120 total credits
  test('Lehigh: total degree credits', () => {
    expect(parse('at least 120 credits from (courses where subject = "CMPS")')).toEqual({
      type: 'credits-from',
      comparison: 'at-least',
      credits: 120,
      source: {
        type: 'course-filter',
        filters: [{ field: 'subject', op: 'eq', value: 'CMPS' }],
      },
    });
  });
});

describe('at most N credits from (...)', () => {
  test('at most credits from course filter', () => {
    expect(parse('at most 6 credits from (courses where subject = "PHYS")')).toEqual({
      type: 'credits-from',
      comparison: 'at-most',
      credits: 6,
      source: {
        type: 'course-filter',
        filters: [{ field: 'subject', op: 'eq', value: 'PHYS' }],
      },
    });
  });

  test('at most credits from course list', () => {
    expect(parse('at most 8 credits from (MATH 205, MATH 241, MATH 242)')).toEqual({
      type: 'credits-from',
      comparison: 'at-most',
      credits: 8,
      source: {
        type: 'all-of',
        items: [
          { type: 'course', subject: 'MATH', number: '205' },
          { type: 'course', subject: 'MATH', number: '241' },
          { type: 'course', subject: 'MATH', number: '242' },
        ],
      },
    });
  });
});

describe('exactly N credits from (...)', () => {
  test('exactly credits from course filter', () => {
    expect(parse('exactly 9 credits from (courses where subject = "CSCI" and number >= 400)')).toEqual({
      type: 'credits-from',
      comparison: 'exactly',
      credits: 9,
      source: {
        type: 'course-filter',
        filters: [
          { field: 'subject', op: 'eq', value: 'CSCI' },
          { field: 'number', op: 'gte', value: 400 },
        ],
      },
    });
  });
});

describe('credits-from nesting and formatting', () => {
  test('credits-from inside all-of', () => {
    const input = `all of (
      CSCI 141,
      at least 12 credits from (courses where subject = "CSCI" and number >= 300)
    )`;
    expect(parse(input)).toEqual({
      type: 'all-of',
      items: [
        { type: 'course', subject: 'CSCI', number: '141' },
        {
          type: 'credits-from',
          comparison: 'at-least',
          credits: 12,
          source: {
            type: 'course-filter',
            filters: [
              { field: 'subject', op: 'eq', value: 'CSCI' },
              { field: 'number', op: 'gte', value: 300 },
            ],
          },
        },
      ],
    });
  });

  test('case-insensitive keywords', () => {
    expect(parse('At Least 6 Credits From (MATH 151, MATH 152)')).toEqual({
      type: 'credits-from',
      comparison: 'at-least',
      credits: 6,
      source: {
        type: 'all-of',
        items: [
          { type: 'course', subject: 'MATH', number: '151' },
          { type: 'course', subject: 'MATH', number: '152' },
        ],
      },
    });
  });

  test('multiline with comments', () => {
    const input = `at least 9 credits from (
      CMPS 305, # Cyber Security
      CMPS 311, # Operating Systems
      CMPS 320, # Machine Learning
      CMPS 331  # AI
    )`;
    expect(parse(input)).toEqual({
      type: 'credits-from',
      comparison: 'at-least',
      credits: 9,
      source: {
        type: 'all-of',
        items: [
          { type: 'course', subject: 'CMPS', number: '305' },
          { type: 'course', subject: 'CMPS', number: '311' },
          { type: 'course', subject: 'CMPS', number: '320' },
          { type: 'course', subject: 'CMPS', number: '331' },
        ],
      },
    });
  });

  test('credits value is parsed as integer', () => {
    const ast = parse('at least 12 credits from (MATH 151)');
    expect(ast.credits).toBe(12);
    expect(typeof ast.credits).toBe('number');
  });

  test('does not conflict with n-of (at least N of)', () => {
    // "at least 3 of" should still parse as n-of, not credits-from
    expect(parse('at least 3 of (MATH 151, MATH 152, MATH 250)')).toEqual({
      type: 'n-of',
      comparison: 'at-least',
      count: 3,
      items: [
        { type: 'course', subject: 'MATH', number: '151' },
        { type: 'course', subject: 'MATH', number: '152' },
        { type: 'course', subject: 'MATH', number: '250' },
      ],
    });
  });
});

describe('credits-from — error cases', () => {
  test('missing credits number fails', () => {
    expect(() => parse('at least credits from (MATH 151)')).toThrow();
  });

  test('empty parens fails', () => {
    expect(() => parse('at least 12 credits from ()')).toThrow();
  });
});
