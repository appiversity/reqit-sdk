'use strict';

const { exportDependencyMatrix } = require('../../src/export/dependency-matrix');

describe('exportDependencyMatrix', () => {
  test('linear chain A→B→C → direct and transitive entries', () => {
    const catalog = {
      courses: [
        { subject: 'MATH', number: '101', title: 'Algebra' },
        { subject: 'MATH', number: '151', title: 'Calc I',
          prerequisites: { type: 'course', subject: 'MATH', number: '101' } },
        { subject: 'MATH', number: '152', title: 'Calc II',
          prerequisites: { type: 'course', subject: 'MATH', number: '151' } },
      ],
    };
    const csv = exportDependencyMatrix(catalog);
    const lines = csv.trim().split('\r\n');
    // Header + 3 courses
    expect(lines).toHaveLength(4);
    // Header has Course plus course keys as columns
    expect(lines[0]).toContain('Course');

    // MATH:151 row should have prereq for MATH:101
    const row151 = lines.find(l => l.startsWith('MATH:151'));
    expect(row151).toContain('prereq');

    // MATH:152 row should have prereq for MATH:151 and transitive for MATH:101
    const row152 = lines.find(l => l.startsWith('MATH:152'));
    expect(row152).toContain('prereq');
    expect(row152).toContain('transitive');
  });

  test('no prerequisites → empty matrix', () => {
    const catalog = {
      courses: [
        { subject: 'ART', number: '101', title: 'Intro Art' },
        { subject: 'ART', number: '201', title: 'Art History' },
      ],
    };
    const csv = exportDependencyMatrix(catalog);
    const lines = csv.trim().split('\r\n');
    // Header only — no courses with prereqs
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('Course');
  });

  test('diamond dependency → correct transitive closure', () => {
    // D requires B and C; B requires A; C requires A
    const catalog = {
      courses: [
        { subject: 'X', number: '1', title: 'A' },
        { subject: 'X', number: '2', title: 'B',
          prerequisites: { type: 'course', subject: 'X', number: '1' } },
        { subject: 'X', number: '3', title: 'C',
          prerequisites: { type: 'course', subject: 'X', number: '1' } },
        { subject: 'X', number: '4', title: 'D',
          prerequisites: { type: 'all-of', items: [
            { type: 'course', subject: 'X', number: '2' },
            { type: 'course', subject: 'X', number: '3' },
          ] } },
      ],
    };
    const csv = exportDependencyMatrix(catalog);
    const lines = csv.trim().split('\r\n');
    // Header + 4 courses
    expect(lines).toHaveLength(5);

    // D should have direct prereqs B and C, transitive prereq A
    const rowD = lines.find(l => l.startsWith('X:4'));
    expect(rowD).toContain('prereq');
    expect(rowD).toContain('transitive');
  });

  test('transitive: false excludes transitive dependencies', () => {
    const catalog = {
      courses: [
        { subject: 'M', number: '1' },
        { subject: 'M', number: '2',
          prerequisites: { type: 'course', subject: 'M', number: '1' } },
        { subject: 'M', number: '3',
          prerequisites: { type: 'course', subject: 'M', number: '2' } },
      ],
    };
    const csv = exportDependencyMatrix(catalog, { transitive: false });
    const lines = csv.trim().split('\r\n');
    // M:3 row should have prereq for M:2 but NOT transitive for M:1
    const row3 = lines.find(l => l.startsWith('M:3'));
    expect(row3).toContain('prereq');
    expect(row3).not.toContain('transitive');
  });

  test('sorted output keys', () => {
    const catalog = {
      courses: [
        { subject: 'Z', number: '1' },
        { subject: 'A', number: '1',
          prerequisites: { type: 'course', subject: 'Z', number: '1' } },
      ],
    };
    const csv = exportDependencyMatrix(catalog);
    const lines = csv.trim().split('\r\n');
    // First data row should be A:1 (sorted before Z:1)
    expect(lines[1]).toMatch(/^A:1/);
  });
});
