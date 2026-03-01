'use strict';

const { parse } = require('../../src/parser');

describe('all of (...)', () => {
  test('two course items', () => {
    expect(parse('all of (MATH 151, MATH 152)')).toEqual({
      type: 'all-of',
      items: [
        { type: 'course', subject: 'MATH', number: '151' },
        { type: 'course', subject: 'MATH', number: '152' },
      ],
    });
  });

  test('three course items', () => {
    expect(parse('all of (MATH 151, MATH 152, MATH 250)')).toEqual({
      type: 'all-of',
      items: [
        { type: 'course', subject: 'MATH', number: '151' },
        { type: 'course', subject: 'MATH', number: '152' },
        { type: 'course', subject: 'MATH', number: '250' },
      ],
    });
  });

  test('single item', () => {
    expect(parse('all of (MATH 151)')).toEqual({
      type: 'all-of',
      items: [
        { type: 'course', subject: 'MATH', number: '151' },
      ],
    });
  });

  // Case-insensitive keywords
  test('ALL OF uppercase', () => {
    expect(parse('ALL OF (MATH 151, MATH 152)')).toEqual({
      type: 'all-of',
      items: [
        { type: 'course', subject: 'MATH', number: '151' },
        { type: 'course', subject: 'MATH', number: '152' },
      ],
    });
  });

  test('All Of title case', () => {
    expect(parse('All Of (MATH 151, MATH 152)')).toEqual({
      type: 'all-of',
      items: [
        { type: 'course', subject: 'MATH', number: '151' },
        { type: 'course', subject: 'MATH', number: '152' },
      ],
    });
  });

  // Whitespace variations
  test('extra spaces around items', () => {
    expect(parse('all of (  MATH 151 ,  MATH 152  )')).toEqual({
      type: 'all-of',
      items: [
        { type: 'course', subject: 'MATH', number: '151' },
        { type: 'course', subject: 'MATH', number: '152' },
      ],
    });
  });

  test('newlines between items', () => {
    const input = `all of (
      MATH 151,
      MATH 152,
      MATH 250
    )`;
    expect(parse(input)).toEqual({
      type: 'all-of',
      items: [
        { type: 'course', subject: 'MATH', number: '151' },
        { type: 'course', subject: 'MATH', number: '152' },
        { type: 'course', subject: 'MATH', number: '250' },
      ],
    });
  });

  test('comments between items', () => {
    const input = `all of (
      MATH 151, # Calculus I
      MATH 152  # Calculus II
    )`;
    expect(parse(input)).toEqual({
      type: 'all-of',
      items: [
        { type: 'course', subject: 'MATH', number: '151' },
        { type: 'course', subject: 'MATH', number: '152' },
      ],
    });
  });

  // Case study examples
  test('Lehigh: core CS courses', () => {
    expect(parse('all of (CSE 007, CSE 017, CSE 109)')).toEqual({
      type: 'all-of',
      items: [
        { type: 'course', subject: 'CSE', number: '007' },
        { type: 'course', subject: 'CSE', number: '017' },
        { type: 'course', subject: 'CSE', number: '109' },
      ],
    });
  });

  test('Moravian: half-unit courses', () => {
    expect(parse('all of (CSCI 220.2, CSCI 243.2)')).toEqual({
      type: 'all-of',
      items: [
        { type: 'course', subject: 'CSCI', number: '220.2' },
        { type: 'course', subject: 'CSCI', number: '243.2' },
      ],
    });
  });

  // Nesting (naturally supported since items are Expressions)
  test('nested all of', () => {
    expect(parse('all of (MATH 151, all of (CSCI 120, CSCI 121))')).toEqual({
      type: 'all-of',
      items: [
        { type: 'course', subject: 'MATH', number: '151' },
        {
          type: 'all-of',
          items: [
            { type: 'course', subject: 'CSCI', number: '120' },
            { type: 'course', subject: 'CSCI', number: '121' },
          ],
        },
      ],
    });
  });

  // Mixed case subjects inside list
  test('lowercase subjects normalize to uppercase', () => {
    expect(parse('all of (math 151, csci 120)')).toEqual({
      type: 'all-of',
      items: [
        { type: 'course', subject: 'MATH', number: '151' },
        { type: 'course', subject: 'CSCI', number: '120' },
      ],
    });
  });

  test('mixed case subjects normalize to uppercase', () => {
    expect(parse('all of (Math 151, Csci 120, cse 003)')).toEqual({
      type: 'all-of',
      items: [
        { type: 'course', subject: 'MATH', number: '151' },
        { type: 'course', subject: 'CSCI', number: '120' },
        { type: 'course', subject: 'CSE', number: '003' },
      ],
    });
  });

  test('mixed case keywords and subjects', () => {
    expect(parse('All of (math 151, Math 152)')).toEqual({
      type: 'all-of',
      items: [
        { type: 'course', subject: 'MATH', number: '151' },
        { type: 'course', subject: 'MATH', number: '152' },
      ],
    });
  });

  // Missing commas
  test('missing comma between items fails', () => {
    expect(() => parse('all of (MATH 151 MATH 152)')).toThrow();
  });

  test('missing comma after second item fails', () => {
    expect(() => parse('all of (MATH 151, MATH 152 MATH 250)')).toThrow();
  });

  test('trailing comma fails', () => {
    expect(() => parse('all of (MATH 151, MATH 152,)')).toThrow();
  });

  // Other error cases
  test('empty parens fails', () => {
    expect(() => parse('all of ()')).toThrow();
  });

  test('missing closing paren fails', () => {
    expect(() => parse('all of (MATH 151, MATH 152')).toThrow();
  });

  test('missing opening paren fails', () => {
    expect(() => parse('all of MATH 151, MATH 152)')).toThrow();
  });
});
