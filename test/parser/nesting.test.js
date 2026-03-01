'use strict';

const { parse } = require('../../src/parser');

describe('Nested all of / any of (arbitrary depth)', () => {
  test('three levels deep: all-of → any-of → all-of', () => {
    const input = `all of (
      MATH 151,
      any of (
        all of (CSE 003, CSE 004),
        CSE 007
      )
    )`;
    expect(parse(input)).toEqual({
      type: 'all-of',
      items: [
        { type: 'course', subject: 'MATH', number: '151' },
        {
          type: 'any-of',
          items: [
            {
              type: 'all-of',
              items: [
                { type: 'course', subject: 'CSE', number: '003' },
                { type: 'course', subject: 'CSE', number: '004' },
              ],
            },
            { type: 'course', subject: 'CSE', number: '007' },
          ],
        },
      ],
    });
  });

  test('three levels deep: any-of → all-of → any-of', () => {
    const input = `any of (
      all of (
        MATH 151,
        any of (MATH 205, MATH 241)
      ),
      all of (
        MATH 031,
        any of (MATH 082, MATH 242)
      )
    )`;
    expect(parse(input)).toEqual({
      type: 'any-of',
      items: [
        {
          type: 'all-of',
          items: [
            { type: 'course', subject: 'MATH', number: '151' },
            {
              type: 'any-of',
              items: [
                { type: 'course', subject: 'MATH', number: '205' },
                { type: 'course', subject: 'MATH', number: '241' },
              ],
            },
          ],
        },
        {
          type: 'all-of',
          items: [
            { type: 'course', subject: 'MATH', number: '031' },
            {
              type: 'any-of',
              items: [
                { type: 'course', subject: 'MATH', number: '082' },
                { type: 'course', subject: 'MATH', number: '242' },
              ],
            },
          ],
        },
      ],
    });
  });

  test('four levels deep', () => {
    const input = `all of (
      any of (
        all of (
          any of (MATH 021, MATH 031),
          MATH 022
        ),
        MATH 051
      )
    )`;
    expect(parse(input)).toEqual({
      type: 'all-of',
      items: [
        {
          type: 'any-of',
          items: [
            {
              type: 'all-of',
              items: [
                {
                  type: 'any-of',
                  items: [
                    { type: 'course', subject: 'MATH', number: '021' },
                    { type: 'course', subject: 'MATH', number: '031' },
                  ],
                },
                { type: 'course', subject: 'MATH', number: '022' },
              ],
            },
            { type: 'course', subject: 'MATH', number: '051' },
          ],
        },
      ],
    });
  });

  // Case study: Lehigh BS CS — calculus sequence with alternatives
  test('Lehigh: calculus requirement (either sequence, each with alternatives)', () => {
    const input = `all of (
      any of (MATH 021, MATH 031, MATH 076), # Calculus I
      MATH 022,                               # Calculus II
      any of (MATH 205, MATH 241, MATH 242)   # Linear Algebra
    )`;
    expect(parse(input)).toEqual({
      type: 'all-of',
      items: [
        {
          type: 'any-of',
          items: [
            { type: 'course', subject: 'MATH', number: '021' },
            { type: 'course', subject: 'MATH', number: '031' },
            { type: 'course', subject: 'MATH', number: '076' },
          ],
        },
        { type: 'course', subject: 'MATH', number: '022' },
        {
          type: 'any-of',
          items: [
            { type: 'course', subject: 'MATH', number: '205' },
            { type: 'course', subject: 'MATH', number: '241' },
            { type: 'course', subject: 'MATH', number: '242' },
          ],
        },
      ],
    });
  });

  // Case study: W&M BS CS — core with nested alternatives
  test('W&M: CS core with calculus alternatives', () => {
    const input = `all of (
      CSCI 141,
      CSCI 241,
      CSCI 243,
      CSCI 303,
      CSCI 304,
      any of (MATH 111, MATH 131),
      any of (MATH 112, MATH 132)
    )`;
    expect(parse(input)).toEqual({
      type: 'all-of',
      items: [
        { type: 'course', subject: 'CSCI', number: '141' },
        { type: 'course', subject: 'CSCI', number: '241' },
        { type: 'course', subject: 'CSCI', number: '243' },
        { type: 'course', subject: 'CSCI', number: '303' },
        { type: 'course', subject: 'CSCI', number: '304' },
        {
          type: 'any-of',
          items: [
            { type: 'course', subject: 'MATH', number: '111' },
            { type: 'course', subject: 'MATH', number: '131' },
          ],
        },
        {
          type: 'any-of',
          items: [
            { type: 'course', subject: 'MATH', number: '112' },
            { type: 'course', subject: 'MATH', number: '132' },
          ],
        },
      ],
    });
  });

  // Comments at every nesting level
  test('comments at every nesting level', () => {
    const input = `# top-level requirement
    all of (
      # math section
      any of (
        MATH 021, # standard calc
        MATH 031  # alternative calc
      ),
      CSE 007 # intro programming
    )`;
    expect(parse(input)).toEqual({
      type: 'all-of',
      items: [
        {
          type: 'any-of',
          items: [
            { type: 'course', subject: 'MATH', number: '021' },
            { type: 'course', subject: 'MATH', number: '031' },
          ],
        },
        { type: 'course', subject: 'CSE', number: '007' },
      ],
    });
  });

  // Mixed case at every level
  test('mixed case keywords and subjects at every level', () => {
    const input = 'All Of (Any Of (math 151, Math 152), csci 141)';
    expect(parse(input)).toEqual({
      type: 'all-of',
      items: [
        {
          type: 'any-of',
          items: [
            { type: 'course', subject: 'MATH', number: '151' },
            { type: 'course', subject: 'MATH', number: '152' },
          ],
        },
        { type: 'course', subject: 'CSCI', number: '141' },
      ],
    });
  });
});
