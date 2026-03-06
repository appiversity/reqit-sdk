'use strict';

/**
 * status.js — 4-state audit status propagation rules.
 *
 * Pure functions that compute parent status from child statuses.
 * No AST or transcript knowledge — just status arrays → parent status.
 *
 * Status values (ordered by progress):
 *   'met'              — requirement fully satisfied
 *   'in-progress'      — will be met if all in-progress courses complete successfully
 *   'partial-progress' — some progress, but completing in-progress courses alone won't satisfy
 *   'not-met'          — no progress toward this requirement
 */

const MET = 'met';
const IN_PROGRESS = 'in-progress';
const PARTIAL_PROGRESS = 'partial-progress';
const NOT_MET = 'not-met';
const WAIVED = 'waived';
const SUBSTITUTED = 'substituted';

const STATUSES = Object.freeze([MET, IN_PROGRESS, PARTIAL_PROGRESS, NOT_MET, WAIVED, SUBSTITUTED]);

/**
 * Count statuses in an array.
 * @param {string[]} statuses
 * @returns {{ met: number, ip: number, pp: number, nm: number, total: number }}
 */
function countStatuses(statuses) {
  let met = 0, ip = 0, pp = 0, nm = 0;
  for (const s of statuses) {
    switch (s) {
      case MET:
      case WAIVED:
      case SUBSTITUTED:
        met++; break;
      case IN_PROGRESS: ip++; break;
      case PARTIAL_PROGRESS: pp++; break;
      default: nm++; break;
    }
  }
  return { met, ip, pp, nm, total: statuses.length };
}

/**
 * all-of: every child must be satisfied.
 *
 * - All met → met
 * - All met or in-progress (≥1 ip) → in-progress
 * - ≥1 child has progress but above not satisfied → partial-progress
 * - All not-met → not-met
 */
function allOf(statuses) {
  if (statuses.length === 0) return MET;
  const { met, ip, pp, nm, total } = countStatuses(statuses);
  if (met === total) return MET;
  if (met + ip === total) return IN_PROGRESS;
  if (nm === total) return NOT_MET;
  return PARTIAL_PROGRESS;
}

/**
 * any-of: at least one child must be satisfied.
 *
 * - ≥1 met → met
 * - No met, ≥1 in-progress → in-progress
 * - No met, no ip, ≥1 partial-progress → partial-progress
 * - All not-met → not-met
 */
function anyOf(statuses) {
  if (statuses.length === 0) return NOT_MET;
  const { met, ip, pp } = countStatuses(statuses);
  if (met > 0) return MET;
  if (ip > 0) return IN_PROGRESS;
  if (pp > 0) return PARTIAL_PROGRESS;
  return NOT_MET;
}

/**
 * n-of with at-least comparison.
 *
 * - met ≥ K → met
 * - met + ip ≥ K → in-progress
 * - some progress (met + ip + pp > 0) → partial-progress
 * - no progress → not-met
 */
function nOfAtLeast(statuses, k) {
  if (statuses.length === 0) return k <= 0 ? MET : NOT_MET;
  const { met, ip, pp } = countStatuses(statuses);
  if (met >= k) return MET;
  if (met + ip >= k) return IN_PROGRESS;
  if (met + ip + pp > 0) return PARTIAL_PROGRESS;
  return NOT_MET;
}

/**
 * n-of with at-most comparison (constraint on maximum).
 *
 * - met ≤ K → met (constraint satisfied)
 * - met > K → not-met (too many matched — can't undo completed courses)
 *
 * In-progress children that might push count over K:
 * - met ≤ K but met + ip > K → in-progress (risk of over-matching)
 *   Actually, for at-most this is reversed: in-progress courses completing
 *   could cause a FAILURE. So if met ≤ K and met + ip > K, status is
 *   in-progress (uncertain — currently ok but could fail).
 */
function nOfAtMost(statuses, k) {
  if (statuses.length === 0) return MET;
  const { met, ip } = countStatuses(statuses);
  if (met > k) return NOT_MET;
  // If in-progress courses completing could exceed limit, flag as in-progress
  // (uncertain outcome). Otherwise, met.
  if (met + ip > k) return IN_PROGRESS;
  return MET;
}

/**
 * n-of with exactly comparison.
 *
 * - met === K → met
 * - met > K → not-met (over-matched)
 * - met < K, met + ip ≥ K → in-progress
 * - met < K, some progress → partial-progress
 * - no progress → not-met
 */
function nOfExactly(statuses, k) {
  if (statuses.length === 0) return k === 0 ? MET : NOT_MET;
  const { met, ip, pp } = countStatuses(statuses);
  if (met === k) return MET;
  if (met > k) return NOT_MET;
  if (met + ip >= k) return IN_PROGRESS;
  if (met + ip + pp > 0) return PARTIAL_PROGRESS;
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
 * - No child met, no child in-progress → met
 * - Any child met → not-met
 * - No child met, ≥1 child in-progress → in-progress (risk if ip completes)
 */
function noneOf(statuses) {
  if (statuses.length === 0) return MET;
  const { met, ip } = countStatuses(statuses);
  if (met > 0) return NOT_MET;
  if (ip > 0) return IN_PROGRESS;
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
      if (earned + inProg >= required) return IN_PROGRESS;
      if (earned + inProg > 0) return PARTIAL_PROGRESS;
      return NOT_MET;
    case 'at-most':
      if (earned > required) return NOT_MET;
      if (earned + inProg > required) return IN_PROGRESS;
      return MET;
    case 'exactly':
      if (earned === required) return MET;
      if (earned > required) return NOT_MET;
      if (earned + inProg >= required) return IN_PROGRESS;
      if (earned + inProg > 0) return PARTIAL_PROGRESS;
      return NOT_MET;
    default:
      throw new Error(`Unknown credits-from comparison: "${comparison}"`);
  }
}

/**
 * Build a summary object from child statuses.
 *
 * @param {string[]} statuses - Child statuses
 * @returns {{ met: number, inProgress: number, partialProgress: number, notMet: number, total: number }}
 */
function buildSummary(statuses) {
  let met = 0, waived = 0, substituted = 0, ip = 0, pp = 0, nm = 0;
  for (const s of statuses) {
    switch (s) {
      case MET: met++; break;
      case WAIVED: waived++; break;
      case SUBSTITUTED: substituted++; break;
      case IN_PROGRESS: ip++; break;
      case PARTIAL_PROGRESS: pp++; break;
      default: nm++; break;
    }
  }
  const total = met + waived + substituted + ip + pp + nm;
  return { met, waived, substituted, inProgress: ip, partialProgress: pp, notMet: nm, total };
}

module.exports = {
  MET,
  IN_PROGRESS,
  PARTIAL_PROGRESS,
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
