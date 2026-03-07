'use strict';

/**
 * transcript.js — Transcript normalization, indexing, and helpers.
 *
 * A transcript is an external input: a Transcript entity with courses,
 * attainments, declared programs, waivers, and substitutions.
 * Reqit does not store transcripts.
 *
 * TranscriptCourse shape:
 *   subject  — subject code (e.g. "MATH")
 *   number   — course number (e.g. "151")
 *   grade    — grade string, or null for in-progress
 *   credits  — credits for this course
 *   term     — opaque to reqit (display only)
 *   status   — 'completed' | 'in-progress' | 'withdrawn'
 */

const { courseKey } = require('../render/shared');
const { isAuditableGrade } = require('../grade');

/**
 * Build a grade → points lookup from a gradeConfig scale.
 * @param {object} gradeConfig
 * @returns {Map<string, number>}
 */
function buildGradePointsMap(gradeConfig) {
  const map = new Map();
  if (gradeConfig && gradeConfig.scale) {
    for (const entry of gradeConfig.scale) {
      map.set(entry.grade, entry.points);
    }
  }
  return map;
}

/**
 * Normalize and index a transcript for O(1) audit lookup.
 *
 * Steps:
 *   1. Filter out withdrawn entries
 *   2. Filter out entries with audit:false grades
 *   3. Deduplicate by courseKey using the specified policy
 *   4. Build courseKey → entry Map
 *   5. Build crossListGroup → entries Map (using catalog cross-list info)
 *
 * @param {object[]} courses - Raw transcript course entries
 * @param {object} gradeConfig - Institution grade configuration
 * @param {object} [catalogIndex] - Optional catalog courseKey → course Map
 *   for cross-list group resolution
 * @param {object} [options] - Normalization options
 * @param {string} [options.duplicatePolicy='latest'] - How to handle repeated
 *   courses: 'latest' (last entry wins), 'best-grade' (highest grade points
 *   wins), or 'first' (first entry wins)
 * @returns {{
 *   byKey: Map<string, object>,
 *   byCrossListGroup: Map<string, object[]>,
 *   courses: object[]
 * }}
 */
function normalizeTranscript(courses, gradeConfig, catalogIndex, options) {
  if (!courses || !Array.isArray(courses)) {
    return { byKey: new Map(), byCrossListGroup: new Map(), courses: [] };
  }

  const policy = (options && options.duplicatePolicy) || 'latest';

  // Step 1+2: filter withdrawn and non-auditable
  const auditable = [];
  for (const entry of courses) {
    if (entry.status === 'withdrawn') continue;
    if (entry.grade != null && !isAuditableGrade(entry.grade, gradeConfig)) continue;
    auditable.push(entry);
  }

  // Step 3: deduplicate by courseKey using the specified policy
  const byKey = new Map();
  if (policy === 'best-grade') {
    const gradePoints = buildGradePointsMap(gradeConfig);
    for (const entry of auditable) {
      const key = courseKey(entry);
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, entry);
      } else {
        const existingPoints = gradePoints.get(existing.grade) ?? -1;
        const newPoints = gradePoints.get(entry.grade) ?? -1;
        if (newPoints > existingPoints) {
          byKey.set(key, entry);
        }
      }
    }
  } else if (policy === 'first') {
    for (const entry of auditable) {
      const key = courseKey(entry);
      if (!byKey.has(key)) {
        byKey.set(key, entry);
      }
    }
  } else {
    // 'latest' — last entry wins (default)
    for (const entry of auditable) {
      const key = courseKey(entry);
      byKey.set(key, entry);
    }
  }

  // Step 5: build crossListGroup index (if catalog provides cross-list info)
  const byCrossListGroup = new Map();
  if (catalogIndex) {
    for (const entry of byKey.values()) {
      const key = courseKey(entry);
      const catalogCourse = catalogIndex.get(key);
      if (catalogCourse && catalogCourse.crossListGroup) {
        const group = catalogCourse.crossListGroup;
        if (!byCrossListGroup.has(group)) {
          byCrossListGroup.set(group, []);
        }
        byCrossListGroup.get(group).push(entry);
      }
    }
  }

  return {
    byKey,
    byCrossListGroup,
    courses: Array.from(byKey.values()),
  };
}

/**
 * Look up a transcript entry by courseKey, with cross-list fallback.
 *
 * @param {string} key - courseKey to look up (e.g. "MATH:151")
 * @param {object} normalizedTranscript - Result of normalizeTranscript()
 * @param {object} [catalogIndex] - Optional catalog courseKey → course Map
 * @param {Map<string, object[]>} [crossListIndex] - Optional crossListGroup → courses Map
 * @returns {{ entry: object|null, crossListed: boolean }}
 */
function lookupTranscriptEntry(key, normalizedTranscript, catalogIndex, crossListIndex) {
  // Direct match
  const direct = normalizedTranscript.byKey.get(key);
  if (direct) return { entry: direct, crossListed: false };

  // Cross-list fallback: find the catalog course's cross-list group,
  // then check if any transcript entry belongs to that group
  if (catalogIndex && crossListIndex) {
    const catalogCourse = catalogIndex.get(key);
    if (catalogCourse && catalogCourse.crossListGroup) {
      const groupCourses = crossListIndex.get(catalogCourse.crossListGroup);
      if (groupCourses) {
        // Check each cross-listed catalog course against the transcript
        for (const altCourse of groupCourses) {
          const altKey = courseKey(altCourse);
          if (altKey === key) continue; // skip the original
          const altEntry = normalizedTranscript.byKey.get(altKey);
          if (altEntry) return { entry: altEntry, crossListed: true };
        }
      }
    }
  }

  return { entry: null, crossListed: false };
}

/**
 * Sum credits earned (completed with passing grade).
 *
 * @param {object[]} courses - Filtered transcript course entries
 * @param {object} gradeConfig - Grade configuration
 * @param {Function} isPassingGrade - Grade check function
 * @returns {number}
 */
function creditsEarned(entries, gradeConfig, isPassingGrade) {
  let total = 0;
  for (const e of entries) {
    if (e.status === 'completed' && e.grade != null && isPassingGrade(e.grade, gradeConfig)) {
      total += e.credits;
    }
  }
  return total;
}

/**
 * Sum credits in progress (enrolled, no grade yet).
 *
 * @param {object[]} courses - Filtered transcript course entries
 * @returns {number}
 */
function creditsInProgress(entries) {
  let total = 0;
  for (const e of entries) {
    if (e.status === 'in-progress') {
      total += e.credits;
    }
  }
  return total;
}

/**
 * Sum credits attempted (completed + in-progress — not withdrawn).
 *
 * @param {object[]} courses - Filtered transcript course entries
 * @returns {number}
 */
function creditsAttempted(entries) {
  let total = 0;
  for (const e of entries) {
    total += e.credits;
  }
  return total;
}

module.exports = {
  normalizeTranscript,
  lookupTranscriptEntry,
  creditsEarned,
  creditsInProgress,
  creditsAttempted,
};
