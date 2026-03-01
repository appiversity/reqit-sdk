'use strict';

const { parse } = require('../../src/parser');

describe('Comments', () => {
  test('inline comment after course reference', () => {
    expect(parse('MATH 151 # Calculus I')).toEqual({
      type: 'course',
      subject: 'MATH',
      number: '151',
    });
  });

  test('comment on line before expression', () => {
    expect(parse('# prerequisites\nMATH 151')).toEqual({
      type: 'course',
      subject: 'MATH',
      number: '151',
    });
  });

  test('comment on line after expression', () => {
    expect(parse('MATH 151\n# end of requirements')).toEqual({
      type: 'course',
      subject: 'MATH',
      number: '151',
    });
  });

  test('comments before and after expression', () => {
    expect(parse('# header\nMATH 151\n# footer')).toEqual({
      type: 'course',
      subject: 'MATH',
      number: '151',
    });
  });

  test('multiple comment lines before expression', () => {
    expect(parse('# line 1\n# line 2\n# line 3\nCSE 003')).toEqual({
      type: 'course',
      subject: 'CSE',
      number: '003',
    });
  });

  test('inline comment with no space after hash', () => {
    expect(parse('MATH 151 #Calculus')).toEqual({
      type: 'course',
      subject: 'MATH',
      number: '151',
    });
  });

  test('comment with special characters', () => {
    expect(parse('MATH 151 # prereq for MATH 152 (required!)')).toEqual({
      type: 'course',
      subject: 'MATH',
      number: '151',
    });
  });

  test('empty comment', () => {
    expect(parse('MATH 151 #')).toEqual({
      type: 'course',
      subject: 'MATH',
      number: '151',
    });
  });

  test('comment-only input fails (no expression)', () => {
    expect(() => parse('# just a comment')).toThrow();
  });

  test('carriage return line endings', () => {
    expect(parse('# comment\r\nMATH 151')).toEqual({
      type: 'course',
      subject: 'MATH',
      number: '151',
    });
  });
});
