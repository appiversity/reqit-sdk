'use strict';

const { parse } = require('../../src/parser');

describe('variable references ($name)', () => {
  test('simple variable reference', () => {
    expect(parse('$core')).toEqual({
      type: 'variable-ref',
      name: 'core',
    });
  });

  test('variable reference with underscores', () => {
    expect(parse('$core_math')).toEqual({
      type: 'variable-ref',
      name: 'core_math',
    });
  });

  test('variable reference in all-of', () => {
    expect(parse('all of ($core, $math, CSCI 141)')).toEqual({
      type: 'all-of',
      items: [
        { type: 'variable-ref', name: 'core' },
        { type: 'variable-ref', name: 'math' },
        { type: 'course', subject: 'CSCI', number: '141' },
      ],
    });
  });

  test('variable reference in n-of', () => {
    expect(parse('at least 2 of ($elective_pool)')).toEqual({
      type: 'n-of',
      comparison: 'at-least',
      count: 2,
      items: [{ type: 'variable-ref', name: 'elective_pool' }],
    });
  });

  test('variable reference with constraint', () => {
    expect(parse('$core with grade >= "C"')).toEqual({
      type: 'with-constraint',
      requirement: { type: 'variable-ref', name: 'core' },
      constraint: { kind: 'min-grade', value: 'C' },
    });
  });

  test('variable reference with except', () => {
    expect(parse('$electives except (CSCI 490)')).toEqual({
      type: 'except',
      source: { type: 'variable-ref', name: 'electives' },
      exclude: [{ type: 'course', subject: 'CSCI', number: '490' }],
    });
  });
});

describe('variable definitions ($name = expression)', () => {
  test('simple variable definition', () => {
    expect(parse('$core = all of (MATH 151, MATH 152)')).toEqual({
      type: 'variable-def',
      name: 'core',
      value: {
        type: 'all-of',
        items: [
          { type: 'course', subject: 'MATH', number: '151' },
          { type: 'course', subject: 'MATH', number: '152' },
        ],
      },
    });
  });

  test('variable definition with complex expression', () => {
    expect(parse('$cs_electives = at least 3 of (courses where subject = "CSCI" and number >= 300)')).toEqual({
      type: 'variable-def',
      name: 'cs_electives',
      value: {
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
    });
  });

  test('variable definition with except value', () => {
    expect(parse('$electives = courses where subject = "CMPS" except (CMPS 490)')).toEqual({
      type: 'variable-def',
      name: 'electives',
      value: {
        type: 'except',
        source: {
          type: 'course-filter',
          filters: [{ field: 'subject', op: 'eq', value: 'CMPS' }],
        },
        exclude: [{ type: 'course', subject: 'CMPS', number: '490' }],
      },
    });
  });

  test('variable definition with single course', () => {
    expect(parse('$capstone = CSCI 490')).toEqual({
      type: 'variable-def',
      name: 'capstone',
      value: { type: 'course', subject: 'CSCI', number: '490' },
    });
  });

  test('variable definition referencing other variable', () => {
    expect(parse('$upper = $core')).toEqual({
      type: 'variable-def',
      name: 'upper',
      value: { type: 'variable-ref', name: 'core' },
    });
  });

  // Lehigh case study: named requirement groups
  test('Lehigh: math core variable', () => {
    const input = `$math_core = all of (
      any of (MATH 021, MATH 031, MATH 076),
      MATH 022,
      any of (MATH 205, MATH 241, MATH 242)
    )`;
    expect(parse(input)).toEqual({
      type: 'variable-def',
      name: 'math_core',
      value: {
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
      },
    });
  });
});

describe('variables — edge cases', () => {
  test('variable name starting with underscore', () => {
    expect(parse('$_private')).toEqual({
      type: 'variable-ref',
      name: '_private',
    });
  });

  test('variable name with digits', () => {
    expect(parse('$pool2')).toEqual({
      type: 'variable-ref',
      name: 'pool2',
    });
  });

  test('$ without name fails', () => {
    expect(() => parse('$')).toThrow();
  });

  test('variable name cannot start with digit', () => {
    expect(() => parse('$123')).toThrow();
  });
});
