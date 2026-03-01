'use strict';

const { parse } = require('../../src/parser');

describe('with grade >= "X"', () => {
  test('single course with min grade', () => {
    expect(parse('MATH 151 with grade >= "C"')).toEqual({
      type: 'with-constraint',
      requirement: { type: 'course', subject: 'MATH', number: '151' },
      constraint: { kind: 'min-grade', value: 'C' },
    });
  });

  test('grade with plus/minus', () => {
    expect(parse('CSCI 141 with grade >= "C-"')).toEqual({
      type: 'with-constraint',
      requirement: { type: 'course', subject: 'CSCI', number: '141' },
      constraint: { kind: 'min-grade', value: 'C-' },
    });
    expect(parse('MATH 151 with grade >= "B+"')).toEqual({
      type: 'with-constraint',
      requirement: { type: 'course', subject: 'MATH', number: '151' },
      constraint: { kind: 'min-grade', value: 'B+' },
    });
  });

  test('all-of with min grade', () => {
    const input = 'all of (MATH 151, MATH 152) with grade >= "C"';
    expect(parse(input)).toEqual({
      type: 'with-constraint',
      requirement: {
        type: 'all-of',
        items: [
          { type: 'course', subject: 'MATH', number: '151' },
          { type: 'course', subject: 'MATH', number: '152' },
        ],
      },
      constraint: { kind: 'min-grade', value: 'C' },
    });
  });

  test('n-of with min grade', () => {
    const input = 'at least 3 of (courses where subject = "CMPS") with grade >= "C-"';
    expect(parse(input)).toEqual({
      type: 'with-constraint',
      requirement: {
        type: 'n-of',
        comparison: 'at-least',
        count: 3,
        items: [
          {
            type: 'course-filter',
            filters: [{ field: 'subject', op: 'eq', value: 'CMPS' }],
          },
        ],
      },
      constraint: { kind: 'min-grade', value: 'C-' },
    });
  });

  // RCNJ case study: pervasive grade constraints
  test('RCNJ: core courses with C or better', () => {
    const input = `all of (
      CMPS 147,
      CMPS 148,
      CMPS 231
    ) with grade >= "C"`;
    expect(parse(input)).toEqual({
      type: 'with-constraint',
      requirement: {
        type: 'all-of',
        items: [
          { type: 'course', subject: 'CMPS', number: '147' },
          { type: 'course', subject: 'CMPS', number: '148' },
          { type: 'course', subject: 'CMPS', number: '231' },
        ],
      },
      constraint: { kind: 'min-grade', value: 'C' },
    });
  });

  test('with grade inside item list', () => {
    const input = `all of (
      MATH 151 with grade >= "C",
      MATH 152 with grade >= "C-"
    )`;
    expect(parse(input)).toEqual({
      type: 'all-of',
      items: [
        {
          type: 'with-constraint',
          requirement: { type: 'course', subject: 'MATH', number: '151' },
          constraint: { kind: 'min-grade', value: 'C' },
        },
        {
          type: 'with-constraint',
          requirement: { type: 'course', subject: 'MATH', number: '152' },
          constraint: { kind: 'min-grade', value: 'C-' },
        },
      ],
    });
  });

  test('except then with grade (both postfixes)', () => {
    const input = 'courses where subject = "CMPS" except (CMPS 490) with grade >= "C"';
    expect(parse(input)).toEqual({
      type: 'with-constraint',
      requirement: {
        type: 'except',
        source: {
          type: 'course-filter',
          filters: [{ field: 'subject', op: 'eq', value: 'CMPS' }],
        },
        exclude: [{ type: 'course', subject: 'CMPS', number: '490' }],
      },
      constraint: { kind: 'min-grade', value: 'C' },
    });
  });

  test('case-insensitive keywords', () => {
    expect(parse('MATH 151 WITH GRADE >= "C"')).toEqual({
      type: 'with-constraint',
      requirement: { type: 'course', subject: 'MATH', number: '151' },
      constraint: { kind: 'min-grade', value: 'C' },
    });
    expect(parse('MATH 151 With Grade >= "B"')).toEqual({
      type: 'with-constraint',
      requirement: { type: 'course', subject: 'MATH', number: '151' },
      constraint: { kind: 'min-grade', value: 'B' },
    });
  });

  test('pass/fail grade', () => {
    expect(parse('MATH 151 with grade >= "P"')).toEqual({
      type: 'with-constraint',
      requirement: { type: 'course', subject: 'MATH', number: '151' },
      constraint: { kind: 'min-grade', value: 'P' },
    });
  });
});

describe('with gpa >= N', () => {
  test('all-of with min GPA', () => {
    const input = 'all of (MATH 151, MATH 152) with gpa >= 2.5';
    expect(parse(input)).toEqual({
      type: 'with-constraint',
      requirement: {
        type: 'all-of',
        items: [
          { type: 'course', subject: 'MATH', number: '151' },
          { type: 'course', subject: 'MATH', number: '152' },
        ],
      },
      constraint: { kind: 'min-gpa', value: 2.5 },
    });
  });

  test('GPA as integer', () => {
    const input = 'all of (CSCI 141, CSCI 241) with gpa >= 2';
    expect(parse(input)).toEqual({
      type: 'with-constraint',
      requirement: {
        type: 'all-of',
        items: [
          { type: 'course', subject: 'CSCI', number: '141' },
          { type: 'course', subject: 'CSCI', number: '241' },
        ],
      },
      constraint: { kind: 'min-gpa', value: 2 },
    });
  });

  test('GPA with decimal precision', () => {
    const input = 'all of (CMPS 130, CMPS 230) with gpa >= 2.75';
    const ast = parse(input);
    expect(ast.constraint).toEqual({ kind: 'min-gpa', value: 2.75 });
  });

  // Moravian case study: major GPA requirement
  test('Moravian: CS major GPA requirement', () => {
    const input = `all of (
      CSCI 170, CSCI 171, CSCI 220,
      CSCI 271, CSCI 370
    ) with gpa >= 2.0`;
    expect(parse(input)).toEqual({
      type: 'with-constraint',
      requirement: {
        type: 'all-of',
        items: [
          { type: 'course', subject: 'CSCI', number: '170' },
          { type: 'course', subject: 'CSCI', number: '171' },
          { type: 'course', subject: 'CSCI', number: '220' },
          { type: 'course', subject: 'CSCI', number: '271' },
          { type: 'course', subject: 'CSCI', number: '370' },
        ],
      },
      constraint: { kind: 'min-gpa', value: 2.0 },
    });
  });

  test('case-insensitive GPA keyword', () => {
    expect(parse('all of (MATH 151, MATH 152) WITH GPA >= 3.0')).toEqual({
      type: 'with-constraint',
      requirement: {
        type: 'all-of',
        items: [
          { type: 'course', subject: 'MATH', number: '151' },
          { type: 'course', subject: 'MATH', number: '152' },
        ],
      },
      constraint: { kind: 'min-gpa', value: 3.0 },
    });
  });

  test('GPA value is a number', () => {
    const ast = parse('all of (MATH 151, MATH 152) with gpa >= 2.5');
    expect(typeof ast.constraint.value).toBe('number');
  });
});

describe('with grade — error cases', () => {
  test('missing grade value fails', () => {
    expect(() => parse('MATH 151 with grade >=')).toThrow();
  });

  test('unquoted grade value fails', () => {
    expect(() => parse('MATH 151 with grade >= C')).toThrow();
  });
});
