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
    // Tests added in commit 2.3
  });

  describe('Rule 6: circular references', () => {
    // Tests added in commit 2.3
  });

  describe('Rule 7: course subject format', () => {
    // Tests added in commit 2.3
  });

  describe('Rule 8: course number format', () => {
    // Tests added in commit 2.3
  });

  // --- Rules 9–14: Filter, Constraint & Context ---

  describe('Rule 9: filter op validity', () => {
    // Tests added in commit 2.4
  });

  describe('Rule 10: with-constraint target', () => {
    // Tests added in commit 2.4
  });

  describe('Rule 11: concurrentAllowed context', () => {
    // Tests added in commit 2.4
  });

  describe('Rule 12: post_constraint fields', () => {
    // Tests added in commit 2.4
  });

  describe('Rule 13: top-level only', () => {
    // Tests added in commit 2.4
  });

  describe('Rule 14: role values', () => {
    // Tests added in commit 2.4
  });

  // --- Integration tests ---

  describe('Parser output validation', () => {
    // Tests added in commit 2.4
  });

});
