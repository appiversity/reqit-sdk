'use strict';

const { audit, MET, PROVISIONAL_MET, NOT_MET } = require('../../src/audit');
const minimalCatalog = require('../fixtures/catalogs/minimal.json');

const complete = require('../fixtures/transcripts/minimal/complete.json');
const empty = require('../fixtures/transcripts/minimal/empty.json');
const partial = require('../fixtures/transcripts/minimal/partial.json');
const inProgress = require('../fixtures/transcripts/minimal/in-progress.json');
const failing = require('../fixtures/transcripts/minimal/failing-grades.json');

// ============================================================
// course node
// ============================================================

describe('course node', () => {
  const ast = { type: 'course', subject: 'MATH', number: '151' };

  test('completed with passing grade → met', () => {
    const { status, result } = audit(ast, minimalCatalog, complete);
    expect(status).toBe(MET);
    expect(result.satisfiedBy).toBeDefined();
    expect(result.satisfiedBy.grade).toBe('A-');
    expect(result.satisfiedBy.credits).toBe(4);
  });

  test('in-progress → in-progress', () => {
    // In the in-progress fixture, MATH 151 is completed; MATH 152 is in-progress
    const ipAst = { type: 'course', subject: 'MATH', number: '152' };
    const { status, result } = audit(ipAst, minimalCatalog, inProgress);
    expect(status).toBe(PROVISIONAL_MET);
    expect(result.satisfiedBy).toBeDefined();
    expect(result.satisfiedBy.status).toBe('in-progress');
    expect(result.satisfiedBy.grade).toBeNull();
  });

  test('not in transcript → not-met', () => {
    const { status, result } = audit(ast, minimalCatalog, empty);
    expect(status).toBe(NOT_MET);
    expect(result.satisfiedBy).toBeUndefined();
  });

  test('completed with failing grade → not-met', () => {
    // In failing fixture, MATH 151 has grade "F"
    const { status, result } = audit(ast, minimalCatalog, failing);
    expect(status).toBe(NOT_MET);
    expect(result.satisfiedBy).toBeDefined();
    expect(result.satisfiedBy.grade).toBe('F');
  });

  test('completed with D- (passing with 0.7 points) → met', () => {
    // In failing fixture, CMPS 130 has grade "D-" which is on the scale (0.7 pts)
    const dAst = { type: 'course', subject: 'CMPS', number: '130' };
    const { status } = audit(dAst, minimalCatalog, failing);
    expect(status).toBe(MET);
  });

  test('completed with NP (not-passing) → not-met', () => {
    const npAst = { type: 'course', subject: 'CMPS', number: '135' };
    const { status, result } = audit(npAst, minimalCatalog, failing);
    expect(status).toBe(NOT_MET);
    expect(result.satisfiedBy).toBeDefined();
    expect(result.satisfiedBy.grade).toBe('NP');
  });

  test('withdrawn entry filtered from transcript → not-met', () => {
    // In failing fixture, ENGL 101 has status: withdrawn
    const wAst = { type: 'course', subject: 'ENGL', number: '101' };
    const { status, result } = audit(wAst, minimalCatalog, failing);
    expect(status).toBe(NOT_MET);
    expect(result.satisfiedBy).toBeUndefined();
  });

  test('result preserves subject and number', () => {
    const { result } = audit(ast, minimalCatalog, complete);
    expect(result.type).toBe('course');
    expect(result.subject).toBe('MATH');
    expect(result.number).toBe('151');
  });

  test('course not in catalog but in transcript → met', () => {
    // A course can be in the transcript without being in the catalog
    // (the audit still matches by courseKey against the transcript)
    const unknownAst = { type: 'course', subject: 'HIST', number: '101' };
    const { status, result } = audit(unknownAst, minimalCatalog, complete);
    expect(status).toBe(MET);
    expect(result.satisfiedBy.grade).toBe('B+');
  });
});

// ============================================================
// course node — cross-listing
// ============================================================

describe('course node — cross-listing', () => {
  // Create a catalog with cross-listed courses
  const xlCatalog = {
    ...minimalCatalog,
    courses: [
      ...minimalCatalog.courses,
      { id: 100, subject: 'CMPS', number: '340', title: 'Combinatorics',
        creditsMin: 3, creditsMax: 3, crossListGroup: 'xlg-combo' },
      { id: 101, subject: 'MATH', number: '340', title: 'Combinatorics',
        creditsMin: 3, creditsMax: 3, crossListGroup: 'xlg-combo' },
    ],
  };

  test('cross-listed match when student took equivalent → met', () => {
    // Requirement is CMPS 340, student took MATH 340
    const ast = { type: 'course', subject: 'CMPS', number: '340' };
    const transcript = [
      { subject: 'MATH', number: '340', grade: 'A', credits: 3,
        term: 'Fall 2024', status: 'completed' },
    ];
    const { status, result, warnings } = audit(ast, xlCatalog, transcript);
    expect(status).toBe(MET);
    expect(result.satisfiedBy.subject).toBe('MATH');
    expect(result.satisfiedBy.number).toBe('340');
    // Should emit a cross-listed-match warning
    expect(warnings).toHaveLength(1);
    expect(warnings[0].type).toBe('cross-listed-match');
    expect(warnings[0].matchedSubject).toBe('MATH');
  });

  test('direct match preferred over cross-list', () => {
    // Student took both CMPS 340 and MATH 340
    const ast = { type: 'course', subject: 'CMPS', number: '340' };
    const transcript = [
      { subject: 'CMPS', number: '340', grade: 'B', credits: 3,
        term: 'Fall 2024', status: 'completed' },
      { subject: 'MATH', number: '340', grade: 'A', credits: 3,
        term: 'Fall 2024', status: 'completed' },
    ];
    const { status, result, warnings } = audit(ast, xlCatalog, transcript);
    expect(status).toBe(MET);
    expect(result.satisfiedBy.subject).toBe('CMPS');
    // No cross-listed warning since direct match was used
    const xlWarnings = warnings.filter(w => w.type === 'cross-listed-match');
    expect(xlWarnings).toHaveLength(0);
  });

  test('cross-listed course not taken → not-met', () => {
    const ast = { type: 'course', subject: 'CMPS', number: '340' };
    const { status } = audit(ast, xlCatalog, empty);
    expect(status).toBe(NOT_MET);
  });
});

// ============================================================
// course-filter node
// ============================================================

describe('course-filter node', () => {
  test('subject filter matches completed courses → met', () => {
    const ast = {
      type: 'course-filter',
      filters: [{ field: 'subject', op: 'eq', value: 'CMPS' }],
    };
    const { status, result } = audit(ast, minimalCatalog, complete);
    expect(status).toBe(MET);
    expect(result.matchedCourses.length).toBeGreaterThan(0);
    expect(result.catalogMatches).toBeGreaterThan(0);
  });

  test('attribute filter matches completed courses → met', () => {
    const ast = {
      type: 'course-filter',
      filters: [{ field: 'attribute', op: 'eq', value: 'SCI' }],
    };
    const { status, result } = audit(ast, minimalCatalog, complete);
    expect(status).toBe(MET);
    // PHYS 201, CHEM 101, BIOL 101, HIST 101 have SCI attribute
    expect(result.matchedCourses.length).toBeGreaterThan(0);
  });

  test('number gte filter → met for upper-division courses', () => {
    const ast = {
      type: 'course-filter',
      filters: [
        { field: 'subject', op: 'eq', value: 'CMPS' },
        { field: 'number', op: 'gte', value: 300 },
      ],
    };
    const { status, result } = audit(ast, minimalCatalog, complete);
    expect(status).toBe(MET);
    // Complete transcript has CMPS 310, 320, 350, 360, 380, 491, 492
    expect(result.matchedCourses.length).toBeGreaterThan(0);
  });

  test('filter matches only in-progress courses → in-progress', () => {
    const ast = {
      type: 'course-filter',
      filters: [
        { field: 'subject', op: 'eq', value: 'CMPS' },
        { field: 'number', op: 'gte', value: 300 },
      ],
    };
    // In-progress transcript has CMPS 310, 320 in-progress, no completed 300+
    const { status, result } = audit(ast, minimalCatalog, inProgress);
    expect(status).toBe(PROVISIONAL_MET);
    expect(result.inProgressCourses.length).toBeGreaterThan(0);
    expect(result.matchedCourses).toHaveLength(0);
  });

  test('no transcript matches → not-met', () => {
    const ast = {
      type: 'course-filter',
      filters: [{ field: 'subject', op: 'eq', value: 'CMPS' }],
    };
    const { status, result } = audit(ast, minimalCatalog, empty);
    expect(status).toBe(NOT_MET);
    expect(result.matchedCourses).toHaveLength(0);
    expect(result.inProgressCourses).toHaveLength(0);
  });

  test('filter matches catalog courses but none in transcript → not-met', () => {
    // ART courses are in the catalog but not in the partial transcript
    const ast = {
      type: 'course-filter',
      filters: [{ field: 'subject', op: 'eq', value: 'ART' }],
    };
    const { status, result } = audit(ast, minimalCatalog, partial);
    expect(status).toBe(NOT_MET);
    expect(result.catalogMatches).toBeGreaterThan(0); // ART courses exist in catalog
    expect(result.matchedCourses).toHaveLength(0);
  });

  test('failing grades excluded from matched courses', () => {
    const ast = {
      type: 'course-filter',
      filters: [{ field: 'subject', op: 'eq', value: 'CMPS' }],
    };
    // In failing fixture: CMPS 130 (D-), CMPS 135 (NP), CMPS 230 (F)
    const { result } = audit(ast, minimalCatalog, failing);
    // Only CMPS 130 (D-) is passing — D- has 0.7 grade points on the scale
    expect(result.matchedCourses).toHaveLength(1);
    expect(result.matchedCourses[0].subject).toBe('CMPS');
    expect(result.matchedCourses[0].number).toBe('130');
  });

  test('result includes filters and catalogMatches count', () => {
    const ast = {
      type: 'course-filter',
      filters: [{ field: 'subject', op: 'eq', value: 'MATH' }],
    };
    const { result } = audit(ast, minimalCatalog, complete);
    expect(result.type).toBe('course-filter');
    expect(result.filters).toEqual(ast.filters);
    // Catalog has MATH 101, 151, 152, 250
    expect(result.catalogMatches).toBe(4);
  });
});

// ============================================================
// score node
// ============================================================

describe('score node', () => {
  const ast = { type: 'score', name: 'SAT', op: 'gte', value: 1200 };

  test('score meets threshold → met', () => {
    const opts = { attainments: { SAT: { kind: 'score', value: 1350 } } };
    const { status, result } = audit(ast, minimalCatalog, empty, opts);
    expect(status).toBe(MET);
    expect(result.actual).toBe(1350);
  });

  test('score exactly at threshold → met', () => {
    const opts = { attainments: { SAT: { kind: 'score', value: 1200 } } };
    const { status } = audit(ast, minimalCatalog, empty, opts);
    expect(status).toBe(MET);
  });

  test('score below threshold → not-met', () => {
    const opts = { attainments: { SAT: { kind: 'score', value: 1100 } } };
    const { status, result } = audit(ast, minimalCatalog, empty, opts);
    expect(status).toBe(NOT_MET);
    expect(result.actual).toBe(1100);
  });

  test('score not in attainments → not-met', () => {
    const { status, result } = audit(ast, minimalCatalog, empty);
    expect(status).toBe(NOT_MET);
    expect(result.actual).toBeUndefined();
  });

  test('empty attainments → not-met', () => {
    const opts = { attainments: {} };
    const { status } = audit(ast, minimalCatalog, empty, opts);
    expect(status).toBe(NOT_MET);
  });

  test('wrong kind (boolean instead of score) → not-met', () => {
    const opts = { attainments: { SAT: { kind: 'boolean', value: true } } };
    const { status } = audit(ast, minimalCatalog, empty, opts);
    expect(status).toBe(NOT_MET);
  });

  test('result preserves name, op, value', () => {
    const opts = { attainments: { SAT: { kind: 'score', value: 1350 } } };
    const { result } = audit(ast, minimalCatalog, empty, opts);
    expect(result.type).toBe('score');
    expect(result.name).toBe('SAT');
    expect(result.op).toBe('gte');
    expect(result.value).toBe(1200);
  });

  test('gt operator', () => {
    const gtAst = { type: 'score', name: 'SAT', op: 'gt', value: 1200 };
    const atBoundary = { attainments: { SAT: { kind: 'score', value: 1200 } } };
    const aboveBoundary = { attainments: { SAT: { kind: 'score', value: 1201 } } };
    expect(audit(gtAst, minimalCatalog, empty, atBoundary).status).toBe(NOT_MET);
    expect(audit(gtAst, minimalCatalog, empty, aboveBoundary).status).toBe(MET);
  });

  test('eq operator', () => {
    const eqAst = { type: 'score', name: 'SAT', op: 'eq', value: 1200 };
    const exact = { attainments: { SAT: { kind: 'score', value: 1200 } } };
    const off = { attainments: { SAT: { kind: 'score', value: 1201 } } };
    expect(audit(eqAst, minimalCatalog, empty, exact).status).toBe(MET);
    expect(audit(eqAst, minimalCatalog, empty, off).status).toBe(NOT_MET);
  });

  test('lt operator', () => {
    const ltAst = { type: 'score', name: 'SAT', op: 'lt', value: 1200 };
    const below = { attainments: { SAT: { kind: 'score', value: 1199 } } };
    const atBoundary = { attainments: { SAT: { kind: 'score', value: 1200 } } };
    expect(audit(ltAst, minimalCatalog, empty, below).status).toBe(MET);
    expect(audit(ltAst, minimalCatalog, empty, atBoundary).status).toBe(NOT_MET);
  });

  test('lte operator', () => {
    const lteAst = { type: 'score', name: 'SAT', op: 'lte', value: 1200 };
    const at = { attainments: { SAT: { kind: 'score', value: 1200 } } };
    const above = { attainments: { SAT: { kind: 'score', value: 1201 } } };
    expect(audit(lteAst, minimalCatalog, empty, at).status).toBe(MET);
    expect(audit(lteAst, minimalCatalog, empty, above).status).toBe(NOT_MET);
  });

  test('ne operator', () => {
    const neAst = { type: 'score', name: 'SAT', op: 'ne', value: 1200 };
    const diff = { attainments: { SAT: { kind: 'score', value: 1201 } } };
    const same = { attainments: { SAT: { kind: 'score', value: 1200 } } };
    expect(audit(neAst, minimalCatalog, empty, diff).status).toBe(MET);
    expect(audit(neAst, minimalCatalog, empty, same).status).toBe(NOT_MET);
  });
});

// ============================================================
// attainment node
// ============================================================

describe('attainment node', () => {
  const ast = { type: 'attainment', name: 'PRAXIS' };

  test('boolean attainment true → met', () => {
    const opts = { attainments: { PRAXIS: { kind: 'boolean', value: true } } };
    const { status } = audit(ast, minimalCatalog, empty, opts);
    expect(status).toBe(MET);
  });

  test('boolean attainment false → not-met', () => {
    const opts = { attainments: { PRAXIS: { kind: 'boolean', value: false } } };
    const { status } = audit(ast, minimalCatalog, empty, opts);
    expect(status).toBe(NOT_MET);
  });

  test('attainment not present → not-met', () => {
    const { status } = audit(ast, minimalCatalog, empty);
    expect(status).toBe(NOT_MET);
  });

  test('empty attainments → not-met', () => {
    const opts = { attainments: {} };
    const { status } = audit(ast, minimalCatalog, empty, opts);
    expect(status).toBe(NOT_MET);
  });

  test('result preserves name', () => {
    const opts = { attainments: { PRAXIS: { kind: 'boolean', value: true } } };
    const { result } = audit(ast, minimalCatalog, empty, opts);
    expect(result.type).toBe('attainment');
    expect(result.name).toBe('PRAXIS');
  });
});

// ============================================================
// quantity node
// ============================================================

describe('quantity node', () => {
  const ast = { type: 'quantity', name: 'TOTAL_CREDITS', op: 'gte', value: 120 };

  test('quantity meets threshold → met', () => {
    const opts = { attainments: { TOTAL_CREDITS: { kind: 'quantity', value: 130 } } };
    const { status, result } = audit(ast, minimalCatalog, empty, opts);
    expect(status).toBe(MET);
    expect(result.actual).toBe(130);
  });

  test('quantity exactly at threshold → met', () => {
    const opts = { attainments: { TOTAL_CREDITS: { kind: 'quantity', value: 120 } } };
    const { status } = audit(ast, minimalCatalog, empty, opts);
    expect(status).toBe(MET);
  });

  test('quantity below threshold → not-met', () => {
    const opts = { attainments: { TOTAL_CREDITS: { kind: 'quantity', value: 90 } } };
    const { status, result } = audit(ast, minimalCatalog, empty, opts);
    expect(status).toBe(NOT_MET);
    expect(result.actual).toBe(90);
  });

  test('quantity not in attainments → not-met', () => {
    const { status, result } = audit(ast, minimalCatalog, empty);
    expect(status).toBe(NOT_MET);
    expect(result.actual).toBeUndefined();
  });

  test('wrong kind (score instead of quantity) → not-met', () => {
    const opts = { attainments: { TOTAL_CREDITS: { kind: 'score', value: 130 } } };
    const { status } = audit(ast, minimalCatalog, empty, opts);
    expect(status).toBe(NOT_MET);
  });

  test('result preserves name, op, value', () => {
    const opts = { attainments: { TOTAL_CREDITS: { kind: 'quantity', value: 130 } } };
    const { result } = audit(ast, minimalCatalog, empty, opts);
    expect(result.type).toBe('quantity');
    expect(result.name).toBe('TOTAL_CREDITS');
    expect(result.op).toBe('gte');
    expect(result.value).toBe(120);
  });

  test('all comparison operators work', () => {
    const attainments = { X: { kind: 'quantity', value: 10 } };
    const opts = { attainments };

    expect(audit({ type: 'quantity', name: 'X', op: 'eq', value: 10 }, minimalCatalog, empty, opts).status).toBe(MET);
    expect(audit({ type: 'quantity', name: 'X', op: 'eq', value: 11 }, minimalCatalog, empty, opts).status).toBe(NOT_MET);
    expect(audit({ type: 'quantity', name: 'X', op: 'ne', value: 11 }, minimalCatalog, empty, opts).status).toBe(MET);
    expect(audit({ type: 'quantity', name: 'X', op: 'ne', value: 10 }, minimalCatalog, empty, opts).status).toBe(NOT_MET);
    expect(audit({ type: 'quantity', name: 'X', op: 'gt', value: 9 }, minimalCatalog, empty, opts).status).toBe(MET);
    expect(audit({ type: 'quantity', name: 'X', op: 'gt', value: 10 }, minimalCatalog, empty, opts).status).toBe(NOT_MET);
    expect(audit({ type: 'quantity', name: 'X', op: 'gte', value: 10 }, minimalCatalog, empty, opts).status).toBe(MET);
    expect(audit({ type: 'quantity', name: 'X', op: 'gte', value: 11 }, minimalCatalog, empty, opts).status).toBe(NOT_MET);
    expect(audit({ type: 'quantity', name: 'X', op: 'lt', value: 11 }, minimalCatalog, empty, opts).status).toBe(MET);
    expect(audit({ type: 'quantity', name: 'X', op: 'lt', value: 10 }, minimalCatalog, empty, opts).status).toBe(NOT_MET);
    expect(audit({ type: 'quantity', name: 'X', op: 'lte', value: 10 }, minimalCatalog, empty, opts).status).toBe(MET);
    expect(audit({ type: 'quantity', name: 'X', op: 'lte', value: 9 }, minimalCatalog, empty, opts).status).toBe(NOT_MET);
  });
});

// ============================================================
// variable-ref / variable-def / scope
// ============================================================

describe('variable-ref and variable-def', () => {
  test('variable-ref resolves through def to course → met', () => {
    const ast = {
      type: 'scope', name: 'test',
      defs: [
        { type: 'variable-def', name: 'core',
          value: { type: 'course', subject: 'MATH', number: '151' } },
      ],
      body: { type: 'variable-ref', name: 'core' },
    };
    const { status, result } = audit(ast, minimalCatalog, complete);
    expect(status).toBe(MET);
    expect(result.type).toBe('variable-ref');
    expect(result.resolved).toBeDefined();
    expect(result.resolved.type).toBe('course');
    expect(result.resolved.satisfiedBy.grade).toBe('A-');
  });

  test('variable-ref to missing def → not-met', () => {
    const ast = {
      type: 'scope', name: 'test',
      defs: [],
      body: { type: 'variable-ref', name: 'missing' },
    };
    const { status } = audit(ast, minimalCatalog, complete);
    expect(status).toBe(NOT_MET);
  });

  test('variable-ref with scope prefix resolves correctly', () => {
    const ast = {
      type: 'scope', name: 'cs',
      defs: [
        { type: 'variable-def', name: 'intro',
          value: { type: 'course', subject: 'CMPS', number: '130' } },
      ],
      body: { type: 'variable-ref', scope: 'cs', name: 'intro' },
    };
    const { status } = audit(ast, minimalCatalog, complete);
    expect(status).toBe(MET);
  });

  test('variable-def is transparent (met by default)', () => {
    const ast = {
      type: 'variable-def', name: 'x',
      value: { type: 'course', subject: 'MATH', number: '151' },
    };
    const { status, result } = audit(ast, minimalCatalog, complete);
    expect(status).toBe(MET);
    expect(result.type).toBe('variable-def');
  });

  test('variable-ref to course not in transcript → not-met', () => {
    const ast = {
      type: 'scope', name: 'test',
      defs: [
        { type: 'variable-def', name: 'missing',
          value: { type: 'course', subject: 'ART', number: '301' } },
      ],
      body: { type: 'variable-ref', name: 'missing' },
    };
    const { status } = audit(ast, minimalCatalog, partial);
    expect(status).toBe(NOT_MET);
  });
});

// ============================================================
// Policy nodes (single-tree no-ops)
// ============================================================

describe('policy nodes (single-tree)', () => {
  test('overlap-limit → not-met in single-tree', () => {
    const ast = { type: 'overlap-limit', max: 2, programs: ['CMPS', 'MATH'] };
    const { status } = audit(ast, minimalCatalog, complete);
    expect(status).toBe(NOT_MET);
  });

  test('outside-program → not-met in single-tree', () => {
    const ast = { type: 'outside-program' };
    const { status } = audit(ast, minimalCatalog, complete);
    expect(status).toBe(NOT_MET);
  });

  test('program-context-ref → not-met in single-tree', () => {
    const ast = { type: 'program-context-ref', name: 'CMPS' };
    const { status } = audit(ast, minimalCatalog, complete);
    expect(status).toBe(NOT_MET);
  });

  test('program → not-met in single-tree', () => {
    const ast = { type: 'program', code: 'CMPS' };
    const { status } = audit(ast, minimalCatalog, complete);
    expect(status).toBe(NOT_MET);
  });
});

// ============================================================
// Unknown node type
// ============================================================

describe('unknown node type', () => {
  test('unknown type → not-met with warning', () => {
    const ast = { type: 'invented-type' };
    const { status, warnings } = audit(ast, minimalCatalog, complete);
    expect(status).toBe(NOT_MET);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].type).toBe('unknown-node-type');
    expect(warnings[0].nodeType).toBe('invented-type');
  });

  test('null node → not-met', () => {
    const { status } = audit(null, minimalCatalog, complete);
    expect(status).toBe(NOT_MET);
  });
});
