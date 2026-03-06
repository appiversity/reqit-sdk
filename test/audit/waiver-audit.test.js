'use strict';

/**
 * Integration tests for audit with waivers.
 *
 * Uses the internal audit() function with exception options
 * to verify waiver interception at all node types.
 */

const { audit } = require('../../src/audit');
const { waiver } = require('../../src/audit/exceptions');
const { WAIVED, MET, NOT_MET, IN_PROGRESS } = require('../../src/audit/status');
const minimalCatalog = require('../fixtures/catalogs/minimal.json');
const { findUnmet } = require('../../src/audit/find-unmet');

const completeTx = [
  { subject: 'MATH', number: '151', grade: 'A', credits: 4, status: 'completed' },
  { subject: 'CMPS', number: '130', grade: 'B', credits: 3, status: 'completed' },
];

const emptyTx = [];

// ============================================================
// Course waivers
// ============================================================

describe('course waivers', () => {
  test('waived course returns status waived', () => {
    const ast = { type: 'course', subject: 'MATH', number: '151' };
    const w = waiver({ course: { subject: 'MATH', number: '151' }, reason: 'AP credit' });
    const result = audit(ast, minimalCatalog, emptyTx, { exceptions: [w] });

    expect(result.status).toBe(WAIVED);
    expect(result.result.status).toBe(WAIVED);
    expect(result.result.waiver).toBeDefined();
    expect(result.result.waiver.kind).toBe('waiver');
    expect(result.result.waiver.reason).toBe('AP credit');
  });

  test('waived course includes catalog credits', () => {
    const ast = { type: 'course', subject: 'MATH', number: '151' };
    const w = waiver({ course: { subject: 'MATH', number: '151' }, reason: 'AP credit' });
    const result = audit(ast, minimalCatalog, emptyTx, { exceptions: [w] });

    expect(result.result.waivedCredits).toBe(4); // MATH 151 is 4 credits in minimal catalog
  });

  test('waiver takes priority over transcript match', () => {
    const ast = { type: 'course', subject: 'MATH', number: '151' };
    const w = waiver({ course: { subject: 'MATH', number: '151' }, reason: 'AP credit' });
    // Student has MATH 151 on transcript AND a waiver
    const result = audit(ast, minimalCatalog, completeTx, { exceptions: [w] });

    // Waiver should take priority
    expect(result.status).toBe(WAIVED);
  });

  test('waived course in all-of propagates as met-equivalent', () => {
    const ast = {
      type: 'all-of',
      items: [
        { type: 'course', subject: 'MATH', number: '151' },
        { type: 'course', subject: 'CMPS', number: '130' },
      ],
    };
    const w = waiver({ course: { subject: 'MATH', number: '151' }, reason: 'AP credit' });
    const result = audit(ast, minimalCatalog, completeTx, { exceptions: [w] });

    expect(result.status).toBe(MET);
    expect(result.result.items[0].status).toBe(WAIVED);
    expect(result.result.items[1].status).toBe(MET);
  });

  test('waived course in any-of returns met', () => {
    const ast = {
      type: 'any-of',
      items: [
        { type: 'course', subject: 'MATH', number: '151' },
        { type: 'course', subject: 'ENGL', number: '101' },
      ],
    };
    const w = waiver({ course: { subject: 'MATH', number: '151' }, reason: 'AP credit' });
    const result = audit(ast, minimalCatalog, emptyTx, { exceptions: [w] });

    expect(result.status).toBe(MET);
  });

  test('waived course excluded from findUnmet', () => {
    const ast = {
      type: 'all-of',
      items: [
        { type: 'course', subject: 'MATH', number: '151' },
        { type: 'course', subject: 'ENGL', number: '101' },
      ],
    };
    const w = waiver({ course: { subject: 'MATH', number: '151' }, reason: 'AP credit' });
    const result = audit(ast, minimalCatalog, emptyTx, { exceptions: [w] });

    const unmet = findUnmet(result.result);
    expect(unmet).toHaveLength(1);
    expect(unmet[0].node.subject).toBe('ENGL');
  });
});

// ============================================================
// Score / attainment / quantity waivers
// ============================================================

describe('non-course leaf waivers', () => {
  test('waived score node', () => {
    const ast = { type: 'score', name: 'SAT_MATH', op: 'gte', value: 600 };
    const w = waiver({ score: 'SAT_MATH', reason: 'Alternative assessment' });
    const result = audit(ast, minimalCatalog, emptyTx, { exceptions: [w] });

    expect(result.status).toBe(WAIVED);
    expect(result.result.waiver.kind).toBe('waiver');
  });

  test('waived attainment node', () => {
    const ast = { type: 'attainment', name: 'JUNIOR_STANDING' };
    const w = waiver({ attainment: 'JUNIOR_STANDING', reason: 'Override' });
    const result = audit(ast, minimalCatalog, emptyTx, { exceptions: [w] });

    expect(result.status).toBe(WAIVED);
  });

  test('waived quantity node', () => {
    const ast = { type: 'quantity', name: 'CLINICAL_HOURS', op: 'gte', value: 100 };
    const w = waiver({ quantity: 'CLINICAL_HOURS', reason: 'Prior experience' });
    const result = audit(ast, minimalCatalog, emptyTx, { exceptions: [w] });

    expect(result.status).toBe(WAIVED);
  });
});

// ============================================================
// Labeled group waivers
// ============================================================

describe('labeled group waivers', () => {
  test('waives entire labeled all-of group', () => {
    const ast = {
      type: 'all-of',
      label: 'Foreign Language Requirement',
      items: [
        { type: 'course', subject: 'SPAN', number: '101' },
        { type: 'course', subject: 'SPAN', number: '102' },
      ],
    };
    const w = waiver({ label: 'Foreign Language Requirement', reason: 'Native speaker' });
    const result = audit(ast, minimalCatalog, emptyTx, { exceptions: [w] });

    expect(result.status).toBe(WAIVED);
    expect(result.result.waiver).toBeDefined();
    expect(result.result.waiver.reason).toBe('Native speaker');
    // Children should NOT be present (short-circuited)
    expect(result.result.items).toBeUndefined();
  });

  test('labeled group waiver takes priority over individual child waivers', () => {
    const ast = {
      type: 'all-of',
      label: 'Math Core',
      items: [
        { type: 'course', subject: 'MATH', number: '151' },
        { type: 'course', subject: 'MATH', number: '152' },
      ],
    };
    const groupW = waiver({ label: 'Math Core', reason: 'Transferred all' });
    const courseW = waiver({ course: { subject: 'MATH', number: '151' }, reason: 'AP' });
    const result = audit(ast, minimalCatalog, emptyTx, { exceptions: [groupW, courseW] });

    expect(result.status).toBe(WAIVED);
    expect(result.result.waiver.reason).toBe('Transferred all');
  });

  test('labeled group waiver within parent composite', () => {
    const ast = {
      type: 'all-of',
      items: [
        {
          type: 'all-of',
          label: 'Foreign Language Requirement',
          items: [
            { type: 'course', subject: 'SPAN', number: '101' },
            { type: 'course', subject: 'SPAN', number: '102' },
          ],
        },
        { type: 'course', subject: 'CMPS', number: '130' },
      ],
    };
    const w = waiver({ label: 'Foreign Language Requirement', reason: 'Native speaker' });
    const result = audit(ast, minimalCatalog, completeTx, { exceptions: [w] });

    expect(result.status).toBe(MET);
    expect(result.result.items[0].status).toBe(WAIVED);
    expect(result.result.items[1].status).toBe(MET);
  });
});

// ============================================================
// Constraint interaction
// ============================================================

describe('waiver + with-constraint interaction', () => {
  test('waived course inside with-constraint skips grade check', () => {
    const ast = {
      type: 'with-constraint',
      constraint: { kind: 'min-grade', value: 'B' },
      requirement: { type: 'course', subject: 'MATH', number: '151' },
    };
    const w = waiver({ course: { subject: 'MATH', number: '151' }, reason: 'AP credit' });
    const result = audit(ast, minimalCatalog, emptyTx, { exceptions: [w] });

    // Should be waived, not not-met due to grade constraint
    expect(result.status).toBe(WAIVED);
  });
});

// ============================================================
// credits-from with waivers
// ============================================================

describe('credits-from with waived courses', () => {
  test('waived course contributes credits from catalog', () => {
    const ast = {
      type: 'credits-from',
      comparison: 'at-least',
      credits: 4,
      source: {
        type: 'all-of',
        items: [
          { type: 'course', subject: 'MATH', number: '151' },
          { type: 'course', subject: 'CMPS', number: '130' },
        ],
      },
    };
    const w = waiver({ course: { subject: 'MATH', number: '151' }, reason: 'AP credit' });
    // Only CMPS 130 on transcript (3 credits), MATH 151 waived (4 credits from catalog)
    const tx = [
      { subject: 'CMPS', number: '130', grade: 'B', credits: 3, status: 'completed' },
    ];
    const result = audit(ast, minimalCatalog, tx, { exceptions: [w] });

    expect(result.status).toBe(MET);
    expect(result.result.creditsEarned).toBe(7); // 3 from CMPS + 4 waived from MATH
  });
});

// ============================================================
// Backward compatibility
// ============================================================

describe('backward compatibility', () => {
  test('audit without exceptions works identically', () => {
    const ast = {
      type: 'all-of',
      items: [
        { type: 'course', subject: 'MATH', number: '151' },
        { type: 'course', subject: 'CMPS', number: '130' },
      ],
    };
    const result = audit(ast, minimalCatalog, completeTx);

    expect(result.status).toBe(MET);
    expect(result.exceptions).toBeUndefined();
  });

  test('audit with empty exceptions array works identically', () => {
    const ast = { type: 'course', subject: 'MATH', number: '151' };
    const result = audit(ast, minimalCatalog, completeTx, { exceptions: [] });

    expect(result.status).toBe(MET);
  });
});

// ============================================================
// Unused exception warnings (cover describeWaiverTarget branches)
// ============================================================

describe('unused exception warnings', () => {
  test('unused course waiver generates warning', () => {
    const ast = { type: 'course', subject: 'MATH', number: '151' };
    const unusedW = waiver({ course: { subject: 'ENGL', number: '101' }, reason: 'transfer' });
    const result = audit(ast, minimalCatalog, completeTx, { exceptions: [unusedW] });
    const warnings = result.warnings.filter(w => w.type === 'unused-exception');
    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toContain('ENGL 101');
  });

  test('unused score waiver generates warning', () => {
    const ast = { type: 'course', subject: 'MATH', number: '151' };
    const unusedW = waiver({ score: 'SAT_MATH', reason: 'alt' });
    const result = audit(ast, minimalCatalog, completeTx, { exceptions: [unusedW] });
    const warnings = result.warnings.filter(w => w.type === 'unused-exception');
    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toContain('score SAT_MATH');
  });

  test('unused attainment waiver generates warning', () => {
    const ast = { type: 'course', subject: 'MATH', number: '151' };
    const unusedW = waiver({ attainment: 'JUNIOR', reason: 'override' });
    const result = audit(ast, minimalCatalog, completeTx, { exceptions: [unusedW] });
    const warnings = result.warnings.filter(w => w.type === 'unused-exception');
    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toContain('attainment JUNIOR');
  });

  test('unused quantity waiver generates warning', () => {
    const ast = { type: 'course', subject: 'MATH', number: '151' };
    const unusedW = waiver({ quantity: 'HOURS', reason: 'exp' });
    const result = audit(ast, minimalCatalog, completeTx, { exceptions: [unusedW] });
    const warnings = result.warnings.filter(w => w.type === 'unused-exception');
    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toContain('quantity HOURS');
  });

  test('unused label waiver generates warning', () => {
    const ast = { type: 'course', subject: 'MATH', number: '151' };
    const unusedW = waiver({ label: 'Gen Ed', reason: 'exempt' });
    const result = audit(ast, minimalCatalog, completeTx, { exceptions: [unusedW] });
    const warnings = result.warnings.filter(w => w.type === 'unused-exception');
    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toContain('label "Gen Ed"');
  });

  test('unused substitution generates warning', () => {
    const ast = { type: 'course', subject: 'MATH', number: '151' };
    const sub = require('../../src/audit/exceptions').substitution({
      original: { subject: 'ENGL', number: '101' },
      replacement: { subject: 'ENGL', number: '201' },
      reason: 'approved',
    });
    const result = audit(ast, minimalCatalog, completeTx, { exceptions: [sub] });
    const warnings = result.warnings.filter(w => w.type === 'unused-exception');
    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toContain('Substitution');
  });
});

// ============================================================
// Summary with waivers
// ============================================================

describe('summary with waived items', () => {
  test('buildSummary counts waived separately via composite summary', () => {
    const ast = {
      type: 'all-of',
      items: [
        { type: 'course', subject: 'MATH', number: '151' },
        { type: 'course', subject: 'CMPS', number: '130' },
        { type: 'course', subject: 'ENGL', number: '101' },
      ],
    };
    const w = waiver({ course: { subject: 'MATH', number: '151' }, reason: 'AP credit' });
    const result = audit(ast, minimalCatalog, completeTx, { exceptions: [w] });

    // MATH 151 waived, CMPS 130 met, ENGL 101 not-met
    const summary = result.result.summary;
    expect(summary.waived).toBe(1);
    expect(summary.met).toBe(1);
    expect(summary.notMet).toBe(1);
  });
});
