'use strict';

const { toHTML } = require('../../src/render/to-html');

describe('toHTML audit overlay', () => {
  test('met course → reqit-status-met class + checkmark + grade', () => {
    const ast = { type: 'course', subject: 'MATH', number: '101' };
    const auditNode = {
      type: 'course', subject: 'MATH', number: '101',
      status: 'met',
      satisfiedBy: { subject: 'MATH', number: '101', grade: 'A', term: 'Fall 2023', credits: 3 },
    };
    const html = toHTML(ast, null, auditNode);
    expect(html).toContain('reqit-status-met');
    expect(html).toContain('&#10003;'); // checkmark
    expect(html).toContain('reqit-grade');
    expect(html).toContain('A');
    expect(html).toContain('reqit-term');
    expect(html).toContain('Fall 2023');
  });

  test('not-met course → reqit-status-not-met class + circle', () => {
    const ast = { type: 'course', subject: 'ART', number: '301' };
    const auditNode = {
      type: 'course', subject: 'ART', number: '301',
      status: 'not-met',
    };
    const html = toHTML(ast, null, auditNode);
    expect(html).toContain('reqit-status-not-met');
    expect(html).toContain('&#9675;'); // circle
    expect(html).not.toContain('reqit-grade');
    expect(html).not.toContain('reqit-term');
  });

  test('in-progress course → reqit-status-in-progress class', () => {
    const ast = { type: 'course', subject: 'MATH', number: '152' };
    const auditNode = {
      type: 'course', subject: 'MATH', number: '152',
      status: 'in-progress',
    };
    const html = toHTML(ast, null, auditNode);
    expect(html).toContain('reqit-status-in-progress');
    expect(html).toContain('&#9685;'); // in-progress indicator
  });

  test('partial-progress course → reqit-status-partial-progress class + half-circle', () => {
    const ast = { type: 'course', subject: 'MATH', number: '101' };
    const auditNode = {
      type: 'course', subject: 'MATH', number: '101',
      status: 'partial-progress',
    };
    const html = toHTML(ast, null, auditNode);
    expect(html).toContain('reqit-status-partial-progress');
    expect(html).toContain('&#9681;'); // half-circle
  });

  test('no audit result → no status classes (existing behavior preserved)', () => {
    const ast = { type: 'course', subject: 'MATH', number: '101' };
    const html = toHTML(ast);
    expect(html).toContain('reqit-course');
    expect(html).not.toContain('reqit-status-');
    expect(html).not.toContain('reqit-grade');
    expect(html).not.toContain('reqit-term');
    expect(html).not.toContain('&#10003;');
  });

  test('composite node status reflects children', () => {
    const ast = {
      type: 'all-of',
      items: [
        { type: 'course', subject: 'MATH', number: '101' },
        { type: 'course', subject: 'ART', number: '301' },
      ],
    };
    const auditNode = {
      type: 'all-of',
      status: 'not-met',
      items: [
        { type: 'course', subject: 'MATH', number: '101', status: 'met',
          satisfiedBy: { subject: 'MATH', number: '101', grade: 'B+', term: 'Spring 2024', credits: 3 } },
        { type: 'course', subject: 'ART', number: '301', status: 'not-met' },
      ],
    };
    const html = toHTML(ast, null, auditNode);
    expect(html).toContain('reqit-all-of reqit-status-not-met');
    expect(html).toContain('reqit-status-met');
    expect(html).toContain('B+');
    expect(html).toContain('reqit-status-not-met');
  });

  test('course with catalog title in audit mode', () => {
    const catalog = { courses: [{ subject: 'MATH', number: '101', title: 'College Algebra' }] };
    const ast = { type: 'course', subject: 'MATH', number: '101' };
    const auditNode = {
      type: 'course', subject: 'MATH', number: '101',
      status: 'met',
      satisfiedBy: { subject: 'MATH', number: '101', grade: 'A-', term: 'Fall 2023', credits: 3 },
    };
    const html = toHTML(ast, catalog, auditNode);
    expect(html).toContain('College Algebra');
    expect(html).toContain('reqit-title');
    expect(html).toContain('reqit-status-met');
    expect(html).toContain('A-');
  });

  test('score node with audit status', () => {
    const ast = { type: 'score', name: 'SAT', op: 'gte', value: 600 };
    const auditNode = { type: 'score', name: 'SAT', status: 'met', actual: 650 };
    const html = toHTML(ast, null, auditNode);
    expect(html).toContain('reqit-score reqit-status-met');
    expect(html).toContain('&#10003;');
  });

  test('met course without grade/term shows no extra spans', () => {
    const ast = { type: 'course', subject: 'MATH', number: '101' };
    const auditNode = {
      type: 'course', subject: 'MATH', number: '101',
      status: 'met',
      satisfiedBy: { subject: 'MATH', number: '101', credits: 3 },
    };
    const html = toHTML(ast, null, auditNode);
    expect(html).toContain('reqit-status-met');
    expect(html).not.toContain('reqit-grade');
    expect(html).not.toContain('reqit-term');
  });

  // --- Coverage for remaining audit-mode node types ---

  test('course-filter with audit status', () => {
    const ast = { type: 'course-filter', filters: [{ field: 'attribute', op: 'eq', value: 'WI' }] };
    const auditNode = { type: 'course-filter', filters: [{ field: 'attribute', op: 'eq', value: 'WI' }], status: 'met' };
    const html = toHTML(ast, null, auditNode);
    expect(html).toContain('reqit-course-filter reqit-status-met');
    expect(html).toContain('&#10003;');
  });

  test('attainment with audit status', () => {
    const ast = { type: 'attainment', name: 'JUNIOR_STANDING' };
    const auditNode = { type: 'attainment', name: 'JUNIOR_STANDING', status: 'not-met' };
    const html = toHTML(ast, null, auditNode);
    expect(html).toContain('reqit-attainment reqit-status-not-met');
    expect(html).toContain('&#9675;');
  });

  test('quantity with audit status', () => {
    const ast = { type: 'quantity', name: 'CLINICAL_HOURS', op: 'gte', value: 500 };
    const auditNode = { type: 'quantity', name: 'CLINICAL_HOURS', status: 'met' };
    const html = toHTML(ast, null, auditNode);
    expect(html).toContain('reqit-quantity reqit-status-met');
  });

  test('variable-ref with audit status', () => {
    const ast = { type: 'variable-ref', name: 'core' };
    const auditNode = { type: 'variable-ref', name: 'core', status: 'met' };
    const html = toHTML(ast, null, auditNode);
    expect(html).toContain('reqit-variable-ref reqit-status-met');
  });

  test('credits-from with audit status', () => {
    const ast = {
      type: 'credits-from', credits: 9, comparison: 'at-least',
      source: {
        type: 'all-of',
        items: [{ type: 'course', subject: 'ENGL', number: '201' }],
      },
    };
    const auditNode = {
      type: 'credits-from', status: 'not-met',
      source: {
        type: 'all-of', status: 'not-met',
        items: [{ type: 'course', subject: 'ENGL', number: '201', status: 'not-met' }],
      },
    };
    const html = toHTML(ast, null, auditNode);
    expect(html).toContain('reqit-credits-from reqit-status-not-met');
    expect(html).toContain('9 credits');
  });

  test('with-constraint with audit status', () => {
    const ast = {
      type: 'with-constraint',
      constraint: { kind: 'min-grade', value: 'C' },
      requirement: { type: 'course', subject: 'MATH', number: '101' },
    };
    const auditNode = {
      type: 'with-constraint', status: 'met',
      requirement: {
        type: 'course', subject: 'MATH', number: '101', status: 'met',
        satisfiedBy: { subject: 'MATH', number: '101', grade: 'B', term: 'Fall 2023', credits: 3 },
      },
    };
    const html = toHTML(ast, null, auditNode);
    expect(html).toContain('reqit-with-constraint reqit-status-met');
    expect(html).toContain('minimum grade of C');
    expect(html).toContain('reqit-grade');
  });

  test('with-constraint min-gpa variant', () => {
    const ast = {
      type: 'with-constraint',
      constraint: { kind: 'min-gpa', value: 2.5 },
      requirement: { type: 'all-of', items: [{ type: 'course', subject: 'MATH', number: '101' }] },
    };
    const auditNode = {
      type: 'with-constraint', status: 'not-met',
      requirement: {
        type: 'all-of', status: 'met',
        items: [{ type: 'course', subject: 'MATH', number: '101', status: 'met' }],
      },
    };
    const html = toHTML(ast, null, auditNode);
    expect(html).toContain('minimum GPA of 2.5');
  });

  test('except with audit status', () => {
    const ast = {
      type: 'except',
      source: { type: 'course-filter', filters: [{ field: 'subject', op: 'eq', value: 'CMPS' }] },
      exclude: [{ type: 'course', subject: 'CMPS', number: '490' }],
    };
    const auditNode = {
      type: 'except', status: 'met',
      source: { type: 'course-filter', filters: [{ field: 'subject', op: 'eq', value: 'CMPS' }], status: 'met' },
      exclude: [{ type: 'course', subject: 'CMPS', number: '490', status: 'not-met' }],
    };
    const html = toHTML(ast, null, auditNode);
    expect(html).toContain('reqit-except reqit-status-met');
    expect(html).toContain('Except:');
  });

  test('variable-def with audit passes through to value', () => {
    const ast = {
      type: 'variable-def', name: 'core',
      value: { type: 'course', subject: 'MATH', number: '101' },
    };
    const auditNode = {
      type: 'variable-def', name: 'core', status: 'met',
      value: { type: 'course', subject: 'MATH', number: '101', status: 'met' },
    };
    const html = toHTML(ast, null, auditNode);
    expect(html).toContain('reqit-course');
    // variable-def is transparent — renders the inner value
  });

  test('scope with audit passes through to body', () => {
    const ast = {
      type: 'scope', name: 'test',
      body: { type: 'course', subject: 'MATH', number: '101' },
      defs: [],
    };
    const auditNode = {
      type: 'scope', name: 'test', status: 'met',
      body: { type: 'course', subject: 'MATH', number: '101', status: 'met' },
    };
    const html = toHTML(ast, null, auditNode);
    expect(html).toContain('reqit-course');
  });

  test('unknown audit node type falls through to non-audit rendering', () => {
    const ast = {
      type: 'program', code: 'CMPS', 'program-type': 'major', level: 'undergraduate',
    };
    const auditNode = { type: 'program', status: 'met' };
    const html = toHTML(ast, null, auditNode);
    expect(html).toContain('reqit-program');
  });

  test('concurrent course with audit status', () => {
    const ast = { type: 'course', subject: 'CMPS', number: '230', concurrentAllowed: true };
    const auditNode = {
      type: 'course', subject: 'CMPS', number: '230',
      status: 'in-progress',
    };
    const html = toHTML(ast, null, auditNode);
    expect(html).toContain('reqit-concurrent');
    expect(html).toContain('reqit-status-in-progress');
  });

  test('null audit node for composite child renders without status', () => {
    const ast = {
      type: 'all-of',
      items: [{ type: 'course', subject: 'MATH', number: '101' }],
    };
    // auditNode has no items array → children get null audit
    const auditNode = { type: 'all-of', status: 'not-met' };
    const html = toHTML(ast, null, auditNode);
    expect(html).toContain('reqit-all-of reqit-status-not-met');
    // Child course should render without status class
    expect(html).toContain('class="reqit-course"');
  });
});
