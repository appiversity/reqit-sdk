'use strict';

const { parse } = require('../../src/parser');

describe('courses where — subject filters', () => {
  test('subject equality', () => {
    expect(parse('courses where subject = "CMPS"')).toEqual({
      type: 'course-filter',
      filters: [{ field: 'subject', op: 'eq', value: 'CMPS' }],
    });
  });

  test('subject equality preserves value case', () => {
    // Filter values stored as-is — resolution handles matching
    expect(parse('courses where subject = "cmps"')).toEqual({
      type: 'course-filter',
      filters: [{ field: 'subject', op: 'eq', value: 'cmps' }],
    });
  });

  test('case-insensitive keywords: Courses Where', () => {
    expect(parse('Courses Where Subject = "MATH"')).toEqual({
      type: 'course-filter',
      filters: [{ field: 'subject', op: 'eq', value: 'MATH' }],
    });
  });

  test('case-insensitive keywords: COURSES WHERE', () => {
    expect(parse('COURSES WHERE SUBJECT = "CSE"')).toEqual({
      type: 'course-filter',
      filters: [{ field: 'subject', op: 'eq', value: 'CSE' }],
    });
  });
});

describe('courses where — number filters', () => {
  test('number >= N', () => {
    expect(parse('courses where number >= 300')).toEqual({
      type: 'course-filter',
      filters: [{ field: 'number', op: 'gte', value: 300 }],
    });
  });

  test('number <= N', () => {
    expect(parse('courses where number <= 200')).toEqual({
      type: 'course-filter',
      filters: [{ field: 'number', op: 'lte', value: 200 }],
    });
  });

  test('number > N', () => {
    expect(parse('courses where number > 100')).toEqual({
      type: 'course-filter',
      filters: [{ field: 'number', op: 'gt', value: 100 }],
    });
  });

  test('number < N', () => {
    expect(parse('courses where number < 500')).toEqual({
      type: 'course-filter',
      filters: [{ field: 'number', op: 'lt', value: 500 }],
    });
  });

  test('number = N (integer)', () => {
    expect(parse('courses where number = 151')).toEqual({
      type: 'course-filter',
      filters: [{ field: 'number', op: 'eq', value: 151 }],
    });
  });

  test('number = "220" (string for exact match)', () => {
    // Quoted value for exact string comparison (won't match "220.2")
    expect(parse('courses where number = "220"')).toEqual({
      type: 'course-filter',
      filters: [{ field: 'number', op: 'eq', value: '220' }],
    });
  });
});

describe('courses where — compound filters (and)', () => {
  test('subject and number >=', () => {
    expect(parse('courses where subject = "CMPS" and number >= 300')).toEqual({
      type: 'course-filter',
      filters: [
        { field: 'subject', op: 'eq', value: 'CMPS' },
        { field: 'number', op: 'gte', value: 300 },
      ],
    });
  });

  test('subject and number range (>= and <=)', () => {
    expect(parse('courses where subject = "MATH" and number >= 100 and number <= 299')).toEqual({
      type: 'course-filter',
      filters: [
        { field: 'subject', op: 'eq', value: 'MATH' },
        { field: 'number', op: 'gte', value: 100 },
        { field: 'number', op: 'lte', value: 299 },
      ],
    });
  });

  test('case-insensitive AND keyword', () => {
    expect(parse('courses where subject = "CSE" AND number >= 200')).toEqual({
      type: 'course-filter',
      filters: [
        { field: 'subject', op: 'eq', value: 'CSE' },
        { field: 'number', op: 'gte', value: 200 },
      ],
    });
  });

  test('no whitespace around operators', () => {
    expect(parse('courses where subject="CMPS" and number>=300')).toEqual({
      type: 'course-filter',
      filters: [
        { field: 'subject', op: 'eq', value: 'CMPS' },
        { field: 'number', op: 'gte', value: 300 },
      ],
    });
  });
});

describe('courses where — inside set operators', () => {
  test('course filter inside all-of', () => {
    const input = `all of (
      CSCI 141,
      courses where subject = "CSCI" and number >= 300
    )`;
    expect(parse(input)).toEqual({
      type: 'all-of',
      items: [
        { type: 'course', subject: 'CSCI', number: '141' },
        {
          type: 'course-filter',
          filters: [
            { field: 'subject', op: 'eq', value: 'CSCI' },
            { field: 'number', op: 'gte', value: 300 },
          ],
        },
      ],
    });
  });

  test('course filter inside any-of', () => {
    expect(parse('any of (courses where subject = "MATH", courses where subject = "CSCI")')).toEqual({
      type: 'any-of',
      items: [
        {
          type: 'course-filter',
          filters: [{ field: 'subject', op: 'eq', value: 'MATH' }],
        },
        {
          type: 'course-filter',
          filters: [{ field: 'subject', op: 'eq', value: 'CSCI' }],
        },
      ],
    });
  });

  // Lehigh case study: upper-division tech electives
  test('Lehigh: at least 3 upper-division CSE courses', () => {
    const input = 'at least 3 of (courses where subject = "CSE" and number >= 300)';
    expect(parse(input)).toEqual({
      type: 'n-of',
      comparison: 'at-least',
      count: 3,
      items: [
        {
          type: 'course-filter',
          filters: [
            { field: 'subject', op: 'eq', value: 'CSE' },
            { field: 'number', op: 'gte', value: 300 },
          ],
        },
      ],
    });
  });

  test('course filter mixed with course refs in n-of', () => {
    const input = `at least 2 of (
      CMPS 305,
      CMPS 311,
      courses where subject = "CMPS" and number >= 400
    )`;
    expect(parse(input)).toEqual({
      type: 'n-of',
      comparison: 'at-least',
      count: 2,
      items: [
        { type: 'course', subject: 'CMPS', number: '305' },
        { type: 'course', subject: 'CMPS', number: '311' },
        {
          type: 'course-filter',
          filters: [
            { field: 'subject', op: 'eq', value: 'CMPS' },
            { field: 'number', op: 'gte', value: 400 },
          ],
        },
      ],
    });
  });
});

describe('courses where — formatting', () => {
  test('multiline with comments', () => {
    const input = `all of (
      courses where subject = "CMPS"  # CS courses
        and number >= 300,            # upper division
      CMPS 141                        # also required
    )`;
    expect(parse(input)).toEqual({
      type: 'all-of',
      items: [
        {
          type: 'course-filter',
          filters: [
            { field: 'subject', op: 'eq', value: 'CMPS' },
            { field: 'number', op: 'gte', value: 300 },
          ],
        },
        { type: 'course', subject: 'CMPS', number: '141' },
      ],
    });
  });

  test('extra whitespace around operators', () => {
    expect(parse('courses where   subject   =   "CSCI"   and   number   >=   200')).toEqual({
      type: 'course-filter',
      filters: [
        { field: 'subject', op: 'eq', value: 'CSCI' },
        { field: 'number', op: 'gte', value: 200 },
      ],
    });
  });
});

describe('courses where — error cases', () => {
  test('missing field name fails', () => {
    expect(() => parse('courses where = "CMPS"')).toThrow();
  });

  test('missing value fails', () => {
    expect(() => parse('courses where subject =')).toThrow();
  });

  test('missing operator fails', () => {
    expect(() => parse('courses where subject "CMPS"')).toThrow();
  });

  test('missing where keyword fails', () => {
    expect(() => parse('courses subject = "CMPS"')).toThrow();
  });

  test('unknown field name treated as parse error', () => {
    // "level" is not a recognized filter field
    expect(() => parse('courses where level = "300"')).toThrow();
  });
});
