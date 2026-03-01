'use strict';

const { parse } = require('../../src/parser');

describe('any of (...)', () => {
  test('two course items', () => {
    expect(parse('any of (MATH 151, MATH 152)')).toEqual({
      type: 'any-of',
      items: [
        { type: 'course', subject: 'MATH', number: '151' },
        { type: 'course', subject: 'MATH', number: '152' },
      ],
    });
  });

  test('three course items', () => {
    expect(parse('any of (MATH 021, MATH 031, MATH 051)')).toEqual({
      type: 'any-of',
      items: [
        { type: 'course', subject: 'MATH', number: '021' },
        { type: 'course', subject: 'MATH', number: '031' },
        { type: 'course', subject: 'MATH', number: '051' },
      ],
    });
  });

  test('single item', () => {
    expect(parse('any of (MATH 151)')).toEqual({
      type: 'any-of',
      items: [
        { type: 'course', subject: 'MATH', number: '151' },
      ],
    });
  });

  // Case-insensitive keywords
  test('ANY OF uppercase', () => {
    expect(parse('ANY OF (MATH 151, MATH 152)')).toEqual({
      type: 'any-of',
      items: [
        { type: 'course', subject: 'MATH', number: '151' },
        { type: 'course', subject: 'MATH', number: '152' },
      ],
    });
  });

  test('Any Of title case', () => {
    expect(parse('Any Of (MATH 151, MATH 152)')).toEqual({
      type: 'any-of',
      items: [
        { type: 'course', subject: 'MATH', number: '151' },
        { type: 'course', subject: 'MATH', number: '152' },
      ],
    });
  });

  // Whitespace and comments
  test('newlines and comments between items', () => {
    const input = `any of (
      MATH 021, # Calculus I
      MATH 031, # Calculus I (Alt)
      MATH 051  # Math Sequence
    )`;
    expect(parse(input)).toEqual({
      type: 'any-of',
      items: [
        { type: 'course', subject: 'MATH', number: '021' },
        { type: 'course', subject: 'MATH', number: '031' },
        { type: 'course', subject: 'MATH', number: '051' },
      ],
    });
  });

  // Mixed case subjects
  test('mixed case subjects normalize to uppercase', () => {
    expect(parse('any of (math 151, Csci 120)')).toEqual({
      type: 'any-of',
      items: [
        { type: 'course', subject: 'MATH', number: '151' },
        { type: 'course', subject: 'CSCI', number: '120' },
      ],
    });
  });

  // Case study examples
  test('Lehigh: calculus alternatives', () => {
    expect(parse('any of (MATH 021, MATH 031, MATH 076)')).toEqual({
      type: 'any-of',
      items: [
        { type: 'course', subject: 'MATH', number: '021' },
        { type: 'course', subject: 'MATH', number: '031' },
        { type: 'course', subject: 'MATH', number: '076' },
      ],
    });
  });

  test('Lehigh: linear algebra alternatives', () => {
    expect(parse('any of (MATH 205, MATH 241, MATH 242)')).toEqual({
      type: 'any-of',
      items: [
        { type: 'course', subject: 'MATH', number: '205' },
        { type: 'course', subject: 'MATH', number: '241' },
        { type: 'course', subject: 'MATH', number: '242' },
      ],
    });
  });

  test('W&M: calculus choices', () => {
    expect(parse('any of (MATH 111, MATH 131)')).toEqual({
      type: 'any-of',
      items: [
        { type: 'course', subject: 'MATH', number: '111' },
        { type: 'course', subject: 'MATH', number: '131' },
      ],
    });
  });

  // Nesting: any-of inside all-of
  test('any of nested inside all of', () => {
    expect(parse('all of (CSCI 141, any of (MATH 111, MATH 131))')).toEqual({
      type: 'all-of',
      items: [
        { type: 'course', subject: 'CSCI', number: '141' },
        {
          type: 'any-of',
          items: [
            { type: 'course', subject: 'MATH', number: '111' },
            { type: 'course', subject: 'MATH', number: '131' },
          ],
        },
      ],
    });
  });

  // Nesting: all-of inside any-of
  test('all of nested inside any of', () => {
    expect(parse('any of (all of (MATH 021, MATH 022), all of (MATH 031, MATH 051))')).toEqual({
      type: 'any-of',
      items: [
        {
          type: 'all-of',
          items: [
            { type: 'course', subject: 'MATH', number: '021' },
            { type: 'course', subject: 'MATH', number: '022' },
          ],
        },
        {
          type: 'all-of',
          items: [
            { type: 'course', subject: 'MATH', number: '031' },
            { type: 'course', subject: 'MATH', number: '051' },
          ],
        },
      ],
    });
  });

  // Error cases
  test('missing comma between items fails', () => {
    expect(() => parse('any of (MATH 151 MATH 152)')).toThrow();
  });

  test('empty parens fails', () => {
    expect(() => parse('any of ()')).toThrow();
  });

  test('missing closing paren fails', () => {
    expect(() => parse('any of (MATH 151, MATH 152')).toThrow();
  });
});
