'use strict';

const { toDescription } = require('../../src/render/to-description');
const { parse } = require('../../src/parser');

function desc(input) {
  return toDescription(parse(input));
}

// === Leaf Nodes ===

describe('toDescription — course', () => {
  test('standard course', () => {
    expect(desc('MATH 151')).toBe('MATH 151');
  });

  test('concurrent', () => {
    expect(desc('CMPS 230 (concurrent)')).toBe('CMPS 230 (may be taken concurrently)');
  });
});

describe('toDescription — course-filter', () => {
  test('subject equality', () => {
    expect(desc('courses where subject = "CMPS"')).toBe('Any course where subject is "CMPS"');
  });

  test('subject inequality', () => {
    expect(desc('courses where subject != "PHYS"')).toBe('Any course where subject is not "PHYS"');
  });

  test('number >=', () => {
    expect(desc('courses where number >= 300')).toBe('Any course where number is at least 300');
  });

  test('compound', () => {
    expect(desc('courses where subject = "CMPS" and number >= 300')).toBe(
      'Any course where subject is "CMPS" and number is at least 300'
    );
  });

  test('subject in list', () => {
    expect(desc('courses where subject in ("CSCI", "MATH")')).toBe(
      'Any course where subject is one of "CSCI", "MATH"'
    );
  });

  test('prerequisite includes', () => {
    expect(desc('courses where prerequisite includes (CMPS 104)')).toBe(
      'Any course where prerequisite includes CMPS 104'
    );
  });

  test('corequisite includes', () => {
    expect(desc('courses where corequisite includes (MATH 151)')).toBe(
      'Any course where corequisite includes MATH 151'
    );
  });
});

describe('toDescription — score', () => {
  test('score >=', () => {
    expect(desc('score SAT_MATH >= 580')).toBe('Score of 580 or higher on SAT_MATH');
  });

  test('score >', () => {
    expect(toDescription({ type: 'score', name: 'SAT', op: 'gt', value: 1200 })).toBe(
      'Score above 1200 on SAT'
    );
  });

  test('score =', () => {
    expect(toDescription({ type: 'score', name: 'AP', op: 'eq', value: 5 })).toBe(
      'Score of exactly 5 on AP'
    );
  });

  test('score <=', () => {
    expect(toDescription({ type: 'score', name: 'SAT', op: 'lte', value: 800 })).toBe(
      'Score of 800 or lower on SAT'
    );
  });

  test('score <', () => {
    expect(toDescription({ type: 'score', name: 'SAT', op: 'lt', value: 800 })).toBe(
      'Score below 800 on SAT'
    );
  });

  test('score !=', () => {
    expect(toDescription({ type: 'score', name: 'SAT', op: 'ne', value: 0 })).toBe(
      'Score other than 0 on SAT'
    );
  });
});

describe('toDescription — attainment', () => {
  test('simple', () => {
    expect(desc('attainment JUNIOR_STANDING')).toBe('Completion of JUNIOR_STANDING');
  });
});

describe('toDescription — quantity', () => {
  test('quantity >=', () => {
    expect(desc('quantity CLINICAL_HOURS >= 500')).toBe('At least 500 CLINICAL_HOURS');
  });

  test('quantity <=', () => {
    expect(toDescription({ type: 'quantity', name: 'HOURS', op: 'lte', value: 100 })).toBe(
      'At most 100 HOURS'
    );
  });

  test('quantity >', () => {
    expect(toDescription({ type: 'quantity', name: 'HOURS', op: 'gt', value: 50 })).toBe(
      'More than 50 HOURS'
    );
  });

  test('quantity <', () => {
    expect(toDescription({ type: 'quantity', name: 'HOURS', op: 'lt', value: 50 })).toBe(
      'Fewer than 50 HOURS'
    );
  });

  test('quantity =', () => {
    expect(toDescription({ type: 'quantity', name: 'HOURS', op: 'eq', value: 100 })).toBe(
      'Exactly 100 HOURS'
    );
  });

  test('quantity !=', () => {
    expect(toDescription({ type: 'quantity', name: 'HOURS', op: 'ne', value: 0 })).toBe(
      'Not 0 HOURS'
    );
  });
});

describe('toDescription — variable-ref', () => {
  test('simple ref', () => {
    expect(desc('$core')).toBe('(see $core)');
  });

  test('cross-scope ref', () => {
    expect(desc('$cmps-major.core')).toBe('(see $cmps-major.core)');
  });
});

// === Composite Nodes ===

describe('toDescription — all-of', () => {
  test('two items', () => {
    expect(desc('all of (MATH 151, MATH 152)')).toBe(
      'Complete all of the following:\n  - MATH 151\n  - MATH 152'
    );
  });

  test('single item', () => {
    expect(desc('all of (MATH 151)')).toBe(
      'Complete all of the following: MATH 151'
    );
  });
});

describe('toDescription — any-of', () => {
  test('two items', () => {
    expect(desc('any of (MATH 151, MATH 152)')).toBe(
      'Complete any one of the following:\n  - MATH 151\n  - MATH 152'
    );
  });
});

describe('toDescription — none-of', () => {
  test('two items', () => {
    expect(desc('none of (MATH 151, MATH 152)')).toBe(
      'None of the following may be used:\n  - MATH 151\n  - MATH 152'
    );
  });
});

describe('toDescription — n-of', () => {
  test('at least', () => {
    expect(desc('at least 2 of (MATH 151, MATH 152, MATH 250)')).toBe(
      'Complete at least 2 of the following:\n  - MATH 151\n  - MATH 152\n  - MATH 250'
    );
  });

  test('at most', () => {
    expect(desc('at most 2 of (MATH 151, MATH 152, MATH 250)')).toBe(
      'Complete at most 2 of the following:\n  - MATH 151\n  - MATH 152\n  - MATH 250'
    );
  });

  test('exactly', () => {
    expect(desc('exactly 1 of (MATH 151, MATH 152)')).toBe(
      'Complete exactly 1 of the following:\n  - MATH 151\n  - MATH 152'
    );
  });
});

describe('toDescription — one-from-each', () => {
  test('three items', () => {
    const result = desc('one from each of (courses where attribute = "HUM", courses where attribute = "SCI", courses where attribute = "SS")');
    expect(result).toContain('Complete one course from each of the following areas:');
    expect(result).toContain('Any course where attribute is "HUM"');
    expect(result).toContain('Any course where attribute is "SCI"');
    expect(result).toContain('Any course where attribute is "SS"');
  });

  test('with nested composites', () => {
    const result = desc('one from each of (all of (MATH 151, MATH 152), all of (CSCI 120, CSCI 121))');
    expect(result).toContain('Complete one course from each of the following areas:');
    expect(result).toContain('Complete all of the following:');
  });

  test('with-constraint wrapping', () => {
    const result = desc('one from each of (MATH 151, MATH 152) with gpa >= 2.0');
    expect(result).toContain('with a minimum GPA of 2');
  });
});

describe('toDescription — from-n-groups', () => {
  test('from at least 2', () => {
    const result = desc('from at least 2 of (courses where attribute = "HUM", courses where attribute = "SCI", courses where attribute = "SS")');
    expect(result).toContain('Complete courses from at least 2 of the following groups:');
  });

  test('four groups', () => {
    const result = desc('from at least 3 of (courses where attribute = "HUM", courses where attribute = "SCI", courses where attribute = "SS", courses where attribute = "ART")');
    expect(result).toContain('Complete courses from at least 3 of the following groups:');
    expect(result).toContain('Any course where attribute is "ART"');
  });
});

describe('toDescription — credits-from', () => {
  test('single source', () => {
    expect(desc('at least 15 credits from (courses where subject = "CSE" and number >= 200)')).toBe(
      'Complete at least 15 credits from: Any course where subject is "CSE" and number is at least 200'
    );
  });

  test('multiple sources', () => {
    const result = desc('at least 12 credits from (MATH 151, MATH 152, MATH 250)');
    expect(result).toContain('Complete at least 12 credits from:');
    expect(result).toContain('MATH 151');
    expect(result).toContain('MATH 152');
    expect(result).toContain('MATH 250');
  });
});

// === Wrapper/Modifier Nodes ===

describe('toDescription — with-constraint', () => {
  test('grade constraint', () => {
    expect(desc('CSCI 121 with grade >= "C-"')).toBe('CSCI 121 with a minimum grade of C-');
  });

  test('gpa constraint', () => {
    expect(desc('all of (MATH 151, MATH 152) with gpa >= 2.0')).toContain('with a minimum GPA of 2');
  });
});

describe('toDescription — except', () => {
  test('filter except courses', () => {
    const result = desc('courses where subject = "CMPS" except (CMPS 490)');
    expect(result).toContain('Any course where subject is "CMPS"');
    expect(result).toContain('except:');
    expect(result).toContain('CMPS 490');
  });
});

describe('toDescription — variable-def', () => {
  test('renders the value', () => {
    expect(desc('$core = all of (MATH 151, MATH 152)')).toBe(
      'Complete all of the following:\n  - MATH 151\n  - MATH 152'
    );
  });
});

describe('toDescription — scope', () => {
  test('renders the body', () => {
    const input = 'scope "test" { all of (MATH 151, MATH 152) }';
    expect(toDescription(parse(input))).toBe(
      'Complete all of the following:\n  - MATH 151\n  - MATH 152'
    );
  });
});

// === Policy Nodes ===

describe('toDescription — program', () => {
  test('named program', () => {
    expect(desc('program CS major undergraduate')).toBe('Program CS (major, undergraduate)');
  });

  test('any program', () => {
    expect(desc('any program major undergraduate')).toBe('Any program (major, undergraduate)');
  });
});

describe('toDescription — program-context-ref', () => {
  test('primary major', () => {
    expect(desc('primary major')).toBe('primary major');
  });

  test('primary minor', () => {
    expect(desc('primary minor')).toBe('primary minor');
  });
});

describe('toDescription — overlap-limit', () => {
  test('courses', () => {
    expect(desc('overlap between ($coll, $cs_major) at most 3 courses')).toBe(
      'Overlap between (see $coll) and (see $cs_major): at most 3 courses'
    );
  });

  test('percent', () => {
    expect(desc('overlap between ($cs_minor, primary major) at most 50 %')).toBe(
      'Overlap between (see $cs_minor) and primary major: at most 50%'
    );
  });
});

describe('toDescription — outside-program', () => {
  test('primary major', () => {
    expect(desc('outside (primary major) at least 72 credits')).toBe(
      'At least 72 credits must come from outside primary major'
    );
  });
});

// === Post-Constraints ===

describe('toDescription — post_constraints', () => {
  test('where at least on n-of', () => {
    const result = desc(`at least 5 of (POLI 215, POLI 301, POLI 309, POLI 315, AFST 208, HIST 251, SOCI 221) where at least 3 match (subject = "POLI")`);
    expect(result).toContain('Complete at least 5 of the following:');
    expect(result).toContain('where at least 3 must have subject is "POLI"');
  });

  test('where clause on all-of', () => {
    const result = desc('all of (MATH 151, MATH 152) where at least 1 match (subject = "MATH")');
    expect(result).toContain('Complete all of the following:');
    expect(result).toContain('where at least 1 must have subject is "MATH"');
  });

  test('where clause on any-of', () => {
    const result = desc('any of (MATH 151, CSCI 120) where at least 1 match (subject = "MATH")');
    expect(result).toContain('Complete any one of the following:');
    expect(result).toContain('where at least 1 must have subject is "MATH"');
  });

  test('where clause on credits-from', () => {
    const result = desc('at least 12 credits from (MATH 151, MATH 152) where at least 1 match (subject = "MATH")');
    expect(result).toContain('Complete at least 12 credits from:');
    expect(result).toContain('where at least 1 must have subject is "MATH"');
  });

  test('where clause on except', () => {
    const result = desc('courses where subject = "CMPS" except (CMPS 490) where at least 1 match (number >= 300)');
    expect(result).toContain('except:');
    expect(result).toContain('where at least 1 must have number is at least 300');
  });
});

// === Labels ===

describe('toDescription — labels', () => {
  test('labeled all-of', () => {
    const result = desc('"Core Requirements": all of (MATH 151, MATH 152)');
    expect(result).toBe(
      'Core Requirements \u2014 complete all of the following:\n  - MATH 151\n  - MATH 152'
    );
  });

  test('labeled any-of', () => {
    const result = desc('"Alternatives": any of (MATH 151, MATH 152)');
    expect(result).toContain('Alternatives \u2014 complete any one of the following:');
  });

  test('labeled none-of', () => {
    const result = desc('"Exclusions": none of (MATH 151, MATH 152)');
    expect(result).toContain('Exclusions \u2014 none of the following may be used:');
  });

  test('labeled n-of', () => {
    const result = desc('"Electives": at least 2 of (MATH 151, MATH 152, MATH 250)');
    expect(result).toContain('Electives \u2014 complete at least 2 of the following:');
  });

  test('labeled credits-from', () => {
    const result = desc('"Technical": at least 15 credits from (courses where subject = "CSE")');
    expect(result).toContain('Technical \u2014 complete at least 15 credits from:');
  });

  test('labeled one-from-each', () => {
    const result = desc('"Distribution": one from each of (courses where attribute = "HUM", courses where attribute = "SCI")');
    expect(result).toContain('Distribution \u2014 complete one course from each of the following areas:');
  });

  test('labeled from-n-groups', () => {
    const result = desc('"Breadth": from at least 2 of (courses where attribute = "HUM", courses where attribute = "SCI")');
    expect(result).toContain('Breadth \u2014 complete courses from at least 2 of the following groups:');
  });

  test('unlabeled composite unchanged', () => {
    expect(desc('all of (MATH 151, MATH 152)')).toBe(
      'Complete all of the following:\n  - MATH 151\n  - MATH 152'
    );
  });
});

// === Complex ===

describe('toDescription — complex', () => {
  test('nested structure', () => {
    const result = desc(`all of (
      CSCI 120,
      CSCI 121 with grade >= "C-",
      any of (CSCI 140, MATH 212)
    )`);
    expect(result).toContain('Complete all of the following:');
    expect(result).toContain('CSCI 120');
    expect(result).toContain('CSCI 121 with a minimum grade of C-');
    expect(result).toContain('Complete any one of the following:');
  });

  test('unknown node type throws', () => {
    expect(() => toDescription({ type: 'bogus' })).toThrow('Unknown node type: bogus');
  });
});
