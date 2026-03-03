'use strict';

/**
 * grade/index.js — Grade configuration, comparison, and GPA calculation.
 *
 * Grade interpretation is intentionally separated from transcripts. A transcript
 * carries raw letter grades; the catalog provides the grade scale via `gradeConfig`.
 * Comparison and GPA calculation happen at audit time using the functions below.
 *
 * GradeConfig shape:
 *   scale      — ordered array of { grade, points, audit? }; first entry is highest
 *   passFail   — array of { grade, passing, audit? }
 *   withdrawal — array of grade strings (non-calculated)
 *   incomplete — array of grade strings (non-calculated)
 *
 * The optional `audit` boolean on scale and passFail entries defaults to true.
 * When set to false, the grade is excluded from all audit evaluation, GPA
 * calculation, and grade comparison. This handles retake scenarios where an
 * institution marks the original grade (e.g. "RD") as non-auditable so only
 * the replacement grade participates in the audit.
 */

/**
 * Default US letter grade scale (A+ through F), plus standard pass/fail,
 * withdrawal, and incomplete grades. Frozen to prevent accidental mutation.
 * @type {Readonly<GradeConfig>}
 */
const DEFAULT_GRADE_CONFIG = Object.freeze({
  scale: Object.freeze([
    Object.freeze({ grade: 'A+', points: 4.0 }),
    Object.freeze({ grade: 'A',  points: 4.0 }),
    Object.freeze({ grade: 'A-', points: 3.7 }),
    Object.freeze({ grade: 'B+', points: 3.3 }),
    Object.freeze({ grade: 'B',  points: 3.0 }),
    Object.freeze({ grade: 'B-', points: 2.7 }),
    Object.freeze({ grade: 'C+', points: 2.3 }),
    Object.freeze({ grade: 'C',  points: 2.0 }),
    Object.freeze({ grade: 'C-', points: 1.7 }),
    Object.freeze({ grade: 'D+', points: 1.3 }),
    Object.freeze({ grade: 'D',  points: 1.0 }),
    Object.freeze({ grade: 'D-', points: 0.7 }),
    Object.freeze({ grade: 'F',  points: 0.0 }),
  ]),
  passFail: Object.freeze([
    Object.freeze({ grade: 'P', passing: true }),
    Object.freeze({ grade: 'NP', passing: false }),
  ]),
  withdrawal: Object.freeze(['W', 'WP', 'WF']),
  incomplete: Object.freeze(['I', 'IP']),
});

/**
 * Build a Map from grade string → index in the scale (0 = highest).
 * @param {Array<{grade: string, points: number}>} scale
 * @returns {Map<string, number>}
 */
function buildScaleIndex(scale) {
  const index = new Map();
  for (let i = 0; i < scale.length; i++) {
    index.set(scale[i].grade, i);
  }
  return index;
}

/** @type {WeakMap<Array, Map<string, number>>} */
const _scaleIndexCache = new WeakMap();

/**
 * Get (or build and cache) the scale index for a grade scale array.
 * @param {Array<{grade: string, points: number}>} scale
 * @returns {Map<string, number>}
 */
function getScaleIndex(scale) {
  if (_scaleIndexCache.has(scale)) return _scaleIndexCache.get(scale);
  const index = buildScaleIndex(scale);
  _scaleIndexCache.set(scale, index);
  return index;
}

/**
 * Check whether a grade is auditable (participates in audit and GPA).
 * A grade is auditable unless its config entry has `audit: false`.
 * The `audit` field defaults to true when omitted.
 *
 * Grades not found in scale or passFail are considered auditable (they will
 * be flagged separately as unrecognized during audit).
 *
 * @param {string} grade - The grade to check
 * @param {GradeConfig} gradeConfig - Grade configuration
 * @returns {boolean} True if the grade is auditable
 */
function isAuditableGrade(grade, gradeConfig) {
  const config = gradeConfig || DEFAULT_GRADE_CONFIG;

  // Check scale entries
  const index = getScaleIndex(config.scale);
  const scalePos = index.get(grade);
  if (scalePos !== undefined) {
    return config.scale[scalePos].audit !== false;
  }

  // Check passFail entries
  if (config.passFail) {
    const pf = config.passFail.find(p => p.grade === grade);
    if (pf) return pf.audit !== false;
  }

  // Withdrawal, incomplete, or unrecognized — auditable by default
  // (withdrawal/incomplete are already handled as non-passing)
  return true;
}

/**
 * Check whether `grade` meets or exceeds `minGrade` on the given scale.
 * Both grades must appear in `gradeConfig.scale`. A grade meets the minimum
 * if its position in the scale is <= the position of minGrade (earlier = higher).
 *
 * Pass/fail, withdrawal, and incomplete grades never meet a minimum letter grade.
 * Grades with `audit: false` never meet a minimum grade.
 *
 * @param {string} grade - The grade to check
 * @param {string} minGrade - The minimum required grade
 * @param {GradeConfig} gradeConfig - Grade configuration
 * @returns {boolean} True if grade meets or exceeds minGrade
 * @throws {Error} If minGrade is not found in the scale
 */
function meetsMinGrade(grade, minGrade, gradeConfig) {
  const config = gradeConfig || DEFAULT_GRADE_CONFIG;
  const index = getScaleIndex(config.scale);

  const minPos = index.get(minGrade);
  if (minPos === undefined) {
    throw new Error(`Grade "${minGrade}" not found in grade scale`);
  }

  const gradePos = index.get(grade);
  if (gradePos === undefined) {
    // Grade not on scale (P/NP, W, I, etc.) — does not meet minimum
    return false;
  }

  // Non-auditable grades never meet a minimum
  if (config.scale[gradePos].audit === false) return false;

  return gradePos <= minPos;
}

/**
 * Check whether a grade is considered passing.
 * A grade is passing if it appears in the scale with points > 0,
 * or appears in passFail with `passing: true`.
 * Withdrawal and incomplete grades are not passing.
 * Grades with `audit: false` are not passing.
 *
 * @param {string} grade - The grade to check
 * @param {GradeConfig} gradeConfig - Grade configuration
 * @returns {boolean} True if the grade is passing
 */
function isPassingGrade(grade, gradeConfig) {
  const config = gradeConfig || DEFAULT_GRADE_CONFIG;

  // Check scale grades — passing if points > 0 and auditable
  const index = getScaleIndex(config.scale);
  const scalePos = index.get(grade);
  if (scalePos !== undefined) {
    if (config.scale[scalePos].audit === false) return false;
    return config.scale[scalePos].points > 0;
  }

  // Check pass/fail grades
  if (config.passFail) {
    const pf = config.passFail.find(p => p.grade === grade);
    if (pf) {
      if (pf.audit === false) return false;
      return pf.passing;
    }
  }

  // Withdrawal, incomplete, or unrecognised — not passing
  return false;
}

/**
 * Calculate credit-weighted GPA from transcript entries.
 * Only grades appearing in `gradeConfig.scale` with `audit !== false`
 * contribute to GPA. Pass/fail, withdrawal, incomplete, and non-auditable
 * grades are excluded from calculation.
 *
 * @param {Array<{grade: string, credits: number}>} entries - Transcript entries
 * @param {GradeConfig} gradeConfig - Grade configuration
 * @returns {number} Weighted GPA, or 0 if no graded credits
 */
function calculateGPA(entries, gradeConfig) {
  const config = gradeConfig || DEFAULT_GRADE_CONFIG;
  const index = getScaleIndex(config.scale);

  let totalPoints = 0;
  let totalCredits = 0;

  for (const entry of entries) {
    const scalePos = index.get(entry.grade);
    if (scalePos === undefined) continue; // skip non-scale grades
    if (config.scale[scalePos].audit === false) continue; // skip non-auditable
    const points = config.scale[scalePos].points;
    totalPoints += points * entry.credits;
    totalCredits += entry.credits;
  }

  if (totalCredits === 0) return 0;
  return totalPoints / totalCredits;
}

module.exports = {
  DEFAULT_GRADE_CONFIG,
  isAuditableGrade,
  meetsMinGrade,
  isPassingGrade,
  calculateGPA,
};
