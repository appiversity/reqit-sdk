'use strict';

const { parse } = require('../../src/parser');

describe('Course references', () => {
  test('standard four-letter subject', () => {
    expect(parse('MATH 151')).toEqual({
      type: 'course',
      subject: 'MATH',
      number: '151',
    });
  });

  test('three-letter subject', () => {
    expect(parse('CSE 003')).toEqual({
      type: 'course',
      subject: 'CSE',
      number: '003',
    });
  });

  test('leading zeros preserved in number', () => {
    const ast = parse('CSE 003');
    expect(ast.number).toBe('003');
  });

  test('alphanumeric number with letter suffix', () => {
    expect(parse('CSCI 101A')).toEqual({
      type: 'course',
      subject: 'CSCI',
      number: '101A',
    });
  });

  test('number with dot notation (Moravian half-unit)', () => {
    expect(parse('CSCI 220.2')).toEqual({
      type: 'course',
      subject: 'CSCI',
      number: '220.2',
    });
  });

  test('leading and trailing whitespace ignored', () => {
    expect(parse('  MATH 151  ')).toEqual({
      type: 'course',
      subject: 'MATH',
      number: '151',
    });
  });

  test('tab between subject and number', () => {
    expect(parse('MATH\t151')).toEqual({
      type: 'course',
      subject: 'MATH',
      number: '151',
    });
  });

  test('multiple spaces between subject and number', () => {
    expect(parse('MATH   151')).toEqual({
      type: 'course',
      subject: 'MATH',
      number: '151',
    });
  });

  // Case insensitivity — parser normalizes to uppercase
  test('lowercase subject normalizes to uppercase', () => {
    expect(parse('math 121')).toEqual({
      type: 'course',
      subject: 'MATH',
      number: '121',
    });
  });

  test('mixed-case subject normalizes to uppercase', () => {
    expect(parse('Math 121')).toEqual({
      type: 'course',
      subject: 'MATH',
      number: '121',
    });
  });

  test('partially wrong case normalizes to uppercase', () => {
    expect(parse('MATh 121')).toEqual({
      type: 'course',
      subject: 'MATH',
      number: '121',
    });
  });

  test('lowercase letter suffix in number normalizes to uppercase', () => {
    expect(parse('CSCI 101a')).toEqual({
      type: 'course',
      subject: 'CSCI',
      number: '101A',
    });
  });

  test('fully lowercase subject and number suffix', () => {
    expect(parse('crwt 102s')).toEqual({
      type: 'course',
      subject: 'CRWT',
      number: '102S',
    });
  });

  // Case study courses
  test('Lehigh: CSE 017', () => {
    expect(parse('CSE 017')).toEqual({
      type: 'course',
      subject: 'CSE',
      number: '017',
    });
  });

  test('Moravian: CSCI 243.2', () => {
    expect(parse('CSCI 243.2')).toEqual({
      type: 'course',
      subject: 'CSCI',
      number: '243.2',
    });
  });

  test('RCNJ: CRWT 102S', () => {
    expect(parse('CRWT 102S')).toEqual({
      type: 'course',
      subject: 'CRWT',
      number: '102S',
    });
  });

  test('RCNJ: CMPS 147', () => {
    expect(parse('CMPS 147')).toEqual({
      type: 'course',
      subject: 'CMPS',
      number: '147',
    });
  });

  test('W&M: DATA 441', () => {
    expect(parse('DATA 441')).toEqual({
      type: 'course',
      subject: 'DATA',
      number: '441',
    });
  });

  test('two-letter subject', () => {
    expect(parse('CS 101')).toEqual({
      type: 'course',
      subject: 'CS',
      number: '101',
    });
  });

  // Concurrent allowed
  test('concurrent allowed', () => {
    expect(parse('CMPS 230 (concurrent allowed)')).toEqual({
      type: 'course',
      subject: 'CMPS',
      number: '230',
      concurrentAllowed: true,
    });
  });

  test('concurrent allowed case-insensitive', () => {
    expect(parse('MATH 151 (Concurrent Allowed)')).toEqual({
      type: 'course',
      subject: 'MATH',
      number: '151',
      concurrentAllowed: true,
    });
    expect(parse('MATH 151 (CONCURRENT ALLOWED)')).toEqual({
      type: 'course',
      subject: 'MATH',
      number: '151',
      concurrentAllowed: true,
    });
  });

  test('concurrent allowed with extra whitespace', () => {
    expect(parse('CMPS 230  (  concurrent   allowed  )')).toEqual({
      type: 'course',
      subject: 'CMPS',
      number: '230',
      concurrentAllowed: true,
    });
  });

  test('concurrent allowed inside all-of', () => {
    const input = `all of (
      CMPS 230 (concurrent allowed),
      MATH 151
    )`;
    expect(parse(input)).toEqual({
      type: 'all-of',
      items: [
        { type: 'course', subject: 'CMPS', number: '230', concurrentAllowed: true },
        { type: 'course', subject: 'MATH', number: '151' },
      ],
    });
  });

  test('without concurrent allowed has no concurrentAllowed field', () => {
    const ast = parse('MATH 151');
    expect(ast).not.toHaveProperty('concurrentAllowed');
  });

  // Error cases
  test('missing number fails', () => {
    expect(() => parse('MATH')).toThrow();
  });

  test('missing subject fails', () => {
    expect(() => parse('151')).toThrow();
  });

  test('empty string fails', () => {
    expect(() => parse('')).toThrow();
  });

  test('single letter subject fails', () => {
    expect(() => parse('M 151')).toThrow();
  });
});
