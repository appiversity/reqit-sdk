'use strict';

const {
  MET, PROVISIONAL_MET, IN_PROGRESS, NOT_MET,
  allOf, anyOf, nOf, noneOf, creditsFrom, buildSummary,
} = require('../../src/audit/status');

// Shorthand for readability
const M = MET, IP = PROVISIONAL_MET, PP = IN_PROGRESS, NM = NOT_MET;

// ============================================================
// allOf
// ============================================================

describe('allOf', () => {
  test('all met → met', () => {
    expect(allOf([M, M, M])).toBe(M);
  });

  test('single met → met', () => {
    expect(allOf([M])).toBe(M);
  });

  test('empty → met (vacuous truth)', () => {
    expect(allOf([])).toBe(M);
  });

  test('all met or in-progress → in-progress', () => {
    expect(allOf([M, IP, M])).toBe(IP);
    expect(allOf([IP, IP])).toBe(IP);
  });

  test('all not-met → not-met', () => {
    expect(allOf([NM, NM, NM])).toBe(NM);
  });

  test('met + not-met → partial-progress', () => {
    expect(allOf([M, NM])).toBe(PP);
    expect(allOf([M, M, NM])).toBe(PP);
  });

  test('met + in-progress + not-met → partial-progress', () => {
    expect(allOf([M, IP, NM])).toBe(PP);
  });

  test('in-progress + not-met → partial-progress', () => {
    expect(allOf([IP, NM])).toBe(PP);
  });

  test('partial-progress children propagate', () => {
    expect(allOf([M, PP])).toBe(PP);
    expect(allOf([PP, NM])).toBe(PP);
    expect(allOf([PP, PP])).toBe(PP);
  });

  test('single not-met → not-met', () => {
    expect(allOf([NM])).toBe(NM);
  });

  test('single in-progress → in-progress', () => {
    expect(allOf([IP])).toBe(IP);
  });
});

// ============================================================
// anyOf
// ============================================================

describe('anyOf', () => {
  test('any met → met', () => {
    expect(anyOf([NM, M, NM])).toBe(M);
    expect(anyOf([M])).toBe(M);
  });

  test('no met, any in-progress → in-progress', () => {
    expect(anyOf([NM, IP, NM])).toBe(IP);
    expect(anyOf([IP])).toBe(IP);
  });

  test('no met, no ip, any partial-progress → partial-progress', () => {
    expect(anyOf([NM, PP])).toBe(PP);
    expect(anyOf([PP])).toBe(PP);
  });

  test('all not-met → not-met', () => {
    expect(anyOf([NM, NM, NM])).toBe(NM);
    expect(anyOf([NM])).toBe(NM);
  });

  test('empty → not-met', () => {
    expect(anyOf([])).toBe(NM);
  });

  test('met takes priority over in-progress', () => {
    expect(anyOf([M, IP, PP, NM])).toBe(M);
  });

  test('in-progress takes priority over partial-progress', () => {
    expect(anyOf([IP, PP, NM])).toBe(IP);
  });
});

// ============================================================
// nOf (at-least)
// ============================================================

describe('nOf at-least', () => {
  test('met count ≥ K → met', () => {
    expect(nOf([M, M, NM, NM], 'at-least', 2)).toBe(M);
    expect(nOf([M, M, M], 'at-least', 2)).toBe(M);
  });

  test('met + ip ≥ K → in-progress', () => {
    expect(nOf([M, IP, NM, NM], 'at-least', 2)).toBe(IP);
    expect(nOf([IP, IP, NM], 'at-least', 2)).toBe(IP);
  });

  test('some progress but not enough → partial-progress', () => {
    expect(nOf([M, NM, NM, NM], 'at-least', 3)).toBe(PP);
    expect(nOf([IP, NM, NM], 'at-least', 3)).toBe(PP);
    expect(nOf([PP, NM, NM], 'at-least', 2)).toBe(PP);
  });

  test('no progress → not-met', () => {
    expect(nOf([NM, NM, NM], 'at-least', 2)).toBe(NM);
  });

  test('K = 1 behaves like anyOf', () => {
    expect(nOf([M, NM], 'at-least', 1)).toBe(M);
    expect(nOf([IP, NM], 'at-least', 1)).toBe(IP);
    expect(nOf([NM, NM], 'at-least', 1)).toBe(NM);
  });

  test('K = items.length behaves like allOf', () => {
    expect(nOf([M, M, M], 'at-least', 3)).toBe(M);
    expect(nOf([M, IP, M], 'at-least', 3)).toBe(IP);
    expect(nOf([M, M, NM], 'at-least', 3)).toBe(PP);
  });

  test('K = 0 → always met', () => {
    expect(nOf([NM, NM], 'at-least', 0)).toBe(M);
    expect(nOf([], 'at-least', 0)).toBe(M);
  });

  test('empty with K > 0 → not-met', () => {
    expect(nOf([], 'at-least', 1)).toBe(NM);
  });
});

// ============================================================
// nOf (at-most)
// ============================================================

describe('nOf at-most', () => {
  test('met ≤ K → met', () => {
    expect(nOf([M, NM, NM], 'at-most', 1)).toBe(M);
    expect(nOf([NM, NM, NM], 'at-most', 1)).toBe(M);
    expect(nOf([M, M, NM], 'at-most', 2)).toBe(M);
  });

  test('met > K → not-met', () => {
    expect(nOf([M, M, NM], 'at-most', 1)).toBe(NM);
    expect(nOf([M, M, M], 'at-most', 2)).toBe(NM);
  });

  test('met ≤ K but met + ip > K → in-progress (uncertain)', () => {
    expect(nOf([M, IP, NM], 'at-most', 1)).toBe(IP);
    expect(nOf([IP, IP, IP], 'at-most', 2)).toBe(IP);
  });

  test('K = 0, none met → met', () => {
    expect(nOf([NM, NM], 'at-most', 0)).toBe(M);
  });

  test('K = 0, one met → not-met', () => {
    expect(nOf([M, NM], 'at-most', 0)).toBe(NM);
  });

  test('empty → met', () => {
    expect(nOf([], 'at-most', 1)).toBe(M);
  });
});

// ============================================================
// nOf (exactly)
// ============================================================

describe('nOf exactly', () => {
  test('met === K → met', () => {
    expect(nOf([M, M, NM], 'exactly', 2)).toBe(M);
    expect(nOf([M], 'exactly', 1)).toBe(M);
  });

  test('met > K → not-met', () => {
    expect(nOf([M, M, M], 'exactly', 2)).toBe(NM);
  });

  test('met < K, met + ip ≥ K → in-progress', () => {
    expect(nOf([M, IP, NM], 'exactly', 2)).toBe(IP);
    expect(nOf([IP, IP], 'exactly', 2)).toBe(IP);
  });

  test('met < K, not enough with ip → partial-progress', () => {
    expect(nOf([M, NM, NM], 'exactly', 3)).toBe(PP);
    expect(nOf([PP, NM], 'exactly', 2)).toBe(PP);
  });

  test('no progress → not-met', () => {
    expect(nOf([NM, NM], 'exactly', 1)).toBe(NM);
  });

  test('K = 0, none met → met', () => {
    expect(nOf([NM, NM], 'exactly', 0)).toBe(M);
  });

  test('empty K = 0 → met', () => {
    expect(nOf([], 'exactly', 0)).toBe(M);
  });

  test('empty K > 0 → not-met', () => {
    expect(nOf([], 'exactly', 1)).toBe(NM);
  });
});

// ============================================================
// noneOf
// ============================================================

describe('noneOf', () => {
  test('no child met or ip → met (exclusion satisfied)', () => {
    expect(noneOf([NM, NM])).toBe(M);
    expect(noneOf([NM])).toBe(M);
  });

  test('empty → met', () => {
    expect(noneOf([])).toBe(M);
  });

  test('any child met → not-met (student took excluded course)', () => {
    expect(noneOf([M, NM])).toBe(NM);
    expect(noneOf([M])).toBe(NM);
    expect(noneOf([M, M])).toBe(NM);
  });

  test('no met, any in-progress → in-progress (risk)', () => {
    expect(noneOf([IP, NM])).toBe(IP);
    expect(noneOf([IP])).toBe(IP);
  });

  test('partial-progress children → met (pp is not met)', () => {
    // partial-progress means some sub-progress but the child isn't met
    // For none-of, only met children cause failure
    expect(noneOf([PP, NM])).toBe(M);
  });
});

// ============================================================
// creditsFrom
// ============================================================

describe('creditsFrom at-least', () => {
  test('earned ≥ required → met', () => {
    expect(creditsFrom(15, 0, 12, 'at-least')).toBe(M);
    expect(creditsFrom(12, 0, 12, 'at-least')).toBe(M);
  });

  test('earned + ip ≥ required → in-progress', () => {
    expect(creditsFrom(8, 4, 12, 'at-least')).toBe(IP);
    expect(creditsFrom(9, 3, 12, 'at-least')).toBe(IP);
  });

  test('earned + ip > 0 but < required → partial-progress', () => {
    expect(creditsFrom(6, 3, 12, 'at-least')).toBe(PP);
    expect(creditsFrom(0, 3, 12, 'at-least')).toBe(PP);
  });

  test('0 earned, 0 ip → not-met', () => {
    expect(creditsFrom(0, 0, 12, 'at-least')).toBe(NM);
  });

  test('required = 0 → always met', () => {
    expect(creditsFrom(0, 0, 0, 'at-least')).toBe(M);
  });
});

describe('creditsFrom at-most', () => {
  test('earned ≤ required → met', () => {
    expect(creditsFrom(8, 0, 12, 'at-most')).toBe(M);
    expect(creditsFrom(12, 0, 12, 'at-most')).toBe(M);
  });

  test('earned > required → not-met', () => {
    expect(creditsFrom(15, 0, 12, 'at-most')).toBe(NM);
  });

  test('earned ≤ required, earned + ip > required → in-progress', () => {
    expect(creditsFrom(10, 4, 12, 'at-most')).toBe(IP);
  });
});

describe('creditsFrom exactly', () => {
  test('earned === required → met', () => {
    expect(creditsFrom(12, 0, 12, 'exactly')).toBe(M);
  });

  test('earned > required → not-met', () => {
    expect(creditsFrom(15, 0, 12, 'exactly')).toBe(NM);
  });

  test('earned < required, earned + ip ≥ required → in-progress', () => {
    expect(creditsFrom(9, 3, 12, 'exactly')).toBe(IP);
  });

  test('earned < required, some progress → partial-progress', () => {
    expect(creditsFrom(6, 3, 12, 'exactly')).toBe(PP);
  });

  test('no progress → not-met', () => {
    expect(creditsFrom(0, 0, 12, 'exactly')).toBe(NM);
  });
});

// ============================================================
// buildSummary
// ============================================================

describe('buildSummary', () => {
  test('counts all 4 statuses', () => {
    const summary = buildSummary([M, IP, PP, NM, M, NM]);
    expect(summary).toEqual({
      met: 2, waived: 0, substituted: 0, provisionalMet: 1, inProgress: 1, notMet: 2, total: 6,
    });
  });

  test('empty statuses', () => {
    expect(buildSummary([])).toEqual({
      met: 0, waived: 0, substituted: 0, provisionalMet: 0, inProgress: 0, notMet: 0, total: 0,
    });
  });

  test('all same status', () => {
    expect(buildSummary([M, M, M])).toEqual({
      met: 3, waived: 0, substituted: 0, provisionalMet: 0, inProgress: 0, notMet: 0, total: 3,
    });
  });
});

// ============================================================
// Error handling
// ============================================================

describe('error handling', () => {
  test('nOf throws on unknown comparison', () => {
    expect(() => nOf([M], 'between', 1)).toThrow('Unknown n-of comparison');
  });

  test('creditsFrom throws on unknown comparison', () => {
    expect(() => creditsFrom(5, 0, 10, 'between')).toThrow('Unknown credits-from comparison');
  });
});
