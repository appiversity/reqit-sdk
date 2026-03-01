'use strict';

const { parse } = require('../../src/parser');

describe('one from each of (...)', () => {
  test('basic one from each', () => {
    const input = `one from each of (
      courses where attribute = "HUM",
      courses where attribute = "SCI",
      courses where attribute = "SS"
    )`;
    expect(parse(input)).toEqual({
      type: 'one-from-each',
      items: [
        { type: 'course-filter', filters: [{ field: 'attribute', op: 'eq', value: 'HUM' }] },
        { type: 'course-filter', filters: [{ field: 'attribute', op: 'eq', value: 'SCI' }] },
        { type: 'course-filter', filters: [{ field: 'attribute', op: 'eq', value: 'SS' }] },
      ],
    });
  });

  test('one from each with course lists', () => {
    const input = `one from each of (
      any of (MATH 111, MATH 131),
      any of (CSCI 141, CSCI 143)
    )`;
    expect(parse(input)).toEqual({
      type: 'one-from-each',
      items: [
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
            { type: 'course', subject: 'CSCI', number: '141' },
            { type: 'course', subject: 'CSCI', number: '143' },
          ],
        },
      ],
    });
  });

  test('case-insensitive keywords', () => {
    const input = 'One From Each Of (courses where attribute = "WI", courses where attribute = "QR")';
    expect(parse(input)).toEqual({
      type: 'one-from-each',
      items: [
        { type: 'course-filter', filters: [{ field: 'attribute', op: 'eq', value: 'WI' }] },
        { type: 'course-filter', filters: [{ field: 'attribute', op: 'eq', value: 'QR' }] },
      ],
    });
  });

  // W&M case study: COLL gen-ed distribution
  test('W&M: COLL gen-ed distribution areas', () => {
    const input = `one from each of (
      courses where attribute = "C200",  # COLL 200
      courses where attribute = "C300",  # COLL 300
      courses where attribute = "C400"   # COLL 400
    )`;
    expect(parse(input)).toEqual({
      type: 'one-from-each',
      items: [
        { type: 'course-filter', filters: [{ field: 'attribute', op: 'eq', value: 'C200' }] },
        { type: 'course-filter', filters: [{ field: 'attribute', op: 'eq', value: 'C300' }] },
        { type: 'course-filter', filters: [{ field: 'attribute', op: 'eq', value: 'C400' }] },
      ],
    });
  });

  test('one from each inside all-of', () => {
    const input = `all of (
      CSCI 141,
      one from each of (
        courses where attribute = "HUM",
        courses where attribute = "SCI"
      )
    )`;
    expect(parse(input)).toEqual({
      type: 'all-of',
      items: [
        { type: 'course', subject: 'CSCI', number: '141' },
        {
          type: 'one-from-each',
          items: [
            { type: 'course-filter', filters: [{ field: 'attribute', op: 'eq', value: 'HUM' }] },
            { type: 'course-filter', filters: [{ field: 'attribute', op: 'eq', value: 'SCI' }] },
          ],
        },
      ],
    });
  });
});

describe('from at least N of (...)', () => {
  test('from at least 3 of 5 groups', () => {
    const input = `from at least 3 of (
      courses where attribute = "HUM",
      courses where attribute = "SCI",
      courses where attribute = "SS",
      courses where attribute = "FA",
      courses where attribute = "QR"
    )`;
    expect(parse(input)).toEqual({
      type: 'from-n-groups',
      count: 3,
      items: [
        { type: 'course-filter', filters: [{ field: 'attribute', op: 'eq', value: 'HUM' }] },
        { type: 'course-filter', filters: [{ field: 'attribute', op: 'eq', value: 'SCI' }] },
        { type: 'course-filter', filters: [{ field: 'attribute', op: 'eq', value: 'SS' }] },
        { type: 'course-filter', filters: [{ field: 'attribute', op: 'eq', value: 'FA' }] },
        { type: 'course-filter', filters: [{ field: 'attribute', op: 'eq', value: 'QR' }] },
      ],
    });
  });

  test('from at least 1 of 2 groups', () => {
    const input = 'from at least 1 of (any of (MATH 111, MATH 131), any of (CSCI 141, CSCI 143))';
    expect(parse(input)).toEqual({
      type: 'from-n-groups',
      count: 1,
      items: [
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
            { type: 'course', subject: 'CSCI', number: '141' },
            { type: 'course', subject: 'CSCI', number: '143' },
          ],
        },
      ],
    });
  });

  test('case-insensitive keywords', () => {
    const input = 'FROM AT LEAST 2 OF (courses where attribute = "HUM", courses where attribute = "SCI", courses where attribute = "SS")';
    expect(parse(input)).toEqual({
      type: 'from-n-groups',
      count: 2,
      items: [
        { type: 'course-filter', filters: [{ field: 'attribute', op: 'eq', value: 'HUM' }] },
        { type: 'course-filter', filters: [{ field: 'attribute', op: 'eq', value: 'SCI' }] },
        { type: 'course-filter', filters: [{ field: 'attribute', op: 'eq', value: 'SS' }] },
      ],
    });
  });

  test('count is parsed as integer', () => {
    const ast = parse('from at least 3 of (courses where attribute = "HUM", courses where attribute = "SCI", courses where attribute = "SS")');
    expect(ast.count).toBe(3);
    expect(typeof ast.count).toBe('number');
  });

  test('does not conflict with credits-from (at least N credits from)', () => {
    // "at least 12 credits from" should still parse as credits-from
    expect(parse('at least 12 credits from (MATH 151)')).toEqual({
      type: 'credits-from',
      comparison: 'at-least',
      credits: 12,
      source: { type: 'course', subject: 'MATH', number: '151' },
    });
  });
});

describe('group ops — error cases', () => {
  test('one from each of empty parens fails', () => {
    expect(() => parse('one from each of ()')).toThrow();
  });

  test('from at least without count fails', () => {
    expect(() => parse('from at least of (courses where attribute = "HUM")')).toThrow();
  });
});
