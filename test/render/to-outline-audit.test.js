'use strict';

const { toOutline } = require('../../src/render/to-outline');

const catalog = {
  courses: [
    { subject: 'MATH', number: '151', title: 'Calculus I' },
    { subject: 'MATH', number: '152', title: 'Calculus II' },
    { subject: 'MATH', number: '253', title: 'Calculus III' },
    { subject: 'CMPS', number: '130', title: 'Intro to CS' },
    { subject: 'CMPS', number: '135', title: 'Intro to CS for Engineers' },
    { subject: 'CMPS', number: '230', title: 'Data Structures' },
    { subject: 'ENGL', number: '201', title: 'College Writing' },
  ],
};

// === Status Icons ===

describe('toOutline audit — status icons', () => {
  test('met course shows ✓', () => {
    const ast = { type: 'course', subject: 'MATH', number: '151' };
    const auditNode = { type: 'course', status: 'met', satisfiedBy: { grade: 'A', term: 'Fall 2023' } };
    const result = toOutline(ast, catalog, auditNode);
    expect(result).toBe('\u2713 MATH 151 - Calculus I  [A, Fall 2023]');
  });

  test('not-met course shows ✗', () => {
    const ast = { type: 'course', subject: 'MATH', number: '253' };
    const auditNode = { type: 'course', status: 'not-met' };
    const result = toOutline(ast, catalog, auditNode);
    expect(result).toBe('\u2717 MATH 253 - Calculus III');
  });

  test('provisional-met course shows ◕', () => {
    const ast = { type: 'course', subject: 'MATH', number: '152' };
    const auditNode = { type: 'course', status: 'provisional-met' };
    const result = toOutline(ast, catalog, auditNode);
    expect(result).toBe('\u25D5 MATH 152 - Calculus II');
  });

  test('waived shows ⊘', () => {
    const ast = { type: 'course', subject: 'MATH', number: '151' };
    const auditNode = { type: 'course', status: 'waived' };
    const result = toOutline(ast, catalog, auditNode);
    expect(result).toBe('\u2298 MATH 151 - Calculus I');
  });

  test('substituted shows ⇄', () => {
    const ast = { type: 'course', subject: 'MATH', number: '151' };
    const auditNode = { type: 'course', status: 'substituted' };
    const result = toOutline(ast, catalog, auditNode);
    expect(result).toBe('\u21C4 MATH 151 - Calculus I');
  });

  test('in-progress shows ◔', () => {
    const ast = { type: 'course', subject: 'MATH', number: '151' };
    const auditNode = { type: 'course', status: 'in-progress' };
    const result = toOutline(ast, catalog, auditNode);
    expect(result).toBe('\u25D4 MATH 151 - Calculus I');
  });
});

// === Matched Course Info ===

describe('toOutline audit — matched course info', () => {
  test('grade and term inline', () => {
    const ast = { type: 'course', subject: 'MATH', number: '151' };
    const auditNode = { type: 'course', status: 'met', satisfiedBy: { grade: 'B+', term: 'Spring 2024' } };
    const result = toOutline(ast, catalog, auditNode);
    expect(result).toContain('[B+, Spring 2024]');
  });

  test('grade only', () => {
    const ast = { type: 'course', subject: 'MATH', number: '151' };
    const auditNode = { type: 'course', status: 'met', satisfiedBy: { grade: 'A' } };
    const result = toOutline(ast, catalog, auditNode);
    expect(result).toContain('[A]');
  });

  test('no satisfiedBy — no brackets', () => {
    const ast = { type: 'course', subject: 'MATH', number: '151' };
    const auditNode = { type: 'course', status: 'not-met' };
    const result = toOutline(ast, catalog, auditNode);
    expect(result).not.toContain('[');
  });
});

// === Composite with Summary ===

describe('toOutline audit — composite summary', () => {
  test('all-of with summary count', () => {
    const ast = {
      type: 'all-of',
      items: [
        { type: 'course', subject: 'MATH', number: '151' },
        { type: 'course', subject: 'MATH', number: '152' },
        { type: 'course', subject: 'MATH', number: '253' },
      ],
    };
    const auditNode = {
      type: 'all-of', status: 'not-met',
      summary: { met: 2, waived: 0, substituted: 0, provisionalMet: 0, inProgress: 0, notMet: 1, total: 3 },
      items: [
        { type: 'course', status: 'met', satisfiedBy: { grade: 'A', term: 'Fall 2023' } },
        { type: 'course', status: 'met', satisfiedBy: { grade: 'B+', term: 'Spring 2024' } },
        { type: 'course', status: 'not-met' },
      ],
    };
    const result = toOutline(ast, catalog, auditNode);
    expect(result).toContain('\u2717 All of the following: (2/3 met)');
    expect(result).toContain('\u251C\u2500\u2500 \u2713 MATH 151 - Calculus I  [A, Fall 2023]');
    expect(result).toContain('\u251C\u2500\u2500 \u2713 MATH 152 - Calculus II  [B+, Spring 2024]');
    expect(result).toContain('\u2514\u2500\u2500 \u2717 MATH 253 - Calculus III');
  });

  test('labeled all-of with summary', () => {
    const ast = {
      type: 'all-of',
      label: 'Math Core',
      items: [
        { type: 'course', subject: 'MATH', number: '151' },
        { type: 'course', subject: 'MATH', number: '152' },
      ],
    };
    const auditNode = {
      type: 'all-of', status: 'met',
      summary: { met: 2, waived: 0, substituted: 0, provisionalMet: 0, inProgress: 0, notMet: 0, total: 2 },
      items: [
        { type: 'course', status: 'met', satisfiedBy: { grade: 'A', term: 'Fall 2023' } },
        { type: 'course', status: 'met', satisfiedBy: { grade: 'B', term: 'Spring 2024' } },
      ],
    };
    const result = toOutline(ast, catalog, auditNode);
    expect(result).toContain('\u2713 Math Core \u2014 All of the following: (2/2 met)');
  });

  test('waived children count toward met in summary', () => {
    const ast = {
      type: 'all-of',
      items: [
        { type: 'course', subject: 'MATH', number: '151' },
        { type: 'course', subject: 'MATH', number: '152' },
      ],
    };
    const auditNode = {
      type: 'all-of', status: 'met',
      summary: { met: 1, waived: 1, substituted: 0, provisionalMet: 0, inProgress: 0, notMet: 0, total: 2 },
      items: [
        { type: 'course', status: 'met', satisfiedBy: { grade: 'A' } },
        { type: 'course', status: 'waived' },
      ],
    };
    const result = toOutline(ast, catalog, auditNode);
    expect(result).toContain('(2/2 met)');
  });
});

// === Transparent Wrappers ===

describe('toOutline audit — transparent wrappers', () => {
  test('variable-def passes audit through to value', () => {
    const ast = {
      type: 'variable-def', name: 'core',
      value: { type: 'course', subject: 'MATH', number: '151' },
    };
    const auditNode = { type: 'course', status: 'met', satisfiedBy: { grade: 'A' } };
    const result = toOutline(ast, catalog, auditNode);
    expect(result).toBe('\u2713 MATH 151 - Calculus I  [A]');
  });

  test('scope passes audit through to body', () => {
    const ast = {
      type: 'scope', name: 'test',
      body: { type: 'course', subject: 'MATH', number: '151' },
      defs: [],
    };
    const auditNode = { type: 'course', status: 'met', satisfiedBy: { grade: 'B+' } };
    const result = toOutline(ast, catalog, auditNode);
    expect(result).toBe('\u2713 MATH 151 - Calculus I  [B+]');
  });
});

// === Variable-Ref Resolved ===

describe('toOutline audit — variable-ref resolved', () => {
  test('resolved variable shows underlying content', () => {
    const ast = { type: 'variable-ref', name: 'core' };
    const auditNode = {
      type: 'variable-ref', name: 'core', status: 'not-met',
      resolved: {
        type: 'all-of', status: 'not-met',
        summary: { met: 1, waived: 0, substituted: 0, provisionalMet: 0, inProgress: 0, notMet: 1, total: 2 },
        items: [
          { type: 'course', status: 'met', satisfiedBy: { grade: 'A' } },
          { type: 'course', status: 'not-met' },
        ],
      },
    };
    // We need AST-level items for the resolved content — but since
    // renderTreeWithAudit uses the audit node as both AST and audit
    // when rendering resolved content, the audit items serve as AST
    const result = toOutline(ast, null, auditNode);
    expect(result).toContain('\u2717 All of the following:');
    expect(result).not.toContain('$core');
  });

  test('unresolved variable-ref shows $name', () => {
    const ast = { type: 'variable-ref', name: 'missing' };
    const auditNode = { type: 'variable-ref', name: 'missing', status: 'not-met' };
    const result = toOutline(ast, null, auditNode);
    expect(result).toBe('\u2717 $missing');
  });
});

// === Program-Ref Sub-Audit ===

describe('toOutline audit — program-ref', () => {
  test('met program-ref with sub-result renders as composite', () => {
    const ast = { type: 'program-ref', code: 'MATH-MINOR' };
    const auditNode = {
      type: 'program-ref', code: 'MATH-MINOR', status: 'met',
      result: {
        type: 'all-of', status: 'met',
        summary: { met: 2, waived: 0, substituted: 0, provisionalMet: 0, inProgress: 0, notMet: 0, total: 2 },
        items: [
          { type: 'course', subject: 'MATH', number: '151', status: 'met', satisfiedBy: { grade: 'A', term: 'Fall 2023' } },
          { type: 'course', subject: 'MATH', number: '152', status: 'met', satisfiedBy: { grade: 'B+', term: 'Spring 2024' } },
        ],
      },
    };
    const result = toOutline(ast, catalog, auditNode);
    expect(result).toContain('\u2713 Program: "MATH-MINOR" (2/2 met)');
    expect(result).toContain('MATH 151 - Calculus I');
    expect(result).toContain('MATH 152 - Calculus II');
  });

  test('not-declared program-ref shows (not declared)', () => {
    const ast = { type: 'program-ref', code: 'MATH-MINOR' };
    const auditNode = { type: 'program-ref', code: 'MATH-MINOR', status: 'not-met', notDeclared: true };
    const result = toOutline(ast, catalog, auditNode);
    expect(result).toBe('\u2717 Program: "MATH-MINOR" (not declared)');
  });

  test('program-ref without result or notDeclared', () => {
    const ast = { type: 'program-ref', code: 'MATH-MINOR' };
    const auditNode = { type: 'program-ref', code: 'MATH-MINOR', status: 'not-met' };
    const result = toOutline(ast, catalog, auditNode);
    expect(result).toBe('\u2717 Program: "MATH-MINOR"');
  });
});

// === Program-Filter with Items ===

describe('toOutline audit — program-filter', () => {
  test('program-filter with evaluated items', () => {
    const ast = {
      type: 'program-filter', quantifier: 'any',
      filters: [{ field: 'type', op: 'eq', value: 'minor' }],
    };
    const auditNode = {
      type: 'program-filter', quantifier: 'any', status: 'met',
      summary: { met: 1, waived: 0, substituted: 0, provisionalMet: 0, inProgress: 0, notMet: 0, total: 1 },
      items: [
        {
          type: 'program-ref', code: 'MATH-MINOR', status: 'met',
          result: {
            type: 'all-of', status: 'met',
            summary: { met: 1, waived: 0, substituted: 0, provisionalMet: 0, inProgress: 0, notMet: 0, total: 1 },
            items: [
              { type: 'course', subject: 'MATH', number: '151', status: 'met', satisfiedBy: { grade: 'A' } },
            ],
          },
        },
      ],
    };
    const result = toOutline(ast, catalog, auditNode);
    expect(result).toContain('\u2713 Any program where type is "minor" (1/1 met)');
    expect(result).toContain('\u2713 Program: "MATH-MINOR"');
    expect(result).toContain('MATH 151');
  });

  test('program-filter with no items renders as leaf', () => {
    const ast = {
      type: 'program-filter', quantifier: 'any',
      filters: [{ field: 'type', op: 'eq', value: 'minor' }],
    };
    const auditNode = { type: 'program-filter', status: 'not-met', items: [] };
    const result = toOutline(ast, null, auditNode);
    expect(result).toContain('\u2717');
  });
});

// === With-Constraint ===

describe('toOutline audit — with-constraint', () => {
  test('grade constraint on leaf course', () => {
    const ast = {
      type: 'with-constraint',
      constraint: { kind: 'min-grade', value: 'C' },
      requirement: { type: 'course', subject: 'MATH', number: '151' },
    };
    const auditNode = {
      type: 'with-constraint', status: 'met',
      requirement: {
        type: 'course', status: 'met',
        satisfiedBy: { grade: 'A', term: 'Fall 2023' },
      },
    };
    const result = toOutline(ast, catalog, auditNode);
    expect(result).toBe('\u2713 MATH 151 - Calculus I  [A, Fall 2023] (min grade: C)');
  });

  test('gpa constraint on composite', () => {
    const ast = {
      type: 'with-constraint',
      constraint: { kind: 'min-gpa', value: 2.0 },
      requirement: {
        type: 'all-of',
        items: [
          { type: 'course', subject: 'MATH', number: '151' },
          { type: 'course', subject: 'MATH', number: '152' },
        ],
      },
    };
    const auditNode = {
      type: 'with-constraint', status: 'met',
      requirement: {
        type: 'all-of', status: 'met',
        summary: { met: 2, waived: 0, substituted: 0, provisionalMet: 0, inProgress: 0, notMet: 0, total: 2 },
        items: [
          { type: 'course', status: 'met', satisfiedBy: { grade: 'A' } },
          { type: 'course', status: 'met', satisfiedBy: { grade: 'B' } },
        ],
      },
    };
    const result = toOutline(ast, catalog, auditNode);
    expect(result).toContain('All of the following: (2/2 met) (min GPA: 2)');
    expect(result).toContain('\u2713 MATH 151');
  });
});

// === Except ===

describe('toOutline audit — except', () => {
  test('except with leaf source', () => {
    const ast = {
      type: 'except',
      source: { type: 'course-filter', filters: [{ field: 'subject', op: 'eq', value: 'CMPS' }] },
      exclude: [{ type: 'course', subject: 'CMPS', number: '230' }],
    };
    const auditNode = {
      type: 'except', status: 'met',
      source: { type: 'course-filter', status: 'met' },
      exclude: [{ type: 'course', status: 'not-met' }],
    };
    const result = toOutline(ast, catalog, auditNode);
    expect(result).toContain('\u2713 Any course where subject is "CMPS", except:');
    expect(result).toContain('\u2717 CMPS 230');
  });

  test('except with composite source', () => {
    const ast = {
      type: 'except',
      source: {
        type: 'all-of',
        items: [
          { type: 'course', subject: 'MATH', number: '151' },
          { type: 'course', subject: 'MATH', number: '152' },
        ],
      },
      exclude: [{ type: 'course', subject: 'MATH', number: '152' }],
    };
    const auditNode = {
      type: 'except', status: 'met',
      source: {
        type: 'all-of', status: 'met',
        items: [
          { type: 'course', status: 'met', satisfiedBy: { grade: 'A' } },
          { type: 'course', status: 'met', satisfiedBy: { grade: 'B' } },
        ],
      },
      exclude: [{ type: 'course', status: 'met', satisfiedBy: { grade: 'B' } }],
    };
    const result = toOutline(ast, catalog, auditNode);
    expect(result).toContain('Source:');
    expect(result).toContain('Except:');
    expect(result).toContain('\u2713 MATH 151');
    expect(result).toContain('\u2713 MATH 152');
  });
});

// === Credits-From ===

describe('toOutline audit — credits-from', () => {
  test('credits-from with source items', () => {
    const ast = {
      type: 'credits-from', credits: 6, comparison: 'at-least',
      source: {
        type: 'all-of',
        items: [
          { type: 'course', subject: 'MATH', number: '151' },
          { type: 'course', subject: 'MATH', number: '152' },
        ],
      },
    };
    const auditNode = {
      type: 'credits-from', status: 'met',
      source: {
        type: 'all-of', status: 'met',
        items: [
          { type: 'course', status: 'met', satisfiedBy: { grade: 'A' } },
          { type: 'course', status: 'met', satisfiedBy: { grade: 'B' } },
        ],
      },
    };
    const result = toOutline(ast, catalog, auditNode);
    expect(result).toContain('\u2713 Complete at least 6 credits from:');
    expect(result).toContain('\u2713 MATH 151');
    expect(result).toContain('\u2713 MATH 152');
  });

  test('credits-from with single source', () => {
    const ast = {
      type: 'credits-from', credits: 15, comparison: 'at-least',
      source: { type: 'course-filter', filters: [{ field: 'subject', op: 'eq', value: 'CSE' }] },
    };
    const auditNode = {
      type: 'credits-from', status: 'not-met',
      source: { type: 'course-filter', status: 'not-met' },
    };
    const result = toOutline(ast, catalog, auditNode);
    expect(result).toContain('\u2717 Complete at least 15 credits from:');
    expect(result).toContain('\u2717 Any course where subject is "CSE"');
  });
});

// === Annotations ===

describe('toOutline audit — annotations', () => {
  test('course with annotation', () => {
    const ast = { type: 'course', subject: 'MATH', number: '151' };
    const auditNode = { type: 'course', status: 'met', satisfiedBy: { grade: 'A' } };
    const annotations = new Map([['MATH:151', ['shared']]]);
    const result = toOutline(ast, catalog, auditNode, { annotations });
    expect(result).toBe('\u2713 MATH 151 - Calculus I  [A] (shared)');
  });

  test('course without annotation entry', () => {
    const ast = { type: 'course', subject: 'MATH', number: '151' };
    const auditNode = { type: 'course', status: 'met', satisfiedBy: { grade: 'A' } };
    const annotations = new Map();
    const result = toOutline(ast, catalog, auditNode, { annotations });
    expect(result).not.toContain('(shared)');
  });

  test('multiple annotations joined', () => {
    const ast = { type: 'course', subject: 'MATH', number: '151' };
    const auditNode = { type: 'course', status: 'met', satisfiedBy: { grade: 'A' } };
    const annotations = new Map([['MATH:151', ['shared', 'gen-ed']]]);
    const result = toOutline(ast, catalog, auditNode, { annotations });
    expect(result).toContain('(shared, gen-ed)');
  });
});

// === No Audit Result — No Regression ===

describe('toOutline audit — no regression without audit', () => {
  test('toOutline(ast, catalog) unchanged', () => {
    const ast = {
      type: 'all-of',
      items: [
        { type: 'course', subject: 'MATH', number: '151' },
        { type: 'course', subject: 'MATH', number: '152' },
      ],
    };
    const result = toOutline(ast, catalog);
    expect(result).toBe(
      'All of the following:\n\u251C\u2500\u2500 MATH 151 - Calculus I\n\u2514\u2500\u2500 MATH 152 - Calculus II'
    );
  });

  test('toOutline(ast) with no catalog', () => {
    const ast = { type: 'course', subject: 'MATH', number: '151' };
    const result = toOutline(ast);
    expect(result).toBe('MATH 151');
  });
});

// === Nested Composites ===

describe('toOutline audit — nested composites', () => {
  test('all-of with nested any-of and correct indentation', () => {
    const ast = {
      type: 'all-of',
      items: [
        { type: 'course', subject: 'MATH', number: '151' },
        {
          type: 'any-of',
          items: [
            { type: 'course', subject: 'CMPS', number: '130' },
            { type: 'course', subject: 'CMPS', number: '135' },
          ],
        },
      ],
    };
    const auditNode = {
      type: 'all-of', status: 'met',
      summary: { met: 2, waived: 0, substituted: 0, provisionalMet: 0, inProgress: 0, notMet: 0, total: 2 },
      items: [
        { type: 'course', status: 'met', satisfiedBy: { grade: 'A' } },
        {
          type: 'any-of', status: 'met',
          summary: { met: 1, waived: 0, substituted: 0, provisionalMet: 0, inProgress: 0, notMet: 1, total: 2 },
          items: [
            { type: 'course', status: 'met', satisfiedBy: { grade: 'B+' } },
            { type: 'course', status: 'not-met' },
          ],
        },
      ],
    };
    const result = toOutline(ast, catalog, auditNode);
    const lines = result.split('\n');
    expect(lines).toHaveLength(5);
    expect(lines[0]).toBe('\u2713 All of the following: (2/2 met)');
    expect(lines[1]).toBe('\u251C\u2500\u2500 \u2713 MATH 151 - Calculus I  [A]');
    expect(lines[2]).toBe('\u2514\u2500\u2500 \u2713 Any one of the following: (1/2 met)');
    expect(lines[3]).toBe('    \u251C\u2500\u2500 \u2713 CMPS 130 - Intro to CS  [B+]');
    expect(lines[4]).toBe('    \u2514\u2500\u2500 \u2717 CMPS 135 - Intro to CS for Engineers');
  });
});

// === Other Leaf Types ===

describe('toOutline audit — other leaf types', () => {
  test('score with actual value', () => {
    const ast = { type: 'score', name: 'SAT_MATH', op: 'gte', value: 580 };
    const auditNode = { type: 'score', status: 'met', actual: 650 };
    const result = toOutline(ast, null, auditNode);
    expect(result).toBe('\u2713 Score SAT_MATH is at least 580 (actual: 650)');
  });

  test('attainment with status', () => {
    const ast = { type: 'attainment', name: 'JUNIOR_STANDING' };
    const auditNode = { type: 'attainment', status: 'not-met' };
    const result = toOutline(ast, null, auditNode);
    expect(result).toBe('\u2717 Attainment: JUNIOR_STANDING');
  });

  test('quantity with status', () => {
    const ast = { type: 'quantity', name: 'CLINICAL_HOURS', op: 'gte', value: 500 };
    const auditNode = { type: 'quantity', status: 'met' };
    const result = toOutline(ast, null, auditNode);
    expect(result).toBe('\u2713 Quantity: CLINICAL_HOURS is at least 500');
  });

  test('program with status', () => {
    const ast = { type: 'program', code: 'CS', 'program-type': 'major', level: 'undergraduate' };
    const auditNode = { type: 'program', status: 'met' };
    const result = toOutline(ast, null, auditNode);
    expect(result).toBe('\u2713 Program CS (major, undergraduate)');
  });

  test('program-context-ref with status', () => {
    const ast = { type: 'program-context-ref', role: 'primary-major' };
    const auditNode = { type: 'program-context-ref', status: 'met' };
    const result = toOutline(ast, null, auditNode);
    expect(result).toBe('\u2713 primary major');
  });

  test('course-filter with status', () => {
    const ast = { type: 'course-filter', filters: [{ field: 'subject', op: 'eq', value: 'CMPS' }] };
    const auditNode = { type: 'course-filter', status: 'met' };
    const result = toOutline(ast, null, auditNode);
    expect(result).toBe('\u2713 Any course where subject is "CMPS"');
  });
});

// === AuditResult Entity Method ===

describe('AuditResult.toOutline()', () => {
  test('entity method end-to-end', () => {
    // Use the entity API to verify it wires through correctly
    const { AuditResult } = require('../../src/entities');

    const ast = {
      type: 'all-of',
      items: [
        { type: 'course', subject: 'MATH', number: '151' },
        { type: 'course', subject: 'MATH', number: '152' },
      ],
    };
    const raw = {
      status: 'not-met',
      warnings: [],
      result: {
        type: 'all-of', status: 'not-met',
        summary: { met: 1, waived: 0, substituted: 0, provisionalMet: 0, inProgress: 0, notMet: 1, total: 2 },
        items: [
          { type: 'course', status: 'met', satisfiedBy: { grade: 'A', term: 'Fall 2023' } },
          { type: 'course', status: 'not-met' },
        ],
      },
    };

    const auditResult = new AuditResult(raw, ast);
    const result = auditResult.toOutline(catalog);
    expect(result).toContain('\u2717 All of the following: (1/2 met)');
    expect(result).toContain('\u2713 MATH 151 - Calculus I  [A, Fall 2023]');
    expect(result).toContain('\u2717 MATH 152 - Calculus II');
  });

  test('entity method with annotations', () => {
    const { AuditResult } = require('../../src/entities');

    const ast = { type: 'course', subject: 'MATH', number: '151' };
    const raw = {
      status: 'met', warnings: [],
      result: { type: 'course', status: 'met', satisfiedBy: { grade: 'A' } },
    };

    const auditResult = new AuditResult(raw, ast);
    const annotations = new Map([['MATH:151', ['shared']]]);
    const result = auditResult.toOutline(catalog, { annotations });
    expect(result).toContain('(shared)');
  });
});
