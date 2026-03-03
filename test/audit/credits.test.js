'use strict';

const { audit, MET, IN_PROGRESS, PARTIAL_PROGRESS, NOT_MET } = require('../../src/audit');
const minimalCatalog = require('../fixtures/catalogs/minimal.json');

const complete = require('../fixtures/transcripts/minimal/complete.json');
const empty = require('../fixtures/transcripts/minimal/empty.json');
const partial = require('../fixtures/transcripts/minimal/partial.json');
const inProgress = require('../fixtures/transcripts/minimal/in-progress.json');

// ============================================================
// credits-from (at-least)
// ============================================================

describe('credits-from at-least', () => {
  test('earned ≥ required → met', () => {
    // CMPS courses in complete: 130(3), 135(3), 230(3), 310(3), 320(3),
    // 350(3), 360(3), 380(3), 491(3), 492(3) = 30 credits
    const ast = {
      type: 'credits-from', comparison: 'at-least', credits: 24,
      source: {
        type: 'course-filter',
        filters: [{ field: 'subject', op: 'eq', value: 'CMPS' }],
      },
    };
    const { status, result } = audit(ast, minimalCatalog, complete);
    expect(status).toBe(MET);
    expect(result.creditsEarned).toBeGreaterThanOrEqual(24);
    expect(result.creditsInProgress).toBe(0);
  });

  test('earned + ip ≥ required → in-progress', () => {
    // In-progress transcript: CMPS completed: 130(3), 135(3), 230(3) = 9
    // CMPS in-progress: 310(3), 320(3) = 6
    // Total: 15, need 12 — so earned(9) + ip(6) ≥ 12
    const ast = {
      type: 'credits-from', comparison: 'at-least', credits: 12,
      source: {
        type: 'course-filter',
        filters: [{ field: 'subject', op: 'eq', value: 'CMPS' }],
      },
    };
    const { status, result } = audit(ast, minimalCatalog, inProgress);
    expect(status).toBe(IN_PROGRESS);
    expect(result.creditsEarned).toBe(9);
    expect(result.creditsInProgress).toBe(6);
  });

  test('some progress but not enough → partial-progress', () => {
    // In-progress CMPS: earned 9, ip 6, total 15 — need 30
    const ast = {
      type: 'credits-from', comparison: 'at-least', credits: 30,
      source: {
        type: 'course-filter',
        filters: [{ field: 'subject', op: 'eq', value: 'CMPS' }],
      },
    };
    const { status } = audit(ast, minimalCatalog, inProgress);
    expect(status).toBe(PARTIAL_PROGRESS);
  });

  test('0 earned, 0 ip → not-met', () => {
    const ast = {
      type: 'credits-from', comparison: 'at-least', credits: 12,
      source: {
        type: 'course-filter',
        filters: [{ field: 'subject', op: 'eq', value: 'CMPS' }],
      },
    };
    const { status, result } = audit(ast, minimalCatalog, empty);
    expect(status).toBe(NOT_MET);
    expect(result.creditsEarned).toBe(0);
    expect(result.creditsInProgress).toBe(0);
  });

  test('required = 0 → always met', () => {
    const ast = {
      type: 'credits-from', comparison: 'at-least', credits: 0,
      source: {
        type: 'course-filter',
        filters: [{ field: 'subject', op: 'eq', value: 'CMPS' }],
      },
    };
    const { status } = audit(ast, minimalCatalog, empty);
    expect(status).toBe(MET);
  });

  test('credits from explicit course list', () => {
    // 3 explicit courses: MATH 101 (3), MATH 151 (4), CMPS 130 (3) = 10 credits
    const ast = {
      type: 'credits-from', comparison: 'at-least', credits: 10,
      source: {
        type: 'all-of',
        items: [
          { type: 'course', subject: 'MATH', number: '101' },
          { type: 'course', subject: 'MATH', number: '151' },
          { type: 'course', subject: 'CMPS', number: '130' },
        ],
      },
    };
    const { status, result } = audit(ast, minimalCatalog, complete);
    expect(status).toBe(MET);
    expect(result.creditsEarned).toBe(10);
  });
});

// ============================================================
// credits-from (at-most)
// ============================================================

describe('credits-from at-most', () => {
  test('earned ≤ limit → met', () => {
    // Partial has CMPS 130(3), 135(3), 230(3) = 9 credits
    const ast = {
      type: 'credits-from', comparison: 'at-most', credits: 12,
      source: {
        type: 'course-filter',
        filters: [{ field: 'subject', op: 'eq', value: 'CMPS' }],
      },
    };
    const { status } = audit(ast, minimalCatalog, partial);
    expect(status).toBe(MET);
  });

  test('earned > limit → not-met', () => {
    // Complete has 30 CMPS credits, limit is 12
    const ast = {
      type: 'credits-from', comparison: 'at-most', credits: 12,
      source: {
        type: 'course-filter',
        filters: [{ field: 'subject', op: 'eq', value: 'CMPS' }],
      },
    };
    const { status } = audit(ast, minimalCatalog, complete);
    expect(status).toBe(NOT_MET);
  });

  test('earned ≤ limit but earned + ip > limit → in-progress', () => {
    // In-progress: CMPS earned 9, ip 6, limit 12 → 9 ≤ 12 but 9+6=15 > 12
    const ast = {
      type: 'credits-from', comparison: 'at-most', credits: 12,
      source: {
        type: 'course-filter',
        filters: [{ field: 'subject', op: 'eq', value: 'CMPS' }],
      },
    };
    const { status } = audit(ast, minimalCatalog, inProgress);
    expect(status).toBe(IN_PROGRESS);
  });
});

// ============================================================
// credits-from (exactly)
// ============================================================

describe('credits-from exactly', () => {
  test('earned === required → met', () => {
    // Partial CMPS: 130(3), 135(3), 230(3) = 9
    const ast = {
      type: 'credits-from', comparison: 'exactly', credits: 9,
      source: {
        type: 'course-filter',
        filters: [{ field: 'subject', op: 'eq', value: 'CMPS' }],
      },
    };
    const { status } = audit(ast, minimalCatalog, partial);
    expect(status).toBe(MET);
  });

  test('earned > required → not-met', () => {
    const ast = {
      type: 'credits-from', comparison: 'exactly', credits: 6,
      source: {
        type: 'course-filter',
        filters: [{ field: 'subject', op: 'eq', value: 'CMPS' }],
      },
    };
    const { status } = audit(ast, minimalCatalog, partial);
    expect(status).toBe(NOT_MET);
  });

  test('earned < required, earned + ip ≥ required → in-progress', () => {
    // CMPS earned 9, ip 6, need exactly 12 → 9 < 12 but 9+6=15 ≥ 12
    const ast = {
      type: 'credits-from', comparison: 'exactly', credits: 12,
      source: {
        type: 'course-filter',
        filters: [{ field: 'subject', op: 'eq', value: 'CMPS' }],
      },
    };
    const { status } = audit(ast, minimalCatalog, inProgress);
    expect(status).toBe(IN_PROGRESS);
  });

  test('no progress → not-met', () => {
    const ast = {
      type: 'credits-from', comparison: 'exactly', credits: 12,
      source: {
        type: 'course-filter',
        filters: [{ field: 'subject', op: 'eq', value: 'CMPS' }],
      },
    };
    const { status } = audit(ast, minimalCatalog, empty);
    expect(status).toBe(NOT_MET);
  });
});

// ============================================================
// credits-from result shape
// ============================================================

describe('credits-from result shape', () => {
  test('result includes all credit fields and source', () => {
    const ast = {
      type: 'credits-from', comparison: 'at-least', credits: 6,
      source: {
        type: 'course-filter',
        filters: [{ field: 'subject', op: 'eq', value: 'MATH' }],
      },
    };
    const { result } = audit(ast, minimalCatalog, complete);
    expect(result.type).toBe('credits-from');
    expect(result.comparison).toBe('at-least');
    expect(result.credits).toBe(6);
    expect(result.creditsEarned).toBeGreaterThan(0);
    expect(typeof result.creditsInProgress).toBe('number');
    expect(Array.isArray(result.matchedCourses)).toBe(true);
    expect(result.source).toBeDefined();
    expect(result.source.type).toBe('course-filter');
  });

  test('matchedCourses contains actual transcript entries', () => {
    const ast = {
      type: 'credits-from', comparison: 'at-least', credits: 6,
      source: {
        type: 'all-of',
        items: [
          { type: 'course', subject: 'MATH', number: '101' },
          { type: 'course', subject: 'MATH', number: '151' },
        ],
      },
    };
    const { result } = audit(ast, minimalCatalog, complete);
    expect(result.matchedCourses).toHaveLength(2);
    expect(result.matchedCourses[0].subject).toBe('MATH');
  });

  test('label is preserved', () => {
    const ast = {
      type: 'credits-from', comparison: 'at-least', credits: 6,
      label: 'Math Credits',
      source: {
        type: 'course-filter',
        filters: [{ field: 'subject', op: 'eq', value: 'MATH' }],
      },
    };
    const { result } = audit(ast, minimalCatalog, complete);
    expect(result.label).toBe('Math Credits');
  });
});
