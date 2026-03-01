'use strict';

const { parse } = require('../../src/parser');

// ============================================================
// Full-language integration tests
// Each test parses a complete requirement tree from a case study
// and verifies the top-level AST structure.
// ============================================================

describe('Lehigh BS CS — prerequisite chains and credits-from', () => {
  test('intro programming choice', () => {
    const input = `any of (
      all of (CSE 003, CSE 004),
      CSE 007
    )`;
    const ast = parse(input);
    expect(ast.type).toBe('any-of');
    expect(ast.items).toHaveLength(2);
    expect(ast.items[0].type).toBe('all-of');
    expect(ast.items[0].items).toHaveLength(2);
    expect(ast.items[1]).toEqual({ type: 'course', subject: 'CSE', number: '007' });
  });

  test('CS core with variable and nested any-of', () => {
    const input = `$cs_core = all of (
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
    )`;
    const ast = parse(input);
    expect(ast.type).toBe('variable-def');
    expect(ast.name).toBe('cs_core');
    expect(ast.value.type).toBe('all-of');
    expect(ast.value.items).toHaveLength(11);
    expect(ast.value.items[0].type).toBe('any-of');
  });

  test('technical electives — credits from filtered courses', () => {
    const input = `at least 15 credits from (
      courses where subject = "CSE" and number >= 200
    )`;
    const ast = parse(input);
    expect(ast.type).toBe('credits-from');
    expect(ast.comparison).toBe('at-least');
    expect(ast.credits).toBe(15);
    expect(ast.source.type).toBe('course-filter');
    expect(ast.source.filters).toHaveLength(2);
  });

  test('math core with multiple any-of branches', () => {
    const input = `$math_core = all of (
      any of (MATH 021, MATH 031, MATH 076),
      MATH 022,
      any of (MATH 205, MATH 241, MATH 242)
    )`;
    const ast = parse(input);
    expect(ast.type).toBe('variable-def');
    expect(ast.value.type).toBe('all-of');
    expect(ast.value.items).toHaveLength(3);
    expect(ast.value.items[0].type).toBe('any-of');
    expect(ast.value.items[0].items).toHaveLength(3);
    expect(ast.value.items[2].type).toBe('any-of');
  });

  test('full degree requirement combining variables', () => {
    const input = `all of (
      $cs_core,
      $math_core,
      $science,
      at least 15 credits from (
        courses where subject = "CSE" and number >= 200
      ),
      at least 12 credits from (
        courses where attribute = "APPROVED-SCI-TECH"
      )
    )`;
    const ast = parse(input);
    expect(ast.type).toBe('all-of');
    expect(ast.items).toHaveLength(5);
    expect(ast.items[0].type).toBe('variable-ref');
    expect(ast.items[3].type).toBe('credits-from');
    expect(ast.items[4].type).toBe('credits-from');
  });
});

describe('Moravian BS CS — grade constraints and multi-unit courses', () => {
  test('discrete structures choice', () => {
    const input = `$discrete = any of (
      CSCI 140,   # Discrete Structures for CS
      MATH 212    # Discrete Mathematical Structures and Proof
    )`;
    const ast = parse(input);
    expect(ast.type).toBe('variable-def');
    expect(ast.name).toBe('discrete');
    expect(ast.value.type).toBe('any-of');
    expect(ast.value.items).toHaveLength(2);
  });

  test('CS core with inline grade constraints', () => {
    const input = `$cs_core = all of (
      CSCI 120,
      CSCI 121 with grade >= "C-",
      $discrete,
      CSCI 220.2,
      CSCI 244 with grade >= "C-",
      CSCI 234 with grade >= "C-",
      CSCI 243.2,
      CSCI 265,
      CSCI 334
    )`;
    const ast = parse(input);
    expect(ast.type).toBe('variable-def');
    expect(ast.value.type).toBe('all-of');
    expect(ast.value.items).toHaveLength(9);
    // Grade-constrained items become with-constraint nodes
    expect(ast.value.items[1].type).toBe('with-constraint');
    expect(ast.value.items[1].requirement).toEqual({ type: 'course', subject: 'CSCI', number: '121' });
    expect(ast.value.items[1].constraint).toEqual({ kind: 'min-grade', value: 'C-' });
    // Multi-unit course numbers
    expect(ast.value.items[3]).toEqual({ type: 'course', subject: 'CSCI', number: '220.2' });
    expect(ast.value.items[6]).toEqual({ type: 'course', subject: 'CSCI', number: '243.2' });
    // Variable ref
    expect(ast.value.items[2]).toEqual({ type: 'variable-ref', name: 'discrete' });
  });

  test('upper electives with subject/number range filter', () => {
    const input = `at least 2 of (
      courses where subject = "CSCI" and number >= 310 and number <= 399
    )`;
    const ast = parse(input);
    expect(ast.type).toBe('n-of');
    expect(ast.comparison).toBe('at-least');
    expect(ast.count).toBe(2);
    expect(ast.items[0].type).toBe('course-filter');
    expect(ast.items[0].filters).toHaveLength(3);
  });

  test('math corequisite with nested all-of in any-of', () => {
    const input = `$math_corequisite = any of (
      MATH 170,
      all of (MATH 106, MATH 166)
    )`;
    const ast = parse(input);
    expect(ast.type).toBe('variable-def');
    expect(ast.value.type).toBe('any-of');
    expect(ast.value.items[1].type).toBe('all-of');
    expect(ast.value.items[1].items).toHaveLength(2);
  });

  test('full Moravian CS degree with variables, constraints, and comments', () => {
    const input = `all of (
      $cs_core,          # 9 units — CS core
      $upper_electives,  # 3 units — upper-level electives
      $math_corequisite  # 1 unit — math co-requisite
    )`;
    const ast = parse(input);
    expect(ast.type).toBe('all-of');
    expect(ast.items).toHaveLength(3);
    expect(ast.items.every(i => i.type === 'variable-ref')).toBe(true);
  });
});

describe('W&M BS CS — GPA constraints, attribute filters, concentrations', () => {
  test('CS core with any-of choices', () => {
    const input = `$cs_core = all of (
      CSCI 141,
      CSCI 241,
      any of (CSCI 243, MATH 214),
      CSCI 301,
      CSCI 303,
      CSCI 304,
      CSCI 312,
      CSCI 423
    )`;
    const ast = parse(input);
    expect(ast.type).toBe('variable-def');
    expect(ast.value.type).toBe('all-of');
    expect(ast.value.items).toHaveLength(8);
    expect(ast.value.items[2].type).toBe('any-of');
  });

  test('general electives with credits-from and except', () => {
    const input = `$general_electives = at least 12 credits from (
      courses where subject = "CSCI" and number >= 300
        except (CSCI 320, CSCI 430, CSCI 498)
    )`;
    const ast = parse(input);
    expect(ast.type).toBe('variable-def');
    expect(ast.value.type).toBe('credits-from');
    expect(ast.value.credits).toBe(12);
    expect(ast.value.source.type).toBe('except');
    expect(ast.value.source.source.type).toBe('course-filter');
    expect(ast.value.source.exclude).toHaveLength(3);
  });

  test('COLL 200 distribution with attribute-based credits-from', () => {
    const input = `$coll_200 = all of (
      at least 3 credits from (courses where attribute = "ALV"),
      at least 3 credits from (courses where attribute = "CSI"),
      at least 3 credits from (courses where attribute = "NQR")
    )`;
    const ast = parse(input);
    expect(ast.type).toBe('variable-def');
    expect(ast.value.type).toBe('all-of');
    expect(ast.value.items).toHaveLength(3);
    ast.value.items.forEach(item => {
      expect(item.type).toBe('credits-from');
      expect(item.credits).toBe(3);
      expect(item.source.type).toBe('course-filter');
    });
  });

  test('COLL 300 with attribute in (...) filter', () => {
    const input = `$coll_300 = at least 3 credits from (
      courses where attribute in ("C300", "C30C", "C30D", "C30G")
    )`;
    const ast = parse(input);
    expect(ast.type).toBe('variable-def');
    expect(ast.value.type).toBe('credits-from');
    expect(ast.value.source.type).toBe('course-filter');
    expect(ast.value.source.filters[0].op).toBe('in');
    expect(ast.value.source.filters[0].value).toEqual(['C300', 'C30C', 'C30D', 'C30G']);
  });

  test('concentration selection — any-of across tracks', () => {
    const input = `$concentration = any of (
      $general_electives,
      $aiml_track,
      $cyber_track
    )`;
    const ast = parse(input);
    expect(ast.type).toBe('variable-def');
    expect(ast.value.type).toBe('any-of');
    expect(ast.value.items).toHaveLength(3);
    expect(ast.value.items.every(i => i.type === 'variable-ref')).toBe(true);
  });

  test('full CS major with GPA constraint', () => {
    const input = `all of (
      $cs_core,
      $math_proficiency,
      $concentration
    ) with gpa >= 2.0`;
    const ast = parse(input);
    expect(ast.type).toBe('with-constraint');
    expect(ast.requirement.type).toBe('all-of');
    expect(ast.requirement.items).toHaveLength(3);
    expect(ast.constraint).toEqual({ kind: 'min-gpa', value: 2.0 });
  });

  test('overlap limit between programs', () => {
    const input = `overlap between ($coll, $cs_major) at most 3 courses`;
    const ast = parse(input);
    expect(ast.type).toBe('overlap-limit');
    expect(ast.left).toEqual({ type: 'variable-ref', name: 'coll' });
    expect(ast.right).toEqual({ type: 'variable-ref', name: 'cs_major' });
    expect(ast.constraint).toEqual({ comparison: 'at-most', value: 3, unit: 'courses' });
  });

  test('outside major credit requirement', () => {
    const input = `outside (primary major) at least 72 credits`;
    const ast = parse(input);
    expect(ast.type).toBe('outside-program');
    expect(ast.program).toEqual({ type: 'program-context-ref', role: 'primary-major' });
    expect(ast.constraint).toEqual({ comparison: 'at-least', value: 72, unit: 'credits' });
  });
});

describe('RCNJ BS CS — test scores, pervasive grades, gen-ed distribution', () => {
  test('CMPS 147 prerequisite — courses with grades + test scores', () => {
    const input = `any of (
      MATH 022 with grade >= "D",
      MATH 024 with grade >= "D",
      MATH 101 with grade >= "D",
      MATH 104 with grade >= "D",
      MATH 108 with grade >= "D",
      MATH 110 with grade >= "D",
      MATH 121 with grade >= "D",
      score "SAT MATH" >= 580,
      score "ACCUPLACER Quant Reasoning" >= 258,
      score "ACCUPLACER Adv Alg & Functions" >= 260,
      score "ACT Composite" >= 26
    )`;
    const ast = parse(input);
    expect(ast.type).toBe('any-of');
    expect(ast.items).toHaveLength(11);
    // First 7 are courses with grade constraints
    for (let i = 0; i < 7; i++) {
      expect(ast.items[i].type).toBe('with-constraint');
      expect(ast.items[i].requirement.type).toBe('course');
      expect(ast.items[i].constraint).toEqual({ kind: 'min-grade', value: 'D' });
    }
    // Last 4 are test scores
    expect(ast.items[7]).toEqual({ type: 'score', name: 'SAT MATH', op: 'gte', value: 580 });
    expect(ast.items[8]).toEqual({ type: 'score', name: 'ACCUPLACER Quant Reasoning', op: 'gte', value: 258 });
    expect(ast.items[9]).toEqual({ type: 'score', name: 'ACCUPLACER Adv Alg & Functions', op: 'gte', value: 260 });
    expect(ast.items[10]).toEqual({ type: 'score', name: 'ACT Composite', op: 'gte', value: 26 });
  });

  test('first year seminar keystone with honors alternative', () => {
    const input = `$first_year_seminar = any of (
      INTD 101,   # First Year Seminar
      HNRS 101    # Honors First Year Seminar
    )`;
    const ast = parse(input);
    expect(ast.type).toBe('variable-def');
    expect(ast.value.type).toBe('any-of');
    expect(ast.value.items).toHaveLength(2);
  });

  test('gen-ed distribution — 2 of 3 categories', () => {
    const input = `$distribution = at least 2 of (
      at least 1 of (courses where attribute = "GE-CULTURE-CREATIVITY"),
      at least 1 of (courses where attribute = "GE-VALUES-ETHICS"),
      at least 1 of (courses where attribute = "GE-SYSTEMS-SUSTAINABILITY")
    )`;
    const ast = parse(input);
    expect(ast.type).toBe('variable-def');
    expect(ast.value.type).toBe('n-of');
    expect(ast.value.comparison).toBe('at-least');
    expect(ast.value.count).toBe(2);
    expect(ast.value.items).toHaveLength(3);
    ast.value.items.forEach(item => {
      expect(item.type).toBe('n-of');
      expect(item.items[0].type).toBe('course-filter');
    });
  });

  test('CS core with GPA constraint', () => {
    const input = `$cs_core = all of (
      CMPS 147,
      CMPS 148,
      CMPS 220,
      CMPS 231,
      CMPS 311,
      CMPS 361,
      CMPS 366,
      CMPS 450
    ) with gpa >= 2.0`;
    const ast = parse(input);
    expect(ast.type).toBe('variable-def');
    expect(ast.value.type).toBe('with-constraint');
    expect(ast.value.requirement.type).toBe('all-of');
    expect(ast.value.requirement.items).toHaveLength(8);
    expect(ast.value.constraint).toEqual({ kind: 'min-gpa', value: 2.0 });
  });

  test('math electives with except', () => {
    const input = `$math_electives = at least 2 of (
      courses where subject = "MATH" and number >= 122
        except (MATH 205, MATH 210, MATH 237)
    )`;
    const ast = parse(input);
    expect(ast.type).toBe('variable-def');
    expect(ast.value.type).toBe('n-of');
    expect(ast.value.count).toBe(2);
    expect(ast.value.items[0].type).toBe('except');
    expect(ast.value.items[0].source.type).toBe('course-filter');
    expect(ast.value.items[0].exclude).toHaveLength(3);
  });

  test('CS electives — large course list', () => {
    const input = `$cs_electives = at least 7 of (
      CMPS 240, CMPS 285, CMPS 305, CMPS 310, CMPS 315,
      CMPS 320, CMPS 327, CMPS 331, CMPS 342, CMPS 345,
      CMPS 350, CMPS 357, CMPS 364, CMPS 367, CMPS 369,
      CMPS 370, CMPS 373, CMPS 375, DATA 301
    )`;
    const ast = parse(input);
    expect(ast.type).toBe('variable-def');
    expect(ast.value.type).toBe('n-of');
    expect(ast.value.comparison).toBe('at-least');
    expect(ast.value.count).toBe(7);
    expect(ast.value.items).toHaveLength(19);
    expect(ast.value.items[18]).toEqual({ type: 'course', subject: 'DATA', number: '301' });
  });

  test('full RCNJ gen-ed requirement tree', () => {
    const input = `all of (
      any of (INTD 101, HNRS 101),                                    # Keystone 1
      CRWT 102,                                                        # Keystone 2
      any of (AIID 201, HNRS 201),                                    # Keystone 3
      any of (SOSC 110, HNRS 110),                                    # Keystone 4
      at least 1 of (courses where attribute = "GE-HIST"),            # Keystone 5
      at least 1 of (courses where attribute = "GE-GLOBAL"),          # Keystone 6
      at least 1 of (courses where attribute = "GE-QUANT"),           # Keystone 7
      at least 1 of (courses where attribute = "GE-SCI"),             # Keystone 8
      at least 2 of (                                                  # Distribution
        at least 1 of (courses where attribute = "GE-CULTURE"),
        at least 1 of (courses where attribute = "GE-VALUES"),
        at least 1 of (courses where attribute = "GE-SYSTEMS")
      )
    )`;
    const ast = parse(input);
    expect(ast.type).toBe('all-of');
    expect(ast.items).toHaveLength(9);
    // Keystones 1, 3, 4 are any-of
    expect(ast.items[0].type).toBe('any-of');
    expect(ast.items[2].type).toBe('any-of');
    expect(ast.items[3].type).toBe('any-of');
    // Keystone 2 is a course
    expect(ast.items[1].type).toBe('course');
    // Keystones 5-8 are n-of with filter items
    for (let i = 4; i <= 7; i++) {
      expect(ast.items[i].type).toBe('n-of');
      expect(ast.items[i].items[0].type).toBe('course-filter');
    }
    // Distribution is n-of containing nested n-of items
    expect(ast.items[8].type).toBe('n-of');
    expect(ast.items[8].count).toBe(2);
    expect(ast.items[8].items).toHaveLength(3);
  });
});

describe('scope blocks — multi-program integration', () => {
  test('complete scoped program with variables', () => {
    const input = `scope "cmps-major" {
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
    }`;
    const ast = parse(input);
    expect(ast.type).toBe('scope');
    expect(ast.name).toBe('cmps-major');
    expect(ast.defs).toHaveLength(2);
    expect(ast.defs[0].name).toBe('core');
    expect(ast.defs[0].scope).toBe('cmps-major');
    expect(ast.defs[1].name).toBe('electives');
    expect(ast.defs[1].scope).toBe('cmps-major');
    expect(ast.body.type).toBe('with-constraint');
    expect(ast.body.requirement.type).toBe('all-of');
    expect(ast.body.constraint).toEqual({ kind: 'min-gpa', value: 2.0 });
  });

  test('cross-scope reference between programs', () => {
    const input = `scope "math-minor" {
      $core = all of (MATH 151, MATH 152, MATH 250)
      all of ($core, $cmps-major.electives)
    }`;
    const ast = parse(input);
    expect(ast.type).toBe('scope');
    expect(ast.body.type).toBe('all-of');
    expect(ast.body.items[1]).toEqual({
      type: 'variable-ref',
      name: 'electives',
      scope: 'cmps-major',
    });
  });
});

describe('complex combined constructs', () => {
  test('credits-from with except and grade constraint', () => {
    const input = `at least 15 credits from (
      courses where subject = "CSE" and number >= 200
        except (CSE 490)
    ) with grade >= "C"`;
    const ast = parse(input);
    expect(ast.type).toBe('with-constraint');
    expect(ast.requirement.type).toBe('credits-from');
    expect(ast.requirement.source.type).toBe('except');
    expect(ast.requirement.source.source.type).toBe('course-filter');
    expect(ast.constraint).toEqual({ kind: 'min-grade', value: 'C' });
  });

  test('n-of with where clause and with-constraint', () => {
    const input = `at least 5 of (
      POLI 215, POLI 301, POLI 309, POLI 315,
      AFST 208, HIST 251, SOCI 221
    )
      where at least 3 match (subject = "POLI")
      with grade >= "C"`;
    const ast = parse(input);
    expect(ast.type).toBe('with-constraint');
    expect(ast.requirement.type).toBe('n-of');
    expect(ast.requirement.post_constraints).toHaveLength(1);
    expect(ast.requirement.post_constraints[0].comparison).toBe('at-least');
    expect(ast.requirement.post_constraints[0].count).toBe(3);
    expect(ast.constraint).toEqual({ kind: 'min-grade', value: 'C' });
  });

  test('deeply nested — all-of containing n-of, credits-from, and variable refs', () => {
    const input = `all of (
      $cs_core,
      at least 3 of (
        courses where subject = "CSCI" and number >= 300
          except (CSCI 490)
      ),
      at least 12 credits from (
        courses where attribute = "APPROVED-ELECTIVE"
      ),
      any of (
        attainment "Junior Standing",
        at least 60 credits from (
          courses where subject != "PHYS"
        )
      )
    ) with gpa >= 2.0`;
    const ast = parse(input);
    expect(ast.type).toBe('with-constraint');
    expect(ast.requirement.type).toBe('all-of');
    expect(ast.requirement.items).toHaveLength(4);
    expect(ast.requirement.items[0].type).toBe('variable-ref');
    expect(ast.requirement.items[1].type).toBe('n-of');
    expect(ast.requirement.items[1].items[0].type).toBe('except');
    expect(ast.requirement.items[2].type).toBe('credits-from');
    expect(ast.requirement.items[3].type).toBe('any-of');
    expect(ast.requirement.items[3].items[0].type).toBe('attainment');
    expect(ast.requirement.items[3].items[1].type).toBe('credits-from');
    expect(ast.constraint).toEqual({ kind: 'min-gpa', value: 2.0 });
  });

  test('one-from-each inside all-of with other constructs', () => {
    const input = `all of (
      $major,
      one from each of (
        courses where attribute = "HUM",
        courses where attribute = "SCI",
        courses where attribute = "SS"
      ),
      at least 120 credits from (
        courses where subject != "REMEDIAL"
      )
    )`;
    const ast = parse(input);
    expect(ast.type).toBe('all-of');
    expect(ast.items).toHaveLength(3);
    expect(ast.items[1].type).toBe('one-from-each');
    expect(ast.items[1].items).toHaveLength(3);
    expect(ast.items[2].type).toBe('credits-from');
  });

  test('concurrent allowed in prerequisite tree', () => {
    const input = `all of (
      any of (
        MATH 121 with grade >= "C",
        score "ACCUPLACER Adv Alg & Functions" >= 280
      ),
      CMPS 148 (concurrent allowed)
    )`;
    const ast = parse(input);
    expect(ast.type).toBe('all-of');
    expect(ast.items[0].type).toBe('any-of');
    expect(ast.items[0].items[0].type).toBe('with-constraint');
    expect(ast.items[0].items[1].type).toBe('score');
    expect(ast.items[1].type).toBe('course');
    expect(ast.items[1].concurrentAllowed).toBe(true);
  });
});
