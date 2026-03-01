'use strict';

const { parse } = require('../../src/parser');

describe('case-insensitive keywords — uppercase', () => {
  test('ALL OF', () => {
    expect(parse('ALL OF (MATH 151, MATH 152)').type).toBe('all-of');
  });

  test('ANY OF', () => {
    expect(parse('ANY OF (MATH 151, MATH 152)').type).toBe('any-of');
  });

  test('NONE OF', () => {
    expect(parse('NONE OF (MATH 151, MATH 152)').type).toBe('none-of');
  });

  test('AT LEAST N OF', () => {
    const ast = parse('AT LEAST 2 OF (MATH 151, MATH 152)');
    expect(ast.type).toBe('n-of');
    expect(ast.comparison).toBe('at-least');
  });

  test('AT MOST N OF', () => {
    const ast = parse('AT MOST 1 OF (MATH 151, MATH 152)');
    expect(ast.type).toBe('n-of');
    expect(ast.comparison).toBe('at-most');
  });

  test('EXACTLY N OF', () => {
    const ast = parse('EXACTLY 1 OF (MATH 151, MATH 152)');
    expect(ast.type).toBe('n-of');
    expect(ast.comparison).toBe('exactly');
  });

  test('COURSES WHERE', () => {
    expect(parse('COURSES WHERE SUBJECT = "MATH"').type).toBe('course-filter');
  });

  test('AT LEAST N CREDITS FROM', () => {
    expect(parse('AT LEAST 12 CREDITS FROM (MATH 151)').type).toBe('credits-from');
  });

  test('EXCEPT', () => {
    const ast = parse('ALL OF (MATH 151, MATH 152) EXCEPT (MATH 151)');
    expect(ast.type).toBe('except');
  });

  test('WITH GRADE >=', () => {
    const ast = parse('MATH 151 WITH GRADE >= "C"');
    expect(ast.type).toBe('with-constraint');
    expect(ast.constraint.kind).toBe('min-grade');
  });

  test('WITH GPA >=', () => {
    const ast = parse('ALL OF (MATH 151, MATH 152) WITH GPA >= 3.0');
    expect(ast.type).toBe('with-constraint');
    expect(ast.constraint.kind).toBe('min-gpa');
  });

  test('SCORE', () => {
    expect(parse('SCORE SAT_MATH >= 580').type).toBe('score');
  });

  test('ATTAINMENT', () => {
    expect(parse('ATTAINMENT JUNIOR_STANDING').type).toBe('attainment');
  });

  test('QUANTITY', () => {
    expect(parse('QUANTITY CLINICAL_HOURS >= 500').type).toBe('quantity');
  });

  test('ONE FROM EACH OF', () => {
    const ast = parse('ONE FROM EACH OF (COURSES WHERE ATTRIBUTE = "HUM", COURSES WHERE ATTRIBUTE = "SCI")');
    expect(ast.type).toBe('one-from-each');
  });

  test('FROM AT LEAST N OF', () => {
    const ast = parse('FROM AT LEAST 2 OF (COURSES WHERE ATTRIBUTE = "HUM", COURSES WHERE ATTRIBUTE = "SCI")');
    expect(ast.type).toBe('from-n-groups');
  });

  test('SCOPE', () => {
    const ast = parse('SCOPE "test" { MATH 151 }');
    expect(ast.type).toBe('scope');
  });

  test('WHERE AT LEAST N MATCH', () => {
    const ast = parse('AT LEAST 3 OF (CSCI 301, CSCI 303, CSCI 312) WHERE AT LEAST 1 MATCH (NUMBER >= 300)');
    expect(ast.post_constraints).toHaveLength(1);
  });

  test('CONCURRENT', () => {
    const ast = parse('CSCI 141 (CONCURRENT)');
    expect(ast.concurrentAllowed).toBe(true);
  });

  test('PREREQUISITE INCLUDES', () => {
    const ast = parse('COURSES WHERE PREREQUISITE INCLUDES (MATH 151)');
    expect(ast.filters[0].field).toBe('prerequisite-includes');
  });

  test('COREQUISITE INCLUDES', () => {
    const ast = parse('COURSES WHERE COREQUISITE INCLUDES (MATH 151)');
    expect(ast.filters[0].field).toBe('corequisite-includes');
  });

  test('NOT IN', () => {
    const ast = parse('COURSES WHERE SUBJECT NOT IN ("MATH", "CSCI")');
    expect(ast.filters[0].op).toBe('not-in');
  });
});

describe('case-insensitive keywords — title case', () => {
  test('All Of', () => {
    expect(parse('All Of (MATH 151, MATH 152)').type).toBe('all-of');
  });

  test('Any Of', () => {
    expect(parse('Any Of (MATH 151, MATH 152)').type).toBe('any-of');
  });

  test('None Of', () => {
    expect(parse('None Of (MATH 151, MATH 152)').type).toBe('none-of');
  });

  test('At Least N Of', () => {
    expect(parse('At Least 2 Of (MATH 151, MATH 152)').type).toBe('n-of');
  });

  test('Courses Where', () => {
    expect(parse('Courses Where Subject = "MATH"').type).toBe('course-filter');
  });

  test('Exactly N Credits From', () => {
    expect(parse('Exactly 12 Credits From (MATH 151)').type).toBe('credits-from');
  });

  test('One From Each Of', () => {
    const ast = parse('One From Each Of (Courses Where Attribute = "HUM", Courses Where Attribute = "SCI")');
    expect(ast.type).toBe('one-from-each');
  });

  test('Score', () => {
    expect(parse('Score SAT_MATH >= 580').type).toBe('score');
  });

  test('Attainment', () => {
    expect(parse('Attainment JUNIOR').type).toBe('attainment');
  });

  test('Quantity', () => {
    expect(parse('Quantity HOURS >= 100').type).toBe('quantity');
  });
});

describe('case-insensitive keywords — mixed case', () => {
  test('aLl oF', () => {
    expect(parse('aLl oF (MATH 151, MATH 152)').type).toBe('all-of');
  });

  test('cOuRsEs wHeRe', () => {
    expect(parse('cOuRsEs wHeRe sUbJeCt = "MATH"').type).toBe('course-filter');
  });
});

describe('whitespace variations', () => {
  test('tabs between keywords', () => {
    expect(parse('all\tof\t(MATH 151,\tMATH 152)').type).toBe('all-of');
  });

  test('multiple spaces between keywords', () => {
    expect(parse('all    of    (MATH 151,  MATH 152)').type).toBe('all-of');
  });

  test('newlines between items', () => {
    const input = `all of (
      MATH 151,
      MATH 152,
      MATH 250
    )`;
    expect(parse(input).items).toHaveLength(3);
  });

  test('no space before open paren', () => {
    expect(parse('all of(MATH 151, MATH 152)').type).toBe('all-of');
  });

  test('spaces inside parens', () => {
    expect(parse('all of (  MATH 151  ,  MATH 152  )').type).toBe('all-of');
  });

  test('leading whitespace', () => {
    expect(parse('   MATH 151').type).toBe('course');
  });

  test('trailing whitespace', () => {
    expect(parse('MATH 151   ').type).toBe('course');
  });

  test('leading and trailing newlines', () => {
    expect(parse('\n\nMATH 151\n\n').type).toBe('course');
  });

  test('comments as whitespace', () => {
    const input = `all of (
      # first course
      MATH 151,
      # second course
      MATH 152
      # end
    )`;
    expect(parse(input).items).toHaveLength(2);
  });

  test('tabs in course ref', () => {
    const ast = parse('MATH\t151');
    expect(ast.subject).toBe('MATH');
    expect(ast.number).toBe('151');
  });

  test('compact expression — no extra spaces', () => {
    const ast = parse('all of(MATH 151,MATH 152)');
    expect(ast.type).toBe('all-of');
    expect(ast.items).toHaveLength(2);
  });

  test('generous spacing around operators', () => {
    const ast = parse('courses where  number  >=  300');
    expect(ast.filters[0].op).toBe('gte');
    expect(ast.filters[0].value).toBe(300);
  });
});

describe('subject/number case handling', () => {
  test('lowercase subject is uppercased', () => {
    expect(parse('math 151').subject).toBe('MATH');
  });

  test('mixed case subject is uppercased', () => {
    expect(parse('Math 151').subject).toBe('MATH');
  });

  test('lowercase number with letters is uppercased', () => {
    expect(parse('MATH 101a').number).toBe('101A');
  });

  test('mixed case number is uppercased', () => {
    expect(parse('CHEM 220.2').number).toBe('220.2');
  });
});
