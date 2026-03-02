'use strict';

const { toHTML } = require('../../src/render/to-html');
const { parse } = require('../../src/parser');

function html(input, catalog) {
  return toHTML(parse(input), catalog);
}

// === Leaf Nodes ===

describe('toHTML — course', () => {
  test('standard course', () => {
    const result = html('MATH 151');
    expect(result).toContain('class="reqit-course"');
    expect(result).toContain('<span class="reqit-subject">MATH</span>');
    expect(result).toContain('<span class="reqit-number">151</span>');
    expect(result).not.toContain('reqit-title');
  });

  test('course with catalog title', () => {
    const catalog = { courses: [{ subject: 'MATH', number: '151', title: 'Calculus I' }] };
    const result = html('MATH 151', catalog);
    expect(result).toContain('<span class="reqit-title">Calculus I</span>');
  });

  test('concurrent course', () => {
    const result = html('CMPS 230 (concurrent)');
    expect(result).toContain('class="reqit-concurrent"');
    expect(result).toContain('(concurrent)');
  });

  test('HTML entities escaped in title', () => {
    const catalog = { courses: [{ subject: 'MATH', number: '151', title: 'Calc <I> & More' }] };
    const result = html('MATH 151', catalog);
    expect(result).toContain('Calc &lt;I&gt; &amp; More');
    expect(result).not.toContain('<I>');
  });
});

describe('toHTML — course-filter', () => {
  test('single filter', () => {
    const result = html('courses where subject = "CMPS"');
    expect(result).toContain('class="reqit-course-filter"');
    expect(result).toContain('subject is &quot;CMPS&quot;');
  });

  test('compound filters', () => {
    const result = html('courses where subject = "CMPS" and number >= 300');
    expect(result).toContain('subject is &quot;CMPS&quot;');
    expect(result).toContain('number is at least 300');
  });

  test('in list', () => {
    const result = html('courses where subject in ("CSCI", "MATH")');
    expect(result).toContain('subject is one of');
    expect(result).toContain('&quot;CSCI&quot;');
  });

  test('prerequisite includes', () => {
    const result = html('courses where prerequisite includes (CMPS 104)');
    expect(result).toContain('prerequisite includes');
    expect(result).toContain('CMPS');
  });

  test('corequisite includes', () => {
    const result = html('courses where corequisite includes (MATH 151)');
    expect(result).toContain('corequisite includes');
    expect(result).toContain('reqit-course-filter');
  });
});

describe('toHTML — score', () => {
  test('standard', () => {
    const result = html('score SAT_MATH >= 580');
    expect(result).toContain('class="reqit-score"');
    expect(result).toContain('SAT_MATH');
    expect(result).toContain('>= 580');
  });
});

describe('toHTML — attainment', () => {
  test('standard', () => {
    const result = html('attainment JUNIOR_STANDING');
    expect(result).toContain('class="reqit-attainment"');
    expect(result).toContain('JUNIOR_STANDING');
  });
});

describe('toHTML — quantity', () => {
  test('standard', () => {
    const result = html('quantity CLINICAL_HOURS >= 500');
    expect(result).toContain('class="reqit-quantity"');
    expect(result).toContain('CLINICAL_HOURS');
  });
});

describe('toHTML — variable-ref', () => {
  test('simple', () => {
    const result = html('$core');
    expect(result).toContain('class="reqit-variable-ref"');
    expect(result).toContain('$core');
  });

  test('cross-scope', () => {
    const result = html('$cmps-major.core');
    expect(result).toContain('$cmps-major.core');
  });
});

// === Composite Nodes ===

describe('toHTML — all-of', () => {
  test('structure', () => {
    const result = html('all of (MATH 151, MATH 152)');
    expect(result).toContain('class="reqit-requirement reqit-all-of"');
    expect(result).toContain('<p class="reqit-label">Complete <strong>all</strong> of the following:</p>');
    expect(result).toContain('<ul class="reqit-items">');
    expect(result).toContain('<li>');
    expect(result).toContain('MATH');
  });

  test('with catalog titles', () => {
    const catalog = {
      courses: [
        { subject: 'MATH', number: '151', title: 'Calculus I' },
        { subject: 'MATH', number: '152', title: 'Calculus II' },
      ],
    };
    const result = html('all of (MATH 151, MATH 152)', catalog);
    expect(result).toContain('Calculus I');
    expect(result).toContain('Calculus II');
  });
});

describe('toHTML — any-of', () => {
  test('structure', () => {
    const result = html('any of (CMPS 130, CMPS 135)');
    expect(result).toContain('reqit-any-of');
    expect(result).toContain('<strong>any one</strong>');
  });
});

describe('toHTML — none-of', () => {
  test('structure', () => {
    const result = html('none of (MATH 151, MATH 152)');
    expect(result).toContain('reqit-none-of');
    expect(result).toContain('<strong>None</strong>');
  });
});

describe('toHTML — n-of', () => {
  test('at least', () => {
    const result = html('at least 3 of (MATH 151, MATH 152, MATH 250, MATH 300)');
    expect(result).toContain('reqit-n-of');
    expect(result).toContain('<strong>at least 3</strong>');
  });

  test('at most', () => {
    const result = html('at most 2 of (MATH 151, MATH 152, MATH 250)');
    expect(result).toContain('<strong>at most 2</strong>');
  });

  test('exactly', () => {
    const result = html('exactly 1 of (MATH 151, MATH 152)');
    expect(result).toContain('<strong>exactly 1</strong>');
  });
});

describe('toHTML — one-from-each', () => {
  test('structure', () => {
    const result = html('one from each of (courses where attribute = "HUM", courses where attribute = "SCI")');
    expect(result).toContain('reqit-one-from-each');
    expect(result).toContain('<strong>one from each</strong>');
  });

  test('with catalog titles', () => {
    const catalog = {
      courses: [
        { subject: 'MATH', number: '151', title: 'Calculus I' },
        { subject: 'MATH', number: '152', title: 'Calculus II' },
      ],
    };
    const result = html('one from each of (MATH 151, MATH 152)', catalog);
    expect(result).toContain('Calculus I');
    expect(result).toContain('Calculus II');
  });

  test('with-constraint wrapping', () => {
    const result = html('one from each of (MATH 151, MATH 152) with gpa >= 2.0');
    expect(result).toContain('reqit-with-constraint');
    expect(result).toContain('reqit-one-from-each');
    expect(result).toContain('minimum GPA of 2');
  });
});

describe('toHTML — from-n-groups', () => {
  test('structure', () => {
    const result = html('from at least 2 of (courses where attribute = "HUM", courses where attribute = "SCI")');
    expect(result).toContain('reqit-from-n-groups');
    expect(result).toContain('<strong>at least 2</strong>');
  });

  test('four groups', () => {
    const result = html('from at least 3 of (courses where attribute = "HUM", courses where attribute = "SCI", courses where attribute = "SS", courses where attribute = "ART")');
    expect(result).toContain('<strong>at least 3</strong>');
    expect((result.match(/<li>/g) || []).length).toBe(4);
  });

  test('nested inside all-of', () => {
    const result = html(`all of (
      CSCI 120,
      from at least 2 of (courses where attribute = "HUM", courses where attribute = "SCI")
    )`);
    expect(result).toContain('reqit-all-of');
    expect(result).toContain('reqit-from-n-groups');
  });
});

describe('toHTML — credits-from', () => {
  test('single source', () => {
    const result = html('at least 15 credits from (courses where subject = "CSE")');
    expect(result).toContain('reqit-credits-from');
    expect(result).toContain('<strong>at least 15 credits</strong>');
  });

  test('multiple sources (unwrap all-of)', () => {
    const result = html('at least 12 credits from (MATH 151, MATH 152)');
    expect(result).toContain('reqit-credits-from');
    expect(result).toContain('MATH');
    // Two <li> items for the two courses
    expect((result.match(/<li>/g) || []).length).toBe(2);
  });
});

// === Wrapper/Modifier Nodes ===

describe('toHTML — with-constraint', () => {
  test('grade', () => {
    const result = html('CSCI 121 with grade >= "C-"');
    expect(result).toContain('reqit-with-constraint');
    expect(result).toContain('minimum grade of C-');
  });

  test('gpa', () => {
    const result = html('all of (MATH 151, MATH 152) with gpa >= 2.0');
    expect(result).toContain('reqit-with-constraint');
    expect(result).toContain('minimum GPA of 2');
  });
});

describe('toHTML — except', () => {
  test('structure', () => {
    const result = html('courses where subject = "CMPS" except (CMPS 490)');
    expect(result).toContain('reqit-except');
    expect(result).toContain('Except:');
    expect(result).toContain('reqit-subject">CMPS</span>');
    expect(result).toContain('reqit-number">490</span>');
  });
});

describe('toHTML — variable-def and scope', () => {
  test('variable-def renders value', () => {
    const result = html('$core = all of (MATH 151, MATH 152)');
    expect(result).toContain('reqit-all-of');
  });

  test('scope renders body', () => {
    const result = html('scope "test" { all of (MATH 151, MATH 152) }');
    expect(result).toContain('reqit-all-of');
  });
});

// === Policy Nodes ===

describe('toHTML — program', () => {
  test('named program', () => {
    const result = html('program CS major undergraduate');
    expect(result).toContain('class="reqit-program"');
    expect(result).toContain('Program CS');
  });

  test('any program', () => {
    const result = html('any program major undergraduate');
    expect(result).toContain('Any program');
  });
});

describe('toHTML — program-context-ref', () => {
  test('primary major', () => {
    const result = html('primary major');
    expect(result).toContain('class="reqit-program-context-ref"');
    expect(result).toContain('primary major');
  });
});

describe('toHTML — overlap-limit', () => {
  test('courses', () => {
    const result = html('overlap between ($coll, $cs_major) at most 3 courses');
    expect(result).toContain('reqit-overlap-limit');
    expect(result).toContain('at most 3 courses');
  });

  test('percent', () => {
    const result = html('overlap between ($cs_minor, primary major) at most 50 %');
    expect(result).toContain('at most 50%');
  });
});

describe('toHTML — outside-program', () => {
  test('standard', () => {
    const result = html('outside (primary major) at least 72 credits');
    expect(result).toContain('reqit-outside-program');
    expect(result).toContain('72 credits');
  });
});

// === Post-Constraints ===

describe('toHTML — post_constraints', () => {
  test('where clause on n-of', () => {
    const result = html('at least 5 of (POLI 215, POLI 301) where at least 1 match (subject = "POLI")');
    expect(result).toContain('reqit-post-constraint');
    expect(result).toContain('where at least 1 have');
  });

  test('where clause on all-of', () => {
    const result = html('all of (MATH 151, MATH 152) where at least 1 match (subject = "MATH")');
    expect(result).toContain('reqit-post-constraint');
    expect(result).toContain('reqit-all-of');
  });

  test('where clause on any-of', () => {
    const result = html('any of (MATH 151, CSCI 120) where at least 1 match (subject = "MATH")');
    expect(result).toContain('reqit-post-constraint');
    expect(result).toContain('reqit-any-of');
  });

  test('where clause on credits-from', () => {
    const result = html('at least 12 credits from (MATH 151, MATH 152) where at least 1 match (subject = "MATH")');
    expect(result).toContain('reqit-post-constraint');
    expect(result).toContain('reqit-credits-from');
  });

  test('where clause on except', () => {
    const result = html('courses where subject = "CMPS" except (CMPS 490) where at least 1 match (number >= 300)');
    expect(result).toContain('reqit-post-constraint');
    expect(result).toContain('reqit-except');
  });
});

// === Nested ===

describe('toHTML — nested', () => {
  test('all-of with nested any-of', () => {
    const result = html(`all of (
      MATH 151,
      any of (CMPS 130, CMPS 135)
    )`);
    expect(result).toContain('reqit-all-of');
    expect(result).toContain('reqit-any-of');
  });

  test('complex case study excerpt', () => {
    const result = html(`all of (
      CSCI 120,
      CSCI 121 with grade >= "C-",
      at least 3 of (courses where subject = "CSCI" and number >= 300)
    )`);
    expect(result).toContain('reqit-all-of');
    expect(result).toContain('reqit-with-constraint');
    expect(result).toContain('reqit-n-of');
    expect(result).toContain('reqit-course-filter');
  });
});

// === XSS Prevention ===

describe('toHTML — XSS prevention', () => {
  test('course title with HTML characters', () => {
    const catalog = {
      courses: [{ subject: 'MATH', number: '151', title: '<script>alert("xss")</script>' }],
    };
    const result = html('MATH 151', catalog);
    expect(result).not.toContain('<script>');
    expect(result).toContain('&lt;script&gt;');
  });

  test('filter value with HTML characters', () => {
    const result = html('courses where subject = "<script>"');
    expect(result).not.toContain('<script>');
  });
});

// === Direct AST Construction ===
// These test renderer branches independently of the parser.

describe('toHTML — direct AST: score operator rendering', () => {
  test.each([
    ['eq', '='],
    ['ne', '!='],
    ['gt', '>'],
    ['gte', '>='],
    ['lt', '<'],
    ['lte', '<='],
  ])('score op %s → "%s"', (op, symbol) => {
    const result = toHTML({ type: 'score', name: 'SAT', op, value: 1200 });
    expect(result).toContain('class="reqit-score"');
    expect(result).toContain(`${symbol} 1200`);
  });
});

describe('toHTML — direct AST: quantity operator rendering', () => {
  test.each([
    ['eq', '='],
    ['ne', '!='],
    ['gt', '>'],
    ['gte', '>='],
    ['lt', '<'],
    ['lte', '<='],
  ])('quantity op %s → "%s"', (op, symbol) => {
    const result = toHTML({ type: 'quantity', name: 'HOURS', op, value: 100 });
    expect(result).toContain('class="reqit-quantity"');
    expect(result).toContain(`${symbol} 100`);
  });
});

describe('toHTML — direct AST: course-filter operator variants', () => {
  test.each([
    ['eq', 'is'],
    ['ne', 'is not'],
    ['gt', 'is above'],
    ['gte', 'is at least'],
    ['lt', 'is below'],
    ['lte', 'is at most'],
  ])('filter op %s → "%s"', (op, phrase) => {
    const result = toHTML({
      type: 'course-filter',
      filters: [{ field: 'number', op, value: 300 }],
    });
    expect(result).toContain('class="reqit-course-filter"');
    expect(result).toContain(`number ${phrase} 300`);
  });

  test('not-in operator', () => {
    const result = toHTML({
      type: 'course-filter',
      filters: [{ field: 'subject', op: 'not-in', value: ['PHYS'] }],
    });
    expect(result).toContain('subject is not one of');
  });
});

describe('toHTML — direct AST: null/empty catalog handling', () => {
  test('null catalog', () => {
    const result = toHTML({ type: 'course', subject: 'MATH', number: '151' }, null);
    expect(result).toContain('MATH');
    expect(result).not.toContain('reqit-title');
  });

  test('catalog with no courses array', () => {
    const result = toHTML({ type: 'course', subject: 'MATH', number: '151' }, {});
    expect(result).not.toContain('reqit-title');
  });
});

describe('toHTML — direct AST: XSS in non-course fields', () => {
  test('score name with HTML characters', () => {
    const result = toHTML({ type: 'score', name: '<img onerror=alert(1)>', op: 'gte', value: 100 });
    expect(result).not.toContain('<img');
    expect(result).toContain('&lt;img');
  });

  test('attainment name with HTML characters', () => {
    const result = toHTML({ type: 'attainment', name: '<script>' });
    expect(result).not.toContain('<script>');
    expect(result).toContain('&lt;script&gt;');
  });

  test('variable-ref name with HTML characters', () => {
    const result = toHTML({ type: 'variable-ref', name: 'x<y' });
    expect(result).not.toContain('x<y');
    expect(result).toContain('x&lt;y');
  });
});

// === Error ===

describe('toHTML — error', () => {
  test('unknown node type throws', () => {
    expect(() => toHTML({ type: 'bogus' })).toThrow('Unknown node type: bogus');
  });
});
