'use strict';

const { diff } = require('../../src/ast/diff');

// ============================================================
// diff — structural AST comparison
// ============================================================

describe('diff', () => {
  test('identical ASTs → empty diff', () => {
    const ast = {
      type: 'all-of',
      items: [
        { type: 'course', subject: 'MATH', number: '101' },
        { type: 'course', subject: 'CMPS', number: '130' },
      ],
    };
    const changes = diff(ast, ast);
    expect(changes).toHaveLength(0);
  });

  test('identical deep-cloned ASTs → empty diff', () => {
    const ast = {
      type: 'all-of',
      items: [
        { type: 'course', subject: 'MATH', number: '101' },
        { type: 'course', subject: 'CMPS', number: '130' },
      ],
    };
    const changes = diff(ast, JSON.parse(JSON.stringify(ast)));
    expect(changes).toHaveLength(0);
  });

  test('added course → one added entry', () => {
    const oldAst = {
      type: 'all-of',
      items: [
        { type: 'course', subject: 'MATH', number: '101' },
      ],
    };
    const newAst = {
      type: 'all-of',
      items: [
        { type: 'course', subject: 'MATH', number: '101' },
        { type: 'course', subject: 'CMPS', number: '130' },
      ],
    };
    const changes = diff(oldAst, newAst);
    const added = changes.filter(c => c.type === 'added');
    expect(added).toHaveLength(1);
    expect(added[0].node.subject).toBe('CMPS');
  });

  test('removed course → one removed entry', () => {
    const oldAst = {
      type: 'all-of',
      items: [
        { type: 'course', subject: 'MATH', number: '101' },
        { type: 'course', subject: 'CMPS', number: '130' },
      ],
    };
    const newAst = {
      type: 'all-of',
      items: [
        { type: 'course', subject: 'MATH', number: '101' },
      ],
    };
    const changes = diff(oldAst, newAst);
    const removed = changes.filter(c => c.type === 'removed');
    expect(removed).toHaveLength(1);
    expect(removed[0].node.subject).toBe('CMPS');
  });

  test('changed field (n-of count 3→4) → one changed entry', () => {
    const oldAst = {
      type: 'n-of', comparison: 'at-least', count: 3,
      items: [
        { type: 'course', subject: 'A', number: '1' },
        { type: 'course', subject: 'B', number: '2' },
        { type: 'course', subject: 'C', number: '3' },
        { type: 'course', subject: 'D', number: '4' },
      ],
    };
    const newAst = { ...oldAst, count: 4 };
    const changes = diff(oldAst, newAst);
    const changed = changes.filter(c => c.type === 'changed');
    expect(changed).toHaveLength(1);
    expect(changed[0].field).toBe('count');
    expect(changed[0].oldValue).toBe(3);
    expect(changed[0].newValue).toBe(4);
  });

  test('reordered items → moved entries', () => {
    const oldAst = {
      type: 'all-of',
      items: [
        { type: 'course', subject: 'MATH', number: '101' },
        { type: 'course', subject: 'CMPS', number: '130' },
        { type: 'course', subject: 'ENGL', number: '101' },
      ],
    };
    const newAst = {
      type: 'all-of',
      items: [
        { type: 'course', subject: 'ENGL', number: '101' },
        { type: 'course', subject: 'MATH', number: '101' },
        { type: 'course', subject: 'CMPS', number: '130' },
      ],
    };
    const changes = diff(oldAst, newAst);
    const moved = changes.filter(c => c.type === 'moved');
    expect(moved.length).toBeGreaterThan(0);
  });

  test('nested changes (change inside credits-from) → correct path', () => {
    const oldAst = {
      type: 'credits-from', credits: 9, comparison: 'at-least',
      source: {
        type: 'all-of',
        items: [{ type: 'course', subject: 'MATH', number: '101' }],
      },
    };
    const newAst = {
      type: 'credits-from', credits: 12, comparison: 'at-least',
      source: {
        type: 'all-of',
        items: [{ type: 'course', subject: 'MATH', number: '101' }],
      },
    };
    const changes = diff(oldAst, newAst);
    expect(changes).toHaveLength(1);
    expect(changes[0].field).toBe('credits');
    expect(changes[0].oldValue).toBe(9);
    expect(changes[0].newValue).toBe(12);
  });

  test('different root types → changed at root', () => {
    const oldAst = { type: 'all-of', items: [] };
    const newAst = { type: 'any-of', items: [] };
    const changes = diff(oldAst, newAst);
    expect(changes).toHaveLength(1);
    expect(changes[0].type).toBe('changed');
    expect(changes[0].field).toBe('type');
    expect(changes[0].path).toEqual([]);
  });

  test('complex realistic diff (add course, remove course, change count)', () => {
    const oldAst = {
      type: 'n-of', comparison: 'at-least', count: 2,
      items: [
        { type: 'course', subject: 'MATH', number: '101' },
        { type: 'course', subject: 'CMPS', number: '130' },
        { type: 'course', subject: 'ENGL', number: '101' },
      ],
    };
    const newAst = {
      type: 'n-of', comparison: 'at-least', count: 3,
      items: [
        { type: 'course', subject: 'MATH', number: '101' },
        { type: 'course', subject: 'ENGL', number: '101' },
        { type: 'course', subject: 'HIST', number: '101' },
      ],
    };
    const changes = diff(oldAst, newAst);
    // count changed 2→3
    const countChanged = changes.filter(c => c.type === 'changed' && c.field === 'count');
    expect(countChanged).toHaveLength(1);
    // CMPS 130 removed
    const removed = changes.filter(c => c.type === 'removed');
    expect(removed).toHaveLength(1);
    expect(removed[0].node.subject).toBe('CMPS');
    // HIST 101 added
    const added = changes.filter(c => c.type === 'added');
    expect(added).toHaveLength(1);
    expect(added[0].node.subject).toBe('HIST');
  });

  test('null old node → added', () => {
    const changes = diff(null, { type: 'course', subject: 'A', number: '1' });
    expect(changes).toHaveLength(1);
    expect(changes[0].type).toBe('added');
  });

  test('null new node → removed', () => {
    const changes = diff({ type: 'course', subject: 'A', number: '1' }, null);
    expect(changes).toHaveLength(1);
    expect(changes[0].type).toBe('removed');
  });

  test('both null → no changes', () => {
    const changes = diff(null, null);
    expect(changes).toHaveLength(0);
  });

  test('wrapper child added where none existed', () => {
    const oldAst = { type: 'credits-from', credits: 9, comparison: 'at-least' };
    const newAst = {
      type: 'credits-from', credits: 9, comparison: 'at-least',
      source: { type: 'course', subject: 'A', number: '1' },
    };
    const changes = diff(oldAst, newAst);
    const added = changes.filter(c => c.type === 'added');
    expect(added).toHaveLength(1);
  });

  test('wrapper child removed', () => {
    const oldAst = {
      type: 'credits-from', credits: 9, comparison: 'at-least',
      source: { type: 'course', subject: 'A', number: '1' },
    };
    const newAst = { type: 'credits-from', credits: 9, comparison: 'at-least' };
    const changes = diff(oldAst, newAst);
    const removed = changes.filter(c => c.type === 'removed');
    expect(removed).toHaveLength(1);
  });

  test('non-identifiable nodes matched by JSON equality', () => {
    // Score nodes have no identity key — falls through to JSON.stringify comparison
    const oldAst = {
      type: 'all-of',
      items: [
        { type: 'score', name: 'SAT', op: 'gte', value: 600 },
        { type: 'score', name: 'ACT', op: 'gte', value: 25 },
      ],
    };
    const newAst = {
      type: 'all-of',
      items: [
        { type: 'score', name: 'SAT', op: 'gte', value: 600 },
        { type: 'score', name: 'ACT', op: 'gte', value: 25 },
      ],
    };
    const changes = diff(oldAst, newAst);
    expect(changes).toHaveLength(0);
  });

  test('non-identifiable node changed → detected as remove + add', () => {
    const oldAst = {
      type: 'all-of',
      items: [
        { type: 'score', name: 'SAT', op: 'gte', value: 600 },
      ],
    };
    const newAst = {
      type: 'all-of',
      items: [
        { type: 'score', name: 'SAT', op: 'gte', value: 700 },
      ],
    };
    const changes = diff(oldAst, newAst);
    // Non-identifiable nodes with different values → LCS sees them as different → remove + add
    expect(changes.length).toBeGreaterThan(0);
    const removed = changes.filter(c => c.type === 'removed');
    const added = changes.filter(c => c.type === 'added');
    expect(removed).toHaveLength(1);
    expect(added).toHaveLength(1);
  });

  test('labeled composite move detection', () => {
    const oldAst = {
      type: 'all-of',
      items: [
        { type: 'all-of', label: 'Core', items: [{ type: 'course', subject: 'A', number: '1' }] },
        { type: 'all-of', label: 'Electives', items: [{ type: 'course', subject: 'B', number: '2' }] },
      ],
    };
    const newAst = {
      type: 'all-of',
      items: [
        { type: 'all-of', label: 'Electives', items: [{ type: 'course', subject: 'B', number: '2' }] },
        { type: 'all-of', label: 'Core', items: [{ type: 'course', subject: 'A', number: '1' }] },
      ],
    };
    const changes = diff(oldAst, newAst);
    const moved = changes.filter(c => c.type === 'moved');
    expect(moved.length).toBeGreaterThan(0);
  });
});
