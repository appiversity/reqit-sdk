'use strict';

const { parse } = require('../../src/parser');

describe('score requirements', () => {
  test('score >= threshold', () => {
    expect(parse('score SAT_MATH >= 580')).toEqual({
      type: 'score',
      name: 'SAT_MATH',
      op: 'gte',
      value: 580,
    });
  });

  test('score >= with simple name', () => {
    expect(parse('score SAT >= 1200')).toEqual({
      type: 'score',
      name: 'SAT',
      op: 'gte',
      value: 1200,
    });
  });

  test('score with different operators', () => {
    expect(parse('score ACT >= 25')).toEqual({
      type: 'score',
      name: 'ACT',
      op: 'gte',
      value: 25,
    });
    expect(parse('score AP_CALCULUS >= 3')).toEqual({
      type: 'score',
      name: 'AP_CALCULUS',
      op: 'gte',
      value: 3,
    });
  });

  // RCNJ case study: test score prerequisites
  test('RCNJ: SAT score prerequisite', () => {
    const input = `any of (
      MATH 100,
      score SAT_MATH >= 580
    )`;
    expect(parse(input)).toEqual({
      type: 'any-of',
      items: [
        { type: 'course', subject: 'MATH', number: '100' },
        { type: 'score', name: 'SAT_MATH', op: 'gte', value: 580 },
      ],
    });
  });

  test('case-insensitive SCORE keyword', () => {
    expect(parse('Score GRE >= 300')).toEqual({
      type: 'score',
      name: 'GRE',
      op: 'gte',
      value: 300,
    });
  });

  test('score value is a number', () => {
    const ast = parse('score SAT >= 1200');
    expect(typeof ast.value).toBe('number');
  });

  test('score code is normalized to uppercase', () => {
    expect(parse('score sat_math >= 580')).toEqual({
      type: 'score',
      name: 'SAT_MATH',
      op: 'gte',
      value: 580,
    });
  });

  test('score code with underscores', () => {
    expect(parse('score AP_CALC_AB >= 3')).toEqual({
      type: 'score',
      name: 'AP_CALC_AB',
      op: 'gte',
      value: 3,
    });
  });

  test('single character score code', () => {
    expect(parse('score X >= 5')).toEqual({
      type: 'score',
      name: 'X',
      op: 'gte',
      value: 5,
    });
  });
});

describe('attainment requirements', () => {
  test('simple attainment', () => {
    expect(parse('attainment JUNIOR_STANDING')).toEqual({
      type: 'attainment',
      name: 'JUNIOR_STANDING',
    });
  });

  test('attainment in all-of', () => {
    const input = `all of (
      CSCI 370,
      attainment SENIOR_STANDING
    )`;
    expect(parse(input)).toEqual({
      type: 'all-of',
      items: [
        { type: 'course', subject: 'CSCI', number: '370' },
        { type: 'attainment', name: 'SENIOR_STANDING' },
      ],
    });
  });

  // Moravian case study: standing requirements
  test('Moravian: standing requirement', () => {
    expect(parse('attainment PRAXIS')).toEqual({
      type: 'attainment',
      name: 'PRAXIS',
    });
  });

  test('case-insensitive ATTAINMENT keyword', () => {
    expect(parse('ATTAINMENT MATRICULATION')).toEqual({
      type: 'attainment',
      name: 'MATRICULATION',
    });
  });

  test('attainment code is normalized to uppercase', () => {
    expect(parse('attainment junior_standing')).toEqual({
      type: 'attainment',
      name: 'JUNIOR_STANDING',
    });
  });
});

describe('quantity requirements', () => {
  test('quantity >= threshold', () => {
    expect(parse('quantity CLINICAL_HOURS >= 500')).toEqual({
      type: 'quantity',
      name: 'CLINICAL_HOURS',
      op: 'gte',
      value: 500,
    });
  });

  test('quantity with decimal value', () => {
    expect(parse('quantity COMMUNITY_SERVICE_HOURS >= 40.5')).toEqual({
      type: 'quantity',
      name: 'COMMUNITY_SERVICE_HOURS',
      op: 'gte',
      value: 40.5,
    });
  });

  test('quantity inside all-of', () => {
    const input = `all of (
      NURS 400,
      quantity CLINICAL_HOURS >= 500,
      attainment CPR_CERTIFICATION
    )`;
    expect(parse(input)).toEqual({
      type: 'all-of',
      items: [
        { type: 'course', subject: 'NURS', number: '400' },
        { type: 'quantity', name: 'CLINICAL_HOURS', op: 'gte', value: 500 },
        { type: 'attainment', name: 'CPR_CERTIFICATION' },
      ],
    });
  });

  test('case-insensitive QUANTITY keyword', () => {
    expect(parse('Quantity LAB_HOURS >= 100')).toEqual({
      type: 'quantity',
      name: 'LAB_HOURS',
      op: 'gte',
      value: 100,
    });
  });
});

describe('non-course — error cases', () => {
  test('score with quoted name fails', () => {
    expect(() => parse('score "SAT MATH" >= 1200')).toThrow();
  });

  test('attainment with quoted name fails', () => {
    expect(() => parse('attainment "Junior Standing"')).toThrow();
  });

  test('quantity without value fails', () => {
    expect(() => parse('quantity HOURS >=')).toThrow();
  });

  test('score code starting with digit fails', () => {
    expect(() => parse('score 3RD_YEAR >= 5')).toThrow();
  });
});
