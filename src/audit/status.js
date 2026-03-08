'use strict';

/**
 * status.js — 4-state audit status propagation rules.
 *
 * Pure functions that compute parent status from child statuses.
 * No AST or transcript knowledge — just status arrays → parent status.
 *
 * Status values (ordered by progress):
 *   'met'              — requirement fully satisfied
 *   'provisional-met'  — will be met when currently-enrolled courses complete
 *   'in-progress'      — some progress, but completing enrolled courses alone won't satisfy
 *   'not-met'          — no progress toward this requirement
 */

const MET = 'met';
const PROVISIONAL_MET = 'provisional-met';
const IN_PROGRESS = 'in-progress';
const NOT_MET = 'not-met';
const WAIVED = 'waived';
const SUBSTITUTED = 'substituted';

const STATUSES = Object.freeze([MET, PROVISIONAL_MET, IN_PROGRESS, NOT_MET, WAIVED, SUBSTITUTED]);

/**
 * Count statuses in an array.
 * @param {string[]} statuses
 * @returns {{ met: number, pm: number, ip: number, nm: number, total: number }}
 */
function countStatuses(statuses) {
  let met = 0, pm = 0, ip = 0, nm = 0;
  for (const s of statuses) {
    switch (s) {
      case MET:
      case WAIVED:
      case SUBSTITUTED:
        met++; break;
      case PROVISIONAL_MET: pm++; break;
      case IN_PROGRESS: ip++; break;
      default: nm++; break;
    }
  }
  return { met, pm, ip, nm, total: statuses.length };
}

/**
 * all-of: every child must be satisfied.
 *
 * - All met → met
 * - All met or provisional-met → provisional-met
 * - ≥1 child has progress but above not satisfied → in-progress
 * - All not-met → not-met
 */
function allOf(statuses) {
  if (statuses.length === 0) return MET;
  const { met, pm, ip, nm, total } = countStatuses(statuses);
  if (met === total) return MET;
  if (met + pm === total) return PROVISIONAL_MET;
  if (nm === total) return NOT_MET;
  return IN_PROGRESS;
}

/**
 * any-of: at least one child must be satisfied.
 *
 * - ≥1 met → met
 * - No met, ≥1 provisional-met → provisional-met
 * - No met, no pm, ≥1 in-progress → in-progress
 * - All not-met → not-met
 */
function anyOf(statuses) {
  if (statuses.length === 0) return NOT_MET;
  const { met, pm, ip } = countStatuses(statuses);
  if (met > 0) return MET;
  if (pm > 0) return PROVISIONAL_MET;
  if (ip > 0) return IN_PROGRESS;
  return NOT_MET;
}

/**
 * n-of with at-least comparison.
 *
 * - met ≥ K → met
 * - met + pm ≥ K → provisional-met
 * - some progress (met + pm + ip > 0) → in-progress
 * - no progress → not-met
 */
function nOfAtLeast(statuses, k) {
  if (statuses.length === 0) return k <= 0 ? MET : NOT_MET;
  const { met, pm, ip } = countStatuses(statuses);
  if (met >= k) return MET;
  if (met + pm >= k) return PROVISIONAL_MET;
  if (met + pm + ip > 0) return IN_PROGRESS;
  return NOT_MET;
}

/**
 * n-of with at-most comparison (constraint on maximum).
 *
 * - met ≤ K → met (constraint satisfied)
 * - met > K → not-met (too many matched — can't undo completed courses)
 *
 * Provisional-met children that might push count over K:
 * - met ≤ K but met + pm > K → provisional-met (uncertain — currently ok
 *   but enrolled courses completing could exceed limit).
 */
function nOfAtMost(statuses, k) {
  if (statuses.length === 0) return MET;
  const { met, pm } = countStatuses(statuses);
  if (met > k) return NOT_MET;
  // If provisional-met children completing could exceed limit, flag as
  // provisional-met (uncertain outcome). Otherwise, met.
  if (met + pm > k) return PROVISIONAL_MET;
  return MET;
}

/**
 * n-of with exactly comparison.
 *
 * - met === K → met
 * - met > K → not-met (over-matched)
 * - met < K, met + pm ≥ K → provisional-met
 * - met < K, some progress → in-progress
 * - no progress → not-met
 */
function nOfExactly(statuses, k) {
  if (statuses.length === 0) return k === 0 ? MET : NOT_MET;
  const { met, pm, ip } = countStatuses(statuses);
  if (met === k) return MET;
  if (met > k) return NOT_MET;
  if (met + pm >= k) return PROVISIONAL_MET;
  if (met + pm + ip > 0) return IN_PROGRESS;
  return NOT_MET;
}

/**
 * Dispatch to the right n-of variant.
 *
 * @param {string[]} statuses - Child statuses
 * @param {string} comparison - 'at-least' | 'at-most' | 'exactly'
 * @param {number} k - The count threshold
 * @returns {string} Parent status
 */
function nOf(statuses, comparison, k) {
  switch (comparison) {
    case 'at-least': return nOfAtLeast(statuses, k);
    case 'at-most': return nOfAtMost(statuses, k);
    case 'exactly': return nOfExactly(statuses, k);
    default: throw new Error(`Unknown n-of comparison: "${comparison}"`);
  }
}

/**
 * none-of: none of the items may be satisfied (exclusion constraint).
 *
 * - No child met, no child provisional-met → met
 * - Any child met → not-met
 * - No child met, ≥1 child provisional-met → provisional-met (risk if enrolled courses complete)
 */
function noneOf(statuses) {
  if (statuses.length === 0) return MET;
  const { met, pm } = countStatuses(statuses);
  if (met > 0) return NOT_MET;
  if (pm > 0) return PROVISIONAL_MET;
  return MET;
}

/**
 * credits-from: credit-counted requirement.
 *
 * @param {number} earned - Credits earned (completed, passing)
 * @param {number} inProg - Credits in progress
 * @param {number} required - Credit threshold
 * @param {string} comparison - 'at-least' | 'at-most' | 'exactly'
 * @returns {string}
 */
function creditsFrom(earned, inProg, required, comparison) {
  switch (comparison) {
    case 'at-least':
      if (earned >= required) return MET;
      if (earned + inProg >= required) return PROVISIONAL_MET;
      if (earned + inProg > 0) return IN_PROGRESS;
      return NOT_MET;
    case 'at-most':
      if (earned > required) return NOT_MET;
      if (earned + inProg > required) return PROVISIONAL_MET;
      return MET;
    case 'exactly':
      if (earned === required) return MET;
      if (earned > required) return NOT_MET;
      if (earned + inProg >= required) return PROVISIONAL_MET;
      if (earned + inProg > 0) return IN_PROGRESS;
      return NOT_MET;
    default:
      throw new Error(`Unknown credits-from comparison: "${comparison}"`);
  }
}

/**
 * Build a summary object from child statuses.
 *
 * @param {string[]} statuses - Child statuses
 * @returns {{ met: number, provisionalMet: number, inProgress: number, notMet: number, total: number }}
 */
function buildSummary(statuses) {
  let met = 0, waived = 0, substituted = 0, pm = 0, ip = 0, nm = 0;
  for (const s of statuses) {
    switch (s) {
      case MET: met++; break;
      case WAIVED: waived++; break;
      case SUBSTITUTED: substituted++; break;
      case PROVISIONAL_MET: pm++; break;
      case IN_PROGRESS: ip++; break;
      default: nm++; break;
    }
  }
  const total = met + waived + substituted + pm + ip + nm;
  return { met, waived, substituted, provisionalMet: pm, inProgress: ip, notMet: nm, total };
}

module.exports = {
  MET,
  PROVISIONAL_MET,
  IN_PROGRESS,
  NOT_MET,
  WAIVED,
  SUBSTITUTED,
  STATUSES,
  allOf,
  anyOf,
  nOf,
  noneOf,
  creditsFrom,
  buildSummary,
};
