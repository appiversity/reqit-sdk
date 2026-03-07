'use strict';

const { parse } = require('../../src/parser');
const { toText } = require('../../src/render/to-text');

/**
 * Round-trip test: parse(text) → toText(ast) → parse(rendered) → deepEqual.
 * The comparison is AST-level, not text-level. Different whitespace/case in
 * input text may produce the same AST.
 */
function roundTrip(text) {
  const ast = parse(text);
  const rendered = toText(ast);
  const reparsed = parse(rendered);
  expect(reparsed).toEqual(ast);
}

// ============================================================
// Leaf Nodes
// ============================================================

describe('round-trip — course references', () => {
  test.each([
    'MATH 151',
    'CSE 017',
    'CSE 003',
    'CSCI 101A',
    'CSCI 220.2',
    'CS 101',
    'CRWT 102S',
    'CMPS 147',
    'DATA 441',
    'CMPS 230 (concurrent)',
    'MATH 151 (CONCURRENT)',
  ])('%s', (text) => roundTrip(text));
});

describe('round-trip — course-filter', () => {
  test.each([
    'courses where subject = "CMPS"',
    'courses where subject != "PHYS"',
    'courses where number >= 300',
    'courses where number <= 200',
    'courses where number > 100',
    'courses where number < 500',
    'courses where number = 151',
    'courses where number = "220"',
    'courses where attribute = "WI"',
    'courses where attribute = "C200"',
    'courses where credits >= 4',
    'courses where credits <= 3',
    'courses where credits = 3',
    'courses where subject = "CMPS" and number >= 300',
    'courses where subject = "MATH" and number >= 100 and number <= 299',
    'courses where subject = "MATH" and credits >= 4',
    'courses where attribute = "WI" and subject = "CSCI"',
    'courses where subject in ("CSCI", "MATH", "ECON")',
    'courses where subject not in ("PHYS", "CHEM")',
    'courses where attribute in ("C300", "C30C", "C30T", "C30S")',
    'courses where subject in ("CSCI", "MATH") and number >= 300',
    'courses where prerequisite includes (CMPS 104)',
    'courses where corequisite includes (MATH 151)',
    'courses where prerequisite includes (any of (MATH 021, MATH 031))',
    'courses where prerequisite includes (CSCI 141) and subject = "CSCI"',
    'courses where subject != "CSCI" and number >= 300',
    'courses where subject != "PHYS" and number >= 200',
    'courses where subject = "*"',
  ])('%s', (text) => roundTrip(text));
});

describe('round-trip — score', () => {
  test.each([
    'score SAT_MATH >= 580',
    'score SAT >= 1200',
    'score ACT >= 25',
    'score AP_CALCULUS >= 3',
    'score AP_CALC_AB >= 3',
  ])('%s', (text) => roundTrip(text));
});

describe('round-trip — attainment', () => {
  test.each([
    'attainment JUNIOR_STANDING',
    'attainment SENIOR_STANDING',
    'attainment PRAXIS',
    'attainment CPR_CERTIFICATION',
    'attainment MATRICULATION',
  ])('%s', (text) => roundTrip(text));
});

describe('round-trip — quantity', () => {
  test.each([
    'quantity CLINICAL_HOURS >= 500',
    'quantity COMMUNITY_SERVICE_HOURS >= 40.5',
    'quantity LAB_HOURS >= 100',
  ])('%s', (text) => roundTrip(text));
});

describe('round-trip — variable references', () => {
  test.each([
    '$core',
    '$core_math',
    '$_private',
    '$pool2',
    '$cmps-major.core',
    '$rcnj.asb_core',
  ])('%s', (text) => roundTrip(text));
});

// ============================================================
// Composite Nodes
// ============================================================

describe('round-trip — all-of', () => {
  test.each([
    'all of (MATH 151, MATH 152)',
    'all of (MATH 151, MATH 152, MATH 250)',
    'all of (MATH 151)',
    'all of (CSE 007, CSE 017, CSE 109)',
    'all of (CSCI 220.2, CSCI 243.2)',
    'all of (MATH 151, all of (CSCI 120, CSCI 121))',
    'all of ($core, $math, CSCI 141)',
  ])('%s', (text) => roundTrip(text));
});

describe('round-trip — any-of', () => {
  test.each([
    'any of (MATH 151, MATH 152)',
    'any of (INTD 101, HNRS 101)',
    'any of (CSCI 243, MATH 214)',
    'any of (courses where subject = "MATH", courses where subject = "CSCI")',
  ])('%s', (text) => roundTrip(text));
});

describe('round-trip — none-of', () => {
  test('none of (MATH 151, MATH 152)', () => roundTrip('none of (MATH 151, MATH 152)'));
});

describe('round-trip — n-of', () => {
  test.each([
    'at least 3 of (MATH 151, MATH 152, MATH 250, MATH 300)',
    'at most 2 of (MATH 151, MATH 152, MATH 250)',
    'exactly 2 of (MATH 151, MATH 152, MATH 250)',
    'at least 3 of (courses where subject = "CSE" and number >= 300)',
    'at least 2 of (CMPS 305, CMPS 311, courses where subject = "CMPS" and number >= 400)',
    'at least 1 of (courses where attribute = "GE-HIST")',
    'at least 1 of (courses where attribute = "GE-GLOBAL")',
  ])('%s', (text) => roundTrip(text));
});

describe('round-trip — one-from-each', () => {
  test('one from each of', () => roundTrip(
    'one from each of (courses where attribute = "HUM", courses where attribute = "SCI", courses where attribute = "SS")'
  ));

  test('with nested composites', () => roundTrip(
    'one from each of (all of (MATH 151, MATH 152), all of (CSCI 120, CSCI 121))'
  ));

  test('with-constraint wrapping', () => roundTrip(
    'one from each of (MATH 151, MATH 152) with gpa >= 2.0'
  ));
});

describe('round-trip — from-n-groups', () => {
  test('from at least 2', () => roundTrip(
    'from at least 2 of (courses where attribute = "HUM", courses where attribute = "SCI", courses where attribute = "SS")'
  ));

  test('four groups', () => roundTrip(
    'from at least 3 of (courses where attribute = "HUM", courses where attribute = "SCI", courses where attribute = "SS", courses where attribute = "ART")'
  ));

  test('nested inside all-of', () => roundTrip(`all of (
    CSCI 120,
    from at least 2 of (courses where attribute = "HUM", courses where attribute = "SCI")
  )`));
});

describe('round-trip — credits-from', () => {
  test.each([
    'at least 15 credits from (courses where subject = "CSE" and number >= 200)',
    'at least 12 credits from (courses where attribute = "APPROVED-SCI-TECH")',
    'at least 3 credits from (courses where attribute = "ALV")',
    'at least 3 credits from (courses where attribute in ("C300", "C30C", "C30D", "C30G"))',
    'at most 6 credits from (courses where subject = "MATH")',
    'exactly 3 credits from (courses where attribute = "WI")',
    'at least 12 credits from (MATH 151, MATH 152, MATH 250)',
    'at least 3 credits from (MATH 151)',
    'at least 120 credits from (courses where subject != "REMEDIAL")',
    'at least 60 credits from (courses where subject != "PHYS")',
  ])('%s', (text) => roundTrip(text));
});

// ============================================================
// Wrapper/Modifier Nodes
// ============================================================

describe('round-trip — with-constraint', () => {
  test.each([
    'CSCI 121 with grade >= "C-"',
    'MATH 100 with grade >= "D"',
    'all of (MATH 151, MATH 152) with gpa >= 2.0',
    '$core with grade >= "C"',
    '$biology.core with grade >= "C"',
  ])('%s', (text) => roundTrip(text));
});

describe('round-trip — except', () => {
  test.each([
    'courses where subject = "CMPS" except (CMPS 490)',
    'courses where subject = "CSCI" except (CSCI 490, CSCI 491)',
    'all of (CMPS 301, CMPS 302, CMPS 350) except (CMPS 350)',
    '$electives except (CSCI 490)',
    'courses where subject = "CMPS" except (courses where number >= 400)',
  ])('%s', (text) => roundTrip(text));
});

describe('round-trip — variable-def', () => {
  test.each([
    '$core = all of (MATH 151, MATH 152)',
    '$capstone = CSCI 490',
    '$upper = $core',
    '$cs_electives = at least 3 of (courses where subject = "CSCI" and number >= 300)',
    '$electives = courses where subject = "CMPS" except (CMPS 490)',
  ])('%s', (text) => roundTrip(text));
});

describe('round-trip — scope', () => {
  test('basic scope', () => {
    roundTrip(`scope "cmps-major" {
      $core = all of (CMPS 130, CMPS 230)
      all of ($core)
    }`);
  });

  test('scope with multiple defs', () => {
    roundTrip(`scope "cmps-major" {
      $core = all of (CMPS 130, CMPS 230)
      $math = all of (MATH 151, MATH 152)
      $electives = at least 3 of (courses where subject = "CMPS" and number >= 300)
      all of ($core, $math, $electives)
    }`);
  });

  test('scope with no defs', () => {
    roundTrip('scope "simple" { all of (MATH 151, MATH 152) }');
  });

  test('scope with cross-scope reference', () => {
    roundTrip(`scope "acct-major" {
      $core = all of (ACCT 201, ACCT 202)
      all of ($core, $rcnj.asb_core)
    }`);
  });

  test('scope with GPA constraint', () => {
    roundTrip(`scope "cmps-major" {
      $core = all of (CMPS 147, CMPS 148, CMPS 231, CMPS 311, CMPS 361, CMPS 366, CMPS 450)
      $electives = at least 5 of (courses where subject = "CMPS" and number >= 300)
      all of ($core, $electives) with gpa >= 2.0
    }`);
  });
});

// ============================================================
// Post-Constraints
// ============================================================

describe('round-trip — post_constraints', () => {
  test.each([
    `at least 5 of (POLI 215, POLI 301, POLI 309, POLI 315, AFST 208, HIST 251, SOCI 221) where at least 3 match (subject = "POLI")`,
    `at least 4 of (BIOL 220, BIOL 315, BIOL 330, BIOL 401, BIOL 410) where at most 1 match (number < 300)`,
    `at least 4 of (CSCI 301, CSCI 303, CSCI 304, CSCI 312, CSCI 320) where exactly 2 match (number >= 400)`,
  ])('%s', (text) => roundTrip(text));

  test('two where clauses', () => {
    roundTrip(`at least 5 of (
      POLI 215, POLI 301, POLI 309, POLI 315,
      AFST 208, HIST 251, SOCI 221
    )
      where at least 3 match (subject = "POLI")
      where at most 1 match (number < 300)`);
  });

  test('except then where', () => {
    roundTrip(`at least 3 of (
      LAWS 203, LAWS 320, LAWS 332, PSYC 218, SOCI 315
    ) except (LAWS 203)
      where at least 1 match (number >= 300)`);
  });

  test('where then with grade', () => {
    roundTrip(`at least 3 of (
      CSCI 301, CSCI 303, CSCI 312, CSCI 320
    )
      where at least 1 match (number >= 400)
      with grade >= "C"`);
  });

  // Post-constraints on non-n-of node types
  test('where clause on all-of', () => {
    roundTrip('all of (MATH 151, MATH 152) where at least 1 match (subject = "MATH")');
  });

  test('where clause on any-of', () => {
    roundTrip('any of (MATH 151, CSCI 120) where at least 1 match (subject = "MATH")');
  });

  test('where clause on credits-from', () => {
    roundTrip('at least 12 credits from (MATH 151, MATH 152) where at least 1 match (subject = "MATH")');
  });

  test('where clause on except', () => {
    roundTrip('courses where subject = "CMPS" except (CMPS 490) where at least 1 match (number >= 300)');
  });
});

// ============================================================
// Policy Nodes
// ============================================================

describe('round-trip — program', () => {
  test.each([
    'program CS major undergraduate',
    'program DATA_SCIENCE certificate graduate',
    'program MATH minor undergraduate',
    'program AI concentration graduate',
    'program SYSTEMS track undergraduate',
    'program ETHICS cluster undergraduate',
    'program PHYSICS major doctoral',
    'program LAW major professional',
    'program EDUCATION certificate post-graduate',
    'program RESEARCH major post-doctoral',
    'any program major undergraduate',
    'any program minor undergraduate',
  ])('%s', (text) => roundTrip(text));
});

describe('round-trip — program-context-ref', () => {
  test.each([
    'primary major',
    'primary minor',
  ])('%s', (text) => roundTrip(text));
});

describe('round-trip — overlap-limit', () => {
  test.each([
    'overlap between ($coll, $cs_major) at most 3 courses',
    'overlap between ($cs_minor, primary major) at most 6 credits',
    'overlap between ($cs_minor, primary major) at most 50 %',
    'overlap between (primary major, primary minor) at most 2 courses',
    'overlap between ($cmps-major.core, $math-minor.core) at most 1 courses',
  ])('%s', (text) => roundTrip(text));
});

describe('round-trip — outside-program', () => {
  test.each([
    'outside (primary major) at least 72 credits',
    'outside (primary minor) at least 30 credits',
    'outside ($cmps_major) at least 60 credits',
  ])('%s', (text) => roundTrip(text));
});

// ============================================================
// Integration: Case Study Excerpts
// ============================================================

describe('round-trip — Lehigh BS CS', () => {
  test('intro programming choice', () => {
    roundTrip(`any of (
      all of (CSE 003, CSE 004),
      CSE 007
    )`);
  });

  test('CS core variable', () => {
    roundTrip(`$cs_core = all of (
      any of (
        all of (CSE 003, CSE 004),
        CSE 007
      ),
      CSE 017,
      CSE 109,
      CSE 140,
      CSE 202,
      CSE 216,
      CSE 262,
      CSE 280,
      CSE 281,
      CSE 303,
      CSE 340
    )`);
  });

  test('tech electives', () => {
    roundTrip('at least 15 credits from (courses where subject = "CSE" and number >= 200)');
  });

  test('math core', () => {
    roundTrip(`$math_core = all of (
      any of (MATH 021, MATH 031, MATH 076),
      MATH 022,
      any of (MATH 205, MATH 241, MATH 242)
    )`);
  });

  test('full degree requirement', () => {
    roundTrip(`all of (
      $cs_core,
      $math_core,
      $science,
      at least 15 credits from (courses where subject = "CSE" and number >= 200),
      at least 12 credits from (courses where attribute = "APPROVED-SCI-TECH")
    )`);
  });
});

describe('round-trip — Moravian BS CS', () => {
  test('discrete structures choice', () => {
    roundTrip(`$discrete = any of (CSCI 140, MATH 212)`);
  });

  test('CS core with grade constraints', () => {
    roundTrip(`$cs_core = all of (
      CSCI 120,
      CSCI 121 with grade >= "C-",
      $discrete,
      CSCI 220.2,
      CSCI 244 with grade >= "C-",
      CSCI 234 with grade >= "C-",
      CSCI 243.2,
      CSCI 265,
      CSCI 334
    )`);
  });

  test('upper electives', () => {
    roundTrip(`at least 2 of (
      courses where subject = "CSCI" and number >= 310 and number <= 399
    )`);
  });

  test('math corequisite', () => {
    roundTrip(`$math_corequisite = any of (
      MATH 170,
      all of (MATH 106, MATH 166)
    )`);
  });
});

describe('round-trip — W&M BS CS', () => {
  test('CS core', () => {
    roundTrip(`$cs_core = all of (
      CSCI 141,
      CSCI 241,
      any of (CSCI 243, MATH 214),
      CSCI 301,
      CSCI 303,
      CSCI 304,
      CSCI 312,
      CSCI 423
    )`);
  });

  test('general electives with except', () => {
    roundTrip(`$general_electives = at least 12 credits from (
      courses where subject = "CSCI" and number >= 300
        except (CSCI 320, CSCI 430, CSCI 498)
    )`);
  });

  test('COLL 200 distribution', () => {
    roundTrip(`$coll_200 = all of (
      at least 3 credits from (courses where attribute = "ALV"),
      at least 3 credits from (courses where attribute = "CSI"),
      at least 3 credits from (courses where attribute = "NQR")
    )`);
  });

  test('COLL 300 attribute in', () => {
    roundTrip('$coll_300 = at least 3 credits from (courses where attribute in ("C300", "C30C", "C30D", "C30G"))');
  });

  test('full CS major with GPA constraint', () => {
    roundTrip(`all of (
      $cs_core,
      $math_proficiency,
      $concentration
    ) with gpa >= 2.0`);
  });

  test('overlap limit', () => {
    roundTrip('overlap between ($coll, $cs_major) at most 3 courses');
  });

  test('outside major', () => {
    roundTrip('outside (primary major) at least 72 credits');
  });
});

describe('round-trip — RCNJ BS CS', () => {
  test('CMPS 147 prerequisite with scores', () => {
    roundTrip(`any of (
      MATH 022 with grade >= "D",
      MATH 024 with grade >= "D",
      MATH 101 with grade >= "D",
      MATH 104 with grade >= "D",
      MATH 108 with grade >= "D",
      MATH 110 with grade >= "D",
      MATH 121 with grade >= "D",
      score SAT_MATH >= 580,
      score ACCUPLACER_QUANT_REASONING >= 258,
      score ACCUPLACER_ADV_ALG >= 260,
      score ACT_COMPOSITE >= 26
    )`);
  });

  test('gen-ed distribution', () => {
    roundTrip(`$distribution = at least 2 of (
      at least 1 of (courses where attribute = "GE-CULTURE-CREATIVITY"),
      at least 1 of (courses where attribute = "GE-VALUES-ETHICS"),
      at least 1 of (courses where attribute = "GE-SYSTEMS-SUSTAINABILITY")
    )`);
  });

  test('CS core with GPA', () => {
    roundTrip(`$cs_core = all of (
      CMPS 147,
      CMPS 148,
      CMPS 220,
      CMPS 231,
      CMPS 311,
      CMPS 361,
      CMPS 366,
      CMPS 450
    ) with gpa >= 2.0`);
  });

  test('math electives with except', () => {
    roundTrip(`$math_electives = at least 2 of (
      courses where subject = "MATH" and number >= 122
        except (MATH 205, MATH 210, MATH 237)
    )`);
  });

  test('CS electives large list', () => {
    roundTrip(`$cs_electives = at least 7 of (
      CMPS 240, CMPS 285, CMPS 305, CMPS 310, CMPS 315,
      CMPS 320, CMPS 327, CMPS 331, CMPS 342, CMPS 345,
      CMPS 350, CMPS 357, CMPS 364, CMPS 367, CMPS 369,
      CMPS 370, CMPS 373, CMPS 375, DATA 301
    )`);
  });

  test('full gen-ed requirement tree', () => {
    roundTrip(`all of (
      any of (INTD 101, HNRS 101),
      CRWT 102,
      any of (AIID 201, HNRS 201),
      any of (SOSC 110, HNRS 110),
      at least 1 of (courses where attribute = "GE-HIST"),
      at least 1 of (courses where attribute = "GE-GLOBAL"),
      at least 1 of (courses where attribute = "GE-QUANT"),
      at least 1 of (courses where attribute = "GE-SCI"),
      at least 2 of (
        at least 1 of (courses where attribute = "GE-CULTURE"),
        at least 1 of (courses where attribute = "GE-VALUES"),
        at least 1 of (courses where attribute = "GE-SYSTEMS")
      )
    )`);
  });
});

// ============================================================
// Labels
// ============================================================

describe('round-trip — labels', () => {
  test.each([
    '"Core": all of (MATH 151, MATH 152)',
    '"Alt": any of (MATH 151, MATH 152)',
    '"Excluded": none of (MATH 151, MATH 152)',
    '"Electives": at least 2 of (MATH 151, MATH 152, MATH 250)',
    '"Technical": at least 15 credits from (courses where subject = "CSE")',
    '"Distribution": one from each of (courses where attribute = "HUM", courses where attribute = "SCI")',
    '"Breadth": from at least 2 of (courses where attribute = "HUM", courses where attribute = "SCI")',
  ])('%s', (text) => roundTrip(text));

  test('labeled variable-def', () => {
    roundTrip('$core = "Core": all of (MATH 151, MATH 152)');
  });

  test('labeled with except and grade constraint', () => {
    roundTrip('"Electives": at least 3 of (CMPS 301, CMPS 302, CMPS 350) except (CMPS 350) with grade >= "C"');
  });

  test('nested labels', () => {
    roundTrip('"Outer": all of ("Inner": any of (MATH 151, MATH 152), CSCI 120)');
  });

  test('labeled scope program', () => {
    roundTrip(`scope "cmps-major" {
      $core = "CS Core": all of (CMPS 130, CMPS 230)
      $math = "Mathematics": all of (MATH 151, MATH 152)
      all of ($core, $math)
    }`);
  });

  test('labeled with where clause', () => {
    roundTrip('"Major": at least 5 of (POLI 215, POLI 301, POLI 309) where at least 2 match (subject = "POLI")');
  });
});

describe('round-trip — complex combined constructs', () => {
  test('credits-from with except and grade constraint', () => {
    roundTrip(`at least 15 credits from (
      courses where subject = "CSE" and number >= 200
        except (CSE 490)
    ) with grade >= "C"`);
  });

  test('n-of with where clause and with-constraint', () => {
    roundTrip(`at least 5 of (
      POLI 215, POLI 301, POLI 309, POLI 315,
      AFST 208, HIST 251, SOCI 221
    )
      where at least 3 match (subject = "POLI")
      with grade >= "C"`);
  });

  test('deeply nested', () => {
    roundTrip(`all of (
      $cs_core,
      at least 3 of (
        courses where subject = "CSCI" and number >= 300
          except (CSCI 490)
      ),
      at least 12 credits from (
        courses where attribute = "APPROVED-ELECTIVE"
      ),
      any of (
        attainment JUNIOR_STANDING,
        at least 60 credits from (
          courses where subject != "PHYS"
        )
      )
    ) with gpa >= 2.0`);
  });

  test('one-from-each inside all-of', () => {
    roundTrip(`all of (
      $major,
      one from each of (
        courses where attribute = "HUM",
        courses where attribute = "SCI",
        courses where attribute = "SS"
      ),
      at least 120 credits from (courses where subject != "REMEDIAL")
    )`);
  });

  test('concurrent in prerequisite tree', () => {
    roundTrip(`all of (
      any of (
        MATH 121 with grade >= "C",
        score ACCUPLACER_ADV_ALG >= 280
      ),
      CMPS 148 (concurrent)
    )`);
  });

  test('cross-scope reference between programs', () => {
    roundTrip(`scope "math-minor" {
      $core = all of (MATH 151, MATH 152, MATH 250)
      all of ($core, $cmps-major.electives)
    }`);
  });

  test('complete scoped program', () => {
    roundTrip(`scope "cmps-major" {
      $core = all of (
        CMPS 147,
        CMPS 148,
        CMPS 231,
        CMPS 311,
        CMPS 361,
        CMPS 366,
        CMPS 450
      )
      $electives = at least 5 of (
        courses where subject = "CMPS" and number >= 300
      )
      all of ($core, $electives) with gpa >= 2.0
    }`);
  });

  test('credits-from with except outside', () => {
    roundTrip('at least 15 credits from (courses where subject = "CSE" and number >= 200) except (CSE 490)');
  });

  test('n-of with except', () => {
    roundTrip('at least 3 of (courses where subject = "CSCI" and number >= 400) except (CSCI 495, CSCI 496)');
  });

  test('all-of with mixed items', () => {
    roundTrip(`all of (
      NURS 400,
      quantity CLINICAL_HOURS >= 500,
      attainment CPR_CERTIFICATION
    )`);
  });

  test('program ref in all-of', () => {
    roundTrip('all of (program CSCI major undergraduate, CSCI 141)');
  });
});
