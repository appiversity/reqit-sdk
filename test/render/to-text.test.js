'use strict';

const { toText } = require('../../src/render/to-text');
const { parse } = require('../../src/parser');

// Helper: parse then render — verifies toText output matches expected string
function expectText(input, expected) {
  expect(toText(parse(input))).toBe(expected);
}

// === Leaf Nodes ===
// One representative per code branch + normalization tests.
// Exhaustive input variations are covered by round-trip.test.js.

describe('toText — course', () => {
  test('standard course', () => {
    expectText('MATH 151', 'MATH 151');
  });

  test('concurrent', () => {
    expectText('CMPS 230 (concurrent)', 'CMPS 230 (concurrent)');
  });

  test('concurrent normalizes case', () => {
    expectText('CMPS 230 (CONCURRENT)', 'CMPS 230 (concurrent)');
  });

  test('normalizes lowercase subject', () => {
    expectText('math 151', 'MATH 151');
  });
});

describe('toText — course-filter', () => {
  // Distinct renderFilter branches: string value, numeric value, array value,
  // prerequisite-includes, corequisite-includes, compound (and-joining)

  test('subject equality (string value)', () => {
    expectText('courses where subject = "CMPS"', 'courses where subject = "CMPS"');
  });

  test('number >= (numeric value)', () => {
    expectText('courses where number >= 300', 'courses where number >= 300');
  });

  test('subject in list (array value)', () => {
    expectText(
      'courses where subject in ("CSCI", "MATH", "ECON")',
      'courses where subject in ("CSCI", "MATH", "ECON")'
    );
  });

  test('prerequisite includes', () => {
    expectText(
      'courses where prerequisite includes (CMPS 104)',
      'courses where prerequisite includes (CMPS 104)'
    );
  });

  test('corequisite includes', () => {
    expectText(
      'courses where corequisite includes (MATH 151)',
      'courses where corequisite includes (MATH 151)'
    );
  });

  test('compound (and-joining)', () => {
    expectText(
      'courses where subject = "CMPS" and number >= 300',
      'courses where subject = "CMPS" and number >= 300'
    );
  });
});

describe('toText — score', () => {
  test('score >=', () => {
    expectText('score SAT_MATH >= 580', 'score SAT_MATH >= 580');
  });

  test('normalizes code to uppercase', () => {
    expectText('score sat_math >= 580', 'score SAT_MATH >= 580');
  });
});

describe('toText — attainment', () => {
  test('simple attainment', () => {
    expectText('attainment JUNIOR_STANDING', 'attainment JUNIOR_STANDING');
  });

  test('normalizes code to uppercase', () => {
    expectText('attainment junior_standing', 'attainment JUNIOR_STANDING');
  });
});

describe('toText — quantity', () => {
  test('quantity >=', () => {
    expectText('quantity CLINICAL_HOURS >= 500', 'quantity CLINICAL_HOURS >= 500');
  });

  test('quantity with decimal', () => {
    expectText('quantity COMMUNITY_SERVICE_HOURS >= 40.5', 'quantity COMMUNITY_SERVICE_HOURS >= 40.5');
  });
});

describe('toText — variable-ref', () => {
  test('simple ref', () => {
    expectText('$core', '$core');
  });

  test('cross-scope ref', () => {
    expectText('$cmps-major.core', '$cmps-major.core');
  });
});

// === Composite Nodes ===

describe('toText — all-of', () => {
  test('two items', () => {
    expectText('all of (MATH 151, MATH 152)', 'all of (MATH 151, MATH 152)');
  });

  test('single item', () => {
    expectText('all of (MATH 151)', 'all of (MATH 151)');
  });

  test('nested all-of', () => {
    expectText(
      'all of (MATH 151, all of (CSCI 120, CSCI 121))',
      'all of (MATH 151, all of (CSCI 120, CSCI 121))'
    );
  });

  test('normalizes whitespace and case', () => {
    expectText(
      'ALL OF (  MATH 151 ,  MATH 152  )',
      'all of (MATH 151, MATH 152)'
    );
  });
});

describe('toText — any-of', () => {
  test('two items', () => {
    expectText('any of (MATH 151, MATH 152)', 'any of (MATH 151, MATH 152)');
  });

  test('nested in all-of', () => {
    expectText(
      'all of (any of (MATH 021, MATH 031), MATH 022)',
      'all of (any of (MATH 021, MATH 031), MATH 022)'
    );
  });
});

describe('toText — none-of', () => {
  test('two items', () => {
    expectText('none of (MATH 151, MATH 152)', 'none of (MATH 151, MATH 152)');
  });
});

describe('toText — n-of', () => {
  // Three comparison branches
  test('at least', () => {
    expectText(
      'at least 3 of (MATH 151, MATH 152, MATH 250, MATH 300)',
      'at least 3 of (MATH 151, MATH 152, MATH 250, MATH 300)'
    );
  });

  test('at most', () => {
    expectText(
      'at most 2 of (MATH 151, MATH 152, MATH 250)',
      'at most 2 of (MATH 151, MATH 152, MATH 250)'
    );
  });

  test('exactly', () => {
    expectText(
      'exactly 2 of (MATH 151, MATH 152, MATH 250)',
      'exactly 2 of (MATH 151, MATH 152, MATH 250)'
    );
  });
});

describe('toText — one-from-each', () => {
  test('three filter items', () => {
    expectText(
      'one from each of (courses where attribute = "HUM", courses where attribute = "SCI", courses where attribute = "SS")',
      'one from each of (courses where attribute = "HUM", courses where attribute = "SCI", courses where attribute = "SS")'
    );
  });
});

describe('toText — from-n-groups', () => {
  test('from at least 2', () => {
    expectText(
      'from at least 2 of (courses where attribute = "HUM", courses where attribute = "SCI", courses where attribute = "SS")',
      'from at least 2 of (courses where attribute = "HUM", courses where attribute = "SCI", courses where attribute = "SS")'
    );
  });
});

describe('toText — credits-from', () => {
  // Three comparison branches + source unwrapping branch
  test('at least (single source)', () => {
    expectText(
      'at least 15 credits from (courses where subject = "CSE" and number >= 200)',
      'at least 15 credits from (courses where subject = "CSE" and number >= 200)'
    );
  });

  test('at most', () => {
    expectText(
      'at most 6 credits from (courses where subject = "MATH")',
      'at most 6 credits from (courses where subject = "MATH")'
    );
  });

  test('exactly', () => {
    expectText(
      'exactly 3 credits from (courses where attribute = "WI")',
      'exactly 3 credits from (courses where attribute = "WI")'
    );
  });

  test('multiple sources (unwrap synthesized all-of)', () => {
    expectText(
      'at least 12 credits from (MATH 151, MATH 152, MATH 250)',
      'at least 12 credits from (MATH 151, MATH 152, MATH 250)'
    );
  });
});

// === Wrapper/Modifier Nodes ===

describe('toText — with-constraint', () => {
  // Two constraint kind branches
  test('grade constraint', () => {
    expectText(
      'CSCI 121 with grade >= "C-"',
      'CSCI 121 with grade >= "C-"'
    );
  });

  test('gpa constraint', () => {
    expectText(
      'all of (MATH 151, MATH 152) with gpa >= 2.0',
      'all of (MATH 151, MATH 152) with gpa >= 2.0'
    );
  });

  test('grade on variable ref', () => {
    expectText(
      '$core with grade >= "C"',
      '$core with grade >= "C"'
    );
  });
});

describe('toText — except', () => {
  test('filter except single course', () => {
    expectText(
      'courses where subject = "CMPS" except (CMPS 490)',
      'courses where subject = "CMPS" except (CMPS 490)'
    );
  });

  test('filter except multiple courses', () => {
    expectText(
      'courses where subject = "CSCI" except (CSCI 490, CSCI 491)',
      'courses where subject = "CSCI" except (CSCI 490, CSCI 491)'
    );
  });

  test('except with course filter in exclude list', () => {
    expectText(
      'courses where subject = "CMPS" except (courses where number >= 400)',
      'courses where subject = "CMPS" except (courses where number >= 400)'
    );
  });
});

describe('toText — variable-def', () => {
  test('simple def', () => {
    expectText(
      '$core = all of (MATH 151, MATH 152)',
      '$core = all of (MATH 151, MATH 152)'
    );
  });
});

describe('toText — scope', () => {
  // Three distinct paths: with defs, no defs, multiple defs
  test('basic scope with defs', () => {
    const input = `scope "cmps-major" {
      $core = all of (CMPS 130, CMPS 230)
      all of ($core)
    }`;
    expect(toText(parse(input))).toBe(
      'scope "cmps-major" { $core = all of (CMPS 130, CMPS 230) all of ($core) }'
    );
  });

  test('scope with no defs', () => {
    const input = 'scope "simple" { all of (MATH 151, MATH 152) }';
    expect(toText(parse(input))).toBe(
      'scope "simple" { all of (MATH 151, MATH 152) }'
    );
  });

  test('scope with multiple defs', () => {
    const input = `scope "cmps-major" {
      $core = all of (CMPS 130, CMPS 230)
      $math = all of (MATH 151, MATH 152)
      all of ($core, $math)
    }`;
    expect(toText(parse(input))).toBe(
      'scope "cmps-major" { $core = all of (CMPS 130, CMPS 230) $math = all of (MATH 151, MATH 152) all of ($core, $math) }'
    );
  });
});

// === Post-Constraints ===

describe('toText — post_constraints', () => {
  test('single where clause', () => {
    const input = `at least 5 of (
      POLI 215, POLI 301, POLI 309, POLI 315,
      AFST 208, HIST 251, SOCI 221
    ) where at least 3 match (subject = "POLI")`;
    expect(toText(parse(input))).toBe(
      'at least 5 of (POLI 215, POLI 301, POLI 309, POLI 315, AFST 208, HIST 251, SOCI 221) where at least 3 match (subject = "POLI")'
    );
  });

  test('at most where clause', () => {
    const input = `at least 4 of (
      BIOL 220, BIOL 315, BIOL 330, BIOL 401, BIOL 410
    ) where at most 1 match (number < 300)`;
    expect(toText(parse(input))).toBe(
      'at least 4 of (BIOL 220, BIOL 315, BIOL 330, BIOL 401, BIOL 410) where at most 1 match (number < 300)'
    );
  });

  test('exactly where clause', () => {
    const input = `at least 4 of (
      CSCI 301, CSCI 303, CSCI 304, CSCI 312, CSCI 320
    ) where exactly 2 match (number >= 400)`;
    expect(toText(parse(input))).toBe(
      'at least 4 of (CSCI 301, CSCI 303, CSCI 304, CSCI 312, CSCI 320) where exactly 2 match (number >= 400)'
    );
  });

  test('two where clauses', () => {
    const input = `at least 5 of (
      POLI 215, POLI 301, POLI 309, POLI 315,
      AFST 208, HIST 251, SOCI 221
    )
      where at least 3 match (subject = "POLI")
      where at most 1 match (number < 300)`;
    expect(toText(parse(input))).toBe(
      'at least 5 of (POLI 215, POLI 301, POLI 309, POLI 315, AFST 208, HIST 251, SOCI 221) where at least 3 match (subject = "POLI") where at most 1 match (number < 300)'
    );
  });

  test('except then where', () => {
    const input = `at least 3 of (
      LAWS 203, LAWS 320, LAWS 332, PSYC 218, SOCI 315
    ) except (LAWS 203)
      where at least 1 match (number >= 300)`;
    expect(toText(parse(input))).toBe(
      'at least 3 of (LAWS 203, LAWS 320, LAWS 332, PSYC 218, SOCI 315) except (LAWS 203) where at least 1 match (number >= 300)'
    );
  });

  test('where then with grade', () => {
    const input = `at least 3 of (
      CSCI 301, CSCI 303, CSCI 312, CSCI 320
    )
      where at least 1 match (number >= 400)
      with grade >= "C"`;
    expect(toText(parse(input))).toBe(
      'at least 3 of (CSCI 301, CSCI 303, CSCI 312, CSCI 320) where at least 1 match (number >= 400) with grade >= "C"'
    );
  });
});

// === Policy Nodes ===

describe('toText — program', () => {
  // Two branches: code present vs any program
  test('named program', () => {
    expectText('program CS major undergraduate', 'program CS major undergraduate');
  });

  test('any program', () => {
    expectText('any program major undergraduate', 'any program major undergraduate');
  });

  test('normalizes code to uppercase', () => {
    expectText('program math minor graduate', 'program MATH minor graduate');
  });
});

describe('toText — program-context-ref', () => {
  test('primary major', () => {
    expectText('primary major', 'primary major');
  });

  test('primary minor', () => {
    expectText('primary minor', 'primary minor');
  });
});

describe('toText — overlap-limit', () => {
  // Unit branch: courses/credits vs percent
  test('courses unit', () => {
    expectText(
      'overlap between ($coll, $cs_major) at most 3 courses',
      'overlap between ($coll, $cs_major) at most 3 courses'
    );
  });

  test('percent unit', () => {
    expectText(
      'overlap between ($cs_minor, primary major) at most 50 %',
      'overlap between ($cs_minor, primary major) at most 50 %'
    );
  });

  test('with program context refs', () => {
    expectText(
      'overlap between (primary major, primary minor) at most 2 courses',
      'overlap between (primary major, primary minor) at most 2 courses'
    );
  });
});

describe('toText — outside-program', () => {
  test('primary major', () => {
    expectText(
      'outside (primary major) at least 72 credits',
      'outside (primary major) at least 72 credits'
    );
  });

  test('variable ref', () => {
    expectText(
      'outside ($cmps_major) at least 60 credits',
      'outside ($cmps_major) at least 60 credits'
    );
  });
});

// === Complex Combined ===

describe('toText — complex combined constructs', () => {
  test('concurrent in prerequisite tree', () => {
    const input = `all of (
      any of (
        MATH 121 with grade >= "C",
        score ACCUPLACER_ADV_ALG >= 280
      ),
      CMPS 148 (concurrent)
    )`;
    expect(toText(parse(input))).toBe(
      'all of (any of (MATH 121 with grade >= "C", score ACCUPLACER_ADV_ALG >= 280), CMPS 148 (concurrent))'
    );
  });
});

// === Labels ===

describe('toText — labels', () => {
  test('labeled all-of', () => {
    expectText('"Core": all of (MATH 151, MATH 152)', '"Core": all of (MATH 151, MATH 152)');
  });

  test('labeled any-of', () => {
    expectText('"Alt": any of (MATH 151, MATH 152)', '"Alt": any of (MATH 151, MATH 152)');
  });

  test('labeled none-of', () => {
    expectText('"Excluded": none of (MATH 151, MATH 152)', '"Excluded": none of (MATH 151, MATH 152)');
  });

  test('labeled n-of', () => {
    expectText(
      '"Electives": at least 2 of (MATH 151, MATH 152, MATH 250)',
      '"Electives": at least 2 of (MATH 151, MATH 152, MATH 250)'
    );
  });

  test('labeled one-from-each', () => {
    expectText(
      '"Distribution": one from each of (courses where attribute = "HUM", courses where attribute = "SCI")',
      '"Distribution": one from each of (courses where attribute = "HUM", courses where attribute = "SCI")'
    );
  });

  test('labeled from-n-groups', () => {
    expectText(
      '"Breadth": from at least 2 of (courses where attribute = "HUM", courses where attribute = "SCI")',
      '"Breadth": from at least 2 of (courses where attribute = "HUM", courses where attribute = "SCI")'
    );
  });

  test('labeled credits-from', () => {
    expectText(
      '"Technical": at least 15 credits from (courses where subject = "CSE")',
      '"Technical": at least 15 credits from (courses where subject = "CSE")'
    );
  });

  test('labeled variable-def renders label on value', () => {
    expectText(
      '$core = "CS Core": all of (CMPS 130, CMPS 230)',
      '$core = "CS Core": all of (CMPS 130, CMPS 230)'
    );
  });

  test('unlabeled composite unchanged', () => {
    expectText('all of (MATH 151, MATH 152)', 'all of (MATH 151, MATH 152)');
  });
});

// === Direct AST construction ===

describe('toText — direct AST', () => {
  test('unknown node type throws', () => {
    expect(() => toText({ type: 'bogus' })).toThrow('Unknown node type: bogus');
  });
});
