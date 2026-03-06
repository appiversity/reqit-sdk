'use strict';

const { toCSV, toXLSX } = require('../../src/export/serialize');
const ExcelJS = require('exceljs');

// ============================================================
// toCSV
// ============================================================

describe('toCSV', () => {
  test('basic rows and headers', () => {
    const rows = [
      { Name: 'Alice', Age: '30' },
      { Name: 'Bob', Age: '25' },
    ];
    const csv = toCSV(rows, ['Name', 'Age']);
    expect(csv).toBe('Name,Age\r\nAlice,30\r\nBob,25\r\n');
  });

  test('quotes fields containing commas', () => {
    const rows = [{ Value: 'hello, world' }];
    const csv = toCSV(rows, ['Value']);
    expect(csv).toContain('"hello, world"');
  });

  test('doubles internal quotes', () => {
    const rows = [{ Value: 'say "hi"' }];
    const csv = toCSV(rows, ['Value']);
    expect(csv).toContain('"say ""hi"""');
  });

  test('quotes fields containing newlines', () => {
    const rows = [{ Value: 'line1\nline2' }];
    const csv = toCSV(rows, ['Value']);
    expect(csv).toContain('"line1\nline2"');
  });

  test('handles empty values', () => {
    const rows = [{ A: 'x', B: null, C: undefined }];
    const csv = toCSV(rows, ['A', 'B', 'C']);
    expect(csv).toBe('A,B,C\r\nx,,\r\n');
  });

  test('empty rows array produces header-only output', () => {
    const csv = toCSV([], ['A', 'B']);
    expect(csv).toBe('A,B\r\n');
  });
});

// ============================================================
// toXLSX
// ============================================================

describe('toXLSX', () => {
  test('returns a Buffer', async () => {
    const rows = [{ Name: 'Alice', Age: 30 }];
    const buf = await toXLSX(rows, ['Name', 'Age']);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(0);
  });

  test('round-trip: write then read back', async () => {
    const rows = [
      { Subject: 'MATH', Number: '101', Title: 'Calculus' },
      { Subject: 'CMPS', Number: '130', Title: 'Intro CS' },
    ];
    const headers = ['Subject', 'Number', 'Title'];
    const buf = await toXLSX(rows, headers, 'Courses');

    // Read back
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buf);
    const sheet = workbook.getWorksheet('Courses');
    expect(sheet).toBeDefined();
    expect(sheet.rowCount).toBe(3); // header + 2 data rows

    const headerRow = sheet.getRow(1).values.slice(1); // exceljs is 1-indexed, first element is empty
    expect(headerRow).toEqual(['Subject', 'Number', 'Title']);

    const row1 = sheet.getRow(2).values.slice(1);
    expect(row1).toEqual(['MATH', '101', 'Calculus']);
  });
});
