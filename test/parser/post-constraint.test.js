'use strict';

const { parse } = require('../../src/parser');

describe('where at least N match (...)', () => {
  test('single where clause on n-of', () => {
    const input = `at least 5 of (
      POLI 215, POLI 301, POLI 309, POLI 315,
      AFST 208, HIST 251, SOCI 221
    ) where at least 3 match (subject = "POLI")`;
    const ast = parse(input);
    expect(ast.type).toBe('n-of');
    expect(ast.comparison).toBe('at-least');
    expect(ast.count).toBe(5);
    expect(ast.items).toHaveLength(7);
    expect(ast.post_constraints).toEqual([
      { comparison: 'at-least', count: 3, filter: { field: 'subject', op: 'eq', value: 'POLI' } },
    ]);
  });
});

describe('where at most N match (...)', () => {
  test('at most constraint on n-of', () => {
    const input = `at least 4 of (
      BIOL 220, BIOL 315, BIOL 330, BIOL 401, BIOL 410
    ) where at most 1 match (number < 300)`;
    const ast = parse(input);
    expect(ast.type).toBe('n-of');
    expect(ast.post_constraints).toEqual([
      { comparison: 'at-most', count: 1, filter: { field: 'number', op: 'lt', value: 300 } },
    ]);
  });
});

describe('where exactly N match (...)', () => {
  test('exactly constraint on n-of', () => {
    const input = `at least 4 of (
      CSCI 301, CSCI 303, CSCI 304, CSCI 312, CSCI 320
    ) where exactly 2 match (number >= 400)`;
    const ast = parse(input);
    expect(ast.type).toBe('n-of');
    expect(ast.post_constraints).toEqual([
      { comparison: 'exactly', count: 2, filter: { field: 'number', op: 'gte', value: 400 } },
    ]);
  });
});

describe('multiple where clauses', () => {
  test('two where clauses on same n-of', () => {
    const input = `at least 5 of (
      POLI 215, POLI 301, POLI 309, POLI 315,
      AFST 208, HIST 251, SOCI 221
    )
      where at least 3 match (subject = "POLI")
      where at most 1 match (number < 300)`;
    const ast = parse(input);
    expect(ast.type).toBe('n-of');
    expect(ast.post_constraints).toHaveLength(2);
    expect(ast.post_constraints[0]).toEqual({
      comparison: 'at-least',
      count: 3,
      filter: { field: 'subject', op: 'eq', value: 'POLI' },
    });
    expect(ast.post_constraints[1]).toEqual({
      comparison: 'at-most',
      count: 1,
      filter: { field: 'number', op: 'lt', value: 300 },
    });
  });
});

describe('where clause with other postfixes', () => {
  test('except then where', () => {
    const input = `at least 3 of (
      LAWS 203, LAWS 320, LAWS 332, PSYC 218, SOCI 315
    ) except (LAWS 203)
      where at least 1 match (number >= 300)`;
    const ast = parse(input);
    expect(ast.type).toBe('except');
    expect(ast.source.type).toBe('n-of');
    expect(ast.post_constraints).toEqual([
      { comparison: 'at-least', count: 1, filter: { field: 'number', op: 'gte', value: 300 } },
    ]);
  });

  test('where then with grade', () => {
    const input = `at least 3 of (
      CSCI 301, CSCI 303, CSCI 312, CSCI 320
    )
      where at least 1 match (number >= 400)
      with grade >= "C"`;
    const ast = parse(input);
    expect(ast.type).toBe('with-constraint');
    expect(ast.requirement.type).toBe('n-of');
    expect(ast.requirement.post_constraints).toEqual([
      { comparison: 'at-least', count: 1, filter: { field: 'number', op: 'gte', value: 400 } },
    ]);
    expect(ast.constraint).toEqual({ kind: 'min-grade', value: 'C' });
  });
});

describe('where clause — case insensitivity', () => {
  test('WHERE AT LEAST uppercase', () => {
    const input = 'at least 3 of (CSCI 301, CSCI 303, CSCI 312) WHERE AT LEAST 1 MATCH (number >= 300)';
    const ast = parse(input);
    expect(ast.post_constraints).toHaveLength(1);
  });

  test('Where At Most title case', () => {
    const input = 'at least 3 of (CSCI 301, CSCI 303, CSCI 312) Where At Most 2 Match (subject = "CSCI")';
    const ast = parse(input);
    expect(ast.post_constraints[0].comparison).toBe('at-most');
  });
});

describe('where clause inside all-of', () => {
  test('n-of with where inside all-of item list', () => {
    const input = `all of (
      CSCI 141,
      at least 3 of (CSCI 301, CSCI 303, CSCI 312, CSCI 320)
        where at least 1 match (number >= 400)
    )`;
    const ast = parse(input);
    expect(ast.type).toBe('all-of');
    expect(ast.items[1].type).toBe('n-of');
    expect(ast.items[1].post_constraints).toEqual([
      { comparison: 'at-least', count: 1, filter: { field: 'number', op: 'gte', value: 400 } },
    ]);
  });
});

describe('expression without where has no post_constraints', () => {
  test('n-of without where clause', () => {
    const ast = parse('at least 3 of (MATH 151, MATH 152, MATH 250)');
    expect(ast).not.toHaveProperty('post_constraints');
  });
});
