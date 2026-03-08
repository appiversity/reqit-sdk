'use strict';

const { audit, MET, PROVISIONAL_MET, IN_PROGRESS, NOT_MET } = require('../../src/audit');
const minimalCatalog = require('../fixtures/catalogs/minimal.json');

const complete = require('../fixtures/transcripts/minimal/complete.json');
const empty = require('../fixtures/transcripts/minimal/empty.json');
const partial = require('../fixtures/transcripts/minimal/partial.json');
const inProgress = require('../fixtures/transcripts/minimal/in-progress.json');

// ============================================================
// all-of
// ============================================================

describe('all-of', () => {
  test('all children met → met', () => {
    const ast = {
      type: 'all-of',
      items: [
        { type: 'course', subject: 'MATH', number: '101' },
        { type: 'course', subject: 'MATH', number: '151' },
        { type: 'course', subject: 'CMPS', number: '130' },
      ],
    };
    const { status, result } = audit(ast, minimalCatalog, complete);
    expect(status).toBe(MET);
    expect(result.summary.met).toBe(3);
    expect(result.summary.total).toBe(3);
  });

  test('all children met or in-progress → in-progress', () => {
    const ast = {
      type: 'all-of',
      items: [
        { type: 'course', subject: 'MATH', number: '101' },   // completed
        { type: 'course', subject: 'MATH', number: '151' },   // completed
        { type: 'course', subject: 'MATH', number: '152' },   // in-progress
      ],
    };
    const { status, result } = audit(ast, minimalCatalog, inProgress);
    expect(status).toBe(PROVISIONAL_MET);
    expect(result.summary.met).toBe(2);
    expect(result.summary.provisionalMet).toBe(1);
  });

  test('some met, some not-met → partial-progress', () => {
    const ast = {
      type: 'all-of',
      items: [
        { type: 'course', subject: 'MATH', number: '101' },   // in partial
        { type: 'course', subject: 'MATH', number: '250' },   // NOT in partial
        { type: 'course', subject: 'CMPS', number: '310' },   // NOT in partial
      ],
    };
    const { status, result } = audit(ast, minimalCatalog, partial);
    expect(status).toBe(IN_PROGRESS);
    expect(result.summary.met).toBe(1);
    expect(result.summary.notMet).toBe(2);
  });

  test('all not-met → not-met', () => {
    const ast = {
      type: 'all-of',
      items: [
        { type: 'course', subject: 'MATH', number: '101' },
        { type: 'course', subject: 'CMPS', number: '130' },
      ],
    };
    const { status } = audit(ast, minimalCatalog, empty);
    expect(status).toBe(NOT_MET);
  });

  test('empty items → met (vacuous truth)', () => {
    const ast = { type: 'all-of', items: [] };
    const { status } = audit(ast, minimalCatalog, empty);
    expect(status).toBe(MET);
  });

  test('label is preserved', () => {
    const ast = {
      type: 'all-of',
      label: 'Core Requirements',
      items: [{ type: 'course', subject: 'MATH', number: '101' }],
    };
    const { result } = audit(ast, minimalCatalog, complete);
    expect(result.label).toBe('Core Requirements');
  });

  test('items array contains individual audit results', () => {
    const ast = {
      type: 'all-of',
      items: [
        { type: 'course', subject: 'MATH', number: '101' },
        { type: 'course', subject: 'CMPS', number: '130' },
      ],
    };
    const { result } = audit(ast, minimalCatalog, complete);
    expect(result.items).toHaveLength(2);
    expect(result.items[0].type).toBe('course');
    expect(result.items[0].status).toBe(MET);
    expect(result.items[1].type).toBe('course');
    expect(result.items[1].status).toBe(MET);
  });
});

// ============================================================
// any-of
// ============================================================

describe('any-of', () => {
  test('at least one met → met', () => {
    const ast = {
      type: 'any-of',
      items: [
        { type: 'course', subject: 'MATH', number: '101' },   // in partial
        { type: 'course', subject: 'ART', number: '301' },    // NOT in partial
      ],
    };
    const { status, result } = audit(ast, minimalCatalog, partial);
    expect(status).toBe(MET);
    expect(result.summary.met).toBe(1);
    expect(result.summary.notMet).toBe(1);
  });

  test('none met, one in-progress → in-progress', () => {
    const ast = {
      type: 'any-of',
      items: [
        { type: 'course', subject: 'CMPS', number: '310' },   // in-progress
        { type: 'course', subject: 'ART', number: '301' },    // not in transcript
      ],
    };
    const { status } = audit(ast, minimalCatalog, inProgress);
    expect(status).toBe(PROVISIONAL_MET);
  });

  test('all not-met → not-met', () => {
    const ast = {
      type: 'any-of',
      items: [
        { type: 'course', subject: 'ART', number: '301' },
        { type: 'course', subject: 'ART', number: '401' },
      ],
    };
    const { status } = audit(ast, minimalCatalog, empty);
    expect(status).toBe(NOT_MET);
  });

  test('empty items → not-met', () => {
    const ast = { type: 'any-of', items: [] };
    const { status } = audit(ast, minimalCatalog, complete);
    expect(status).toBe(NOT_MET);
  });

  test('label is preserved', () => {
    const ast = {
      type: 'any-of',
      label: 'Electives',
      items: [{ type: 'course', subject: 'MATH', number: '101' }],
    };
    const { result } = audit(ast, minimalCatalog, complete);
    expect(result.label).toBe('Electives');
  });
});

// ============================================================
// n-of (at-least)
// ============================================================

describe('n-of at-least', () => {
  test('met count ≥ K → met', () => {
    const ast = {
      type: 'n-of', comparison: 'at-least', count: 2,
      items: [
        { type: 'course', subject: 'MATH', number: '101' },
        { type: 'course', subject: 'MATH', number: '151' },
        { type: 'course', subject: 'ART', number: '301' },
      ],
    };
    const { status, result } = audit(ast, minimalCatalog, complete);
    expect(status).toBe(MET);
    expect(result.comparison).toBe('at-least');
    expect(result.count).toBe(2);
  });

  test('met + in-progress ≥ K → in-progress', () => {
    const ast = {
      type: 'n-of', comparison: 'at-least', count: 2,
      items: [
        { type: 'course', subject: 'MATH', number: '101' },   // completed
        { type: 'course', subject: 'CMPS', number: '310' },   // in-progress
        { type: 'course', subject: 'ART', number: '301' },    // not in transcript
      ],
    };
    const { status } = audit(ast, minimalCatalog, inProgress);
    expect(status).toBe(PROVISIONAL_MET);
  });

  test('some progress but not enough → partial-progress', () => {
    const ast = {
      type: 'n-of', comparison: 'at-least', count: 3,
      items: [
        { type: 'course', subject: 'MATH', number: '101' },   // in partial
        { type: 'course', subject: 'ART', number: '301' },    // not in partial
        { type: 'course', subject: 'ART', number: '401' },    // not in partial
      ],
    };
    const { status } = audit(ast, minimalCatalog, partial);
    expect(status).toBe(IN_PROGRESS);
  });

  test('no progress → not-met', () => {
    const ast = {
      type: 'n-of', comparison: 'at-least', count: 2,
      items: [
        { type: 'course', subject: 'ART', number: '301' },
        { type: 'course', subject: 'ART', number: '401' },
      ],
    };
    const { status } = audit(ast, minimalCatalog, empty);
    expect(status).toBe(NOT_MET);
  });

  test('K = 0 → always met', () => {
    const ast = {
      type: 'n-of', comparison: 'at-least', count: 0,
      items: [
        { type: 'course', subject: 'ART', number: '301' },
      ],
    };
    const { status } = audit(ast, minimalCatalog, empty);
    expect(status).toBe(MET);
  });
});

// ============================================================
// n-of (at-most)
// ============================================================

describe('n-of at-most', () => {
  test('met ≤ K → met', () => {
    const ast = {
      type: 'n-of', comparison: 'at-most', count: 2,
      items: [
        { type: 'course', subject: 'MATH', number: '101' },   // met
        { type: 'course', subject: 'ART', number: '301' },    // not met
        { type: 'course', subject: 'ART', number: '401' },    // not met
      ],
    };
    const { status } = audit(ast, minimalCatalog, complete);
    expect(status).toBe(MET);
  });

  test('met > K → not-met', () => {
    const ast = {
      type: 'n-of', comparison: 'at-most', count: 1,
      items: [
        { type: 'course', subject: 'MATH', number: '101' },
        { type: 'course', subject: 'MATH', number: '151' },
        { type: 'course', subject: 'CMPS', number: '130' },
      ],
    };
    const { status } = audit(ast, minimalCatalog, complete);
    expect(status).toBe(NOT_MET);
  });

  test('met ≤ K but met + ip > K → in-progress', () => {
    const ast = {
      type: 'n-of', comparison: 'at-most', count: 1,
      items: [
        { type: 'course', subject: 'MATH', number: '101' },   // completed
        { type: 'course', subject: 'CMPS', number: '310' },   // in-progress
        { type: 'course', subject: 'ART', number: '301' },    // not in transcript
      ],
    };
    const { status } = audit(ast, minimalCatalog, inProgress);
    expect(status).toBe(PROVISIONAL_MET);
  });
});

// ============================================================
// n-of (exactly)
// ============================================================

describe('n-of exactly', () => {
  test('met === K → met', () => {
    const ast = {
      type: 'n-of', comparison: 'exactly', count: 2,
      items: [
        { type: 'course', subject: 'MATH', number: '101' },   // in partial
        { type: 'course', subject: 'MATH', number: '151' },   // in partial
        { type: 'course', subject: 'ART', number: '301' },    // not in partial
      ],
    };
    const { status } = audit(ast, minimalCatalog, partial);
    expect(status).toBe(MET);
  });

  test('met > K → not-met', () => {
    const ast = {
      type: 'n-of', comparison: 'exactly', count: 1,
      items: [
        { type: 'course', subject: 'MATH', number: '101' },
        { type: 'course', subject: 'MATH', number: '151' },
      ],
    };
    const { status } = audit(ast, minimalCatalog, complete);
    expect(status).toBe(NOT_MET);
  });

  test('met < K, met + ip ≥ K → in-progress', () => {
    const ast = {
      type: 'n-of', comparison: 'exactly', count: 2,
      items: [
        { type: 'course', subject: 'MATH', number: '101' },   // completed
        { type: 'course', subject: 'CMPS', number: '310' },   // in-progress
        { type: 'course', subject: 'ART', number: '301' },    // not in transcript
      ],
    };
    const { status } = audit(ast, minimalCatalog, inProgress);
    expect(status).toBe(PROVISIONAL_MET);
  });
});

// ============================================================
// none-of
// ============================================================

describe('none-of', () => {
  test('no children met → met (exclusion satisfied)', () => {
    const ast = {
      type: 'none-of',
      items: [
        { type: 'course', subject: 'ART', number: '301' },
        { type: 'course', subject: 'ART', number: '401' },
      ],
    };
    const { status, result } = audit(ast, minimalCatalog, partial);
    expect(status).toBe(MET);
    expect(result.summary.notMet).toBe(2);
  });

  test('one child met → not-met (exclusion violated)', () => {
    const ast = {
      type: 'none-of',
      items: [
        { type: 'course', subject: 'MATH', number: '101' },   // in partial
        { type: 'course', subject: 'ART', number: '301' },    // not in partial
      ],
    };
    const { status } = audit(ast, minimalCatalog, partial);
    expect(status).toBe(NOT_MET);
  });

  test('one in-progress → in-progress (risk)', () => {
    const ast = {
      type: 'none-of',
      items: [
        { type: 'course', subject: 'CMPS', number: '310' },   // in-progress
        { type: 'course', subject: 'ART', number: '301' },    // not in transcript
      ],
    };
    const { status } = audit(ast, minimalCatalog, inProgress);
    expect(status).toBe(PROVISIONAL_MET);
  });

  test('empty → met', () => {
    const ast = { type: 'none-of', items: [] };
    const { status } = audit(ast, minimalCatalog, empty);
    expect(status).toBe(MET);
  });
});

// ============================================================
// one-from-each
// ============================================================

describe('one-from-each', () => {
  test('one course from each group → met', () => {
    const ast = {
      type: 'one-from-each',
      items: [
        { type: 'any-of', items: [
          { type: 'course', subject: 'MATH', number: '101' },
          { type: 'course', subject: 'MATH', number: '151' },
        ] },
        { type: 'any-of', items: [
          { type: 'course', subject: 'CMPS', number: '130' },
          { type: 'course', subject: 'CMPS', number: '135' },
        ] },
      ],
    };
    const { status, result } = audit(ast, minimalCatalog, complete);
    expect(status).toBe(MET);
    expect(result.items).toHaveLength(2);
    expect(result.items[0].status).toBe(MET);
    expect(result.items[1].status).toBe(MET);
  });

  test('missing from one group → partial-progress', () => {
    const ast = {
      type: 'one-from-each',
      items: [
        { type: 'any-of', items: [
          { type: 'course', subject: 'MATH', number: '101' },  // in partial
        ] },
        { type: 'any-of', items: [
          { type: 'course', subject: 'ART', number: '301' },   // NOT in partial
          { type: 'course', subject: 'ART', number: '401' },   // NOT in partial
        ] },
      ],
    };
    const { status } = audit(ast, minimalCatalog, partial);
    expect(status).toBe(IN_PROGRESS);
  });

  test('one group has in-progress → in-progress', () => {
    const ast = {
      type: 'one-from-each',
      items: [
        { type: 'any-of', items: [
          { type: 'course', subject: 'MATH', number: '101' },  // completed
        ] },
        { type: 'any-of', items: [
          { type: 'course', subject: 'CMPS', number: '310' },  // in-progress
        ] },
      ],
    };
    const { status } = audit(ast, minimalCatalog, inProgress);
    expect(status).toBe(PROVISIONAL_MET);
  });

  test('no groups satisfied → not-met', () => {
    const ast = {
      type: 'one-from-each',
      items: [
        { type: 'any-of', items: [
          { type: 'course', subject: 'ART', number: '301' },
        ] },
        { type: 'any-of', items: [
          { type: 'course', subject: 'ART', number: '401' },
        ] },
      ],
    };
    const { status } = audit(ast, minimalCatalog, empty);
    expect(status).toBe(NOT_MET);
  });

  test('course-filter groups', () => {
    const ast = {
      type: 'one-from-each',
      items: [
        { type: 'course-filter',
          filters: [{ field: 'attribute', op: 'eq', value: 'SCI' }] },
        { type: 'course-filter',
          filters: [{ field: 'attribute', op: 'eq', value: 'HUM' }] },
      ],
    };
    const { status } = audit(ast, minimalCatalog, complete);
    expect(status).toBe(MET);
  });
});

// ============================================================
// from-n-groups
// ============================================================

describe('from-n-groups', () => {
  test('met groups ≥ K → met', () => {
    const ast = {
      type: 'from-n-groups', count: 2,
      items: [
        { type: 'any-of', items: [
          { type: 'course', subject: 'MATH', number: '101' },
        ] },
        { type: 'any-of', items: [
          { type: 'course', subject: 'CMPS', number: '130' },
        ] },
        { type: 'any-of', items: [
          { type: 'course', subject: 'ART', number: '301' },
        ] },
      ],
    };
    const { status, result } = audit(ast, minimalCatalog, partial);
    expect(status).toBe(MET);
    expect(result.count).toBe(2);
  });

  test('met + ip groups ≥ K → in-progress', () => {
    const ast = {
      type: 'from-n-groups', count: 2,
      items: [
        { type: 'any-of', items: [
          { type: 'course', subject: 'MATH', number: '101' },  // completed
        ] },
        { type: 'any-of', items: [
          { type: 'course', subject: 'CMPS', number: '310' },  // in-progress
        ] },
        { type: 'any-of', items: [
          { type: 'course', subject: 'ART', number: '301' },   // not met
        ] },
      ],
    };
    const { status } = audit(ast, minimalCatalog, inProgress);
    expect(status).toBe(PROVISIONAL_MET);
  });

  test('some group progress but not enough → partial-progress', () => {
    const ast = {
      type: 'from-n-groups', count: 3,
      items: [
        { type: 'any-of', items: [
          { type: 'course', subject: 'MATH', number: '101' },  // met
        ] },
        { type: 'any-of', items: [
          { type: 'course', subject: 'ART', number: '301' },   // not met
        ] },
        { type: 'any-of', items: [
          { type: 'course', subject: 'ART', number: '401' },   // not met
        ] },
      ],
    };
    const { status } = audit(ast, minimalCatalog, partial);
    expect(status).toBe(IN_PROGRESS);
  });

  test('no groups met → not-met', () => {
    const ast = {
      type: 'from-n-groups', count: 2,
      items: [
        { type: 'any-of', items: [
          { type: 'course', subject: 'ART', number: '301' },
        ] },
        { type: 'any-of', items: [
          { type: 'course', subject: 'ART', number: '401' },
        ] },
      ],
    };
    const { status } = audit(ast, minimalCatalog, empty);
    expect(status).toBe(NOT_MET);
  });

  test('course-filter groups → met when enough groups have matches', () => {
    // 3 groups as course-filters: QR courses, SCI courses, FA courses
    // Complete transcript has QR (MATH), SCI (PHYS, CHEM, BIOL), and FA (ART) — all 3 groups met
    const ast = {
      type: 'from-n-groups', count: 2,
      items: [
        { type: 'course-filter',
          filters: [{ field: 'attribute', op: 'eq', value: 'QR' }] },
        { type: 'course-filter',
          filters: [{ field: 'attribute', op: 'eq', value: 'SCI' }] },
        { type: 'course-filter',
          filters: [{ field: 'attribute', op: 'eq', value: 'FA' }] },
      ],
    };
    const { status, result } = audit(ast, minimalCatalog, complete);
    expect(status).toBe(MET);
    expect(result.count).toBe(2);
    expect(result.items).toHaveLength(3);
  });

  test('course-filter groups → not-met when too few groups match', () => {
    const ast = {
      type: 'from-n-groups', count: 2,
      items: [
        { type: 'course-filter',
          filters: [{ field: 'attribute', op: 'eq', value: 'QR' }] },
        { type: 'course-filter',
          filters: [{ field: 'attribute', op: 'eq', value: 'FA' }] },
      ],
    };
    const { status } = audit(ast, minimalCatalog, empty);
    expect(status).toBe(NOT_MET);
  });
});

// ============================================================
// Nested composites
// ============================================================

describe('nested composites', () => {
  test('all-of containing any-of children', () => {
    const ast = {
      type: 'all-of',
      items: [
        { type: 'any-of', items: [
          { type: 'course', subject: 'MATH', number: '101' },
          { type: 'course', subject: 'MATH', number: '151' },
        ] },
        { type: 'any-of', items: [
          { type: 'course', subject: 'CMPS', number: '130' },
          { type: 'course', subject: 'CMPS', number: '135' },
        ] },
      ],
    };
    const { status, result } = audit(ast, minimalCatalog, partial);
    expect(status).toBe(MET);
    expect(result.items[0].status).toBe(MET);
    expect(result.items[1].status).toBe(MET);
  });

  test('all-of with mixed children propagates partial-progress', () => {
    const ast = {
      type: 'all-of',
      items: [
        { type: 'course', subject: 'MATH', number: '101' },   // met in partial
        { type: 'all-of', items: [
          { type: 'course', subject: 'CMPS', number: '130' },  // met in partial
          { type: 'course', subject: 'ART', number: '301' },   // NOT in partial
        ] },
      ],
    };
    const { status, result } = audit(ast, minimalCatalog, partial);
    expect(status).toBe(IN_PROGRESS);
    expect(result.items[0].status).toBe(MET);
    expect(result.items[1].status).toBe(IN_PROGRESS);
  });

  test('three levels deep — all met → met', () => {
    const ast = {
      type: 'all-of',
      items: [
        { type: 'all-of', items: [
          { type: 'any-of', items: [
            { type: 'course', subject: 'MATH', number: '101' },
          ] },
        ] },
        { type: 'course', subject: 'CMPS', number: '130' },
      ],
    };
    const { status } = audit(ast, minimalCatalog, complete);
    expect(status).toBe(MET);
  });
});
