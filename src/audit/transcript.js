'use strict';

/**
 * transcript.js — Transcript normalization, indexing, and helpers.
 *
 * A transcript is an external input: an array of TranscriptEntry objects
 * provided by the consuming application. Reqit does not store transcripts.
 *
 * TranscriptEntry shape:
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
 * Normalize and index a transcript for O(1) audit lookup.
 *
 * Steps:
 *   1. Filter out withdrawn entries
 *   2. Filter out entries with audit:false grades
 *   3. Deduplicate by courseKey — keep last (most recent) auditable entry
 *   4. Build courseKey → entry Map
 *   5. Build crossListGroup → entries Map (using catalog cross-list info)
 *
 * @param {object[]} entries - Raw transcript entries
 * @param {object} gradeConfig - Institution grade configuration
 * @param {object} [catalogIndex] - Optional catalog courseKey → course Map
 *   for cross-list group resolution
 * @returns {{
 *   byKey: Map<string, object>,
 *   byCrossListGroup: Map<string, object[]>,
 *   entries: object[]
 * }}
 */
function normalizeTranscript(entries, gradeConfig, catalogIndex) {
  if (!entries || !Array.isArray(entries)) {
    return { byKey: new Map(), byCrossListGroup: new Map(), entries: [] };
  }

  // Step 1+2: filter withdrawn and non-auditable
  const auditable = [];
  for (const entry of entries) {
    if (entry.status === 'withdrawn') continue;
    if (entry.grade != null && !isAuditableGrade(entry.grade, gradeConfig)) continue;
    auditable.push(entry);
  }

  // Step 3: deduplicate by courseKey — last entry wins (most recent)
  const byKey = new Map();
  for (const entry of auditable) {
    const key = courseKey(entry);
    byKey.set(key, entry);
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
    entries: Array.from(byKey.values()),
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
 * @param {object[]} entries - Filtered transcript entries
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
 * @param {object[]} entries - Filtered transcript entries
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
 * @param {object[]} entries - Filtered transcript entries
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
