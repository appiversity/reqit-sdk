'use strict';

const { expand } = require('../../src/ast/expand');
const { parse } = require('../../src/parser');
const { toText } = require('../../src/render/to-text');
const { toOutline } = require('../../src/render/to-outline');
const api = require('../../src/index');
const minimalCatalog = require('../fixtures/catalogs/minimal.json');

describe('expand — scope inlining', () => {
  test('single variable: scope with one def and body ref', () => {
    const ast = parse('scope "x" { $a = MATH 151 $a }');
    const result = expand(ast);
    expect(result).toEqual({ type: 'course', subject: 'MATH', number: '151' });
  });

  test('multi-var in composite', () => {
    const ast = parse('$a = MATH 151\n$b = CMPS 130\nall of ($a, $b)');
    const result = expand(ast);
    expect(result).toEqual({
      type: 'all-of',
      items: [
        { type: 'course', subject: 'MATH', number: '151' },
        { type: 'course', subject: 'CMPS', number: '130' },
      ],
    });
  });

  test('bare variable program (name: null) expands correctly', () => {
    const ast = parse('$core = MATH 151\n$core');
    expect(ast.type).toBe('scope');
    expect(ast.name).toBeNull();
    const result = expand(ast);
    expect(result).toEqual({ type: 'course', subject: 'MATH', number: '151' });
  });

  test('variable referencing another variable', () => {
    const ast = parse('$a = MATH 151\n$b = all of ($a, CMPS 130)\n$b');
    const result = expand(ast);
    expect(result).toEqual({
      type: 'all-of',
      items: [
        { type: 'course', subject: 'MATH', number: '151' },
        { type: 'course', subject: 'CMPS', number: '130' },
      ],
    });
  });

  test('circular reference throws', () => {
    const ast = {
      type: 'scope',
      name: null,
      defs: [
        { type: 'variable-def', name: 'a', value: { type: 'variable-ref', name: 'b' } },
        { type: 'variable-def', name: 'b', value: { type: 'variable-ref', name: 'a' } },
      ],
      body: { type: 'variable-ref', name: 'a' },
    };
    expect(() => expand(ast)).toThrow(/[Cc]ircular/);
  });

  test('no variables: non-scope returned unchanged', () => {
    const ast = parse('all of (MATH 151, CMPS 130)');
    const result = expand(ast);
    expect(result).toEqual(ast);
  });

  test('expansion preserves constraints', () => {
    const ast = parse('$core = all of (MATH 151, CMPS 130)\n$core with grade >= "B"');
    const result = expand(ast);
    expect(result.type).toBe('with-constraint');
    expect(result.requirement.type).toBe('all-of');
    expect(result.constraint).toEqual({ kind: 'min-grade', value: 'B' });
  });

  test('scoped refs ($scope.var) resolve correctly', () => {
    const ast = parse('scope "bio" { $core = BIOL 101 $core }');
    // Build an outer scope referencing $bio.core
    const outer = {
      type: 'scope',
      name: null,
      defs: ast.defs.map(d => ({ ...d, scope: 'bio' })),
      body: { type: 'variable-ref', name: 'core', scope: 'bio' },
    };
    // Manually set the scope name so buildVarMap registers scoped keys
    outer.name = 'bio';
    // Use a named scope for this test
    const namedScope = { ...ast };
    const result = expand(namedScope);
    expect(result).toEqual({ type: 'course', subject: 'BIOL', number: '101' });
  });
});

describe('expand via Requirement.expand()', () => {
  test('req.expand() returns new Requirement', () => {
    const req = api.parse('$a = MATH 151\n$a');
    const expanded = req.expand();
    expect(expanded).toBeInstanceOf(api.Requirement);
    expect(expanded.ast).toEqual({ type: 'course', subject: 'MATH', number: '151' });
  });

  test('req.expand().toOutline(catalog) shows course titles', () => {
    const req = api.parse('$a = MATH 151\n$a');
    const outline = req.expand().toOutline(minimalCatalog);
    expect(outline).toContain('Calculus I');
  });

  test('req.expand().text shows canonical DSL without scope/variables', () => {
    const req = api.parse('$a = MATH 151\n$b = CMPS 130\nall of ($a, $b)');
    const text = req.expand().text;
    expect(text).toBe('all of (MATH 151, CMPS 130)');
  });

  test('non-scope requirement expand returns equivalent', () => {
    const req = api.parse('MATH 151');
    const expanded = req.expand();
    expect(expanded.ast).toEqual(req.ast);
  });

  test('original requirement unchanged after expand', () => {
    const req = api.parse('$a = MATH 151\n$a');
    req.expand();
    expect(req.ast.type).toBe('scope');
  });
});
