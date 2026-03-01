'use strict';

const { parse } = require('../../src/parser');

describe('except (...) modifier', () => {
  test('course filter except single course', () => {
    expect(parse('courses where subject = "CMPS" except (CMPS 490)')).toEqual({
      type: 'except',
      source: {
        type: 'course-filter',
        filters: [{ field: 'subject', op: 'eq', value: 'CMPS' }],
      },
      exclude: [{ type: 'course', subject: 'CMPS', number: '490' }],
    });
  });

  test('course filter except multiple courses', () => {
    expect(parse('courses where subject = "CSCI" except (CSCI 490, CSCI 491)')).toEqual({
      type: 'except',
      source: {
        type: 'course-filter',
        filters: [{ field: 'subject', op: 'eq', value: 'CSCI' }],
      },
      exclude: [
        { type: 'course', subject: 'CSCI', number: '490' },
        { type: 'course', subject: 'CSCI', number: '491' },
      ],
    });
  });

  test('all-of except courses', () => {
    const input = 'all of (CMPS 301, CMPS 302, CMPS 350) except (CMPS 350)';
    expect(parse(input)).toEqual({
      type: 'except',
      source: {
        type: 'all-of',
        items: [
          { type: 'course', subject: 'CMPS', number: '301' },
          { type: 'course', subject: 'CMPS', number: '302' },
          { type: 'course', subject: 'CMPS', number: '350' },
        ],
      },
      exclude: [{ type: 'course', subject: 'CMPS', number: '350' }],
    });
  });

  test('except inside an item list', () => {
    const input = `all of (
      courses where subject = "CMPS" except (CMPS 490),
      MATH 151
    )`;
    expect(parse(input)).toEqual({
      type: 'all-of',
      items: [
        {
          type: 'except',
          source: {
            type: 'course-filter',
            filters: [{ field: 'subject', op: 'eq', value: 'CMPS' }],
          },
          exclude: [{ type: 'course', subject: 'CMPS', number: '490' }],
        },
        { type: 'course', subject: 'MATH', number: '151' },
      ],
    });
  });

  // credits-from with except — except wraps the credits-from at parse level
  test('credits-from with except', () => {
    const input = 'at least 15 credits from (courses where subject = "CSE" and number >= 200) except (CSE 490)';
    expect(parse(input)).toEqual({
      type: 'except',
      source: {
        type: 'credits-from',
        comparison: 'at-least',
        credits: 15,
        source: {
          type: 'course-filter',
          filters: [
            { field: 'subject', op: 'eq', value: 'CSE' },
            { field: 'number', op: 'gte', value: 200 },
          ],
        },
      },
      exclude: [{ type: 'course', subject: 'CSE', number: '490' }],
    });
  });

  test('except with n-of', () => {
    const input = 'at least 3 of (courses where subject = "CSCI" and number >= 300) except (CSCI 490)';
    expect(parse(input)).toEqual({
      type: 'except',
      source: {
        type: 'n-of',
        comparison: 'at-least',
        count: 3,
        items: [
          {
            type: 'course-filter',
            filters: [
              { field: 'subject', op: 'eq', value: 'CSCI' },
              { field: 'number', op: 'gte', value: 300 },
            ],
          },
        ],
      },
      exclude: [{ type: 'course', subject: 'CSCI', number: '490' }],
    });
  });

  test('case-insensitive EXCEPT keyword', () => {
    expect(parse('courses where subject = "CMPS" EXCEPT (CMPS 490)')).toEqual({
      type: 'except',
      source: {
        type: 'course-filter',
        filters: [{ field: 'subject', op: 'eq', value: 'CMPS' }],
      },
      exclude: [{ type: 'course', subject: 'CMPS', number: '490' }],
    });
  });

  test('except with course filter in exclude list', () => {
    const input = 'courses where subject = "CMPS" except (courses where number >= 400)';
    expect(parse(input)).toEqual({
      type: 'except',
      source: {
        type: 'course-filter',
        filters: [{ field: 'subject', op: 'eq', value: 'CMPS' }],
      },
      exclude: [
        {
          type: 'course-filter',
          filters: [{ field: 'number', op: 'gte', value: 400 }],
        },
      ],
    });
  });

  // W&M case study: upper-division electives excluding capstone
  test('W&M: CS electives except capstone', () => {
    const input = `at least 3 of (
      courses where subject = "CSCI" and number >= 400
    ) except (CSCI 495, CSCI 496)`;
    expect(parse(input)).toEqual({
      type: 'except',
      source: {
        type: 'n-of',
        comparison: 'at-least',
        count: 3,
        items: [
          {
            type: 'course-filter',
            filters: [
              { field: 'subject', op: 'eq', value: 'CSCI' },
              { field: 'number', op: 'gte', value: 400 },
            ],
          },
        ],
      },
      exclude: [
        { type: 'course', subject: 'CSCI', number: '495' },
        { type: 'course', subject: 'CSCI', number: '496' },
      ],
    });
  });
});

describe('except — error cases', () => {
  test('except with empty parens fails', () => {
    expect(() => parse('courses where subject = "CMPS" except ()')).toThrow();
  });

  test('except without parens fails', () => {
    expect(() => parse('courses where subject = "CMPS" except CMPS 490')).toThrow();
  });
});
