'use strict';

const { collectMatchedEntries } = require('../../src/audit/single-tree');

// ============================================================
// collectMatchedEntries — direct unit tests
// ============================================================

describe('collectMatchedEntries', () => {
  test('nested composite with mixed entry sources', () => {
    const result = {
      type: 'all-of',
      items: [
        {
          type: 'course', subject: 'MATH', number: '101',
          satisfiedBy: { subject: 'MATH', number: '101', grade: 'A', credits: 3, status: 'completed' },
        },
        {
          type: 'course-filter',
          matchedCourses: [
            { subject: 'CMPS', number: '130', grade: 'B+', credits: 3, status: 'completed' },
          ],
          inProgressCourses: [
            { subject: 'CMPS', number: '230', grade: null, credits: 3, status: 'in-progress' },
          ],
        },
      ],
    };
    const entries = collectMatchedEntries(result);
    expect(entries).toHaveLength(3);
    const subjects = entries.map(e => `${e.subject}:${e.number}`).sort();
    expect(subjects).toEqual(['CMPS:130', 'CMPS:230', 'MATH:101']);
  });

  test('deduplication: same course in two subtrees', () => {
    const result = {
      type: 'any-of',
      items: [
        {
          type: 'course', subject: 'MATH', number: '101',
          satisfiedBy: { subject: 'MATH', number: '101', grade: 'A', credits: 3, status: 'completed' },
        },
        {
          type: 'all-of',
          items: [
            {
              type: 'course', subject: 'MATH', number: '101',
              satisfiedBy: { subject: 'MATH', number: '101', grade: 'A', credits: 3, status: 'completed' },
            },
            {
              type: 'course', subject: 'CMPS', number: '130',
              satisfiedBy: { subject: 'CMPS', number: '130', grade: 'B', credits: 3, status: 'completed' },
            },
          ],
        },
      ],
    };
    const entries = collectMatchedEntries(result);
    // MATH 101 appears in both subtrees but should only be collected once
    expect(entries).toHaveLength(2);
    const keys = entries.map(e => `${e.subject}:${e.number}`).sort();
    expect(keys).toEqual(['CMPS:130', 'MATH:101']);
  });

  test('variable-ref resolved results', () => {
    const result = {
      type: 'variable-ref', name: 'math_core',
      resolved: {
        type: 'all-of',
        items: [
          {
            type: 'course', subject: 'MATH', number: '101',
            satisfiedBy: { subject: 'MATH', number: '101', grade: 'A', credits: 3, status: 'completed' },
          },
          {
            type: 'course', subject: 'MATH', number: '151',
            satisfiedBy: { subject: 'MATH', number: '151', grade: 'B', credits: 4, status: 'completed' },
          },
        ],
      },
    };
    const entries = collectMatchedEntries(result);
    expect(entries).toHaveLength(2);
  });

  test('empty/null node input', () => {
    expect(collectMatchedEntries(null)).toEqual([]);
    expect(collectMatchedEntries(undefined)).toEqual([]);
    expect(collectMatchedEntries({})).toEqual([]);
  });

  test('node with no matched entries returns empty array', () => {
    const result = {
      type: 'course', subject: 'ART', number: '301',
      status: 'not-met',
    };
    const entries = collectMatchedEntries(result);
    expect(entries).toHaveLength(0);
  });

  test('credits-from source traversal', () => {
    const result = {
      type: 'credits-from',
      source: {
        type: 'course-filter',
        matchedCourses: [
          { subject: 'PHYS', number: '201', grade: 'B', credits: 4, status: 'completed' },
          { subject: 'CHEM', number: '101', grade: 'C+', credits: 4, status: 'completed' },
        ],
        inProgressCourses: [],
      },
      matchedCourses: [
        { subject: 'PHYS', number: '201', grade: 'B', credits: 4, status: 'completed' },
        { subject: 'CHEM', number: '101', grade: 'C+', credits: 4, status: 'completed' },
      ],
    };
    const entries = collectMatchedEntries(result);
    // Deduped across source and top-level matchedCourses
    expect(entries).toHaveLength(2);
  });

  test('except node with exclude children', () => {
    const result = {
      type: 'except',
      source: {
        type: 'course-filter',
        matchedCourses: [
          { subject: 'CMPS', number: '310', grade: 'A-', credits: 3, status: 'completed' },
          { subject: 'CMPS', number: '320', grade: 'B+', credits: 3, status: 'completed' },
        ],
        inProgressCourses: [],
      },
      exclude: [
        {
          type: 'course', subject: 'CMPS', number: '491',
          satisfiedBy: { subject: 'CMPS', number: '491', grade: 'A', credits: 3, status: 'completed' },
        },
      ],
      matchedCourses: [
        { subject: 'CMPS', number: '310', grade: 'A-', credits: 3, status: 'completed' },
        { subject: 'CMPS', number: '320', grade: 'B+', credits: 3, status: 'completed' },
      ],
    };
    const entries = collectMatchedEntries(result);
    // Source has 310, 320; exclude has 491; top-level matchedCourses has 310, 320
    // All 3 unique courses should be collected
    expect(entries).toHaveLength(3);
  });
});
