'use strict';

const { exportAudit } = require('../../src/export/audit-export');
const { audit } = require('../../src/audit');
const minimalCatalog = require('../fixtures/catalogs/minimal.json');

const partial = require('../fixtures/transcripts/minimal/partial.json');
const empty = require('../fixtures/transcripts/minimal/empty.json');
const inProgress = require('../fixtures/transcripts/minimal/in-progress.json');

describe('exportAudit', () => {
  test('met courses show transcript details', () => {
    const ast = {
      type: 'all-of',
      items: [
        { type: 'course', subject: 'MATH', number: '101' },
        { type: 'course', subject: 'CMPS', number: '130' },
      ],
    };
    const { result } = audit(ast, minimalCatalog, partial);
    const csv = exportAudit(result, minimalCatalog);
    const lines = csv.trim().split('\r\n');
    expect(lines).toHaveLength(3); // header + 2 courses
    expect(lines[1]).toContain('met');
    expect(lines[1]).toContain('MATH 101');
    expect(lines[1]).toContain('Fall 2023');
  });

  test('not-met courses show empty satisfied-by', () => {
    const ast = {
      type: 'all-of',
      items: [
        { type: 'course', subject: 'ART', number: '301' },
      ],
    };
    const { result } = audit(ast, minimalCatalog, partial);
    const csv = exportAudit(result, minimalCatalog);
    const lines = csv.trim().split('\r\n');
    expect(lines).toHaveLength(2); // header + 1 course
    expect(lines[1]).toContain('not-met');
  });

  test('in-progress courses show current status', () => {
    // in-progress transcript has MATH 152 as in-progress
    const ast = {
      type: 'all-of',
      items: [
        { type: 'course', subject: 'MATH', number: '101' },
        { type: 'course', subject: 'MATH', number: '152' },
      ],
    };
    const { result } = audit(ast, minimalCatalog, inProgress);
    const csv = exportAudit(result, minimalCatalog);
    const lines = csv.trim().split('\r\n');
    expect(lines).toHaveLength(3); // header + 2 courses
    const ipLine = lines.find(l => l.includes('provisional-met'));
    expect(ipLine).toBeDefined();
    expect(ipLine).toContain('152');
  });

  test('labeled groups show in Group column', () => {
    const ast = {
      type: 'all-of',
      items: [
        {
          type: 'all-of', label: 'Math Core',
          items: [{ type: 'course', subject: 'MATH', number: '101' }],
        },
      ],
    };
    const { result } = audit(ast, minimalCatalog, partial);
    const csv = exportAudit(result, minimalCatalog);
    expect(csv).toContain('Math Core');
  });

  test('course-filter node renders filter description', () => {
    const ast = {
      type: 'course-filter',
      filters: [{ field: 'attribute', op: 'eq', value: 'WI' }],
    };
    const { result } = audit(ast, minimalCatalog, empty);
    const csv = exportAudit(result, minimalCatalog);
    const lines = csv.trim().split('\r\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('Courses where');
    expect(lines[1]).toContain('attribute');
    expect(lines[1]).toContain('WI');
  });

  test('attainment node renders name', () => {
    const ast = { type: 'attainment', name: 'JUNIOR_STANDING' };
    const { result } = audit(ast, minimalCatalog, empty);
    const csv = exportAudit(result, minimalCatalog);
    const lines = csv.trim().split('\r\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('Attainment');
    expect(lines[1]).toContain('JUNIOR_STANDING');
    expect(lines[1]).toContain('not-met');
  });

  test('met attainment with attainment provided', () => {
    const ast = { type: 'attainment', name: 'JUNIOR_STANDING' };
    const { result } = audit(ast, minimalCatalog, empty, {
      attainments: { JUNIOR_STANDING: { kind: 'boolean', value: true } },
    });
    const csv = exportAudit(result, minimalCatalog);
    expect(csv).toContain('met');
  });

  test('course-filter with matched courses in audit', () => {
    // Use a filter that matches some courses, and a transcript that satisfies some
    const ast = {
      type: 'course-filter',
      filters: [{ field: 'subject', op: 'eq', value: 'MATH' }],
    };
    const { result } = audit(ast, minimalCatalog, partial);
    const csv = exportAudit(result, minimalCatalog);
    expect(csv).toContain('Courses where');
  });

  test('score node with actual value', () => {
    const ast = { type: 'score', name: 'SAT', op: 'gte', value: 600 };
    const { result } = audit(ast, minimalCatalog, empty, {
      attainments: { SAT: { kind: 'score', value: 650 } },
    });
    const csv = exportAudit(result, minimalCatalog);
    expect(csv).toContain('SAT');
    expect(csv).toContain('met');
    expect(csv).toContain('650');
  });

  test('program-ref with sub-audit produces rows for summary and inner courses', () => {
    const catalog = {
      ...minimalCatalog,
      programs: [{
        code: 'MATH-MINOR',
        type: 'minor',
        requirements: {
          type: 'all-of',
          items: [
            { type: 'course', subject: 'MATH', number: '101' },
            { type: 'course', subject: 'MATH', number: '152' },
          ],
        },
      }],
    };
    const { result } = audit(
      { type: 'program-ref', code: 'MATH-MINOR' },
      catalog,
      partial,
      { declaredPrograms: [{ code: 'MATH-MINOR', type: 'minor' }] },
    );
    const csv = exportAudit(result, catalog);
    const lines = csv.trim().split('\r\n');
    // header + program-ref row + 2 inner course rows
    expect(lines).toHaveLength(4);
    expect(lines[1]).toContain('MATH-MINOR');
    expect(lines[2]).toContain('MATH 101');
    expect(lines[3]).toContain('MATH 152');
  });
});
