'use strict';

const { parse } = require('../../src/parser');

describe('variable references ($name)', () => {
  test('simple variable reference', () => {
    expect(parse('$core')).toEqual({
      type: 'variable-ref',
      name: 'core',
    });
  });

  test('variable reference with underscores', () => {
    expect(parse('$core_math')).toEqual({
      type: 'variable-ref',
      name: 'core_math',
    });
  });

  test('variable reference in all-of', () => {
    expect(parse('all of ($core, $math, CSCI 141)')).toEqual({
      type: 'all-of',
      items: [
        { type: 'variable-ref', name: 'core' },
        { type: 'variable-ref', name: 'math' },
        { type: 'course', subject: 'CSCI', number: '141' },
      ],
    });
  });

  test('variable reference in n-of', () => {
    expect(parse('at least 2 of ($elective_pool)')).toEqual({
      type: 'n-of',
      comparison: 'at-least',
      count: 2,
      items: [{ type: 'variable-ref', name: 'elective_pool' }],
    });
  });

  test('variable reference with constraint', () => {
    expect(parse('$core with grade >= "C"')).toEqual({
      type: 'with-constraint',
      requirement: { type: 'variable-ref', name: 'core' },
      constraint: { kind: 'min-grade', value: 'C' },
    });
  });

  test('variable reference with except', () => {
    expect(parse('$electives except (CSCI 490)')).toEqual({
      type: 'except',
      source: { type: 'variable-ref', name: 'electives' },
      exclude: [{ type: 'course', subject: 'CSCI', number: '490' }],
    });
  });
});

describe('variable definitions ($name = expression)', () => {
  test('simple variable definition', () => {
    expect(parse('$core = all of (MATH 151, MATH 152)')).toEqual({
      type: 'variable-def',
      name: 'core',
      value: {
        type: 'all-of',
        items: [
          { type: 'course', subject: 'MATH', number: '151' },
          { type: 'course', subject: 'MATH', number: '152' },
        ],
      },
    });
  });

  test('variable definition with complex expression', () => {
    expect(parse('$cs_electives = at least 3 of (courses where subject = "CSCI" and number >= 300)')).toEqual({
      type: 'variable-def',
      name: 'cs_electives',
      value: {
        type: 'n-of',
        comparison: 'at-least',
        count: 3,
        items: [
          {
            type: 'course-filter',
            filters: [
              { field: 'subject', op: 'eq', value: 'CSCI' },
              { field: 'number', op: 'gte', value: 300 },
            ],
          },
        ],
      },
    });
  });

  test('variable definition with except value', () => {
    expect(parse('$electives = courses where subject = "CMPS" except (CMPS 490)')).toEqual({
      type: 'variable-def',
      name: 'electives',
      value: {
        type: 'except',
        source: {
          type: 'course-filter',
          filters: [{ field: 'subject', op: 'eq', value: 'CMPS' }],
        },
        exclude: [{ type: 'course', subject: 'CMPS', number: '490' }],
      },
    });
  });

  test('variable definition with single course', () => {
    expect(parse('$capstone = CSCI 490')).toEqual({
      type: 'variable-def',
      name: 'capstone',
      value: { type: 'course', subject: 'CSCI', number: '490' },
    });
  });

  test('variable definition referencing other variable', () => {
    expect(parse('$upper = $core')).toEqual({
      type: 'variable-def',
      name: 'upper',
      value: { type: 'variable-ref', name: 'core' },
    });
  });

  // Lehigh case study: named requirement groups
  test('Lehigh: math core variable', () => {
    const input = `$math_core = all of (
      any of (MATH 021, MATH 031, MATH 076),
      MATH 022,
      any of (MATH 205, MATH 241, MATH 242)
    )`;
    expect(parse(input)).toEqual({
      type: 'variable-def',
      name: 'math_core',
      value: {
        type: 'all-of',
        items: [
          {
            type: 'any-of',
            items: [
              { type: 'course', subject: 'MATH', number: '021' },
              { type: 'course', subject: 'MATH', number: '031' },
              { type: 'course', subject: 'MATH', number: '076' },
            ],
          },
          { type: 'course', subject: 'MATH', number: '022' },
          {
            type: 'any-of',
            items: [
              { type: 'course', subject: 'MATH', number: '205' },
              { type: 'course', subject: 'MATH', number: '241' },
              { type: 'course', subject: 'MATH', number: '242' },
            ],
          },
        ],
      },
    });
  });
});

describe('cross-scope references ($scope.name)', () => {
  test('cross-scope reference', () => {
    expect(parse('$cmps-major.core')).toEqual({
      type: 'variable-ref',
      name: 'core',
      scope: 'cmps-major',
    });
  });

  test('cross-scope with underscored var name', () => {
    expect(parse('$rcnj.asb_core')).toEqual({
      type: 'variable-ref',
      name: 'asb_core',
      scope: 'rcnj',
    });
  });

  test('cross-scope in all-of', () => {
    expect(parse('all of ($core, $rcnj.asb_core)')).toEqual({
      type: 'all-of',
      items: [
        { type: 'variable-ref', name: 'core' },
        { type: 'variable-ref', name: 'asb_core', scope: 'rcnj' },
      ],
    });
  });

  test('cross-scope reference in expression', () => {
    expect(parse('$biology.core with grade >= "C"')).toEqual({
      type: 'with-constraint',
      requirement: { type: 'variable-ref', name: 'core', scope: 'biology' },
      constraint: { kind: 'min-grade', value: 'C' },
    });
  });
});

describe('scope blocks', () => {
  test('basic scope block', () => {
    const input = `scope "cmps-major" {
      $core = all of (CMPS 130, CMPS 230)
      all of ($core)
    }`;
    expect(parse(input)).toEqual({
      type: 'scope',
      name: 'cmps-major',
      defs: [
        {
          type: 'variable-def',
          name: 'core',
          scope: 'cmps-major',
          value: {
            type: 'all-of',
            items: [
              { type: 'course', subject: 'CMPS', number: '130' },
              { type: 'course', subject: 'CMPS', number: '230' },
            ],
          },
        },
      ],
      body: {
        type: 'all-of',
        items: [{ type: 'variable-ref', name: 'core' }],
      },
    });
  });

  test('scope with multiple variable defs', () => {
    const input = `scope "cmps-major" {
      $core = all of (CMPS 130, CMPS 230)
      $math = all of (MATH 151, MATH 152)
      $electives = at least 3 of (courses where subject = "CMPS" and number >= 300)
      all of ($core, $math, $electives)
    }`;
    const ast = parse(input);
    expect(ast.type).toBe('scope');
    expect(ast.name).toBe('cmps-major');
    expect(ast.defs).toHaveLength(3);
    expect(ast.defs[0].name).toBe('core');
    expect(ast.defs[0].scope).toBe('cmps-major');
    expect(ast.defs[1].name).toBe('math');
    expect(ast.defs[1].scope).toBe('cmps-major');
    expect(ast.defs[2].name).toBe('electives');
    expect(ast.defs[2].scope).toBe('cmps-major');
    expect(ast.body.type).toBe('all-of');
    expect(ast.body.items).toHaveLength(3);
  });

  test('scope with no variable defs', () => {
    const input = 'scope "simple" { all of (MATH 151, MATH 152) }';
    expect(parse(input)).toEqual({
      type: 'scope',
      name: 'simple',
      defs: [],
      body: {
        type: 'all-of',
        items: [
          { type: 'course', subject: 'MATH', number: '151' },
          { type: 'course', subject: 'MATH', number: '152' },
        ],
      },
    });
  });

  test('scope with cross-scope reference in body', () => {
    const input = `scope "acct-major" {
      $core = all of (ACCT 201, ACCT 202)
      all of ($core, $rcnj.asb_core)
    }`;
    const ast = parse(input);
    expect(ast.body.items[1]).toEqual({
      type: 'variable-ref',
      name: 'asb_core',
      scope: 'rcnj',
    });
  });

  test('scope with comments', () => {
    const input = `scope "cmps-major" {
      # Core courses
      $core = all of (CMPS 130, CMPS 230)

      # Final requirement
      all of ($core)
    }`;
    const ast = parse(input);
    expect(ast.type).toBe('scope');
    expect(ast.defs).toHaveLength(1);
    expect(ast.defs[0].name).toBe('core');
  });

  test('case-insensitive SCOPE keyword', () => {
    const input = 'SCOPE "test" { MATH 151 }';
    expect(parse(input)).toEqual({
      type: 'scope',
      name: 'test',
      defs: [],
      body: { type: 'course', subject: 'MATH', number: '151' },
    });
  });
});

describe('variables — edge cases', () => {
  test('variable name starting with underscore', () => {
    expect(parse('$_private')).toEqual({
      type: 'variable-ref',
      name: '_private',
    });
  });

  test('variable name with digits', () => {
    expect(parse('$pool2')).toEqual({
      type: 'variable-ref',
      name: 'pool2',
    });
  });

  test('$ without name fails', () => {
    expect(() => parse('$')).toThrow();
  });

  test('variable name cannot start with digit', () => {
    expect(() => parse('$123')).toThrow();
  });
});
