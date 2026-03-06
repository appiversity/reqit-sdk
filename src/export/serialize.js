'use strict';

/**
 * serialize.js — Generic CSV and XLSX serializers.
 *
 * Both accept the same `rows`/`headers` interface so export functions
 * are format-agnostic.
 */

const ExcelJS = require('exceljs');

/**
 * Serialize rows as CSV (RFC 4180).
 *
 * Handles quoting of commas, double-quotes, and newlines.
 *
 * @param {Array<object>} rows - Array of row objects
 * @param {string[]} headers - Column headers (keys into row objects)
 * @returns {string} CSV string
 */
function toCSV(rows, headers) {
  const lines = [];
  lines.push(headers.map(escapeCSV).join(','));
  for (const row of rows) {
    const values = headers.map(h => escapeCSV(row[h] != null ? String(row[h]) : ''));
    lines.push(values.join(','));
  }
  return lines.join('\r\n') + '\r\n';
}

/**
 * Escape a CSV field per RFC 4180.
 *
 * Wraps in double-quotes if the field contains commas, quotes, or newlines.
 * Internal double-quotes are doubled.
 *
 * @param {string} field
 * @returns {string}
 */
function escapeCSV(field) {
  if (field.includes(',') || field.includes('"') || field.includes('\n') || field.includes('\r')) {
    return '"' + field.replace(/"/g, '""') + '"';
  }
  return field;
}

/**
 * Serialize rows as XLSX.
 *
 * Returns a Buffer containing the XLSX file.
 *
 * @param {Array<object>} rows - Array of row objects
 * @param {string[]} headers - Column headers (keys into row objects)
 * @param {string} [sheetName='Sheet1'] - Worksheet name
 * @returns {Promise<Buffer>} XLSX buffer
 */
async function toXLSX(rows, headers, sheetName) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName || 'Sheet1');

  sheet.addRow(headers);
  for (const row of rows) {
    const values = headers.map(h => row[h] != null ? row[h] : '');
    sheet.addRow(values);
  }

  return workbook.xlsx.writeBuffer();
}

module.exports = { toCSV, toXLSX };
