'use strict';

const { parse } = require('../../src/parser');

describe('score requirements', () => {
  test('score >= threshold', () => {
    expect(parse('score "SAT MATH" >= 580')).toEqual({
      type: 'score',
      name: 'SAT MATH',
      op: 'gte',
      value: 580,
    });
  });

  test('score >= with composite name', () => {
    expect(parse('score "SAT" >= 1200')).toEqual({
      type: 'score',
      name: 'SAT',
      op: 'gte',
      value: 1200,
    });
  });

  test('score with different operators', () => {
    expect(parse('score "ACT" >= 25')).toEqual({
      type: 'score',
      name: 'ACT',
      op: 'gte',
      value: 25,
    });
    expect(parse('score "AP Calculus" >= 3')).toEqual({
      type: 'score',
      name: 'AP Calculus',
      op: 'gte',
      value: 3,
    });
  });

  // RCNJ case study: test score prerequisites
  test('RCNJ: SAT score prerequisite', () => {
    const input = `any of (
      MATH 100,
      score "SAT MATH" >= 580
    )`;
    expect(parse(input)).toEqual({
      type: 'any-of',
      items: [
        { type: 'course', subject: 'MATH', number: '100' },
        { type: 'score', name: 'SAT MATH', op: 'gte', value: 580 },
      ],
    });
  });

  test('case-insensitive SCORE keyword', () => {
    expect(parse('Score "GRE" >= 300')).toEqual({
      type: 'score',
      name: 'GRE',
      op: 'gte',
      value: 300,
    });
  });

  test('score value is a number', () => {
    const ast = parse('score "SAT" >= 1200');
    expect(typeof ast.value).toBe('number');
  });
});

describe('attainment requirements', () => {
  test('simple attainment', () => {
    expect(parse('attainment "Junior Standing"')).toEqual({
      type: 'attainment',
      name: 'Junior Standing',
    });
  });

  test('attainment in all-of', () => {
    const input = `all of (
      CSCI 370,
      attainment "Senior Standing"
    )`;
    expect(parse(input)).toEqual({
      type: 'all-of',
      items: [
        { type: 'course', subject: 'CSCI', number: '370' },
        { type: 'attainment', name: 'Senior Standing' },
      ],
    });
  });

  // Moravian case study: standing requirements
  test('Moravian: standing requirement', () => {
    expect(parse('attainment "Praxis"')).toEqual({
      type: 'attainment',
      name: 'Praxis',
    });
  });

  test('case-insensitive ATTAINMENT keyword', () => {
    expect(parse('ATTAINMENT "Matriculation"')).toEqual({
      type: 'attainment',
      name: 'Matriculation',
    });
  });
});

describe('quantity requirements', () => {
  test('quantity >= threshold', () => {
    expect(parse('quantity "Clinical Hours" >= 500')).toEqual({
      type: 'quantity',
      name: 'Clinical Hours',
      op: 'gte',
      value: 500,
    });
  });

  test('quantity with decimal value', () => {
    expect(parse('quantity "Community Service Hours" >= 40.5')).toEqual({
      type: 'quantity',
      name: 'Community Service Hours',
      op: 'gte',
      value: 40.5,
    });
  });

  test('quantity inside all-of', () => {
    const input = `all of (
      NURS 400,
      quantity "Clinical Hours" >= 500,
      attainment "CPR Certification"
    )`;
    expect(parse(input)).toEqual({
      type: 'all-of',
      items: [
        { type: 'course', subject: 'NURS', number: '400' },
        { type: 'quantity', name: 'Clinical Hours', op: 'gte', value: 500 },
        { type: 'attainment', name: 'CPR Certification' },
      ],
    });
  });

  test('case-insensitive QUANTITY keyword', () => {
    expect(parse('Quantity "Lab Hours" >= 100')).toEqual({
      type: 'quantity',
      name: 'Lab Hours',
      op: 'gte',
      value: 100,
    });
  });
});

describe('non-course — error cases', () => {
  test('score without quoted name fails', () => {
    expect(() => parse('score SAT >= 1200')).toThrow();
  });

  test('attainment without quoted name fails', () => {
    expect(() => parse('attainment Junior')).toThrow();
  });

  test('quantity without value fails', () => {
    expect(() => parse('quantity "Hours" >=')).toThrow();
  });
});
