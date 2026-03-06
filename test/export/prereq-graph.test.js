'use strict';

const { buildPrereqGraph } = require('../../src/export/prereq-graph');

describe('buildPrereqGraph', () => {
  test('linear chain A→B→C', () => {
    const catalog = {
      courses: [
        { subject: 'M', number: '1' },
        { subject: 'M', number: '2', prerequisites: { type: 'course', subject: 'M', number: '1' } },
        { subject: 'M', number: '3', prerequisites: { type: 'course', subject: 'M', number: '2' } },
      ],
    };
    const graph = buildPrereqGraph(catalog);
    expect(graph.get('M:2').direct).toEqual(new Set(['M:1']));
    expect(graph.get('M:3').direct).toEqual(new Set(['M:2']));
    expect(graph.get('M:3').transitive).toEqual(new Set(['M:1']));
    expect(graph.get('M:1').direct.size).toBe(0);
  });

  test('diamond dependency D requires B and C, both require A', () => {
    const catalog = {
      courses: [
        { subject: 'X', number: '1' },
        { subject: 'X', number: '2', prerequisites: { type: 'course', subject: 'X', number: '1' } },
        { subject: 'X', number: '3', prerequisites: { type: 'course', subject: 'X', number: '1' } },
        { subject: 'X', number: '4', prerequisites: {
          type: 'all-of', items: [
            { type: 'course', subject: 'X', number: '2' },
            { type: 'course', subject: 'X', number: '3' },
          ],
        } },
      ],
    };
    const graph = buildPrereqGraph(catalog);
    expect(graph.get('X:4').direct).toEqual(new Set(['X:2', 'X:3']));
    expect(graph.get('X:4').transitive).toEqual(new Set(['X:1']));
  });

  test('cycle handling — BFS terminates', () => {
    // A→B→A (circular)
    const catalog = {
      courses: [
        { subject: 'C', number: '1', prerequisites: { type: 'course', subject: 'C', number: '2' } },
        { subject: 'C', number: '2', prerequisites: { type: 'course', subject: 'C', number: '1' } },
      ],
    };
    const graph = buildPrereqGraph(catalog);
    // Both should complete without infinite loop
    expect(graph.get('C:1').direct).toEqual(new Set(['C:2']));
    expect(graph.get('C:2').direct).toEqual(new Set(['C:1']));
  });

  test('missing course reference — silently skipped in transitive', () => {
    const catalog = {
      courses: [
        { subject: 'A', number: '1', prerequisites: { type: 'course', subject: 'Z', number: '9' } },
      ],
    };
    const graph = buildPrereqGraph(catalog);
    // Direct edge recorded even though Z:9 isn't in catalog
    expect(graph.get('A:1').direct).toEqual(new Set(['Z:9']));
    // No transitive because Z:9 isn't in graph
    expect(graph.get('A:1').transitive.size).toBe(0);
  });

  test('courses with no prerequisites have empty sets', () => {
    const catalog = {
      courses: [
        { subject: 'A', number: '1' },
        { subject: 'A', number: '2' },
      ],
    };
    const graph = buildPrereqGraph(catalog);
    expect(graph.get('A:1').direct.size).toBe(0);
    expect(graph.get('A:1').transitive.size).toBe(0);
  });
});
