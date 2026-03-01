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

describe('with grade — error cases', () => {
  test('missing grade value fails', () => {
    expect(() => parse('MATH 151 with grade >=')).toThrow();
  });

  test('unquoted grade value fails', () => {
    expect(() => parse('MATH 151 with grade >= C')).toThrow();
  });
});
