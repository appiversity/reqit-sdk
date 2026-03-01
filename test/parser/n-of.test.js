'use strict';

const { parse } = require('../../src/parser');

describe('at least N of (...)', () => {
  test('at least 2 of 3 courses', () => {
    expect(parse('at least 2 of (MATH 151, MATH 152, MATH 250)')).toEqual({
      type: 'n-of',
      comparison: 'at-least',
      count: 2,
      items: [
        { type: 'course', subject: 'MATH', number: '151' },
        { type: 'course', subject: 'MATH', number: '152' },
        { type: 'course', subject: 'MATH', number: '250' },
      ],
    });
  });

  test('at least 1 of 2 courses', () => {
    expect(parse('at least 1 of (MATH 021, MATH 031)')).toEqual({
      type: 'n-of',
      comparison: 'at-least',
      count: 1,
      items: [
        { type: 'course', subject: 'MATH', number: '021' },
        { type: 'course', subject: 'MATH', number: '031' },
      ],
    });
  });

  test('case-insensitive keywords', () => {
    expect(parse('At Least 3 Of (MATH 151, MATH 152, MATH 250, MATH 231)')).toEqual({
      type: 'n-of',
      comparison: 'at-least',
      count: 3,
      items: [
        { type: 'course', subject: 'MATH', number: '151' },
        { type: 'course', subject: 'MATH', number: '152' },
        { type: 'course', subject: 'MATH', number: '250' },
        { type: 'course', subject: 'MATH', number: '231' },
      ],
    });
  });
});

describe('at most N of (...)', () => {
  test('at most 2 of 4 courses', () => {
    expect(parse('at most 2 of (CMPS 310, CMPS 320, CMPS 350, CMPS 360)')).toEqual({
      type: 'n-of',
      comparison: 'at-most',
      count: 2,
      items: [
        { type: 'course', subject: 'CMPS', number: '310' },
        { type: 'course', subject: 'CMPS', number: '320' },
        { type: 'course', subject: 'CMPS', number: '350' },
        { type: 'course', subject: 'CMPS', number: '360' },
      ],
    });
  });

  test('AT MOST uppercase', () => {
    expect(parse('AT MOST 1 OF (MATH 151, MATH 152)')).toEqual({
      type: 'n-of',
      comparison: 'at-most',
      count: 1,
      items: [
        { type: 'course', subject: 'MATH', number: '151' },
        { type: 'course', subject: 'MATH', number: '152' },
      ],
    });
  });
});

describe('exactly N of (...)', () => {
  test('exactly 3 of 5 courses', () => {
    expect(parse('exactly 3 of (CSCI 301, CSCI 303, CSCI 304, CSCI 312, CSCI 320)')).toEqual({
      type: 'n-of',
      comparison: 'exactly',
      count: 3,
      items: [
        { type: 'course', subject: 'CSCI', number: '301' },
        { type: 'course', subject: 'CSCI', number: '303' },
        { type: 'course', subject: 'CSCI', number: '304' },
        { type: 'course', subject: 'CSCI', number: '312' },
        { type: 'course', subject: 'CSCI', number: '320' },
      ],
    });
  });

  test('exactly 1 of (same as any of but explicit count)', () => {
    expect(parse('exactly 1 of (MATH 111, MATH 131)')).toEqual({
      type: 'n-of',
      comparison: 'exactly',
      count: 1,
      items: [
        { type: 'course', subject: 'MATH', number: '111' },
        { type: 'course', subject: 'MATH', number: '131' },
      ],
    });
  });

  test('Exactly title case', () => {
    expect(parse('Exactly 2 Of (MATH 151, MATH 152, MATH 250)')).toEqual({
      type: 'n-of',
      comparison: 'exactly',
      count: 2,
      items: [
        { type: 'course', subject: 'MATH', number: '151' },
        { type: 'course', subject: 'MATH', number: '152' },
        { type: 'course', subject: 'MATH', number: '250' },
      ],
    });
  });
});

describe('n-of with nesting and formatting', () => {
  test('n-of with nested any-of', () => {
    expect(parse('at least 2 of (MATH 151, any of (CSE 003, CSE 007), MATH 250)')).toEqual({
      type: 'n-of',
      comparison: 'at-least',
      count: 2,
      items: [
        { type: 'course', subject: 'MATH', number: '151' },
        {
          type: 'any-of',
          items: [
            { type: 'course', subject: 'CSE', number: '003' },
            { type: 'course', subject: 'CSE', number: '007' },
          ],
        },
        { type: 'course', subject: 'MATH', number: '250' },
      ],
    });
  });

  test('n-of inside all-of', () => {
    const input = `all of (
      CSCI 141,
      at least 3 of (
        CSCI 415, CSCI 416, CSCI 421,
        CSCI 423, CSCI 434, CSCI 444
      )
    )`;
    expect(parse(input)).toEqual({
      type: 'all-of',
      items: [
        { type: 'course', subject: 'CSCI', number: '141' },
        {
          type: 'n-of',
          comparison: 'at-least',
          count: 3,
          items: [
            { type: 'course', subject: 'CSCI', number: '415' },
            { type: 'course', subject: 'CSCI', number: '416' },
            { type: 'course', subject: 'CSCI', number: '421' },
            { type: 'course', subject: 'CSCI', number: '423' },
            { type: 'course', subject: 'CSCI', number: '434' },
            { type: 'course', subject: 'CSCI', number: '444' },
          ],
        },
      ],
    });
  });

  test('multiline with comments', () => {
    const input = `at least 2 of (
      CMPS 305, # Cyber Security
      CMPS 311, # Operating Systems
      CMPS 320, # Machine Learning
      CMPS 331  # AI
    )`;
    expect(parse(input)).toEqual({
      type: 'n-of',
      comparison: 'at-least',
      count: 2,
      items: [
        { type: 'course', subject: 'CMPS', number: '305' },
        { type: 'course', subject: 'CMPS', number: '311' },
        { type: 'course', subject: 'CMPS', number: '320' },
        { type: 'course', subject: 'CMPS', number: '331' },
      ],
    });
  });

  test('count is parsed as integer', () => {
    const ast = parse('at least 3 of (MATH 151, MATH 152, MATH 250)');
    expect(ast.count).toBe(3);
    expect(typeof ast.count).toBe('number');
  });

  // W&M case study: CS electives — pick 3 from upper-division
  test('W&M: CS electives', () => {
    const input = `at least 3 of (
      CSCI 415, CSCI 416, CSCI 420, CSCI 421,
      CSCI 423, CSCI 430, CSCI 434, CSCI 436,
      CSCI 444, CSCI 445, CSCI 446, CSCI 454,
      CSCI 455, CSCI 464
    )`;
    const ast = parse(input);
    expect(ast.type).toBe('n-of');
    expect(ast.comparison).toBe('at-least');
    expect(ast.count).toBe(3);
    expect(ast.items).toHaveLength(14);
    expect(ast.items[0]).toEqual({ type: 'course', subject: 'CSCI', number: '415' });
    expect(ast.items[13]).toEqual({ type: 'course', subject: 'CSCI', number: '464' });
  });

  // Error cases
  test('missing count fails', () => {
    expect(() => parse('at least of (MATH 151)')).toThrow();
  });

  test('missing comma between items fails', () => {
    expect(() => parse('at least 2 of (MATH 151 MATH 152)')).toThrow();
  });

  test('empty parens fails', () => {
    expect(() => parse('exactly 2 of ()')).toThrow();
  });
});
