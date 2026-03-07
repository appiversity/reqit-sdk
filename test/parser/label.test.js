'use strict';

const { parse } = require('../../src/parser');

// ============================================================
// Label syntax: "Label": composite(...)
// ============================================================

describe('label — all-of', () => {
  test('labeled all-of', () => {
    const ast = parse('"Core Requirements": all of (MATH 151, MATH 152)');
    expect(ast).toEqual({
      type: 'all-of',
      label: 'Core Requirements',
      items: [
        { type: 'course', subject: 'MATH', number: '151' },
        { type: 'course', subject: 'MATH', number: '152' },
      ],
    });
  });
});

describe('label — other composite types', () => {
  test('labeled any-of', () => {
    const ast = parse('"Alternatives": any of (MATH 151, MATH 152)');
    expect(ast.type).toBe('any-of');
    expect(ast.label).toBe('Alternatives');
    expect(ast.items).toHaveLength(2);
  });

  test('labeled none-of', () => {
    const ast = parse('"Exclusions": none of (MATH 151, MATH 152)');
    expect(ast.type).toBe('none-of');
    expect(ast.label).toBe('Exclusions');
  });

  test('labeled n-of', () => {
    const ast = parse('"Electives": at least 2 of (MATH 151, MATH 152, MATH 250)');
    expect(ast.type).toBe('n-of');
    expect(ast.label).toBe('Electives');
    expect(ast.comparison).toBe('at-least');
    expect(ast.count).toBe(2);
  });

  test('labeled credits-from', () => {
    const ast = parse('"Technical Credits": at least 15 credits from (courses where subject = "CSE")');
    expect(ast.type).toBe('credits-from');
    expect(ast.label).toBe('Technical Credits');
    expect(ast.credits).toBe(15);
  });

  test('labeled one-from-each', () => {
    const ast = parse('"Distribution": one from each of (courses where attribute = "HUM", courses where attribute = "SCI")');
    expect(ast.type).toBe('one-from-each');
    expect(ast.label).toBe('Distribution');
  });

  test('labeled from-n-groups', () => {
    const ast = parse('"Breadth": from at least 2 of (courses where attribute = "HUM", courses where attribute = "SCI")');
    expect(ast.type).toBe('from-n-groups');
    expect(ast.label).toBe('Breadth');
  });
});

describe('label — variable-def interaction', () => {
  test('label on value inside variable-def', () => {
    const ast = parse('$core = "CS Core": all of (CMPS 130, CMPS 230)');
    expect(ast.type).toBe('variable-def');
    expect(ast.name).toBe('core');
    expect(ast.value.type).toBe('all-of');
    expect(ast.value.label).toBe('CS Core');
    expect(ast.value.items).toHaveLength(2);
  });

  test('label in scope with variable-def', () => {
    const ast = parse(`scope "cmps-major" {
      $core = "CS Core": all of (CMPS 130, CMPS 230)
      all of ($core)
    }`);
    expect(ast.type).toBe('scope');
    expect(ast.defs[0].value.label).toBe('CS Core');
    expect(ast.defs[0].value.type).toBe('all-of');
  });
});

describe('label — nested labels', () => {
  test('outer and inner both labeled', () => {
    const ast = parse('"Outer": all of ("Inner": any of (MATH 151, MATH 152), CSCI 120)');
    expect(ast.type).toBe('all-of');
    expect(ast.label).toBe('Outer');
    expect(ast.items[0].type).toBe('any-of');
    expect(ast.items[0].label).toBe('Inner');
  });
});

describe('label — with except, where, with-constraint', () => {
  test('label with except', () => {
    const ast = parse('"Electives": at least 3 of (CMPS 301, CMPS 302, CMPS 350) except (CMPS 350)');
    expect(ast.type).toBe('except');
    expect(ast.source.type).toBe('n-of');
    expect(ast.source.label).toBe('Electives');
  });

  test('label with where clause', () => {
    const ast = parse('"Major": at least 5 of (POLI 215, POLI 301, POLI 309) where at least 2 match (subject = "POLI")');
    expect(ast.type).toBe('n-of');
    expect(ast.label).toBe('Major');
    expect(ast.post_constraints).toHaveLength(1);
  });

  test('label with with-constraint', () => {
    const ast = parse('"Core": all of (MATH 151, MATH 152) with grade >= "C"');
    expect(ast.type).toBe('with-constraint');
    expect(ast.requirement.type).toBe('all-of');
    expect(ast.requirement.label).toBe('Core');
  });
});

describe('label — no-label regression', () => {
  test('unlabeled all-of unchanged', () => {
    const ast = parse('all of (MATH 151, MATH 152)');
    expect(ast.type).toBe('all-of');
    expect(ast.label).toBeUndefined();
  });

  test('unlabeled course unchanged', () => {
    const ast = parse('MATH 151');
    expect(ast.type).toBe('course');
    expect(ast.label).toBeUndefined();
  });

  test('unlabeled variable-def unchanged', () => {
    const ast = parse('$core = all of (MATH 151, MATH 152)');
    expect(ast.value.label).toBeUndefined();
  });
});

describe('label — error cases', () => {
  test('label on non-composite fails to parse', () => {
    expect(() => parse('"Bad": MATH 151')).toThrow();
  });

  test('label on variable-ref fails to parse', () => {
    expect(() => parse('"Bad": $core')).toThrow();
  });

  test('label on course-filter fails to parse', () => {
    expect(() => parse('"Bad": courses where subject = "CMPS"')).toThrow();
  });
});
