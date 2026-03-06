'use strict';

const { exportPrereqMatrix } = require('../../src/export/prereq-matrix');
const minimalCatalog = require('../fixtures/catalogs/minimal.json');

// ============================================================
// exportPrereqMatrix
// ============================================================

describe('exportPrereqMatrix', () => {
  test('linear chain A→B→C → one pair per direct link', () => {
    // MATH 101 → MATH 151 → MATH 152
    const catalog = {
      courses: [
        { subject: 'MATH', number: '101', title: 'Algebra', creditsMin: 3, creditsMax: 3 },
        { subject: 'MATH', number: '151', title: 'Calc I', creditsMin: 4, creditsMax: 4,
          prerequisites: { type: 'course', subject: 'MATH', number: '101' } },
        { subject: 'MATH', number: '152', title: 'Calc II', creditsMin: 4, creditsMax: 4,
          prerequisites: { type: 'course', subject: 'MATH', number: '151' } },
      ],
    };
    const csv = exportPrereqMatrix(catalog);
    const lines = csv.trim().split('\r\n');
    // Header + 2 direct pairs (MATH 151→101, MATH 152→151)
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('MATH');
    expect(lines[1]).toContain('direct');
  });

  test('linear chain with transitive: true → includes transitive rows', () => {
    const catalog = {
      courses: [
        { subject: 'MATH', number: '101', title: 'Algebra', creditsMin: 3, creditsMax: 3 },
        { subject: 'MATH', number: '151', title: 'Calc I', creditsMin: 4, creditsMax: 4,
          prerequisites: { type: 'course', subject: 'MATH', number: '101' } },
        { subject: 'MATH', number: '152', title: 'Calc II', creditsMin: 4, creditsMax: 4,
          prerequisites: { type: 'course', subject: 'MATH', number: '151' } },
      ],
    };
    const csv = exportPrereqMatrix(catalog, { transitive: true });
    const lines = csv.trim().split('\r\n');
    // Header + 2 direct + 1 transitive (MATH 152 → MATH 101 transitive)
    expect(lines).toHaveLength(4);
    const transitiveLine = lines.find(l => l.includes('transitive'));
    expect(transitiveLine).toBeDefined();
    expect(transitiveLine).toContain('152');
    expect(transitiveLine).toContain('101');
  });

  test('course with no prereqs → no rows', () => {
    const catalog = {
      courses: [
        { subject: 'ART', number: '101', title: 'Intro Art', creditsMin: 3, creditsMax: 3 },
      ],
    };
    const csv = exportPrereqMatrix(catalog);
    const lines = csv.trim().split('\r\n');
    expect(lines).toHaveLength(1); // header only
  });

  test('course with multiple prereqs → one row per prereq', () => {
    const catalog = {
      courses: [
        { subject: 'A', number: '1', title: 'A1', creditsMin: 3, creditsMax: 3 },
        { subject: 'B', number: '2', title: 'B2', creditsMin: 3, creditsMax: 3 },
        { subject: 'C', number: '3', title: 'C3', creditsMin: 3, creditsMax: 3,
          prerequisites: {
            type: 'all-of',
            items: [
              { type: 'course', subject: 'A', number: '1' },
              { type: 'course', subject: 'B', number: '2' },
            ],
          } },
      ],
    };
    const csv = exportPrereqMatrix(catalog);
    const lines = csv.trim().split('\r\n');
    // Header + 2 rows (C3→A1, C3→B2)
    expect(lines).toHaveLength(3);
  });

  test('XLSX format returns Buffer', async () => {
    const catalog = {
      courses: [
        { subject: 'MATH', number: '101', title: 'Algebra', creditsMin: 3, creditsMax: 3 },
        { subject: 'MATH', number: '151', title: 'Calc I', creditsMin: 4, creditsMax: 4,
          prerequisites: { type: 'course', subject: 'MATH', number: '101' } },
      ],
    };
    const buf = await exportPrereqMatrix(catalog, { format: 'xlsx' });
    expect(Buffer.isBuffer(buf)).toBe(true);
  });

  test('sorted by subject/number then prereq subject/number', () => {
    const catalog = {
      courses: [
        { subject: 'Z', number: '1', title: 'Z1', creditsMin: 3, creditsMax: 3 },
        { subject: 'A', number: '1', title: 'A1', creditsMin: 3, creditsMax: 3,
          prerequisites: { type: 'course', subject: 'Z', number: '1' } },
      ],
    };
    const csv = exportPrereqMatrix(catalog);
    const lines = csv.trim().split('\r\n');
    // A:1 → Z:1 should be first data row (A comes before Z)
    expect(lines[1]).toMatch(/^A,/);
  });

  test('includeNoPrereqs → courses with no prereqs appear as empty rows', () => {
    const catalog = {
      courses: [
        { subject: 'ART', number: '101', title: 'Intro Art', creditsMin: 3, creditsMax: 3 },
        { subject: 'ART', number: '201', title: 'Art II', creditsMin: 3, creditsMax: 3,
          prerequisites: { type: 'course', subject: 'ART', number: '101' } },
      ],
    };
    const csv = exportPrereqMatrix(catalog, { includeNoPrereqs: true });
    const lines = csv.trim().split('\r\n');
    // Header + 1 direct prereq row (ART 201→101) + 1 no-prereq row (ART 101)
    expect(lines).toHaveLength(3);
    const noPrereqLine = lines.find(l => l.includes('Intro Art') && !l.includes('direct'));
    expect(noPrereqLine).toBeDefined();
  });

  test('prereq not in catalog → uses key parts for subject/number', () => {
    const catalog = {
      courses: [
        { subject: 'X', number: '2', title: 'X2', creditsMin: 3, creditsMax: 3,
          prerequisites: { type: 'course', subject: 'Z', number: '9' } },
      ],
    };
    const csv = exportPrereqMatrix(catalog);
    const lines = csv.trim().split('\r\n');
    expect(lines).toHaveLength(2); // header + 1 row
    expect(lines[1]).toContain('Z');
    expect(lines[1]).toContain('9');
  });

  test('minimal catalog produces expected output', () => {
    const csv = exportPrereqMatrix(minimalCatalog);
    const lines = csv.trim().split('\r\n');
    // Should have at least the header + several prereq relationships
    expect(lines.length).toBeGreaterThan(5);
    expect(lines[0]).toBe('Subject,Number,Title,Prereq Subject,Prereq Number,Prereq Title,Relationship');
  });
});
