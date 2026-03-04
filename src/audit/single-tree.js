'use strict';

/**
 * single-tree.js — Single-tree audit walker.
 *
 * Walks a reqit AST and evaluates each node against a student transcript,
 * producing an annotated audit result tree with 4-state status propagation.
 *
 * The walker expects a pre-built context containing:
 *   - catalog indexes (courseIndex, crossListIndex, courses)
 *   - normalized transcript
 *   - grade config
 *   - variable defs
 *   - attainments (scores, booleans, quantities)
 *   - warnings accumulator
 */

const { courseKey } = require('../render/shared');
const { isPassingGrade, meetsMinGrade, calculateGPA } = require('../grade');
const {
  evaluateFilters,
  collectDefs,
} = require('../resolve');
const { lookupTranscriptEntry } = require('./transcript');
const {
  MET, IN_PROGRESS, PARTIAL_PROGRESS, NOT_MET,
  allOf, anyOf, nOf, noneOf, creditsFrom, buildSummary,
} = require('./status');
const { evaluatePostConstraints } = require('./post-constraints');

/**
 * Audit a single AST node against the transcript.
 *
 * @param {object} node - AST node
 * @param {object} ctx - Audit context
 * @returns {object} Audit result node
 */
function auditNode(node, ctx) {
  if (!node || typeof node !== 'object') {
    return { type: 'unknown', status: NOT_MET };
  }

  switch (node.type) {
    // --- Leaf nodes ---
    case 'course':
      return auditCourse(node, ctx);
    case 'course-filter':
      return auditCourseFilter(node, ctx);
    case 'score':
      return auditScore(node, ctx);
    case 'attainment':
      return auditAttainment(node, ctx);
    case 'quantity':
      return auditQuantity(node, ctx);

    // --- Composite nodes ---
    case 'all-of':
      return auditAllOf(node, ctx);
    case 'any-of':
      return auditAnyOf(node, ctx);
    case 'n-of':
      return auditNOf(node, ctx);
    case 'none-of':
      return auditNoneOf(node, ctx);
    case 'one-from-each':
      return auditOneFromEach(node, ctx);
    case 'from-n-groups':
      return auditFromNGroups(node, ctx);
    case 'credits-from':
      return auditCreditsFrom(node, ctx);

    // --- Wrapper nodes ---
    case 'with-constraint':
      return auditWithConstraint(node, ctx);
    case 'except':
      return auditExcept(node, ctx);

    // --- Variable/scope nodes ---
    case 'variable-ref':
      return auditVariableRef(node, ctx);
    case 'variable-def':
      // Variable defs are transparent — they don't produce audit results
      // They are resolved lazily through variable-ref
      return { type: 'variable-def', name: node.name, status: MET };
    case 'scope':
      return auditNode(node.body, ctx);

    // --- Policy nodes (multi-tree only) ---
    case 'overlap-limit':
    case 'outside-program':
      // These belong in overlapRules, not inline in ASTs (spec rule 13).
      ctx.warnings.push({
        type: 'misplaced-policy-node',
        nodeType: node.type,
        message: `"${node.type}" found inline in AST — should be in overlapRules`,
      });
      return { type: node.type, status: NOT_MET };
    case 'program-context-ref':
      // Valid inline — resolved during multi-tree pass 2.
      // Preserve role so the patcher can look up the evaluated status.
      return { type: node.type, status: NOT_MET, role: node.role };
    case 'program':
      return { type: node.type, status: NOT_MET };

    default:
      ctx.warnings.push({
        type: 'unknown-node-type',
        nodeType: node.type,
        message: `Unknown AST node type "${node.type}" encountered during audit`,
      });
      return { type: node.type || 'unknown', status: NOT_MET };
  }
}

// ============================================================
// Leaf node auditors
// ============================================================

function auditCourse(node, ctx) {
  const key = courseKey(node);
  const { entry, crossListed } = lookupTranscriptEntry(
    key, ctx.transcript, ctx.catalogIndex, ctx.crossListIndex
  );

  if (!entry) {
    return { type: 'course', subject: node.subject, number: node.number, status: NOT_MET };
  }

  if (crossListed) {
    ctx.warnings.push({
      type: 'cross-listed-match',
      subject: node.subject,
      number: node.number,
      matchedSubject: entry.subject,
      matchedNumber: entry.number,
      message: `${node.subject} ${node.number} matched via cross-listing (student took ${entry.subject} ${entry.number})`,
    });
  }

  // In-progress: enrolled but no grade yet
  if (entry.status === 'in-progress') {
    return {
      type: 'course', subject: node.subject, number: node.number,
      status: IN_PROGRESS,
      satisfiedBy: { ...entry },
    };
  }

  // Check if grade is passing
  if (entry.grade != null && isPassingGrade(entry.grade, ctx.gradeConfig)) {
    return {
      type: 'course', subject: node.subject, number: node.number,
      status: MET,
      satisfiedBy: { ...entry },
    };
  }

  // Course taken but grade is not passing
  return {
    type: 'course', subject: node.subject, number: node.number,
    status: NOT_MET,
    satisfiedBy: { ...entry },
  };
}

function auditCourseFilter(node, ctx) {
  // Resolve the filter against catalog to get matching courses
  const matched = evaluateFilters(node.filters, ctx.courses);

  // Find which matched courses appear in the transcript
  const found = [];
  const inProg = [];

  for (const course of matched) {
    const key = courseKey(course);
    const { entry } = lookupTranscriptEntry(
      key, ctx.transcript, ctx.catalogIndex, ctx.crossListIndex
    );
    if (!entry) continue;

    if (entry.status === 'in-progress') {
      inProg.push({ ...entry, catalogCourse: course });
    } else if (entry.grade != null && isPassingGrade(entry.grade, ctx.gradeConfig)) {
      found.push({ ...entry, catalogCourse: course });
    }
  }

  const result = {
    type: 'course-filter',
    filters: node.filters,
    matchedCourses: found,
    inProgressCourses: inProg,
    catalogMatches: matched.length,
  };

  if (found.length > 0) {
    result.status = MET;
  } else if (inProg.length > 0) {
    result.status = IN_PROGRESS;
  } else {
    result.status = NOT_MET;
  }

  return result;
}

function auditScore(node, ctx) {
  const attainments = ctx.attainments || {};
  const attainment = attainments[node.name];

  const result = {
    type: 'score', name: node.name, op: node.op, value: node.value,
  };

  if (!attainment || attainment.kind !== 'score') {
    result.status = NOT_MET;
    return result;
  }

  const actual = attainment.value;
  result.actual = actual;
  result.status = evaluateComparison(actual, node.op, node.value) ? MET : NOT_MET;
  return result;
}

function auditAttainment(node, ctx) {
  const attainments = ctx.attainments || {};
  const attainment = attainments[node.name];

  const result = { type: 'attainment', name: node.name };

  if (!attainment) {
    result.status = NOT_MET;
    return result;
  }

  result.status = attainment.value ? MET : NOT_MET;

  return result;
}

function auditQuantity(node, ctx) {
  const attainments = ctx.attainments || {};
  const attainment = attainments[node.name];

  const result = {
    type: 'quantity', name: node.name, op: node.op, value: node.value,
  };

  if (!attainment || attainment.kind !== 'quantity') {
    result.status = NOT_MET;
    return result;
  }

  const actual = attainment.value;
  result.actual = actual;
  result.status = evaluateComparison(actual, node.op, node.value) ? MET : NOT_MET;
  return result;
}

// ============================================================
// Composite node auditors
// ============================================================

function auditAllOf(node, ctx) {
  const items = (node.items || []).map(child => auditNode(child, ctx));
  const statuses = items.map(r => r.status);
  return {
    type: 'all-of',
    status: allOf(statuses),
    items,
    summary: buildSummary(statuses),
    ...(node.label ? { label: node.label } : {}),
  };
}

function auditAnyOf(node, ctx) {
  const items = (node.items || []).map(child => auditNode(child, ctx));
  const statuses = items.map(r => r.status);
  return {
    type: 'any-of',
    status: anyOf(statuses),
    items,
    summary: buildSummary(statuses),
    ...(node.label ? { label: node.label } : {}),
  };
}

function auditNOf(node, ctx) {
  const items = (node.items || []).map(child => auditNode(child, ctx));
  const statuses = items.map(r => r.status);
  const status = nOf(statuses, node.comparison, node.count);

  const result = {
    type: 'n-of',
    comparison: node.comparison,
    count: node.count,
    status,
    items,
    summary: buildSummary(statuses),
    ...(node.label ? { label: node.label } : {}),
  };

  // Check post_constraints
  if (node.post_constraints && node.post_constraints.length > 0 && status === MET) {
    const metItems = items.filter(r => r.status === MET);
    const constraintResults = evaluatePostConstraints(
      metItems, node.post_constraints, ctx
    );
    result.postConstraintResults = constraintResults;

    const anyFailed = constraintResults.some(c => !c.met);
    if (anyFailed) {
      // Try backtracking if enabled
      if (ctx.backtrack && node.comparison === 'at-least') {
        const { backtrackPostConstraints } = require('./backtrack');
        const bt = backtrackPostConstraints(
          metItems, node.count, node.post_constraints, ctx
        );
        if (bt.found) {
          result.postConstraintResults = bt.constraintResults;
          result.selectedItems = bt.selected;
          // Status stays MET — backtracking found a valid selection
        } else {
          result.status = NOT_MET;
          emitPostConstraintWarnings(constraintResults, ctx);
        }
      } else {
        result.status = NOT_MET;
        emitPostConstraintWarnings(constraintResults, ctx);
      }
    }
  }

  return result;
}

function auditNoneOf(node, ctx) {
  const items = (node.items || []).map(child => auditNode(child, ctx));
  const statuses = items.map(r => r.status);
  return {
    type: 'none-of',
    status: noneOf(statuses),
    items,
    summary: buildSummary(statuses),
  };
}

function auditOneFromEach(node, ctx) {
  const items = (node.items || []).map(group => {
    // Each group item is treated as an any-of (need at least one from the group)
    const groupResult = auditNode(group, ctx);
    return groupResult;
  });

  // one-from-each is like all-of where each group must have at least one match
  // For individual course-filter items, MET means at least one course matched
  const statuses = items.map(r => r.status);
  return {
    type: 'one-from-each',
    status: allOf(statuses),
    items,
    summary: buildSummary(statuses),
    ...(node.label ? { label: node.label } : {}),
  };
}

function auditFromNGroups(node, ctx) {
  const items = (node.items || []).map(group => auditNode(group, ctx));

  const groupStatuses = items.map(r => r.status);

  // Use nOf at-least logic on group statuses
  const status = nOf(groupStatuses, 'at-least', node.count);

  return {
    type: 'from-n-groups',
    count: node.count,
    status,
    items,
    summary: buildSummary(groupStatuses),
    ...(node.label ? { label: node.label } : {}),
  };
}

function auditCreditsFrom(node, ctx) {
  // Audit the source to get matched courses
  const sourceResult = auditNode(node.source, ctx);

  // Collect transcript entries that matched the source
  const matchedEntries = collectMatchedEntries(sourceResult);

  let earned = 0;
  let inProg = 0;
  for (const entry of matchedEntries) {
    if (entry.status === 'in-progress') {
      inProg += entry.credits;
    } else if (entry.grade != null && isPassingGrade(entry.grade, ctx.gradeConfig)) {
      earned += entry.credits;
    }
  }

  const status = creditsFrom(earned, inProg, node.credits, node.comparison);

  return {
    type: 'credits-from',
    comparison: node.comparison,
    credits: node.credits,
    status,
    creditsEarned: earned,
    creditsInProgress: inProg,
    matchedCourses: matchedEntries,
    source: sourceResult,
    ...(node.label ? { label: node.label } : {}),
  };
}

// ============================================================
// Wrapper node auditors
// ============================================================

function auditWithConstraint(node, ctx) {
  const innerResult = auditNode(node.requirement, ctx);

  const result = {
    type: 'with-constraint',
    constraint: node.constraint,
    requirement: innerResult,
  };

  // If inner requirement isn't met, the constraint is also not met
  if (innerResult.status === NOT_MET) {
    result.status = NOT_MET;
    return result;
  }

  // Evaluate the constraint against matched courses
  const matchedEntries = collectMatchedEntries(innerResult);

  if (node.constraint.kind === 'min-grade') {
    const constraintResult = evaluateMinGradeConstraint(
      node.constraint.value, matchedEntries, ctx
    );
    result.constraintResult = constraintResult;
    if (!constraintResult.met) {
      result.status = NOT_MET;
    } else {
      result.status = innerResult.status;
    }
  } else if (node.constraint.kind === 'min-gpa') {
    const constraintResult = evaluateMinGpaConstraint(
      node.constraint.value, matchedEntries, ctx
    );
    result.constraintResult = constraintResult;
    if (!constraintResult.met) {
      // If inner is in-progress, GPA may change — status is in-progress
      if (innerResult.status === IN_PROGRESS) {
        result.status = IN_PROGRESS;
      } else {
        result.status = NOT_MET;
      }
    } else {
      result.status = innerResult.status;
    }
  } else {
    result.status = innerResult.status;
  }

  return result;
}

function auditExcept(node, ctx) {
  // Audit source and exclude subtrees
  const sourceResult = auditNode(node.source, ctx);
  const excludeResults = (node.exclude || []).map(e => auditNode(e, ctx));

  // Collect matched entries from source, minus those in exclude
  const sourceEntries = collectMatchedEntries(sourceResult);
  const excludeKeys = new Set();
  for (const exResult of excludeResults) {
    for (const entry of collectMatchedEntries(exResult)) {
      excludeKeys.add(courseKey(entry));
    }
  }

  const filtered = sourceEntries.filter(e => !excludeKeys.has(courseKey(e)));

  // Determine status based on filtered results
  let status;
  const hasCompleted = filtered.some(
    e => e.status === 'completed' && e.grade != null && isPassingGrade(e.grade, ctx.gradeConfig)
  );
  const hasInProgress = filtered.some(e => e.status === 'in-progress');

  if (hasCompleted) {
    status = MET;
  } else if (hasInProgress) {
    status = IN_PROGRESS;
  } else {
    status = NOT_MET;
  }

  return {
    type: 'except',
    status,
    source: sourceResult,
    exclude: excludeResults,
    matchedCourses: filtered,
  };
}

function auditVariableRef(node, ctx) {
  const name = node.scope ? `${node.scope}.${node.name}` : node.name;
  const def = ctx.defs.get(name);

  if (!def) {
    return {
      type: 'variable-ref', name: node.name,
      ...(node.scope ? { scope: node.scope } : {}),
      status: NOT_MET,
    };
  }

  // Guard against circular references
  if (ctx.expanding.has(name)) {
    return {
      type: 'variable-ref', name: node.name,
      ...(node.scope ? { scope: node.scope } : {}),
      status: NOT_MET,
    };
  }

  ctx.expanding.add(name);
  const result = auditNode(def.value, ctx);
  ctx.expanding.delete(name);

  return {
    type: 'variable-ref', name: node.name,
    ...(node.scope ? { scope: node.scope } : {}),
    status: result.status,
    resolved: result,
  };
}

// ============================================================
// Helpers
// ============================================================

/**
 * Recursively collect transcript entries from audit results.
 * Traverses the result tree to find all satisfiedBy / matchedCourses entries.
 */
function collectMatchedEntries(result) {
  const entries = [];
  const seen = new Set();

  function walk(node) {
    if (!node) return;

    // Leaf course with satisfiedBy
    if (node.satisfiedBy) {
      const key = courseKey(node.satisfiedBy);
      if (!seen.has(key)) {
        seen.add(key);
        entries.push(node.satisfiedBy);
      }
    }

    // course-filter matched courses
    if (node.matchedCourses && Array.isArray(node.matchedCourses)) {
      for (const entry of node.matchedCourses) {
        const key = courseKey(entry);
        if (!seen.has(key)) {
          seen.add(key);
          entries.push(entry);
        }
      }
    }

    // course-filter in-progress courses
    if (node.inProgressCourses && Array.isArray(node.inProgressCourses)) {
      for (const entry of node.inProgressCourses) {
        const key = courseKey(entry);
        if (!seen.has(key)) {
          seen.add(key);
          entries.push(entry);
        }
      }
    }

    // Recurse into children
    if (node.items && Array.isArray(node.items)) {
      for (const child of node.items) walk(child);
    }
    if (node.source) walk(node.source);
    if (node.requirement) walk(node.requirement);
    if (node.resolved) walk(node.resolved);
    if (node.exclude && Array.isArray(node.exclude)) {
      for (const child of node.exclude) walk(child);
    }
  }

  walk(result);
  return entries;
}

/**
 * Evaluate a numeric comparison.
 */
function evaluateComparison(actual, op, threshold) {
  switch (op) {
    case 'eq': return actual === threshold;
    case 'ne': return actual !== threshold;
    case 'gt': return actual > threshold;
    case 'gte': return actual >= threshold;
    case 'lt': return actual < threshold;
    case 'lte': return actual <= threshold;
    default: return false;
  }
}

/**
 * Emit post-constraint failure warnings.
 */
function emitPostConstraintWarnings(constraintResults, ctx) {
  for (const c of constraintResults) {
    if (!c.met) {
      ctx.warnings.push({
        type: 'post-constraint-failed',
        constraint: c.constraint,
        actual: c.actual,
        message: `Post-constraint failed: ${c.constraint.comparison} ${c.constraint.count} courses matching ${c.constraint.filter.field} ${c.constraint.filter.op} ${c.constraint.filter.value} (found ${c.actual})`,
      });
    }
  }
}

/**
 * Evaluate min-grade constraint against matched entries.
 */
function evaluateMinGradeConstraint(minGrade, entries, ctx) {
  let allMeet = true;
  let gradedCount = 0;

  for (const entry of entries) {
    if (entry.status === 'in-progress') continue; // skip in-progress
    if (entry.grade == null) continue;
    gradedCount++;
    if (!meetsMinGrade(entry.grade, minGrade, ctx.gradeConfig)) {
      allMeet = false;
    }
  }

  return { met: gradedCount > 0 ? allMeet : true, minGrade, gradedCount };
}

/**
 * Evaluate min-gpa constraint against matched entries.
 */
function evaluateMinGpaConstraint(minGpa, entries, ctx) {
  const gradedEntries = entries.filter(
    e => e.status !== 'in-progress' && e.grade != null
  );

  if (gradedEntries.length === 0) {
    return { met: true, actual: 0, minGpa, gradedCount: 0 };
  }

  const gpa = calculateGPA(gradedEntries, ctx.gradeConfig);
  return { met: gpa >= minGpa, actual: gpa, minGpa, gradedCount: gradedEntries.length };
}

module.exports = {
  auditNode,
  collectMatchedEntries,
};
