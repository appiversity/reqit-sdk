'use strict';

const { exportProgramChecklist } = require('../../src/export/program-checklist');
const minimalCatalog = require('../fixtures/catalogs/minimal.json');

describe('exportProgramChecklist', () => {
  test('flat all-of → one row per course', () => {
    const ast = {
      type: 'all-of',
      items: [
        { type: 'course', subject: 'MATH', number: '101' },
        { type: 'course', subject: 'CMPS', number: '130' },
      ],
    };
    const csv = exportProgramChecklist(ast, minimalCatalog);
    const lines = csv.trim().split('\r\n');
    expect(lines).toHaveLength(3); // header + 2 courses
    expect(lines[1]).toContain('MATH');
    expect(lines[1]).toContain('College Algebra');
    expect(lines[2]).toContain('CMPS');
  });

  test('nested groups → Group column reflects labels', () => {
    const ast = {
      type: 'all-of',
      items: [
        {
          type: 'all-of', label: 'Core Requirements',
          items: [
            { type: 'course', subject: 'MATH', number: '101' },
            { type: 'course', subject: 'MATH', number: '151' },
          ],
        },
        {
          type: 'all-of', label: 'Electives',
          items: [
            { type: 'course', subject: 'ART', number: '101' },
          ],
        },
      ],
    };
    const csv = exportProgramChecklist(ast, minimalCatalog);
    const lines = csv.trim().split('\r\n');
    // 3 courses total
    expect(lines).toHaveLength(4); // header + 3
    expect(lines[1]).toContain('Core Requirements');
    expect(lines[2]).toContain('Core Requirements');
    expect(lines[3]).toContain('Electives');
  });

  test('n-of → Type shows choose N', () => {
    const ast = {
      type: 'n-of', comparison: 'at-least', count: 2,
      items: [
        { type: 'course', subject: 'A', number: '1' },
        { type: 'course', subject: 'B', number: '2' },
        { type: 'course', subject: 'C', number: '3' },
      ],
    };
    const csv = exportProgramChecklist(ast);
    const lines = csv.trim().split('\r\n');
    // Should include a "Choose at least 2" row + 3 courses
    const chooseRow = lines.find(l => l.includes('Choose'));
    expect(chooseRow).toBeDefined();
    expect(chooseRow).toContain('at least 2');
  });

  test('credits-from → shows credits info', () => {
    const ast = {
      type: 'credits-from', credits: 9, comparison: 'at-least',
      source: { type: 'course-filter', filters: [{ field: 'attribute', op: 'eq', value: 'WI' }] },
    };
    const csv = exportProgramChecklist(ast);
    const lines = csv.trim().split('\r\n');
    const creditsRow = lines.find(l => l.includes('9 credits'));
    expect(creditsRow).toBeDefined();
  });

  test('score node → renders score requirement', () => {
    const ast = {
      type: 'all-of',
      items: [{ type: 'score', name: 'SAT', op: 'gte', value: 600 }],
    };
    const csv = exportProgramChecklist(ast);
    const lines = csv.trim().split('\r\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('Score SAT');
    expect(lines[1]).toContain('gte');
    expect(lines[1]).toContain('600');
    expect(lines[1]).toContain('score');
  });

  test('attainment node → renders attainment requirement', () => {
    const ast = {
      type: 'all-of',
      items: [{ type: 'attainment', name: 'JUNIOR_STANDING' }],
    };
    const csv = exportProgramChecklist(ast);
    const lines = csv.trim().split('\r\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('Attainment');
    expect(lines[1]).toContain('JUNIOR_STANDING');
    expect(lines[1]).toContain('attainment');
  });

  test('quantity node → renders quantity requirement', () => {
    const ast = {
      type: 'all-of',
      items: [{ type: 'quantity', name: 'CLINICAL_HOURS', op: 'gte', value: 500 }],
    };
    const csv = exportProgramChecklist(ast);
    const lines = csv.trim().split('\r\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('Quantity');
    expect(lines[1]).toContain('CLINICAL_HOURS');
    expect(lines[1]).toContain('500');
    expect(lines[1]).toContain('quantity');
  });

  test('course-filter node → renders filter description', () => {
    const ast = {
      type: 'all-of',
      items: [{
        type: 'course-filter',
        filters: [{ field: 'subject', op: 'eq', value: 'MATH' }],
      }],
    };
    const csv = exportProgramChecklist(ast);
    const lines = csv.trim().split('\r\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('Courses where');
    expect(lines[1]).toContain('filter');
  });

  test('from-n-groups → Type shows choose N', () => {
    const ast = {
      type: 'from-n-groups', comparison: 'at-least', count: 2,
      items: [
        { type: 'all-of', label: 'Group A', items: [{ type: 'course', subject: 'A', number: '1' }] },
        { type: 'all-of', label: 'Group B', items: [{ type: 'course', subject: 'B', number: '1' }] },
        { type: 'all-of', label: 'Group C', items: [{ type: 'course', subject: 'C', number: '1' }] },
      ],
    };
    const csv = exportProgramChecklist(ast);
    const lines = csv.trim().split('\r\n');
    const chooseRow = lines.find(l => l.includes('Choose'));
    expect(chooseRow).toBeDefined();
  });

  test('no catalog → courses without titles', () => {
    const ast = {
      type: 'all-of',
      items: [{ type: 'course', subject: 'MATH', number: '101' }],
    };
    const csv = exportProgramChecklist(ast);
    expect(csv).toContain('MATH 101');
  });
});
