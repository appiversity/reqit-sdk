'use strict';

const { audit, findUnmet, MET, IN_PROGRESS, PARTIAL_PROGRESS, NOT_MET } = require('../../src/audit');
const minimalCatalog = require('../fixtures/catalogs/minimal.json');

const complete = require('../fixtures/transcripts/minimal/complete.json');
const empty = require('../fixtures/transcripts/minimal/empty.json');
const partial = require('../fixtures/transcripts/minimal/partial.json');
const inProgress = require('../fixtures/transcripts/minimal/in-progress.json');

// ============================================================
// findUnmet
// ============================================================

describe('findUnmet', () => {
  test('all met → empty array', () => {
    const ast = {
      type: 'all-of',
      items: [
        { type: 'course', subject: 'MATH', number: '101' },
        { type: 'course', subject: 'CMPS', number: '130' },
      ],
    };
    const { result } = audit(ast, minimalCatalog, complete);
    const unmet = findUnmet(result);
    expect(unmet).toHaveLength(0);
  });

  test('all not-met → returns all leaf nodes', () => {
    const ast = {
      type: 'all-of',
      items: [
        { type: 'course', subject: 'MATH', number: '101' },
        { type: 'course', subject: 'CMPS', number: '130' },
      ],
    };
    const { result } = audit(ast, minimalCatalog, empty);
    const unmet = findUnmet(result);
    expect(unmet).toHaveLength(2);
    expect(unmet[0].status).toBe(NOT_MET);
    expect(unmet[1].status).toBe(NOT_MET);
  });

  test('mixed statuses → returns only unmet leaves', () => {
    const ast = {
      type: 'all-of',
      items: [
        { type: 'course', subject: 'MATH', number: '101' },   // met in partial
        { type: 'course', subject: 'ART', number: '301' },    // NOT in partial
        { type: 'course', subject: 'ART', number: '401' },    // NOT in partial
      ],
    };
    const { result } = audit(ast, minimalCatalog, partial);
    const unmet = findUnmet(result);
    expect(unmet).toHaveLength(2);
    expect(unmet[0].node.subject).toBe('ART');
    expect(unmet[0].node.number).toBe('301');
    expect(unmet[1].node.subject).toBe('ART');
    expect(unmet[1].node.number).toBe('401');
  });

  test('in-progress items included', () => {
    const ast = {
      type: 'all-of',
      items: [
        { type: 'course', subject: 'MATH', number: '101' },   // completed
        { type: 'course', subject: 'MATH', number: '152' },   // in-progress
      ],
    };
    const { result } = audit(ast, minimalCatalog, inProgress);
    const unmet = findUnmet(result);
    expect(unmet).toHaveLength(1);
    expect(unmet[0].status).toBe(IN_PROGRESS);
    expect(unmet[0].node.subject).toBe('MATH');
    expect(unmet[0].node.number).toBe('152');
  });

  test('path tracks location in the tree', () => {
    const ast = {
      type: 'all-of',
      items: [
        { type: 'course', subject: 'MATH', number: '101' },
        { type: 'all-of', items: [
          { type: 'course', subject: 'CMPS', number: '130' },
          { type: 'course', subject: 'ART', number: '301' },
        ] },
      ],
    };
    const { result } = audit(ast, minimalCatalog, partial);
    const unmet = findUnmet(result);
    // ART 301 is unmet, at items[1].items[1]
    expect(unmet).toHaveLength(1);
    expect(unmet[0].path).toEqual(['items[1]', 'items[1]']);
  });

  test('score nodes included in unmet', () => {
    const ast = {
      type: 'all-of',
      items: [
        { type: 'course', subject: 'MATH', number: '101' },
        { type: 'score', name: 'SAT', op: 'gte', value: 1200 },
      ],
    };
    const { result } = audit(ast, minimalCatalog, complete);
    const unmet = findUnmet(result);
    expect(unmet).toHaveLength(1);
    expect(unmet[0].node.type).toBe('score');
    expect(unmet[0].node.name).toBe('SAT');
  });

  test('credits-from source unmet leaves collected', () => {
    const ast = {
      type: 'credits-from', comparison: 'at-least', credits: 12,
      source: {
        type: 'all-of',
        items: [
          { type: 'course', subject: 'MATH', number: '101' },
          { type: 'course', subject: 'ART', number: '301' },
        ],
      },
    };
    const { result } = audit(ast, minimalCatalog, partial);
    const unmet = findUnmet(result);
    // ART 301 is unmet inside the source
    const artUnmet = unmet.filter(u => u.node.subject === 'ART');
    expect(artUnmet.length).toBeGreaterThan(0);
  });

  test('empty result (single met course)', () => {
    const ast = { type: 'course', subject: 'MATH', number: '101' };
    const { result } = audit(ast, minimalCatalog, complete);
    const unmet = findUnmet(result);
    expect(unmet).toHaveLength(0);
  });

  test('single not-met course', () => {
    const ast = { type: 'course', subject: 'ART', number: '301' };
    const { result } = audit(ast, minimalCatalog, empty);
    const unmet = findUnmet(result);
    expect(unmet).toHaveLength(1);
    expect(unmet[0].path).toEqual([]);
  });

  test('unmet except node recurses into children, not collected as leaf', () => {
    // except node with not-met source and exclude children
    // findUnmet should recurse into the except's children, not treat
    // the except node itself as a leaf
    const ast = {
      type: 'except',
      source: {
        type: 'any-of',
        items: [
          { type: 'course', subject: 'ART', number: '301' },
          { type: 'course', subject: 'ART', number: '401' },
        ],
      },
      exclude: [
        { type: 'course', subject: 'ART', number: '301' },
      ],
    };
    const { result } = audit(ast, minimalCatalog, empty);
    const unmet = findUnmet(result);
    // Should find the individual unmet courses inside source, not the except node itself
    const exceptNodes = unmet.filter(u => u.node.type === 'except');
    expect(exceptNodes).toHaveLength(0);
    // Should find the leaf courses
    const courseNodes = unmet.filter(u => u.node.type === 'course');
    expect(courseNodes.length).toBeGreaterThan(0);
  });
});
