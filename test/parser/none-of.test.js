'use strict';

const { parse } = require('../../src/parser');

describe('none of (...)', () => {
  test('none of single course', () => {
    expect(parse('none of (CMPS 490)')).toEqual({
      type: 'none-of',
      items: [{ type: 'course', subject: 'CMPS', number: '490' }],
    });
  });

  test('none of multiple courses', () => {
    expect(parse('none of (CMPS 490, CMPS 491, CMPS 492)')).toEqual({
      type: 'none-of',
      items: [
        { type: 'course', subject: 'CMPS', number: '490' },
        { type: 'course', subject: 'CMPS', number: '491' },
        { type: 'course', subject: 'CMPS', number: '492' },
      ],
    });
  });

  test('case-insensitive keywords', () => {
    expect(parse('NONE OF (MATH 151)')).toEqual({
      type: 'none-of',
      items: [{ type: 'course', subject: 'MATH', number: '151' }],
    });
    expect(parse('None Of (MATH 151)')).toEqual({
      type: 'none-of',
      items: [{ type: 'course', subject: 'MATH', number: '151' }],
    });
  });

  test('none of inside all-of', () => {
    const input = `all of (
      CSCI 141,
      none of (CSCI 490, CSCI 491)
    )`;
    expect(parse(input)).toEqual({
      type: 'all-of',
      items: [
        { type: 'course', subject: 'CSCI', number: '141' },
        {
          type: 'none-of',
          items: [
            { type: 'course', subject: 'CSCI', number: '490' },
            { type: 'course', subject: 'CSCI', number: '491' },
          ],
        },
      ],
    });
  });

  test('none of with course filter', () => {
    expect(parse('none of (courses where subject = "PHYS")')).toEqual({
      type: 'none-of',
      items: [
        {
          type: 'course-filter',
          filters: [{ field: 'subject', op: 'eq', value: 'PHYS' }],
        },
      ],
    });
  });

  test('multiline with comments', () => {
    const input = `none of (
      CMPS 490, # Capstone I
      CMPS 491  # Capstone II
    )`;
    expect(parse(input)).toEqual({
      type: 'none-of',
      items: [
        { type: 'course', subject: 'CMPS', number: '490' },
        { type: 'course', subject: 'CMPS', number: '491' },
      ],
    });
  });
});

describe('none of — error cases', () => {
  test('empty parens fails', () => {
    expect(() => parse('none of ()')).toThrow();
  });
});
