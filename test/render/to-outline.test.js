'use strict';

const { toOutline } = require('../../src/render/to-outline');
const { parse } = require('../../src/parser');

function outline(input, catalog) {
  return toOutline(parse(input), catalog);
}

// === Leaf Nodes ===

describe('toOutline — leaf nodes', () => {
  test('course', () => {
    expect(outline('MATH 151')).toBe('MATH 151');
  });

  test('course with catalog title', () => {
    const catalog = { courses: [{ subject: 'MATH', number: '151', title: 'Calculus I' }] };
    expect(outline('MATH 151', catalog)).toBe('MATH 151 - Calculus I');
  });

  test('course with catalog — no match', () => {
    const catalog = { courses: [{ subject: 'CSCI', number: '120', title: 'Intro' }] };
    expect(outline('MATH 151', catalog)).toBe('MATH 151');
  });

  test('concurrent course', () => {
    expect(outline('CMPS 230 (concurrent)')).toBe('CMPS 230 (concurrent)');
  });

  test('course-filter', () => {
    expect(outline('courses where subject = "CMPS" and number >= 300')).toBe(
      'Any course where subject is "CMPS" and number is at least 300'
    );
  });

  test('score', () => {
    expect(outline('score SAT_MATH >= 580')).toBe('Score SAT_MATH is at least 580');
  });

  test('attainment', () => {
    expect(outline('attainment JUNIOR_STANDING')).toBe('Attainment: JUNIOR_STANDING');
  });

  test('quantity', () => {
    expect(outline('quantity CLINICAL_HOURS >= 500')).toBe('Quantity: CLINICAL_HOURS is at least 500');
  });

  test('variable-ref', () => {
    expect(outline('$core')).toBe('$core');
  });

  test('cross-scope variable-ref', () => {
    expect(outline('$cmps-major.core')).toBe('$cmps-major.core');
  });

  test('program', () => {
    expect(outline('program CS major undergraduate')).toBe('Program CS (major, undergraduate)');
  });

  test('any program', () => {
    expect(outline('any program major undergraduate')).toBe('Any program (major, undergraduate)');
  });

  test('primary major', () => {
    expect(outline('primary major')).toBe('primary major');
  });
});

// === Composite Nodes ===

describe('toOutline — all-of', () => {
  test('two items', () => {
    expect(outline('all of (MATH 151, MATH 152)')).toBe(
      'All of the following:\n├── MATH 151\n└── MATH 152'
    );
  });

  test('with catalog titles', () => {
    const catalog = {
      courses: [
        { subject: 'MATH', number: '151', title: 'Calculus I' },
        { subject: 'MATH', number: '152', title: 'Calculus II' },
      ],
    };
    expect(outline('all of (MATH 151, MATH 152)', catalog)).toBe(
      'All of the following:\n├── MATH 151 - Calculus I\n└── MATH 152 - Calculus II'
    );
  });

  test('three items', () => {
    expect(outline('all of (MATH 151, MATH 152, MATH 250)')).toBe(
      'All of the following:\n├── MATH 151\n├── MATH 152\n└── MATH 250'
    );
  });
});

describe('toOutline — any-of', () => {
  test('two items', () => {
    expect(outline('any of (CMPS 130, CMPS 135)')).toBe(
      'Any one of the following:\n├── CMPS 130\n└── CMPS 135'
    );
  });
});

describe('toOutline — n-of', () => {
  test('at least', () => {
    expect(outline('at least 2 of (MATH 151, MATH 152, MATH 250)')).toBe(
      'Complete at least 2 of the following:\n├── MATH 151\n├── MATH 152\n└── MATH 250'
    );
  });
});

describe('toOutline — credits-from', () => {
  test('single source', () => {
    expect(outline('at least 15 credits from (courses where subject = "CSE")')).toBe(
      'Complete at least 15 credits from:\n└── Any course where subject is "CSE"'
    );
  });

  test('multiple sources', () => {
    expect(outline('at least 12 credits from (MATH 151, MATH 152, MATH 250)')).toBe(
      'Complete at least 12 credits from:\n├── MATH 151\n├── MATH 152\n└── MATH 250'
    );
  });
});

describe('toOutline — one-from-each', () => {
  test('three groups', () => {
    const result = outline('one from each of (courses where attribute = "HUM", courses where attribute = "SCI", courses where attribute = "SS")');
    expect(result).toContain('One from each of the following:');
    expect(result).toContain('├── Any course where attribute is "HUM"');
    expect(result).toContain('└── Any course where attribute is "SS"');
  });

  test('with catalog titles', () => {
    const catalog = {
      courses: [
        { subject: 'MATH', number: '151', title: 'Calculus I' },
        { subject: 'MATH', number: '152', title: 'Calculus II' },
      ],
    };
    const result = outline('one from each of (MATH 151, MATH 152)', catalog);
    expect(result).toContain('MATH 151 - Calculus I');
    expect(result).toContain('MATH 152 - Calculus II');
  });

  test('with nested composites', () => {
    const result = outline('one from each of (all of (MATH 151, MATH 152), all of (CSCI 120, CSCI 121))');
    expect(result).toContain('One from each of the following:');
    expect(result).toContain('├── All of the following:');
    expect(result).toContain('│   ├── MATH 151');
    expect(result).toContain('└── All of the following:');
  });

  test('with-constraint wrapping', () => {
    const result = outline('one from each of (MATH 151, MATH 152) with gpa >= 2.0');
    expect(result).toContain('One from each of the following: (min GPA: 2)');
  });
});

describe('toOutline — from-n-groups', () => {
  test('from at least 2', () => {
    const result = outline('from at least 2 of (courses where attribute = "HUM", courses where attribute = "SCI")');
    expect(result).toContain('From at least 2 of the following groups:');
  });

  test('four groups with tree structure', () => {
    const result = outline('from at least 3 of (courses where attribute = "HUM", courses where attribute = "SCI", courses where attribute = "SS", courses where attribute = "ART")');
    expect(result).toBe(
      'From at least 3 of the following groups:\n' +
      '├── Any course where attribute is "HUM"\n' +
      '├── Any course where attribute is "SCI"\n' +
      '├── Any course where attribute is "SS"\n' +
      '└── Any course where attribute is "ART"'
    );
  });

  test('nested inside all-of', () => {
    const result = outline(`all of (
      CSCI 120,
      from at least 2 of (courses where attribute = "HUM", courses where attribute = "SCI")
    )`);
    expect(result).toContain('└── From at least 2 of the following groups:');
    expect(result).toContain('    ├── Any course where attribute is "HUM"');
  });
});

// === Nested ===

describe('toOutline — nested structures', () => {
  test('all-of with nested any-of', () => {
    const catalog = {
      courses: [
        { subject: 'MATH', number: '151', title: 'Calculus I' },
        { subject: 'MATH', number: '152', title: 'Calculus II' },
        { subject: 'CMPS', number: '130', title: 'Intro to CS' },
        { subject: 'CMPS', number: '135', title: 'Intro to CS for Engineers' },
      ],
    };
    const result = outline(`all of (
      MATH 151,
      MATH 152,
      any of (CMPS 130, CMPS 135)
    )`, catalog);
    expect(result).toBe(
      'All of the following:\n' +
      '├── MATH 151 - Calculus I\n' +
      '├── MATH 152 - Calculus II\n' +
      '└── Any one of the following:\n' +
      '    ├── CMPS 130 - Intro to CS\n' +
      '    └── CMPS 135 - Intro to CS for Engineers'
    );
  });

  test('deeply nested', () => {
    const result = outline(`all of (
      $cs_core,
      at least 3 of (
        courses where subject = "CSCI" and number >= 300
      )
    )`);
    expect(result).toContain('All of the following:');
    expect(result).toContain('├── $cs_core');
    expect(result).toContain('└── Complete at least 3 of the following:');
    expect(result).toContain('    └── Any course where subject is "CSCI" and number is at least 300');
  });
});

// === Wrapper Nodes ===

describe('toOutline — with-constraint', () => {
  test('grade on leaf', () => {
    expect(outline('CSCI 121 with grade >= "C-"')).toBe('CSCI 121 (min grade: C-)');
  });

  test('gpa on composite', () => {
    const result = outline('all of (MATH 151, MATH 152) with gpa >= 2.0');
    expect(result).toContain('All of the following: (min GPA: 2)');
    expect(result).toContain('├── MATH 151');
  });

  test('grade on leaf with catalog', () => {
    const catalog = { courses: [{ subject: 'CSCI', number: '121', title: 'Data Structures' }] };
    expect(outline('CSCI 121 with grade >= "C-"', catalog)).toBe(
      'CSCI 121 - Data Structures (min grade: C-)'
    );
  });
});

describe('toOutline — except', () => {
  test('filter except courses (leaf source)', () => {
    const result = outline('courses where subject = "CMPS" except (CMPS 490)');
    expect(result).toContain('except:');
    expect(result).toContain('CMPS 490');
  });

  test('except with composite source preserves source tree children', () => {
    const result = outline('all of (MATH 151, MATH 152, CMPS 130) except (CMPS 130)');
    // Source tree's children must not be dropped
    expect(result).toContain('MATH 151');
    expect(result).toContain('MATH 152');
    expect(result).toContain('CMPS 130');
    expect(result).toContain('Source:');
    expect(result).toContain('Except:');
  });

  test('except with deeply nested composite source', () => {
    const result = outline('all of (MATH 151, any of (MATH 152, CMPS 130)) except (CMPS 130)');
    expect(result).toContain('MATH 151');
    expect(result).toContain('MATH 152');
    expect(result).toContain('CMPS 130');
    expect(result).toContain('Source:');
  });
});

describe('toOutline — variable-def and scope', () => {
  test('variable-def renders value', () => {
    expect(outline('$core = all of (MATH 151, MATH 152)')).toBe(
      'All of the following:\n├── MATH 151\n└── MATH 152'
    );
  });

  test('scope renders body', () => {
    expect(outline('scope "test" { all of (MATH 151, MATH 152) }')).toBe(
      'All of the following:\n├── MATH 151\n└── MATH 152'
    );
  });
});

// === Policy Nodes ===

describe('toOutline — policy nodes', () => {
  test('overlap-limit', () => {
    expect(outline('overlap between ($coll, $cs_major) at most 3 courses')).toBe(
      'Overlap between $coll and $cs_major: at most 3 courses'
    );
  });

  test('overlap-limit percent', () => {
    expect(outline('overlap between ($cs_minor, primary major) at most 50 %')).toBe(
      'Overlap between $cs_minor and primary major: at most 50%'
    );
  });

  test('outside-program', () => {
    expect(outline('outside (primary major) at least 72 credits')).toBe(
      'At least 72 credits from outside primary major'
    );
  });
});

// === Post-Constraints ===

describe('toOutline — post_constraints', () => {
  test('where clause on n-of', () => {
    const result = outline('at least 5 of (POLI 215, POLI 301) where at least 1 match (subject = "POLI")');
    expect(result).toContain('(where at least 1 have subject is "POLI")');
  });

  test('where clause on all-of', () => {
    const result = outline('all of (MATH 151, MATH 152) where at least 1 match (subject = "MATH")');
    expect(result).toContain('All of the following: (where at least 1 have subject is "MATH")');
    expect(result).toContain('├── MATH 151');
  });

  test('where clause on any-of', () => {
    const result = outline('any of (MATH 151, CSCI 120) where at least 1 match (subject = "MATH")');
    expect(result).toContain('Any one of the following: (where at least 1 have subject is "MATH")');
  });

  test('where clause on credits-from', () => {
    const result = outline('at least 12 credits from (MATH 151, MATH 152) where at least 1 match (subject = "MATH")');
    expect(result).toContain('Complete at least 12 credits from: (where at least 1 have subject is "MATH")');
  });

  test('where clause on except', () => {
    const result = outline('courses where subject = "CMPS" except (CMPS 490) where at least 1 match (number >= 300)');
    expect(result).toContain('except: (where at least 1 have number is at least 300)');
  });
});

// === Additional Coverage ===

describe('toOutline — additional coverage', () => {
  test('none-of as composite', () => {
    const result = outline('none of (MATH 151, MATH 152)');
    expect(result).toContain('None of the following:');
    expect(result).toContain('├── MATH 151');
    expect(result).toContain('└── MATH 152');
  });

  test('at most n-of', () => {
    const result = outline('at most 2 of (MATH 151, MATH 152, MATH 250)');
    expect(result).toContain('Complete at most 2 of the following:');
  });

  test('exactly n-of', () => {
    const result = outline('exactly 1 of (MATH 151, MATH 152)');
    expect(result).toContain('Complete exactly 1 of the following:');
  });

  test('corequisite includes filter', () => {
    const result = outline('courses where corequisite includes (MATH 151)');
    expect(result).toContain('corequisite includes');
  });

  test('subject in list filter', () => {
    const result = outline('at least 3 of (POLI 215, POLI 301) where at most 1 match (subject in ("POLI", "HIST"))');
    expect(result).toContain('where at most 1 have');
  });

  test('except with composite source preserves all items', () => {
    const result = outline('all of (CMPS 301, CMPS 302) except (CMPS 302)');
    expect(result).toContain('Except:');
    expect(result).toContain('CMPS 301');
    expect(result).toContain('CMPS 302');
  });
});

// === Direct AST Construction ===
// These test renderer branches independently of the parser.

describe('toOutline — direct AST: score operator variants', () => {
  test.each([
    ['gte', 'is at least'],
    ['gt', 'is above'],
    ['lte', 'is at most'],
    ['lt', 'is below'],
    ['eq', 'is'],
    ['ne', 'is not'],
  ])('score op %s → "%s"', (op, phrase) => {
    const result = toOutline({ type: 'score', name: 'SAT', op, value: 1200 });
    expect(result).toBe(`Score SAT ${phrase} 1200`);
  });
});

describe('toOutline — direct AST: quantity operator variants', () => {
  test.each([
    ['gte', 'is at least'],
    ['gt', 'is above'],
    ['lte', 'is at most'],
    ['lt', 'is below'],
    ['eq', 'is'],
    ['ne', 'is not'],
  ])('quantity op %s → "%s"', (op, phrase) => {
    const result = toOutline({ type: 'quantity', name: 'HOURS', op, value: 100 });
    expect(result).toBe(`Quantity: HOURS ${phrase} 100`);
  });
});

describe('toOutline — direct AST: course-filter operator variants', () => {
  test.each([
    ['eq', 'is'],
    ['ne', 'is not'],
    ['gt', 'is above'],
    ['gte', 'is at least'],
    ['lt', 'is below'],
    ['lte', 'is at most'],
  ])('filter op %s → "%s"', (op, phrase) => {
    const result = toOutline({
      type: 'course-filter',
      filters: [{ field: 'number', op, value: 300 }],
    });
    expect(result).toBe(`Any course where number ${phrase} 300`);
  });

  test('in operator', () => {
    const result = toOutline({
      type: 'course-filter',
      filters: [{ field: 'subject', op: 'in', value: ['CSCI', 'MATH'] }],
    });
    expect(result).toBe('Any course where subject is one of "CSCI", "MATH"');
  });

  test('not-in operator', () => {
    const result = toOutline({
      type: 'course-filter',
      filters: [{ field: 'subject', op: 'not-in', value: ['PHYS'] }],
    });
    expect(result).toBe('Any course where subject is not one of "PHYS"');
  });
});

describe('toOutline — direct AST: null/empty catalog handling', () => {
  test('null catalog', () => {
    const result = toOutline({ type: 'course', subject: 'MATH', number: '151' }, null);
    expect(result).toBe('MATH 151');
  });

  test('catalog with no courses array', () => {
    const result = toOutline({ type: 'course', subject: 'MATH', number: '151' }, {});
    expect(result).toBe('MATH 151');
  });

  test('undefined catalog', () => {
    const result = toOutline({ type: 'course', subject: 'MATH', number: '151' });
    expect(result).toBe('MATH 151');
  });
});

// === Labels ===

describe('toOutline — labels', () => {
  test('labeled all-of', () => {
    expect(outline('"Core": all of (MATH 151, MATH 152)')).toBe(
      'Core \u2014 All of the following:\n\u251C\u2500\u2500 MATH 151\n\u2514\u2500\u2500 MATH 152'
    );
  });

  test('labeled any-of', () => {
    const result = outline('"Alternatives": any of (MATH 151, MATH 152)');
    expect(result).toContain('Alternatives \u2014 Any one of the following:');
  });

  test('labeled n-of', () => {
    const result = outline('"Electives": at least 2 of (MATH 151, MATH 152, MATH 250)');
    expect(result).toContain('Electives \u2014 Complete at least 2 of the following:');
  });

  test('labeled from-n-groups', () => {
    const result = outline('"Breadth": from at least 2 of (courses where attribute = "HUM", courses where attribute = "SCI")');
    expect(result).toContain('Breadth \u2014 From at least 2 of the following groups:');
  });

  test('labeled one-from-each', () => {
    const result = outline('"Distribution": one from each of (courses where attribute = "HUM", courses where attribute = "SCI")');
    expect(result).toContain('Distribution \u2014 One from each of the following:');
  });

  test('labeled none-of', () => {
    const result = outline('"Excluded": none of (MATH 151, MATH 152)');
    expect(result).toContain('Excluded \u2014 None of the following:');
  });

  test('unlabeled composite unchanged', () => {
    expect(outline('all of (MATH 151, MATH 152)')).toBe(
      'All of the following:\n\u251C\u2500\u2500 MATH 151\n\u2514\u2500\u2500 MATH 152'
    );
  });

  test('labeled credits-from', () => {
    const result = outline('"Technical": at least 15 credits from (courses where subject = "CSE")');
    expect(result).toContain('Technical \u2014 Complete at least 15 credits from:');
  });

  test('nested labeled inside all-of', () => {
    const result = outline(`all of (
      "Math Core": all of (MATH 151, MATH 152),
      CSCI 120
    )`);
    expect(result).toContain('\u251C\u2500\u2500 Math Core \u2014 All of the following:');
  });
});

// === Error ===

describe('toOutline — error', () => {
  test('unknown node type throws', () => {
    expect(() => toOutline({ type: 'bogus' })).toThrow('Unknown node type: bogus');
  });
});
