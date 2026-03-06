'use strict';

const { walk, transform } = require('../../src/ast/walk');

// ============================================================
// walk — depth-first pre-order traversal
// ============================================================

describe('walk', () => {
  test('visits all nodes in pre-order', () => {
    const ast = {
      type: 'all-of',
      items: [
        { type: 'course', subject: 'MATH', number: '101' },
        { type: 'course', subject: 'CMPS', number: '130' },
      ],
    };
    const visited = [];
    walk(ast, (node) => visited.push(node.type));
    expect(visited).toEqual(['all-of', 'course', 'course']);
  });

  test('provides correct path', () => {
    const ast = {
      type: 'all-of',
      items: [
        { type: 'credits-from', credits: 9, comparison: 'at-least',
          source: { type: 'course', subject: 'MATH', number: '101' } },
      ],
    };
    const paths = [];
    walk(ast, (node, path) => paths.push([node.type, [...path]]));
    expect(paths).toEqual([
      ['all-of', []],
      ['credits-from', ['items', 0]],
      ['course', ['items', 0, 'source']],
    ]);
  });

  test('provides correct parent', () => {
    const inner = { type: 'course', subject: 'A', number: '1' };
    const ast = { type: 'with-constraint', constraint: { kind: 'min-grade', value: 'C' }, requirement: inner };
    const parents = [];
    walk(ast, (node, path, parent) => parents.push(parent));
    expect(parents[0]).toBeNull();        // root has no parent
    expect(parents[1]).toBe(ast);         // inner's parent is the root
  });

  test('handles deeply nested trees', () => {
    const ast = {
      type: 'all-of',
      items: [{
        type: 'any-of',
        items: [{
          type: 'n-of', comparison: 'at-least', count: 1,
          items: [{
            type: 'with-constraint',
            constraint: { kind: 'min-grade', value: 'B' },
            requirement: { type: 'course', subject: 'X', number: '1' },
          }],
        }],
      }],
    };
    const types = [];
    walk(ast, (node) => types.push(node.type));
    expect(types).toEqual(['all-of', 'any-of', 'n-of', 'with-constraint', 'course']);
  });

  test('visits scope body and defs', () => {
    const ast = {
      type: 'scope', name: 'test',
      body: { type: 'variable-ref', name: 'x' },
      defs: [{ type: 'variable-def', name: 'x', value: { type: 'course', subject: 'A', number: '1' } }],
    };
    const types = [];
    walk(ast, (node) => types.push(node.type));
    expect(types).toEqual(['scope', 'variable-ref', 'variable-def', 'course']);
  });

  test('visits except source and exclude', () => {
    const ast = {
      type: 'except',
      source: { type: 'course-filter', filters: [] },
      exclude: [{ type: 'course', subject: 'X', number: '1' }],
    };
    const types = [];
    walk(ast, (node) => types.push(node.type));
    expect(types).toEqual(['except', 'course-filter', 'course']);
  });

  test('visits overlap-limit left and right', () => {
    const ast = {
      type: 'overlap-limit',
      left: { type: 'program-context-ref', role: 'primary-major' },
      right: { type: 'program-context-ref', role: 'primary-minor' },
      constraint: { comparison: 'at-most', value: 3, unit: 'courses' },
    };
    const types = [];
    walk(ast, (node) => types.push(node.type));
    expect(types).toEqual(['overlap-limit', 'program-context-ref', 'program-context-ref']);
  });

  test('visits audit result resolved child', () => {
    const ast = {
      type: 'variable-ref', name: 'core', status: 'met',
      resolved: { type: 'all-of', status: 'met', items: [] },
    };
    const types = [];
    walk(ast, (node) => types.push(node.type));
    expect(types).toEqual(['variable-ref', 'all-of']);
  });
});

// ============================================================
// transform — immutable post-order transformation
// ============================================================

describe('transform', () => {
  test('identity function returns structurally equal AST', () => {
    const ast = {
      type: 'all-of',
      items: [
        { type: 'course', subject: 'MATH', number: '101' },
        { type: 'course', subject: 'CMPS', number: '130' },
      ],
    };
    const result = transform(ast, node => node);
    expect(result).toBe(ast); // same reference — no changes
  });

  test('replaces leaf nodes', () => {
    const ast = {
      type: 'all-of',
      items: [
        { type: 'course', subject: 'CMPS', number: '130' },
        { type: 'course', subject: 'CMPS', number: '230' },
      ],
    };
    const result = transform(ast, node => {
      if (node.type === 'course' && node.subject === 'CMPS') {
        return { ...node, subject: 'CS' };
      }
      return node;
    });
    expect(result.items[0].subject).toBe('CS');
    expect(result.items[1].subject).toBe('CS');
  });

  test('does not mutate original AST', () => {
    const original = {
      type: 'all-of',
      items: [
        { type: 'course', subject: 'MATH', number: '101' },
      ],
    };
    const originalJSON = JSON.stringify(original);
    transform(original, node => {
      if (node.type === 'course') return { ...node, subject: 'CHANGED' };
      return node;
    });
    expect(JSON.stringify(original)).toBe(originalJSON);
  });

  test('replaces composite nodes', () => {
    const ast = {
      type: 'all-of',
      items: [
        { type: 'any-of', items: [{ type: 'course', subject: 'A', number: '1' }] },
      ],
    };
    const result = transform(ast, node => {
      if (node.type === 'any-of') return { ...node, label: 'Electives' };
      return node;
    });
    expect(result.items[0].label).toBe('Electives');
  });

  test('post-order: children transformed before parent', () => {
    const order = [];
    const ast = {
      type: 'all-of',
      items: [{ type: 'course', subject: 'A', number: '1' }],
    };
    transform(ast, node => {
      order.push(node.type);
      return node;
    });
    expect(order).toEqual(['course', 'all-of']);
  });

  test('handles empty items arrays', () => {
    const ast = { type: 'all-of', items: [] };
    const result = transform(ast, node => node);
    expect(result).toBe(ast);
    expect(result.items).toEqual([]);
  });

  test('handles credits-from with source', () => {
    const ast = {
      type: 'credits-from', credits: 9, comparison: 'at-least',
      source: { type: 'course', subject: 'MATH', number: '101' },
    };
    const result = transform(ast, node => {
      if (node.type === 'course') return { ...node, number: '999' };
      return node;
    });
    expect(result.source.number).toBe('999');
    expect(ast.source.number).toBe('101'); // original unchanged
  });

  test('handles except with source and exclude', () => {
    const ast = {
      type: 'except',
      source: { type: 'course-filter', filters: [] },
      exclude: [{ type: 'course', subject: 'X', number: '1' }],
    };
    const result = transform(ast, node => {
      if (node.type === 'course') return { ...node, subject: 'REMOVED' };
      return node;
    });
    expect(result.exclude[0].subject).toBe('REMOVED');
  });

  test('unknown node type → still applies transformFn', () => {
    const ast = { type: 'frobnicate', x: 42 };
    const result = transform(ast, node => {
      if (node.type === 'frobnicate') return { ...node, x: 99 };
      return node;
    });
    expect(result.x).toBe(99);
  });

  test('transform handles resolved property on audit result nodes', () => {
    const ast = {
      type: 'variable-ref', name: 'core', status: 'met',
      resolved: {
        type: 'all-of', status: 'met',
        items: [{ type: 'course', subject: 'A', number: '1' }],
      },
    };
    const result = transform(ast, node => {
      if (node.type === 'course') return { ...node, subject: 'CHANGED' };
      return node;
    });
    expect(result.resolved.items[0].subject).toBe('CHANGED');
    expect(ast.resolved.items[0].subject).toBe('A'); // original unchanged
  });

  test('handles nested wrapper chain', () => {
    const ast = {
      type: 'with-constraint',
      constraint: { kind: 'min-grade', value: 'C' },
      requirement: {
        type: 'all-of',
        items: [
          { type: 'course', subject: 'MATH', number: '101' },
          { type: 'course', subject: 'MATH', number: '151' },
        ],
      },
    };
    const result = transform(ast, node => {
      if (node.type === 'course' && node.number === '151') {
        return { ...node, number: '152' };
      }
      return node;
    });
    expect(result.requirement.items[0].number).toBe('101');
    expect(result.requirement.items[1].number).toBe('152');
  });
});
