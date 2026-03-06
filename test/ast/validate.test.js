'use strict';

const { validate } = require('../../src/ast/validate');
const { parse } = require('../../src/parser');

// Helper: make a valid course node
function course(subject, number) {
  return { type: 'course', subject, number };
}

describe('validate()', () => {

  describe('smoke test', () => {
    test('valid course node returns { valid: true }', () => {
      const result = validate(course('MATH', '151'));
      expect(result).toEqual({ valid: true });
    });

    test('parser output validates', () => {
      const ast = parse('MATH 151');
      const result = validate(ast);
      expect(result).toEqual({ valid: true });
    });
  });

  // --- Rules 1–4: Basic Structural Integrity ---

  describe('Rule 1: type property required', () => {
    test('missing type property', () => {
      const result = validate({ subject: 'MATH', number: '151' });
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual([
        { rule: 1, message: expect.stringContaining('type'), path: '(root)' }
      ]);
    });

    test('empty string type', () => {
      const result = validate({ type: '', subject: 'MATH', number: '151' });
      expect(result.valid).toBe(false);
      expect(result.errors[0].rule).toBe(1);
    });

    test('non-string type (number)', () => {
      const result = validate({ type: 42 });
      expect(result.valid).toBe(false);
      expect(result.errors[0].rule).toBe(1);
    });

    test('nested node missing type', () => {
      const result = validate({
        type: 'all-of',
        items: [
          course('MATH', '151'),
          { subject: 'CMPS', number: '147' } // missing type
        ]
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual([
        { rule: 1, message: expect.stringContaining('type'), path: 'items[1]' }
      ]);
    });
  });

  describe('Rule 2: non-empty items', () => {
    test('all-of with empty items', () => {
      const result = validate({ type: 'all-of', items: [] });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toEqual({
        rule: 2, message: expect.stringContaining('all-of'), path: '(root)'
      });
    });

    test('any-of with empty items', () => {
      const result = validate({ type: 'any-of', items: [] });
      expect(result.valid).toBe(false);
      expect(result.errors[0].rule).toBe(2);
    });

    test('none-of with empty items', () => {
      const result = validate({ type: 'none-of', items: [] });
      expect(result.valid).toBe(false);
      expect(result.errors[0].rule).toBe(2);
    });

    test('n-of with empty items', () => {
      const result = validate({ type: 'n-of', comparison: 'at-least', count: 2, items: [] });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.rule === 2)).toBe(true);
    });

    test('one-from-each with empty items', () => {
      const result = validate({ type: 'one-from-each', items: [] });
      expect(result.valid).toBe(false);
      expect(result.errors[0].rule).toBe(2);
    });

    test('from-n-groups with empty items', () => {
      const result = validate({ type: 'from-n-groups', count: 2, items: [] });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.rule === 2)).toBe(true);
    });

    test('all-of with missing items property', () => {
      const result = validate({ type: 'all-of' });
      expect(result.valid).toBe(false);
      expect(result.errors[0].rule).toBe(2);
    });

    test('all-of with non-empty items is valid', () => {
      const result = validate({
        type: 'all-of',
        items: [course('MATH', '151')]
      });
      expect(result).toEqual({ valid: true });
    });

    test('nested empty items reports correct path', () => {
      const result = validate({
        type: 'all-of',
        items: [
          course('MATH', '151'),
          { type: 'any-of', items: [] }
        ]
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toEqual({
        rule: 2, message: expect.stringContaining('any-of'), path: 'items[1]'
      });
    });
  });

  describe('Rule 3: count bounds', () => {
    test('n-of with count 0', () => {
      const result = validate({
        type: 'n-of', comparison: 'at-least', count: 0,
        items: [course('MATH', '151')]
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0].rule).toBe(3);
    });

    test('n-of with negative count', () => {
      const result = validate({
        type: 'n-of', comparison: 'at-least', count: -1,
        items: [course('MATH', '151')]
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0].rule).toBe(3);
    });

    test('n-of with non-integer count', () => {
      const result = validate({
        type: 'n-of', comparison: 'at-least', count: 2.5,
        items: [course('MATH', '151'), course('MATH', '152'), course('MATH', '153')]
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0].rule).toBe(3);
    });

    test('at-least count > items.length is allowed (filters may expand)', () => {
      const result = validate({
        type: 'n-of', comparison: 'at-least', count: 5,
        items: [course('MATH', '151'), course('MATH', '152')]
      });
      expect(result).toEqual({ valid: true });
    });

    test('at-most count > items.length is error', () => {
      const result = validate({
        type: 'n-of', comparison: 'at-most', count: 5,
        items: [course('MATH', '151'), course('MATH', '152')]
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0].rule).toBe(3);
      expect(result.errors[0].message).toContain('at-most');
    });

    test('exactly count > items.length is error', () => {
      const result = validate({
        type: 'n-of', comparison: 'exactly', count: 5,
        items: [course('MATH', '151'), course('MATH', '152')]
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0].rule).toBe(3);
      expect(result.errors[0].message).toContain('exactly');
    });

    test('exactly count == items.length is valid', () => {
      const result = validate({
        type: 'n-of', comparison: 'exactly', count: 2,
        items: [course('MATH', '151'), course('MATH', '152')]
      });
      expect(result).toEqual({ valid: true });
    });

    test('at-most count == items.length is valid', () => {
      const result = validate({
        type: 'n-of', comparison: 'at-most', count: 2,
        items: [course('MATH', '151'), course('MATH', '152')]
      });
      expect(result).toEqual({ valid: true });
    });

    test('from-n-groups with count 0', () => {
      const result = validate({
        type: 'from-n-groups', count: 0,
        items: [course('MATH', '151')]
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0].rule).toBe(3);
    });

    test('valid n-of at-least', () => {
      const result = validate({
        type: 'n-of', comparison: 'at-least', count: 2,
        items: [course('MATH', '151'), course('MATH', '152'), course('MATH', '153')]
      });
      expect(result).toEqual({ valid: true });
    });
  });

  describe('Rule 4: credits-from positive', () => {
    test('credits-from with credits 0', () => {
      const result = validate({
        type: 'credits-from', comparison: 'at-least', credits: 0,
        source: course('MATH', '151')
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0].rule).toBe(4);
    });

    test('credits-from with negative credits', () => {
      const result = validate({
        type: 'credits-from', comparison: 'at-least', credits: -5,
        source: course('MATH', '151')
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0].rule).toBe(4);
    });

    test('credits-from with non-number credits', () => {
      const result = validate({
        type: 'credits-from', comparison: 'at-least', credits: 'twelve',
        source: course('MATH', '151')
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0].rule).toBe(4);
    });

    test('credits-from with positive credits is valid', () => {
      const result = validate({
        type: 'credits-from', comparison: 'at-least', credits: 12,
        source: course('MATH', '151')
      });
      expect(result).toEqual({ valid: true });
    });
  });

  describe('multiple errors collected', () => {
    test('collects errors from multiple nodes', () => {
      const result = validate({
        type: 'all-of',
        items: [
          { type: 'any-of', items: [] },                              // rule 2
          { type: 'n-of', comparison: 'exactly', count: 5, items: [   // rule 3
            course('MATH', '151')
          ]},
          { type: 'credits-from', comparison: 'at-least', credits: 0, // rule 4
            source: course('MATH', '151')
          }
        ]
      });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBe(3);
      expect(result.errors.map(e => e.rule).sort()).toEqual([2, 3, 4]);
    });
  });

  // --- Rules 5–8: Variable & Course Format ---

  describe('Rule 5: variable-ref resolution', () => {
    test('unscoped ref with matching def is valid', () => {
      const result = validate({
        type: 'all-of',
        items: [
          { type: 'variable-def', name: 'core', value: course('MATH', '151') },
          { type: 'variable-ref', name: 'core' }
        ]
      });
      expect(result).toEqual({ valid: true });
    });

    test('unscoped ref with no matching def fails', () => {
      const result = validate({ type: 'variable-ref', name: 'missing' });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toEqual({
        rule: 5,
        message: expect.stringContaining('$missing'),
        path: '(root)'
      });
    });

    test('cross-scope ref with matching scoped def is valid', () => {
      const result = validate({
        type: 'all-of',
        items: [
          {
            type: 'scope', name: 'cs',
            defs: [
              { type: 'variable-def', name: 'core', value: course('CMPS', '147') }
            ],
            body: { type: 'course', subject: 'CMPS', number: '147' }
          },
          { type: 'variable-ref', name: 'core', scope: 'cs' }
        ]
      });
      expect(result).toEqual({ valid: true });
    });

    test('cross-scope ref with no matching def fails', () => {
      const result = validate({
        type: 'variable-ref', name: 'core', scope: 'math'
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toEqual({
        rule: 5,
        message: expect.stringContaining('$math.core'),
        path: '(root)'
      });
    });

    test('ref inside scope resolves local def', () => {
      const result = validate({
        type: 'scope', name: 'cs',
        items: [
          { type: 'variable-def', name: 'core', value: course('CMPS', '147') },
          { type: 'variable-ref', name: 'core' }
        ]
      });
      expect(result).toEqual({ valid: true });
    });
  });

  describe('Rule 6: circular references', () => {
    test('direct self-reference', () => {
      const result = validate({
        type: 'all-of',
        items: [
          { type: 'variable-def', name: 'a', value: { type: 'variable-ref', name: 'a' } }
        ]
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.rule === 6)).toBe(true);
    });

    test('indirect circular reference (a -> b -> a)', () => {
      const result = validate({
        type: 'all-of',
        items: [
          { type: 'variable-def', name: 'a', value: { type: 'variable-ref', name: 'b' } },
          { type: 'variable-def', name: 'b', value: { type: 'variable-ref', name: 'a' } }
        ]
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.rule === 6)).toBe(true);
    });

    test('chain without cycle is valid (a -> b -> course)', () => {
      const result = validate({
        type: 'all-of',
        items: [
          { type: 'variable-def', name: 'b', value: course('MATH', '151') },
          { type: 'variable-def', name: 'a', value: { type: 'variable-ref', name: 'b' } },
          { type: 'variable-ref', name: 'a' }
        ]
      });
      expect(result).toEqual({ valid: true });
    });

    test('three-node cycle (a -> b -> c -> a)', () => {
      const result = validate({
        type: 'all-of',
        items: [
          { type: 'variable-def', name: 'a', value: { type: 'variable-ref', name: 'b' } },
          { type: 'variable-def', name: 'b', value: { type: 'variable-ref', name: 'c' } },
          { type: 'variable-def', name: 'c', value: { type: 'variable-ref', name: 'a' } }
        ]
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.rule === 6)).toBe(true);
    });
  });

  describe('Rule 7: course subject format', () => {
    test('valid 4-letter subject', () => {
      expect(validate(course('MATH', '151'))).toEqual({ valid: true });
    });

    test('valid 2-letter subject', () => {
      expect(validate(course('CS', '101'))).toEqual({ valid: true });
    });

    test('valid 6-letter subject', () => {
      expect(validate(course('COMPUT', '100'))).toEqual({ valid: true });
    });

    test('single character subject fails', () => {
      const result = validate(course('M', '151'));
      expect(result.valid).toBe(false);
      expect(result.errors[0].rule).toBe(7);
    });

    test('7-character subject fails', () => {
      const result = validate(course('ABCDEFG', '151'));
      expect(result.valid).toBe(false);
      expect(result.errors[0].rule).toBe(7);
    });

    test('lowercase subject fails', () => {
      const result = validate(course('math', '151'));
      expect(result.valid).toBe(false);
      expect(result.errors[0].rule).toBe(7);
    });

    test('subject with special chars fails', () => {
      const result = validate(course('MA-TH', '151'));
      expect(result.valid).toBe(false);
      expect(result.errors[0].rule).toBe(7);
    });

    test('alphanumeric subject is valid', () => {
      expect(validate(course('CS2', '101'))).toEqual({ valid: true });
    });
  });

  describe('Rule 8: course number format', () => {
    test('valid 3-digit number', () => {
      expect(validate(course('MATH', '151'))).toEqual({ valid: true });
    });

    test('valid 1-digit number', () => {
      expect(validate(course('MATH', '1'))).toEqual({ valid: true });
    });

    test('valid number with letter suffix', () => {
      expect(validate(course('CHEM', '101A'))).toEqual({ valid: true });
    });

    test('valid decimal number', () => {
      expect(validate(course('CSCI', '220.2'))).toEqual({ valid: true });
    });

    test('number starting with letter fails', () => {
      const result = validate(course('MATH', 'A151'));
      expect(result.valid).toBe(false);
      expect(result.errors[0].rule).toBe(8);
    });

    test('empty number fails', () => {
      const result = validate(course('MATH', ''));
      expect(result.valid).toBe(false);
      expect(result.errors[0].rule).toBe(8);
    });

    test('7-character number fails', () => {
      const result = validate(course('MATH', '1234567'));
      expect(result.valid).toBe(false);
      expect(result.errors[0].rule).toBe(8);
    });

    test('number with special chars fails', () => {
      const result = validate(course('MATH', '15-1'));
      expect(result.valid).toBe(false);
      expect(result.errors[0].rule).toBe(8);
    });
  });

  // --- Rules 9–14: Filter, Constraint & Context ---

  describe('Rule 9: filter op validity', () => {
    test('subject with eq is valid', () => {
      const result = validate({
        type: 'course-filter',
        filters: [{ field: 'subject', op: 'eq', value: 'CMPS' }]
      });
      expect(result).toEqual({ valid: true });
    });

    test('subject with in is valid', () => {
      const result = validate({
        type: 'course-filter',
        filters: [{ field: 'subject', op: 'in', value: ['CMPS', 'MATH'] }]
      });
      expect(result).toEqual({ valid: true });
    });

    test('subject with wildcard is valid', () => {
      const result = validate({
        type: 'course-filter',
        filters: [{ field: 'subject', op: 'wildcard', value: '*' }]
      });
      expect(result).toEqual({ valid: true });
    });

    test('subject with gte fails', () => {
      const result = validate({
        type: 'course-filter',
        filters: [{ field: 'subject', op: 'gte', value: 'CMPS' }]
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0].rule).toBe(9);
      expect(result.errors[0].message).toContain('subject');
    });

    test('number with gte is valid', () => {
      const result = validate({
        type: 'course-filter',
        filters: [{ field: 'number', op: 'gte', value: 300 }]
      });
      expect(result).toEqual({ valid: true });
    });

    test('number with in fails', () => {
      const result = validate({
        type: 'course-filter',
        filters: [{ field: 'number', op: 'in', value: [100, 200] }]
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0].rule).toBe(9);
    });

    test('attribute with ne is valid', () => {
      const result = validate({
        type: 'course-filter',
        filters: [{ field: 'attribute', op: 'ne', value: 'WI' }]
      });
      expect(result).toEqual({ valid: true });
    });

    test('attribute with lt fails', () => {
      const result = validate({
        type: 'course-filter',
        filters: [{ field: 'attribute', op: 'lt', value: 'WI' }]
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0].rule).toBe(9);
    });

    test('credits with lte is valid', () => {
      const result = validate({
        type: 'course-filter',
        filters: [{ field: 'credits', op: 'lte', value: 4 }]
      });
      expect(result).toEqual({ valid: true });
    });

    test('credits with not-in fails', () => {
      const result = validate({
        type: 'course-filter',
        filters: [{ field: 'credits', op: 'not-in', value: [3, 4] }]
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0].rule).toBe(9);
    });

    test('prerequisite-includes with includes is valid', () => {
      const result = validate({
        type: 'course-filter',
        filters: [{ field: 'prerequisite-includes', op: 'includes', value: course('MATH', '151') }]
      });
      expect(result).toEqual({ valid: true });
    });

    test('prerequisite-includes with eq fails', () => {
      const result = validate({
        type: 'course-filter',
        filters: [{ field: 'prerequisite-includes', op: 'eq', value: course('MATH', '151') }]
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0].rule).toBe(9);
    });

    test('post_constraint filter with invalid op', () => {
      const result = validate({
        type: 'n-of',
        comparison: 'at-least',
        count: 3,
        items: [course('MATH', '151'), course('MATH', '152'), course('MATH', '153')],
        post_constraints: [
          { comparison: 'at-least', count: 1, filter: { field: 'subject', op: 'gte', value: 'MATH' } }
        ]
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0].rule).toBe(9);
    });
  });

  describe('Rule 10: with-constraint target', () => {
    test('with-constraint on course is valid', () => {
      const result = validate({
        type: 'with-constraint',
        requirement: course('MATH', '151'),
        constraint: { kind: 'min-grade', value: 'C' }
      });
      expect(result).toEqual({ valid: true });
    });

    test('with-constraint on all-of is valid', () => {
      const result = validate({
        type: 'with-constraint',
        requirement: { type: 'all-of', items: [course('MATH', '151')] },
        constraint: { kind: 'min-gpa', value: 2.0 }
      });
      expect(result).toEqual({ valid: true });
    });

    test('with-constraint on score fails', () => {
      const result = validate({
        type: 'with-constraint',
        requirement: { type: 'score', name: 'SAT_MATH', op: 'gte', value: 580 },
        constraint: { kind: 'min-grade', value: 'C' }
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0].rule).toBe(10);
    });

    test('with-constraint on attainment fails', () => {
      const result = validate({
        type: 'with-constraint',
        requirement: { type: 'attainment', name: 'JUNIOR_STANDING' },
        constraint: { kind: 'min-grade', value: 'C' }
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0].rule).toBe(10);
    });

    test('with-constraint on quantity fails', () => {
      const result = validate({
        type: 'with-constraint',
        requirement: { type: 'quantity', name: 'HOURS', op: 'gte', value: 500 },
        constraint: { kind: 'min-grade', value: 'C' }
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0].rule).toBe(10);
    });

    test('with-constraint on program fails', () => {
      const result = validate({
        type: 'with-constraint',
        requirement: { type: 'program', code: 'CS', 'program-type': 'major', level: 'undergraduate' },
        constraint: { kind: 'min-grade', value: 'C' }
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0].rule).toBe(10);
    });

    test('with-constraint on program-context-ref fails', () => {
      const result = validate({
        type: 'with-constraint',
        requirement: { type: 'program-context-ref', role: 'primary-major' },
        constraint: { kind: 'min-grade', value: 'C' }
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0].rule).toBe(10);
    });
  });

  describe('Rule 11: concurrentAllowed context', () => {
    test('concurrentAllowed on course is valid', () => {
      const result = validate({
        type: 'course', subject: 'CMPS', number: '230', concurrentAllowed: true
      });
      expect(result).toEqual({ valid: true });
    });

    test('concurrentAllowed on non-course fails', () => {
      const result = validate({
        type: 'all-of',
        items: [course('MATH', '151')],
        concurrentAllowed: true
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0].rule).toBe(11);
    });
  });

  describe('Rule 12: post_constraint fields', () => {
    test('post_constraint with subject field is valid', () => {
      const result = validate({
        type: 'n-of',
        comparison: 'at-least',
        count: 3,
        items: [course('MATH', '151'), course('POLI', '101'), course('POLI', '201'), course('POLI', '301')],
        post_constraints: [
          { comparison: 'at-least', count: 1, filter: { field: 'subject', op: 'eq', value: 'POLI' } }
        ]
      });
      expect(result).toEqual({ valid: true });
    });

    test('post_constraint with prerequisite-includes field fails', () => {
      const result = validate({
        type: 'n-of',
        comparison: 'at-least',
        count: 3,
        items: [course('MATH', '151'), course('MATH', '152'), course('MATH', '153')],
        post_constraints: [
          { comparison: 'at-least', count: 1, filter: { field: 'prerequisite-includes', op: 'includes', value: course('MATH', '100') } }
        ]
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0].rule).toBe(12);
    });

    test('post_constraint with number field is valid', () => {
      const result = validate({
        type: 'n-of',
        comparison: 'at-least',
        count: 3,
        items: [course('MATH', '151'), course('MATH', '152'), course('MATH', '301'), course('MATH', '401')],
        post_constraints: [
          { comparison: 'at-least', count: 1, filter: { field: 'number', op: 'gte', value: 300 } }
        ]
      });
      expect(result).toEqual({ valid: true });
    });
  });

  describe('Rule 13: top-level only', () => {
    test('overlap-limit at top level is valid', () => {
      const result = validate({
        type: 'overlap-limit',
        left: { type: 'variable-ref', name: 'gen_ed' },
        right: { type: 'program-context-ref', role: 'primary-major' },
        constraint: { comparison: 'at-most', value: 3, unit: 'courses' }
      });
      // variable-ref 'gen_ed' will fail rule 5, but NOT rule 13
      expect(result.errors.every(e => e.rule !== 13)).toBe(true);
    });

    test('overlap-limit nested inside all-of fails', () => {
      const result = validate({
        type: 'all-of',
        items: [
          {
            type: 'overlap-limit',
            left: { type: 'program-context-ref', role: 'primary-major' },
            right: { type: 'program-context-ref', role: 'primary-minor' },
            constraint: { comparison: 'at-most', value: 2, unit: 'courses' }
          }
        ]
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.rule === 13)).toBe(true);
    });

    test('outside-program at top level is valid', () => {
      const result = validate({
        type: 'outside-program',
        program: { type: 'program-context-ref', role: 'primary-major' },
        constraint: { comparison: 'at-least', value: 72, unit: 'credits' }
      });
      expect(result).toEqual({ valid: true });
    });

    test('outside-program nested fails', () => {
      const result = validate({
        type: 'all-of',
        items: [
          {
            type: 'outside-program',
            program: { type: 'program-context-ref', role: 'primary-major' },
            constraint: { comparison: 'at-least', value: 72, unit: 'credits' }
          }
        ]
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.rule === 13)).toBe(true);
    });
  });

  describe('Rule 14: role values', () => {
    test('primary-major is valid', () => {
      const result = validate({ type: 'program-context-ref', role: 'primary-major' });
      expect(result).toEqual({ valid: true });
    });

    test('primary-minor is valid', () => {
      const result = validate({ type: 'program-context-ref', role: 'primary-minor' });
      expect(result).toEqual({ valid: true });
    });

    test('invalid role fails', () => {
      const result = validate({ type: 'program-context-ref', role: 'secondary-major' });
      expect(result.valid).toBe(false);
      expect(result.errors[0].rule).toBe(14);
    });
  });

  // --- Integration tests ---

  describe('Parser output validation', () => {
    test('simple course', () => {
      expect(validate(parse('MATH 151'))).toEqual({ valid: true });
    });

    test('all-of with gpa constraint', () => {
      expect(validate(parse('all of (MATH 151, MATH 152) with gpa >= 2.0'))).toEqual({ valid: true });
    });

    test('complex requirement with variables and filters', () => {
      const ast = parse(`
        all of (
          $core = all of (CMPS 147, CMPS 148, CMPS 230),
          $core with gpa >= 2.0,
          at least 3 of (
            courses where subject = "CMPS" and number >= 300
          )
        )
      `);
      expect(validate(ast)).toEqual({ valid: true });
    });

    test('score requirement', () => {
      expect(validate(parse('score SAT_MATH >= 580'))).toEqual({ valid: true });
    });

    test('attainment requirement', () => {
      expect(validate(parse('attainment JUNIOR_STANDING'))).toEqual({ valid: true });
    });
  });

  // --- Edge cases for coverage ---

  describe('tree traversal edge cases', () => {
    test('walks source child of credits-from', () => {
      // credits-from with an invalid source child (missing type)
      const result = validate({
        type: 'credits-from', credits: 9, comparison: 'at-least',
        source: { subject: 'MATH', number: '151' } // missing type
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0].rule).toBe(1);
      expect(result.errors[0].path).toBe('source');
    });

    test('walks requirement child of with-constraint', () => {
      const result = validate({
        type: 'with-constraint',
        constraint: { kind: 'min-grade', value: 'C' },
        requirement: { subject: 'MATH', number: '151' } // missing type
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0].rule).toBe(1);
      expect(result.errors[0].path).toBe('requirement');
    });

    test('collectDefs finds variable-defs inside scope defs', () => {
      const result = validate({
        type: 'all-of',
        items: [
          {
            type: 'scope', name: 'wrapper',
            defs: [
              { type: 'variable-def', name: 'inner', value: course('MATH', '151') }
            ],
            body: { type: 'variable-ref', name: 'inner' }
          },
          { type: 'variable-ref', name: 'inner', scope: 'wrapper' }
        ]
      });
      expect(result).toEqual({ valid: true });
    });

    test('collectDefs finds variable-defs inside variable-def value', () => {
      // A variable-def whose value contains another variable-def (nested)
      const result = validate({
        type: 'variable-def', name: 'outer',
        value: {
          type: 'all-of',
          items: [
            { type: 'variable-def', name: 'inner', value: course('MATH', '151') },
            { type: 'variable-ref', name: 'inner' }
          ]
        }
      });
      expect(result).toEqual({ valid: true });
    });

    test('scope with missing name defaults to empty string', () => {
      const result = validate({
        type: 'scope',
        defs: [
          { type: 'variable-def', name: 'x', value: course('MATH', '151') },
        ],
        body: { type: 'variable-ref', name: 'x' }
      });
      expect(result).toEqual({ valid: true });
    });

    test('validateFilterOp with null filter is a no-op', () => {
      const result = validate({
        type: 'course-filter',
        filters: [null]
      });
      // Should not crash; null filter is skipped
      expect(result).toEqual({ valid: true });
    });

    test('validateFilterOp with unknown field is a no-op', () => {
      const result = validate({
        type: 'course-filter',
        filters: [{ field: 'unknown-field', op: 'eq', value: 'test' }]
      });
      // Unknown field — no error from rule 9
      expect(result).toEqual({ valid: true });
    });

    test('collectDefs recurses into requirement property', () => {
      const result = validate({
        type: 'all-of',
        items: [
          {
            type: 'with-constraint',
            requirement: {
              type: 'all-of',
              items: [
                { type: 'variable-def', name: 'nested', value: course('MATH', '151') }
              ]
            },
            constraint: { kind: 'min-gpa', value: 2.0 }
          },
          { type: 'variable-ref', name: 'nested' }
        ]
      });
      expect(result).toEqual({ valid: true });
    });

    test('collectDefs recurses into program property', () => {
      const result = validate({
        type: 'outside-program',
        program: { type: 'program-context-ref', role: 'primary-major' },
        constraint: { comparison: 'at-least', value: 72, unit: 'credits' }
      });
      expect(result).toEqual({ valid: true });
    });

    test('scope with no items array', () => {
      const result = validate({ type: 'scope', name: 'empty' });
      // Should not crash — scope with no items is valid but useless
      expect(result).toEqual({ valid: true });
    });

    test('variable-def with no value', () => {
      const result = validate({
        type: 'all-of',
        items: [
          { type: 'variable-def', name: 'empty' },
          { type: 'variable-ref', name: 'empty' }
        ]
      });
      // Ref resolves, but def has no value — should not crash
      expect(result).toEqual({ valid: true });
    });

    test('circular reference with scoped variable', () => {
      const result = validate({
        type: 'all-of',
        items: [
          {
            type: 'scope', name: 'sc',
            defs: [
              { type: 'variable-def', name: 'a', value: { type: 'variable-ref', name: 'a', scope: 'sc' } }
            ],
            body: { type: 'course', subject: 'MATH', number: '101' }
          }
        ]
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.rule === 6 && e.message.includes('sc.'))).toBe(true);
    });

    test('post_constraint with missing filter property', () => {
      const result = validate({
        type: 'n-of',
        comparison: 'at-least',
        count: 2,
        items: [course('MATH', '151'), course('MATH', '152')],
        post_constraints: [{ comparison: 'at-least', count: 1 }]
      });
      // Missing filter — should not crash
      expect(result).toEqual({ valid: true });
    });
  });

});
