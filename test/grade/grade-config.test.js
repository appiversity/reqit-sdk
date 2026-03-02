'use strict';

const { DEFAULT_GRADE_CONFIG } = require('../../src/grade');

describe('DEFAULT_GRADE_CONFIG', () => {
  test('has 13 scale entries from A+ to F', () => {
    expect(DEFAULT_GRADE_CONFIG.scale).toHaveLength(13);
    expect(DEFAULT_GRADE_CONFIG.scale[0].grade).toBe('A+');
    expect(DEFAULT_GRADE_CONFIG.scale[12].grade).toBe('F');
  });

  test('scale is ordered descending by points', () => {
    for (let i = 1; i < DEFAULT_GRADE_CONFIG.scale.length; i++) {
      expect(DEFAULT_GRADE_CONFIG.scale[i].points)
        .toBeLessThanOrEqual(DEFAULT_GRADE_CONFIG.scale[i - 1].points);
    }
  });

  test('A+ and A both have 4.0 points', () => {
    expect(DEFAULT_GRADE_CONFIG.scale[0].points).toBe(4.0);
    expect(DEFAULT_GRADE_CONFIG.scale[1].points).toBe(4.0);
  });

  test('F has 0.0 points', () => {
    expect(DEFAULT_GRADE_CONFIG.scale[12].points).toBe(0.0);
  });

  test('has pass/fail grades', () => {
    expect(DEFAULT_GRADE_CONFIG.passFail).toHaveLength(2);
    expect(DEFAULT_GRADE_CONFIG.passFail[0]).toEqual({ grade: 'P', passing: true });
    expect(DEFAULT_GRADE_CONFIG.passFail[1]).toEqual({ grade: 'NP', passing: false });
  });

  test('has withdrawal grades', () => {
    expect(DEFAULT_GRADE_CONFIG.withdrawal).toEqual(['W', 'WP', 'WF']);
  });

  test('has incomplete grades', () => {
    expect(DEFAULT_GRADE_CONFIG.incomplete).toEqual(['I', 'IP']);
  });

  test('is frozen (immutable)', () => {
    expect(Object.isFrozen(DEFAULT_GRADE_CONFIG)).toBe(true);
    expect(Object.isFrozen(DEFAULT_GRADE_CONFIG.scale)).toBe(true);
    expect(Object.isFrozen(DEFAULT_GRADE_CONFIG.passFail)).toBe(true);
    expect(Object.isFrozen(DEFAULT_GRADE_CONFIG.withdrawal)).toBe(true);
    expect(Object.isFrozen(DEFAULT_GRADE_CONFIG.incomplete)).toBe(true);
  });
});
