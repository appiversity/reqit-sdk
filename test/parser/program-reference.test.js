'use strict';

const { parse } = require('../../src/parser');

// ============================================================
// program-ref — program "CODE"
// ============================================================

describe('program-ref parsing', () => {
  test('basic program reference', () => {
    const ast = parse('program "MATH-MINOR"');
    expect(ast).toEqual({ type: 'program-ref', code: 'MATH-MINOR' });
  });

  test('program reference with simple code', () => {
    const ast = parse('program "BS-DATA"');
    expect(ast).toEqual({ type: 'program-ref', code: 'BS-DATA' });
  });

  test('program reference with underscores', () => {
    const ast = parse('program "CSCI_MAJOR"');
    expect(ast).toEqual({ type: 'program-ref', code: 'CSCI_MAJOR' });
  });

  test('program reference is case-insensitive keyword', () => {
    const ast = parse('PROGRAM "MATH-MINOR"');
    expect(ast).toEqual({ type: 'program-ref', code: 'MATH-MINOR' });
  });

  test('disambiguation: existing program ref still works', () => {
    const ast = parse('program CS major undergraduate');
    expect(ast).toEqual({
      type: 'program',
      code: 'CS',
      'program-type': 'major',
      level: 'undergraduate',
    });
  });

  test('disambiguation: any program still works', () => {
    const ast = parse('any program major undergraduate');
    expect(ast).toEqual({
      type: 'program',
      'program-type': 'major',
      level: 'undergraduate',
    });
  });

  test('program-ref inside all-of', () => {
    const ast = parse('all of (program "MATH-MINOR", MATH 151)');
    expect(ast.type).toBe('all-of');
    expect(ast.items).toHaveLength(2);
    expect(ast.items[0]).toEqual({ type: 'program-ref', code: 'MATH-MINOR' });
    expect(ast.items[1].type).toBe('course');
  });
});

// ============================================================
// program-filter — quantified program filters
// ============================================================

describe('program-filter parsing', () => {
  test('any program where type = "minor"', () => {
    const ast = parse('any program where type = "minor"');
    expect(ast).toEqual({
      type: 'program-filter',
      quantifier: 'any',
      filters: [{ field: 'type', op: 'eq', value: 'minor' }],
    });
  });

  test('all programs where type = "minor"', () => {
    const ast = parse('all programs where type = "minor"');
    expect(ast).toEqual({
      type: 'program-filter',
      quantifier: 'all',
      filters: [{ field: 'type', op: 'eq', value: 'minor' }],
    });
  });

  test('at least 2 programs where type = "minor"', () => {
    const ast = parse('at least 2 programs where type = "minor"');
    expect(ast).toEqual({
      type: 'program-filter',
      quantifier: 'n-of',
      comparison: 'at-least',
      count: 2,
      filters: [{ field: 'type', op: 'eq', value: 'minor' }],
    });
  });

  test('at most 1 programs where type = "minor"', () => {
    const ast = parse('at most 1 programs where type = "minor"');
    expect(ast).toEqual({
      type: 'program-filter',
      quantifier: 'n-of',
      comparison: 'at-most',
      count: 1,
      filters: [{ field: 'type', op: 'eq', value: 'minor' }],
    });
  });

  test('exactly 2 programs where level = "undergraduate"', () => {
    const ast = parse('exactly 2 programs where level = "undergraduate"');
    expect(ast).toEqual({
      type: 'program-filter',
      quantifier: 'n-of',
      comparison: 'exactly',
      count: 2,
      filters: [{ field: 'level', op: 'eq', value: 'undergraduate' }],
    });
  });

  test('combined filters with and', () => {
    const ast = parse('any program where type = "minor" and level = "undergraduate"');
    expect(ast).toEqual({
      type: 'program-filter',
      quantifier: 'any',
      filters: [
        { field: 'type', op: 'eq', value: 'minor' },
        { field: 'level', op: 'eq', value: 'undergraduate' },
      ],
    });
  });

  test('code filter field', () => {
    const ast = parse('any program where code = "MATH-MINOR"');
    expect(ast).toEqual({
      type: 'program-filter',
      quantifier: 'any',
      filters: [{ field: 'code', op: 'eq', value: 'MATH-MINOR' }],
    });
  });

  test('in operator with program filter', () => {
    const ast = parse('any program where type in ("minor", "certificate")');
    expect(ast).toEqual({
      type: 'program-filter',
      quantifier: 'any',
      filters: [{ field: 'type', op: 'in', value: ['minor', 'certificate'] }],
    });
  });

  test('ne operator with program filter', () => {
    const ast = parse('all programs where type != "major"');
    expect(ast).toEqual({
      type: 'program-filter',
      quantifier: 'all',
      filters: [{ field: 'type', op: 'ne', value: 'major' }],
    });
  });

  test('case insensitive keywords', () => {
    const ast = parse('ANY PROGRAM WHERE TYPE = "minor"');
    expect(ast.type).toBe('program-filter');
    expect(ast.quantifier).toBe('any');
  });

  test('case insensitive filter field names', () => {
    const ast = parse('any program where TYPE = "minor"');
    expect(ast.filters[0].field).toBe('type');
  });
});

// ============================================================
// Disambiguation — no conflicts with existing grammar
// ============================================================

describe('program-filter disambiguation', () => {
  test('any of (...) still works', () => {
    const ast = parse('any of (MATH 151, MATH 152)');
    expect(ast.type).toBe('any-of');
  });

  test('all of (...) still works', () => {
    const ast = parse('all of (MATH 151, MATH 152)');
    expect(ast.type).toBe('all-of');
  });

  test('at least 2 of (...) still works', () => {
    const ast = parse('at least 2 of (MATH 151, MATH 152, MATH 153)');
    expect(ast.type).toBe('n-of');
  });

  test('at most 1 of (...) still works', () => {
    const ast = parse('at most 1 of (MATH 151, MATH 152)');
    expect(ast.type).toBe('n-of');
  });

  test('exactly 1 of (...) still works', () => {
    const ast = parse('exactly 1 of (MATH 151, MATH 152)');
    expect(ast.type).toBe('n-of');
  });

  test('at least 3 credits from (...) still works', () => {
    const ast = parse('at least 3 credits from (MATH 151)');
    expect(ast.type).toBe('credits-from');
  });

  test('program-filter inside all-of', () => {
    const ast = parse('all of (any program where type = "minor", MATH 151)');
    expect(ast.type).toBe('all-of');
    expect(ast.items).toHaveLength(2);
    expect(ast.items[0].type).toBe('program-filter');
    expect(ast.items[1].type).toBe('course');
  });
});
