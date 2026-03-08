'use strict';

const {
  Waiver, Substitution, waiver, substitution,
  buildExceptionContext, findLeafWaiver,
  buildWaivedResult, buildGroupWaivedResult, resolveWaivedCredits,
  applySubstitutions, partitionExceptions,
} = require('../../src/audit/exceptions');
const { WAIVED, SUBSTITUTED } = require('../../src/audit/status');

// ============================================================
// Waiver factory + class
// ============================================================

describe('waiver()', () => {
  test('creates course waiver', () => {
    const w = waiver({
      course: { subject: 'MATH', number: '151' },
      reason: 'AP credit',
    });
    expect(w).toBeInstanceOf(Waiver);
    expect(w.kind).toBe('waiver');
    expect(w.target).toEqual({ course: { subject: 'MATH', number: '151' } });
    expect(w.reason).toBe('AP credit');
    expect(w.metadata).toBeNull();
  });

  test('creates course waiver with metadata', () => {
    const w = waiver({
      course: { subject: 'MATH', number: '151' },
      reason: 'AP credit',
      metadata: { apScore: 5 },
    });
    expect(w.metadata).toEqual({ apScore: 5 });
  });

  test('creates score waiver', () => {
    const w = waiver({ score: 'SAT_MATH', reason: 'Alternative assessment' });
    expect(w.target).toEqual({ score: 'SAT_MATH' });
  });

  test('creates attainment waiver', () => {
    const w = waiver({ attainment: 'JUNIOR_STANDING', reason: 'Override' });
    expect(w.target).toEqual({ attainment: 'JUNIOR_STANDING' });
  });

  test('creates quantity waiver', () => {
    const w = waiver({ quantity: 'CLINICAL_HOURS', reason: 'Prior experience' });
    expect(w.target).toEqual({ quantity: 'CLINICAL_HOURS' });
  });

  test('creates label waiver', () => {
    const w = waiver({ label: 'Foreign Language Requirement', reason: 'Native speaker' });
    expect(w.target).toEqual({ label: 'Foreign Language Requirement' });
  });

  test('trims reason whitespace', () => {
    const w = waiver({ score: 'X', reason: '  trimmed  ' });
    expect(w.reason).toBe('trimmed');
  });

  test('throws without reason', () => {
    expect(() => waiver({ course: { subject: 'MATH', number: '151' } }))
      .toThrow('requires a non-empty reason');
  });

  test('throws with empty reason', () => {
    expect(() => waiver({ course: { subject: 'MATH', number: '151' }, reason: '' }))
      .toThrow('requires a non-empty reason');
  });

  test('throws without target key', () => {
    expect(() => waiver({ reason: 'test' }))
      .toThrow('requires exactly one target key');
  });

  test('throws with multiple target keys', () => {
    expect(() => waiver({ course: { subject: 'MATH', number: '151' }, score: 'SAT', reason: 'test' }))
      .toThrow('requires exactly one target key');
  });

  test('throws with invalid course target', () => {
    expect(() => waiver({ course: { subject: 'MATH' }, reason: 'test' }))
      .toThrow('course target requires { subject, number }');
  });

  test('throws with empty label', () => {
    expect(() => waiver({ label: '', reason: 'test' }))
      .toThrow('label target requires a non-empty string');
  });

  test('throws with invalid score target (non-string)', () => {
    expect(() => waiver({ score: 123, reason: 'test' }))
      .toThrow('score target requires a non-empty string');
  });

  test('throws with empty attainment target', () => {
    expect(() => waiver({ attainment: '', reason: 'test' }))
      .toThrow('attainment target requires a non-empty string');
  });

  test('throws with null opts', () => {
    expect(() => waiver(null)).toThrow('requires an options object');
  });

  test('is immutable (frozen)', () => {
    const w = waiver({ course: { subject: 'MATH', number: '151' }, reason: 'AP' });
    expect(Object.isFrozen(w)).toBe(true);
  });

  test('toJSON serializes correctly', () => {
    const w = waiver({
      course: { subject: 'MATH', number: '151' },
      reason: 'AP credit',
      metadata: { apScore: 5 },
    });
    const json = w.toJSON();
    expect(json).toEqual({
      kind: 'waiver',
      course: { subject: 'MATH', number: '151' },
      reason: 'AP credit',
      metadata: { apScore: 5 },
    });
  });

  test('toJSON omits metadata when null', () => {
    const w = waiver({ score: 'SAT_MATH', reason: 'test' });
    const json = w.toJSON();
    expect(json.metadata).toBeUndefined();
  });
});

// ============================================================
// Substitution factory + class
// ============================================================

describe('substitution()', () => {
  test('creates substitution', () => {
    const s = substitution({
      original: { subject: 'MATH', number: '151' },
      replacement: { subject: 'PHYS', number: '201' },
      reason: 'Department approval',
    });
    expect(s).toBeInstanceOf(Substitution);
    expect(s.kind).toBe('substitution');
    expect(s.original).toEqual({ subject: 'MATH', number: '151' });
    expect(s.replacement).toEqual({ subject: 'PHYS', number: '201' });
    expect(s.reason).toBe('Department approval');
    expect(s.metadata).toBeNull();
  });

  test('creates substitution with metadata', () => {
    const s = substitution({
      original: { subject: 'MATH', number: '151' },
      replacement: { subject: 'PHYS', number: '201' },
      reason: 'Approved',
      metadata: { approvedBy: 'Dean' },
    });
    expect(s.metadata).toEqual({ approvedBy: 'Dean' });
  });

  test('throws without reason', () => {
    expect(() => substitution({
      original: { subject: 'MATH', number: '151' },
      replacement: { subject: 'PHYS', number: '201' },
    })).toThrow('requires a non-empty reason');
  });

  test('throws without original', () => {
    expect(() => substitution({
      replacement: { subject: 'PHYS', number: '201' },
      reason: 'test',
    })).toThrow('requires original');
  });

  test('throws without replacement', () => {
    expect(() => substitution({
      original: { subject: 'MATH', number: '151' },
      reason: 'test',
    })).toThrow('requires replacement');
  });

  test('throws with null opts', () => {
    expect(() => substitution(null)).toThrow('requires an options object');
  });

  test('is immutable (frozen)', () => {
    const s = substitution({
      original: { subject: 'MATH', number: '151' },
      replacement: { subject: 'PHYS', number: '201' },
      reason: 'test',
    });
    expect(Object.isFrozen(s)).toBe(true);
  });

  test('toJSON serializes correctly', () => {
    const s = substitution({
      original: { subject: 'MATH', number: '151' },
      replacement: { subject: 'PHYS', number: '201' },
      reason: 'Approved',
      metadata: { id: 42 },
    });
    expect(s.toJSON()).toEqual({
      kind: 'substitution',
      original: { subject: 'MATH', number: '151' },
      replacement: { subject: 'PHYS', number: '201' },
      reason: 'Approved',
      metadata: { id: 42 },
    });
  });
});

// ============================================================
// buildExceptionContext
// ============================================================

describe('buildExceptionContext()', () => {
  test('indexes course waivers by courseKey', () => {
    const w = waiver({ course: { subject: 'MATH', number: '151' }, reason: 'AP' });
    const ctx = buildExceptionContext([w]);
    expect(ctx.waivers.courses.get('MATH:151')).toBe(w);
  });

  test('indexes score waivers', () => {
    const w = waiver({ score: 'SAT_MATH', reason: 'test' });
    const ctx = buildExceptionContext([w]);
    expect(ctx.waivers.scores.get('SAT_MATH')).toBe(w);
  });

  test('indexes attainment waivers', () => {
    const w = waiver({ attainment: 'JUNIOR_STANDING', reason: 'test' });
    const ctx = buildExceptionContext([w]);
    expect(ctx.waivers.attainments.get('JUNIOR_STANDING')).toBe(w);
  });

  test('indexes quantity waivers', () => {
    const w = waiver({ quantity: 'CLINICAL_HOURS', reason: 'test' });
    const ctx = buildExceptionContext([w]);
    expect(ctx.waivers.quantities.get('CLINICAL_HOURS')).toBe(w);
  });

  test('indexes label waivers', () => {
    const w = waiver({ label: 'Gen Ed', reason: 'test' });
    const ctx = buildExceptionContext([w]);
    expect(ctx.waivers.labels.get('Gen Ed')).toBe(w);
  });

  test('indexes substitutions by original courseKey', () => {
    const s = substitution({
      original: { subject: 'MATH', number: '151' },
      replacement: { subject: 'PHYS', number: '201' },
      reason: 'test',
    });
    const ctx = buildExceptionContext([s]);
    expect(ctx.substitutions.get('MATH:151')).toBe(s);
  });

  test('first waiver wins for duplicate targets', () => {
    const w1 = waiver({ course: { subject: 'MATH', number: '151' }, reason: 'first' });
    const w2 = waiver({ course: { subject: 'MATH', number: '151' }, reason: 'second' });
    const ctx = buildExceptionContext([w1, w2]);
    expect(ctx.waivers.courses.get('MATH:151').reason).toBe('first');
  });

  test('handles mixed exceptions', () => {
    const w = waiver({ course: { subject: 'MATH', number: '151' }, reason: 'AP' });
    const s = substitution({
      original: { subject: 'ENGL', number: '101' },
      replacement: { subject: 'ENGL', number: '201' },
      reason: 'approved',
    });
    const ctx = buildExceptionContext([w, s]);
    expect(ctx.waivers.courses.size).toBe(1);
    expect(ctx.substitutions.size).toBe(1);
  });

  test('handles empty array', () => {
    const ctx = buildExceptionContext([]);
    expect(ctx.waivers.courses.size).toBe(0);
    expect(ctx.substitutions.size).toBe(0);
  });
});

// ============================================================
// findLeafWaiver
// ============================================================

describe('findLeafWaiver()', () => {
  const courseW = waiver({ course: { subject: 'MATH', number: '151' }, reason: 'AP' });
  const scoreW = waiver({ score: 'SAT_MATH', reason: 'test' });
  const attW = waiver({ attainment: 'JUNIOR', reason: 'test' });
  const quantW = waiver({ quantity: 'HOURS', reason: 'test' });
  const ctx = buildExceptionContext([courseW, scoreW, attW, quantW]);

  test('matches course node', () => {
    expect(findLeafWaiver({ type: 'course', subject: 'MATH', number: '151' }, ctx)).toBe(courseW);
  });

  test('matches score node', () => {
    expect(findLeafWaiver({ type: 'score', name: 'SAT_MATH' }, ctx)).toBe(scoreW);
  });

  test('matches attainment node', () => {
    expect(findLeafWaiver({ type: 'attainment', name: 'JUNIOR' }, ctx)).toBe(attW);
  });

  test('matches quantity node', () => {
    expect(findLeafWaiver({ type: 'quantity', name: 'HOURS' }, ctx)).toBe(quantW);
  });

  test('returns null for non-matching course', () => {
    expect(findLeafWaiver({ type: 'course', subject: 'ENGL', number: '101' }, ctx)).toBeNull();
  });

  test('returns null for composite node', () => {
    expect(findLeafWaiver({ type: 'all-of', items: [] }, ctx)).toBeNull();
  });

  test('returns null when no waivers in ctx', () => {
    expect(findLeafWaiver({ type: 'course', subject: 'MATH', number: '151' }, {})).toBeNull();
  });
});

// ============================================================
// buildWaivedResult
// ============================================================

describe('buildWaivedResult()', () => {
  test('builds waived course result with catalog credits', () => {
    const w = waiver({ course: { subject: 'MATH', number: '151' }, reason: 'AP' });
    const catalogIndex = new Map([['MATH:151', { subject: 'MATH', number: '151', credits: 4 }]]);
    const result = buildWaivedResult(
      { type: 'course', subject: 'MATH', number: '151' }, w, { catalogIndex }
    );
    expect(result.status).toBe(WAIVED);
    expect(result.subject).toBe('MATH');
    expect(result.number).toBe('151');
    expect(result.waivedCredits).toBe(4);
    expect(result.waiver.kind).toBe('waiver');
  });

  test('builds waived score result', () => {
    const w = waiver({ score: 'SAT_MATH', reason: 'alt' });
    const result = buildWaivedResult(
      { type: 'score', name: 'SAT_MATH', op: 'gte', value: 600 }, w, {}
    );
    expect(result.status).toBe(WAIVED);
    expect(result.name).toBe('SAT_MATH');
    expect(result.op).toBe('gte');
    expect(result.value).toBe(600);
  });

  test('builds waived attainment result', () => {
    const w = waiver({ attainment: 'JUNIOR', reason: 'override' });
    const result = buildWaivedResult({ type: 'attainment', name: 'JUNIOR' }, w, {});
    expect(result.status).toBe(WAIVED);
    expect(result.name).toBe('JUNIOR');
  });

  test('builds waived quantity result', () => {
    const w = waiver({ quantity: 'HOURS', reason: 'prior exp' });
    const result = buildWaivedResult(
      { type: 'quantity', name: 'HOURS', op: 'gte', value: 100 }, w, {}
    );
    expect(result.status).toBe(WAIVED);
    expect(result.name).toBe('HOURS');
  });
});

// ============================================================
// resolveWaivedCredits
// ============================================================

describe('resolveWaivedCredits()', () => {
  test('sums credits from course nodes in subtree', () => {
    const node = {
      type: 'all-of', items: [
        { type: 'course', subject: 'MATH', number: '151' },
        { type: 'course', subject: 'MATH', number: '152' },
      ],
    };
    const catalogIndex = new Map([
      ['MATH:151', { subject: 'MATH', number: '151', credits: 4 }],
      ['MATH:152', { subject: 'MATH', number: '152', credits: 3 }],
    ]);
    expect(resolveWaivedCredits(node, { catalogIndex })).toBe(7);
  });

  test('returns 0 when no catalog index', () => {
    const node = { type: 'course', subject: 'MATH', number: '151' };
    expect(resolveWaivedCredits(node, {})).toBe(0);
  });
});

// ============================================================
// applySubstitutions
// ============================================================

describe('applySubstitutions()', () => {
  test('creates virtual entry when replacement exists on transcript', () => {
    const normTranscript = {
      byKey: new Map([
        ['PHYS:201', { subject: 'PHYS', number: '201', grade: 'B+', credits: 4, status: 'completed' }],
      ]),
      courses: [{ subject: 'PHYS', number: '201', grade: 'B+', credits: 4, status: 'completed' }],
    };
    const sub = substitution({
      original: { subject: 'MATH', number: '151' },
      replacement: { subject: 'PHYS', number: '201' },
      reason: 'approved',
    });
    const subs = new Map([['MATH:151', sub]]);

    applySubstitutions(normTranscript, subs);

    const virtual = normTranscript.byKey.get('MATH:151');
    expect(virtual).toBeDefined();
    expect(virtual.subject).toBe('MATH');
    expect(virtual.number).toBe('151');
    expect(virtual.grade).toBe('B+');
    expect(virtual.credits).toBe(4);
    expect(virtual._substitution).toBe(sub);
    expect(virtual._replacedBy).toEqual({ subject: 'PHYS', number: '201' });
  });

  test('does not create virtual entry when replacement not on transcript', () => {
    const normTranscript = {
      byKey: new Map(),
      courses: [],
    };
    const sub = substitution({
      original: { subject: 'MATH', number: '151' },
      replacement: { subject: 'PHYS', number: '201' },
      reason: 'approved',
    });
    const subs = new Map([['MATH:151', sub]]);

    applySubstitutions(normTranscript, subs);
    expect(normTranscript.byKey.has('MATH:151')).toBe(false);
  });

  test('does not override existing original on transcript', () => {
    const normTranscript = {
      byKey: new Map([
        ['MATH:151', { subject: 'MATH', number: '151', grade: 'A', credits: 4, status: 'completed' }],
        ['PHYS:201', { subject: 'PHYS', number: '201', grade: 'B', credits: 4, status: 'completed' }],
      ]),
      courses: [],
    };
    const sub = substitution({
      original: { subject: 'MATH', number: '151' },
      replacement: { subject: 'PHYS', number: '201' },
      reason: 'approved',
    });
    const subs = new Map([['MATH:151', sub]]);

    applySubstitutions(normTranscript, subs);
    // Original entry should remain unchanged
    expect(normTranscript.byKey.get('MATH:151').grade).toBe('A');
    expect(normTranscript.byKey.get('MATH:151')._substitution).toBeUndefined();
  });
});

// ============================================================
// Status integration — countStatuses / buildSummary with new statuses
// ============================================================

describe('status functions with WAIVED/SUBSTITUTED', () => {
  const {
    MET, PROVISIONAL_MET, IN_PROGRESS, NOT_MET, WAIVED, SUBSTITUTED,
    allOf, anyOf, nOf, buildSummary,
  } = require('../../src/audit/status');

  test('countStatuses treats WAIVED as met-equivalent', () => {
    expect(allOf([WAIVED, MET, MET])).toBe(MET);
  });

  test('countStatuses treats SUBSTITUTED as met-equivalent', () => {
    expect(allOf([SUBSTITUTED, MET, MET])).toBe(MET);
  });

  test('allOf with mix of met/waived/substituted → met', () => {
    expect(allOf([MET, WAIVED, SUBSTITUTED])).toBe(MET);
  });

  test('allOf with waived + not-met → partial-progress', () => {
    expect(allOf([WAIVED, NOT_MET])).toBe(IN_PROGRESS);
  });

  test('anyOf with waived → met', () => {
    expect(anyOf([NOT_MET, WAIVED])).toBe(MET);
  });

  test('nOf at-least with waived counts toward threshold', () => {
    expect(nOf([WAIVED, SUBSTITUTED, NOT_MET], 'at-least', 2)).toBe(MET);
  });

  test('buildSummary reports waived and substituted separately', () => {
    const summary = buildSummary([MET, WAIVED, SUBSTITUTED, PROVISIONAL_MET, NOT_MET]);
    expect(summary).toEqual({
      met: 1,
      waived: 1,
      substituted: 1,
      provisionalMet: 1,
      inProgress: 0,
      notMet: 1,
      total: 5,
    });
  });

  test('buildSummary with only waived', () => {
    const summary = buildSummary([WAIVED, WAIVED]);
    expect(summary.waived).toBe(2);
    expect(summary.met).toBe(0);
    expect(summary.total).toBe(2);
  });
});

// ============================================================
// findUnmet skips waived/substituted
// ============================================================

describe('findUnmet with WAIVED/SUBSTITUTED', () => {
  const { findUnmet } = require('../../src/audit/find-unmet');

  test('skips waived nodes', () => {
    const result = {
      type: 'all-of', status: 'partial-progress',
      items: [
        { type: 'course', subject: 'MATH', number: '151', status: 'waived' },
        { type: 'course', subject: 'MATH', number: '152', status: 'not-met' },
      ],
    };
    const unmet = findUnmet(result);
    expect(unmet).toHaveLength(1);
    expect(unmet[0].node.subject).toBe('MATH');
    expect(unmet[0].node.number).toBe('152');
  });

  test('skips substituted nodes', () => {
    const result = {
      type: 'all-of', status: 'partial-progress',
      items: [
        { type: 'course', subject: 'MATH', number: '151', status: 'substituted' },
        { type: 'course', subject: 'ENGL', number: '101', status: 'not-met' },
      ],
    };
    const unmet = findUnmet(result);
    expect(unmet).toHaveLength(1);
    expect(unmet[0].node.subject).toBe('ENGL');
  });
});
