'use strict';

const { forEachChild, CHILD_PROPS } = require('../../src/ast/children');
const { NODE_TYPES } = require('../../src/render/shared');

// ============================================================
// forEachChild — generic AST child visitor
// ============================================================

describe('forEachChild', () => {
  // --- Leaf nodes ---

  test('course → no callback', () => {
    const cb = jest.fn();
    forEachChild({ type: 'course', subject: 'MATH', number: '101' }, cb);
    expect(cb).not.toHaveBeenCalled();
  });

  test('course-filter → no callback', () => {
    const cb = jest.fn();
    forEachChild({ type: 'course-filter', filters: [{ field: 'subject', op: 'eq', value: 'MATH' }] }, cb);
    expect(cb).not.toHaveBeenCalled();
  });

  test('score → no callback', () => {
    const cb = jest.fn();
    forEachChild({ type: 'score', name: 'SAT', op: 'gte', value: 600 }, cb);
    expect(cb).not.toHaveBeenCalled();
  });

  test('attainment → no callback', () => {
    const cb = jest.fn();
    forEachChild({ type: 'attainment', name: 'JUNIOR' }, cb);
    expect(cb).not.toHaveBeenCalled();
  });

  test('quantity → no callback', () => {
    const cb = jest.fn();
    forEachChild({ type: 'quantity', name: 'HOURS', op: 'gte', value: 100 }, cb);
    expect(cb).not.toHaveBeenCalled();
  });

  test('variable-ref → no callback', () => {
    const cb = jest.fn();
    forEachChild({ type: 'variable-ref', name: 'core' }, cb);
    expect(cb).not.toHaveBeenCalled();
  });

  test('program → no callback', () => {
    const cb = jest.fn();
    forEachChild({ type: 'program', code: 'CS', 'program-type': 'major', level: 'undergraduate' }, cb);
    expect(cb).not.toHaveBeenCalled();
  });

  test('program-context-ref → no callback', () => {
    const cb = jest.fn();
    forEachChild({ type: 'program-context-ref', role: 'primary-major' }, cb);
    expect(cb).not.toHaveBeenCalled();
  });

  // --- Composite nodes ---

  test('all-of → visits items', () => {
    const children = [];
    const items = [
      { type: 'course', subject: 'MATH', number: '101' },
      { type: 'course', subject: 'CMPS', number: '130' },
    ];
    forEachChild({ type: 'all-of', items }, (child, key) => children.push({ child, key }));
    expect(children).toHaveLength(2);
    expect(children[0].key).toBe('items');
    expect(children[0].child).toBe(items[0]);
    expect(children[1].child).toBe(items[1]);
  });

  test('any-of → visits items', () => {
    const children = [];
    forEachChild({
      type: 'any-of',
      items: [{ type: 'course', subject: 'ART', number: '101' }],
    }, (child, key) => children.push(key));
    expect(children).toEqual(['items']);
  });

  test('n-of → visits items', () => {
    const children = [];
    forEachChild({
      type: 'n-of', comparison: 'at-least', count: 2,
      items: [
        { type: 'course', subject: 'A', number: '1' },
        { type: 'course', subject: 'B', number: '2' },
        { type: 'course', subject: 'C', number: '3' },
      ],
    }, (child) => children.push(child));
    expect(children).toHaveLength(3);
  });

  test('none-of → visits items', () => {
    const children = [];
    forEachChild({
      type: 'none-of',
      items: [{ type: 'course', subject: 'X', number: '1' }],
    }, (child) => children.push(child));
    expect(children).toHaveLength(1);
  });

  test('one-from-each → visits items', () => {
    const children = [];
    forEachChild({
      type: 'one-from-each',
      items: [
        { type: 'course-filter', filters: [] },
        { type: 'course-filter', filters: [] },
      ],
    }, (child) => children.push(child));
    expect(children).toHaveLength(2);
  });

  test('from-n-groups → visits items', () => {
    const children = [];
    forEachChild({
      type: 'from-n-groups', count: 2,
      items: [{ type: 'all-of', items: [] }],
    }, (child) => children.push(child));
    expect(children).toHaveLength(1);
  });

  // --- credits-from ---

  test('credits-from → visits source', () => {
    const source = { type: 'course-filter', filters: [] };
    const children = [];
    forEachChild({
      type: 'credits-from', credits: 9, comparison: 'at-least', source,
    }, (child, key) => children.push({ child, key }));
    expect(children).toHaveLength(1);
    expect(children[0].key).toBe('source');
    expect(children[0].child).toBe(source);
  });

  // --- Wrapper nodes ---

  test('with-constraint → visits requirement', () => {
    const requirement = { type: 'course', subject: 'MATH', number: '101' };
    const children = [];
    forEachChild({
      type: 'with-constraint',
      constraint: { kind: 'min-grade', value: 'C' },
      requirement,
    }, (child, key) => children.push({ child, key }));
    expect(children).toHaveLength(1);
    expect(children[0].key).toBe('requirement');
  });

  test('except → visits source and exclude', () => {
    const source = { type: 'course-filter', filters: [] };
    const exclude = [
      { type: 'course', subject: 'X', number: '1' },
      { type: 'course', subject: 'Y', number: '2' },
    ];
    const children = [];
    forEachChild({ type: 'except', source, exclude }, (child, key) => children.push(key));
    expect(children).toEqual(['source', 'exclude', 'exclude']);
  });

  test('variable-def → visits value', () => {
    const value = { type: 'all-of', items: [] };
    const children = [];
    forEachChild({ type: 'variable-def', name: 'core', value }, (child, key) => children.push(key));
    expect(children).toEqual(['value']);
  });

  test('scope → visits body and defs', () => {
    const body = { type: 'all-of', items: [] };
    const defs = [{ type: 'variable-def', name: 'x', value: { type: 'course', subject: 'A', number: '1' } }];
    const children = [];
    forEachChild({ type: 'scope', name: 'test', body, defs }, (child, key) => children.push(key));
    expect(children).toEqual(['body', 'defs']);
  });

  // --- Policy nodes ---

  test('overlap-limit → visits left and right', () => {
    const left = { type: 'program-context-ref', role: 'primary-major' };
    const right = { type: 'program-context-ref', role: 'primary-minor' };
    const children = [];
    forEachChild({
      type: 'overlap-limit', left, right,
      constraint: { comparison: 'at-most', value: 3, unit: 'courses' },
    }, (child, key) => children.push(key));
    expect(children).toEqual(['left', 'right']);
  });

  test('outside-program → visits program', () => {
    const program = { type: 'program-context-ref', role: 'primary-major' };
    const children = [];
    forEachChild({
      type: 'outside-program', program,
      constraint: { comparison: 'at-least', value: 30, unit: 'credits' },
    }, (child, key) => children.push(key));
    expect(children).toEqual(['program']);
  });

  // --- Audit result nodes ---

  test('variable-ref with resolved → visits resolved', () => {
    const resolved = { type: 'all-of', status: 'met', items: [] };
    const children = [];
    forEachChild({
      type: 'variable-ref', name: 'core', status: 'met', resolved,
    }, (child, key) => children.push(key));
    expect(children).toEqual(['resolved']);
  });

  // --- Edge cases ---

  test('null node → no crash, no callback', () => {
    const cb = jest.fn();
    forEachChild(null, cb);
    expect(cb).not.toHaveBeenCalled();
  });

  test('undefined node → no crash, no callback', () => {
    const cb = jest.fn();
    forEachChild(undefined, cb);
    expect(cb).not.toHaveBeenCalled();
  });

  test('unknown type → no crash, no callback', () => {
    const cb = jest.fn();
    forEachChild({ type: 'made-up-type', items: [{ type: 'course', subject: 'A', number: '1' }] }, cb);
    expect(cb).not.toHaveBeenCalled();
  });

  test('missing child property → skips gracefully', () => {
    const children = [];
    // scope with no body or defs
    forEachChild({ type: 'scope', name: 'empty' }, (child) => children.push(child));
    expect(children).toHaveLength(0);
  });

  test('empty items array → no callbacks', () => {
    const cb = jest.fn();
    forEachChild({ type: 'all-of', items: [] }, cb);
    expect(cb).not.toHaveBeenCalled();
  });
});

// ============================================================
// Exhaustiveness guard — every NODE_TYPE must have CHILD_PROPS entry
// ============================================================

describe('CHILD_PROPS exhaustiveness', () => {
  test('every NODE_TYPE has an entry in CHILD_PROPS', () => {
    const missing = NODE_TYPES.filter(t => !CHILD_PROPS.has(t));
    expect(missing).toEqual([]);
  });

  test('no extra entries in CHILD_PROPS beyond NODE_TYPES', () => {
    const nodeTypeSet = new Set(NODE_TYPES);
    const extra = [];
    for (const key of CHILD_PROPS.keys()) {
      if (!nodeTypeSet.has(key)) extra.push(key);
    }
    expect(extra).toEqual([]);
  });
});
