'use strict';

/**
 * Public API smoke test — verifies every export from src/index.js is defined.
 *
 * This is a structural guard: if an export breaks (wrong destructuring name,
 * missing re-export), this test fails immediately.
 */
const api = require('../../src/index');

describe('public API exports', () => {
  const expectedFunctions = [
    // Parser
    'parse',
    // Validator
    'validate',
    // Resolver
    'resolve',
    // Renderers
    'toText',
    'toDescription',
    'toHTML',
    'toOutline',
    // Audit
    'audit',
    'prepareAudit',
    'findUnmet',
    'findNextEligible',
    'auditMulti',
    'CourseAssignmentMap',
    // Grade
    'isPassingGrade',
    'meetsMinGrade',
    'calculateGPA',
    'isAuditableGrade',
    // AST utilities
    'walk',
    'transform',
    'extractCourses',
    'extractAllReferences',
    'diff',
    // Export
    'exportPrereqMatrix',
    'exportProgramChecklist',
    'exportAudit',
    'exportDependencyMatrix',
  ];

  const expectedConstants = [
    'MET',
    'IN_PROGRESS',
    'PARTIAL_PROGRESS',
    'NOT_MET',
    'DEFAULT_GRADE_CONFIG',
  ];

  test.each(expectedFunctions)('%s is exported as a function', (name) => {
    expect(typeof api[name]).toBe('function');
  });

  test.each(expectedConstants)('%s is exported as a defined value', (name) => {
    expect(api[name]).toBeDefined();
  });

  test('no unexpected undefined exports', () => {
    const allKeys = Object.keys(api);
    const undefinedKeys = allKeys.filter(k => api[k] === undefined);
    expect(undefinedKeys).toHaveLength(0);
  });

  test('parse → toText round-trip through public API', () => {
    const ast = api.parse('all of (MATH 151, CMPS 130)');
    const text = api.toText(ast);
    const ast2 = api.parse(text);
    expect(ast2).toEqual(ast);
  });

  test('toDescription produces string', () => {
    const ast = api.parse('MATH 151');
    expect(typeof api.toDescription(ast)).toBe('string');
  });

  test('toOutline produces string', () => {
    const ast = api.parse('all of (MATH 151, CMPS 130)');
    expect(typeof api.toOutline(ast)).toBe('string');
  });

  test('toHTML produces string with reqit classes', () => {
    const ast = api.parse('MATH 151');
    const html = api.toHTML(ast);
    expect(html).toContain('reqit-course');
  });

  test('audit returns status and result', () => {
    const ast = api.parse('MATH 151');
    const catalog = { courses: [{ subject: 'MATH', number: '151', creditsMin: 3, creditsMax: 3 }] };
    const transcript = [{ subject: 'MATH', number: '151', grade: 'A', credits: 3, term: 'Fall 2023', status: 'completed' }];
    const { status, result } = api.audit(ast, catalog, transcript);
    expect(status).toBe(api.MET);
    expect(result).toBeDefined();
  });

  test('walk visits nodes', () => {
    const ast = api.parse('all of (MATH 151, CMPS 130)');
    const types = [];
    api.walk(ast, (node) => types.push(node.type));
    expect(types).toContain('all-of');
    expect(types).toContain('course');
  });

  test('exportPrereqMatrix returns CSV string', () => {
    const catalog = {
      courses: [
        { subject: 'A', number: '1' },
        { subject: 'A', number: '2', prerequisites: { type: 'course', subject: 'A', number: '1' } },
      ],
    };
    const csv = api.exportPrereqMatrix(catalog, { format: 'csv' });
    expect(typeof csv).toBe('string');
    expect(csv).toContain('A');
  });
});
