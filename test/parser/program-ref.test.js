'use strict';

const { parse } = require('../../src/parser');

describe('program references', () => {
  test('named program with type and level', () => {
    expect(parse('program CS major undergraduate')).toEqual({
      type: 'program',
      code: 'CS',
      'program-type': 'major',
      level: 'undergraduate',
    });
  });

  test('program with different type and level', () => {
    expect(parse('program DATA_SCIENCE certificate graduate')).toEqual({
      type: 'program',
      code: 'DATA_SCIENCE',
      'program-type': 'certificate',
      level: 'graduate',
    });
  });

  test('program minor undergraduate', () => {
    expect(parse('program MATH minor undergraduate')).toEqual({
      type: 'program',
      code: 'MATH',
      'program-type': 'minor',
      level: 'undergraduate',
    });
  });

  test('program concentration', () => {
    expect(parse('program AI concentration graduate')).toEqual({
      type: 'program',
      code: 'AI',
      'program-type': 'concentration',
      level: 'graduate',
    });
  });

  test('program track', () => {
    expect(parse('program SYSTEMS track undergraduate')).toEqual({
      type: 'program',
      code: 'SYSTEMS',
      'program-type': 'track',
      level: 'undergraduate',
    });
  });

  test('program cluster', () => {
    expect(parse('program ETHICS cluster undergraduate')).toEqual({
      type: 'program',
      code: 'ETHICS',
      'program-type': 'cluster',
      level: 'undergraduate',
    });
  });

  test('program doctoral level', () => {
    expect(parse('program PHYSICS major doctoral')).toEqual({
      type: 'program',
      code: 'PHYSICS',
      'program-type': 'major',
      level: 'doctoral',
    });
  });

  test('program professional level', () => {
    expect(parse('program LAW major professional')).toEqual({
      type: 'program',
      code: 'LAW',
      'program-type': 'major',
      level: 'professional',
    });
  });

  test('program post-graduate level', () => {
    expect(parse('program EDUCATION certificate post-graduate')).toEqual({
      type: 'program',
      code: 'EDUCATION',
      'program-type': 'certificate',
      level: 'post-graduate',
    });
  });

  test('program post-doctoral level', () => {
    expect(parse('program RESEARCH major post-doctoral')).toEqual({
      type: 'program',
      code: 'RESEARCH',
      'program-type': 'major',
      level: 'post-doctoral',
    });
  });

  test('any program major undergraduate', () => {
    expect(parse('any program major undergraduate')).toEqual({
      type: 'program',
      'program-type': 'major',
      level: 'undergraduate',
    });
  });

  test('any program minor undergraduate', () => {
    expect(parse('any program minor undergraduate')).toEqual({
      type: 'program',
      'program-type': 'minor',
      level: 'undergraduate',
    });
  });

  test('case-insensitive keywords', () => {
    expect(parse('PROGRAM CSCI MAJOR UNDERGRADUATE')).toEqual({
      type: 'program',
      code: 'CSCI',
      'program-type': 'major',
      level: 'undergraduate',
    });
  });

  test('mixed case keywords and code normalization', () => {
    expect(parse('Program math Minor Graduate')).toEqual({
      type: 'program',
      code: 'MATH',
      'program-type': 'minor',
      level: 'graduate',
    });
  });

  test('any program does not conflict with any of', () => {
    // "any of (...)" should still parse as any-of, not program
    expect(parse('any of (MATH 151, MATH 152)').type).toBe('any-of');
  });

  test('program code with underscores', () => {
    expect(parse('program COMP_SCI major undergraduate')).toEqual({
      type: 'program',
      code: 'COMP_SCI',
      'program-type': 'major',
      level: 'undergraduate',
    });
  });

  test('program code normalized to uppercase', () => {
    expect(parse('program comp_sci major undergraduate')).toEqual({
      type: 'program',
      code: 'COMP_SCI',
      'program-type': 'major',
      level: 'undergraduate',
    });
  });

  test('program with quoted name fails', () => {
    expect(() => parse('program "Computer Science" major undergraduate')).toThrow();
  });
});

describe('program context references', () => {
  test('primary major', () => {
    expect(parse('primary major')).toEqual({
      type: 'program-context-ref',
      role: 'primary-major',
    });
  });

  test('primary minor', () => {
    expect(parse('primary minor')).toEqual({
      type: 'program-context-ref',
      role: 'primary-minor',
    });
  });

  test('case-insensitive', () => {
    expect(parse('PRIMARY MAJOR')).toEqual({
      type: 'program-context-ref',
      role: 'primary-major',
    });
  });

  test('mixed case', () => {
    expect(parse('Primary Minor')).toEqual({
      type: 'program-context-ref',
      role: 'primary-minor',
    });
  });
});

describe('overlap limits', () => {
  test('overlap between two variables at most N courses', () => {
    expect(parse('overlap between ($coll, $cs_major) at most 3 courses')).toEqual({
      type: 'overlap-limit',
      left: { type: 'variable-ref', name: 'coll' },
      right: { type: 'variable-ref', name: 'cs_major' },
      constraint: { comparison: 'at-most', value: 3, unit: 'courses' },
    });
  });

  test('overlap between variable and program context at most N credits', () => {
    expect(parse('overlap between ($cs_minor, primary major) at most 6 credits')).toEqual({
      type: 'overlap-limit',
      left: { type: 'variable-ref', name: 'cs_minor' },
      right: { type: 'program-context-ref', role: 'primary-major' },
      constraint: { comparison: 'at-most', value: 6, unit: 'credits' },
    });
  });

  test('overlap with percent unit', () => {
    expect(parse('overlap between ($cs_minor, primary major) at most 50 %')).toEqual({
      type: 'overlap-limit',
      left: { type: 'variable-ref', name: 'cs_minor' },
      right: { type: 'program-context-ref', role: 'primary-major' },
      constraint: { comparison: 'at-most', value: 50, unit: 'percent' },
    });
  });

  test('overlap between two program context refs', () => {
    expect(parse('overlap between (primary major, primary minor) at most 2 courses')).toEqual({
      type: 'overlap-limit',
      left: { type: 'program-context-ref', role: 'primary-major' },
      right: { type: 'program-context-ref', role: 'primary-minor' },
      constraint: { comparison: 'at-most', value: 2, unit: 'courses' },
    });
  });

  test('overlap with cross-scope variable refs', () => {
    expect(parse('overlap between ($cmps-major.core, $math-minor.core) at most 1 courses')).toEqual({
      type: 'overlap-limit',
      left: { type: 'variable-ref', name: 'core', scope: 'cmps-major' },
      right: { type: 'variable-ref', name: 'core', scope: 'math-minor' },
      constraint: { comparison: 'at-most', value: 1, unit: 'courses' },
    });
  });

  test('case-insensitive overlap keywords', () => {
    expect(parse('OVERLAP BETWEEN ($a, $b) AT MOST 3 COURSES')).toEqual({
      type: 'overlap-limit',
      left: { type: 'variable-ref', name: 'a' },
      right: { type: 'variable-ref', name: 'b' },
      constraint: { comparison: 'at-most', value: 3, unit: 'courses' },
    });
  });
});

describe('outside program', () => {
  test('outside primary major at least N credits', () => {
    expect(parse('outside (primary major) at least 72 credits')).toEqual({
      type: 'outside-program',
      program: { type: 'program-context-ref', role: 'primary-major' },
      constraint: { comparison: 'at-least', value: 72, unit: 'credits' },
    });
  });

  test('outside primary minor at least N credits', () => {
    expect(parse('outside (primary minor) at least 30 credits')).toEqual({
      type: 'outside-program',
      program: { type: 'program-context-ref', role: 'primary-minor' },
      constraint: { comparison: 'at-least', value: 30, unit: 'credits' },
    });
  });

  test('outside variable ref at least N credits', () => {
    expect(parse('outside ($cmps_major) at least 60 credits')).toEqual({
      type: 'outside-program',
      program: { type: 'variable-ref', name: 'cmps_major' },
      constraint: { comparison: 'at-least', value: 60, unit: 'credits' },
    });
  });

  test('case-insensitive outside keywords', () => {
    expect(parse('OUTSIDE (PRIMARY MAJOR) AT LEAST 72 CREDITS')).toEqual({
      type: 'outside-program',
      program: { type: 'program-context-ref', role: 'primary-major' },
      constraint: { comparison: 'at-least', value: 72, unit: 'credits' },
    });
  });

  // W&M case study: outside major requirement
  test('W&M: outside major at least 72 credits', () => {
    expect(parse('outside (primary major) at least 72 credits')).toEqual({
      type: 'outside-program',
      program: { type: 'program-context-ref', role: 'primary-major' },
      constraint: { comparison: 'at-least', value: 72, unit: 'credits' },
    });
  });
});

describe('program/overlap in composite expressions', () => {
  test('program ref in all-of', () => {
    const ast = parse('all of (program CSCI major undergraduate, CSCI 141)');
    expect(ast.type).toBe('all-of');
    expect(ast.items[0]).toEqual({
      type: 'program',
      code: 'CSCI',
      'program-type': 'major',
      level: 'undergraduate',
    });
    expect(ast.items[1]).toEqual({ type: 'course', subject: 'CSCI', number: '141' });
  });

  test('program context ref as overlap target', () => {
    const ast = parse('overlap between ($cs_major, primary minor) at most 3 courses');
    expect(ast.right).toEqual({ type: 'program-context-ref', role: 'primary-minor' });
  });
});
