'use strict';

/**
 * Catalog Resolution
 *
 * Resolves a reqit AST against a catalog, expanding course references
 * and course-filter nodes into concrete course lists.
 *
 * resolve(ast, catalog) → { courses: Course[], filters: FilterMatch[] }
 *
 * - courses: all catalog courses explicitly referenced by course nodes,
 *   deduplicated by subject:number.
 * - filters: one entry per course-filter node, each with the filter's AST
 *   node and an array of matched catalog courses.
 *
 * The catalog is normalized before resolution — missing optional fields on
 * courses are defaulted (attributes → [], crossListGroup → undefined,
 * prerequisites → null, corequisites → null).
 */

const { courseKey } = require('../render/shared');

/**
 * Normalize a catalog by defaulting optional fields on each course.
 *
 * @param {object} catalog - Raw catalog object
 * @returns {object} Catalog with normalized course records
 */
function normalizeCatalog(catalog) {
  return {
    ...catalog,
    courses: catalog.courses.map(c => ({
      ...c,
      attributes: c.attributes || [],
      crossListGroup: c.crossListGroup || undefined,
      prerequisites: c.prerequisites || null,
      corequisites: c.corequisites || null,
    })),
  };
}

/**
 * Build a subject:number → course lookup index for O(1) resolution.
 *
 * @param {object[]} courses - Normalized catalog courses
 * @returns {Map<string, object>} Index keyed by "SUBJECT:NUMBER"
 */
function buildCourseIndex(courses) {
  const index = new Map();
  for (const c of courses) {
    index.set(courseKey(c), c);
  }
  return index;
}

/**
 * Build a crossListGroup → courses[] index for cross-list resolution.
 *
 * @param {object[]} courses - Normalized catalog courses
 * @returns {Map<string, object[]>} Index keyed by crossListGroup
 */
function buildCrossListIndex(courses) {
  const index = new Map();
  for (const c of courses) {
    if (c.crossListGroup) {
      if (!index.has(c.crossListGroup)) {
        index.set(c.crossListGroup, []);
      }
      index.get(c.crossListGroup).push(c);
    }
  }
  return index;
}

/**
 * Resolve a reqit AST against a catalog.
 *
 * @param {object} ast - A validated reqit AST
 * @param {object} catalog - Catalog with courses, programs, attainments, gradeConfig
 * @returns {{ courses: object[], filters: { node: object, matched: object[] }[] }}
 */
function resolve(ast, catalog) {
  const norm = normalizeCatalog(catalog);
  const courseIndex = buildCourseIndex(norm.courses);
  const crossListIndex = buildCrossListIndex(norm.courses);
  const defs = collectDefs(ast, '', new Map());
  const ctx = {
    catalog: norm,
    courseIndex,
    crossListIndex,
    collected: new Map(),  // "SUBJECT:NUMBER" → normalized course object
    filters: [],           // { node, matched: Course[] }
    defs,                  // variable name → variable-def node
    expanding: new Set(),  // guards against circular variable refs
  };

  walkNode(ast, ctx);

  return {
    courses: Array.from(ctx.collected.values()),
    filters: ctx.filters,
  };
}

/**
 * Pre-pass: collect all variable-def nodes, registering them in a map.
 * Defs inside a scope register under both "scope.name" and "name".
 * Unscoped defs register under "name" only.
 *
 * @param {object} node - AST node
 * @param {string} scopeName - Current scope name (empty string if none)
 * @param {Map<string, object>} defs - Accumulator map
 * @returns {Map<string, object>}
 */
function collectDefs(node, scopeName, defs) {
  if (!node || typeof node !== 'object') return defs;

  if (node.type === 'scope') {
    const scope = node.name || '';
    if (Array.isArray(node.defs)) {
      for (const def of node.defs) {
        collectDefs(def, scope, defs);
      }
    }
    if (node.body) {
      collectDefs(node.body, scope, defs);
    }
    return defs;
  }

  if (node.type === 'variable-def') {
    const name = node.name;
    if (scopeName) {
      defs.set(`${scopeName}.${name}`, node);
      defs.set(name, node);
    } else {
      defs.set(name, node);
    }
    if (node.value) {
      collectDefs(node.value, scopeName, defs);
    }
    return defs;
  }

  // Recurse into children
  if (Array.isArray(node.items)) {
    for (const child of node.items) {
      collectDefs(child, scopeName, defs);
    }
  }
  if (node.expression) collectDefs(node.expression, scopeName, defs);
  if (node.value) collectDefs(node.value, scopeName, defs);
  if (node.source) collectDefs(node.source, scopeName, defs);
  if (node.requirement) collectDefs(node.requirement, scopeName, defs);
  if (node.body) collectDefs(node.body, scopeName, defs);

  return defs;
}

/**
 * Evaluate a list of filters (AND logic) against all catalog courses.
 * Returns courses that match every filter.
 *
 * @param {object[]} filters - Array of filter objects { field, op, value }
 * @param {object[]} courses - Normalized catalog courses
 * @returns {object[]} Matching courses
 */
function evaluateFilters(filters, courses) {
  return courses.filter(course => {
    for (const f of filters) {
      if (!evaluateFilter(f, course)) return false;
    }
    return true;
  });
}

/**
 * Evaluate a single filter against a course.
 *
 * @param {object} filter - { field, op, value }
 * @param {object} course - Normalized catalog course
 * @returns {boolean} Whether the course matches the filter
 */
function evaluateFilter(filter, course) {
  const { field, op, value } = filter;

  switch (field) {
    case 'subject':
      return evaluateStringFilter(course.subject, op, value);

    case 'number':
      return evaluateNumberFilter(course.number, op, value);

    case 'credits':
      return evaluateCreditsFilter(course, op, value);

    case 'attribute':
      return evaluateAttributeFilter(course, op, value);

    case 'prerequisite-includes':
      return astContainsCourse(course.prerequisites, value);

    case 'corequisite-includes':
      return astContainsCourse(course.corequisites, value);

    default:
      return false;
  }
}

/**
 * Evaluate a string-field filter (eq, ne).
 *
 * @param {string} courseValue - The course's field value
 * @param {string} op - Comparison operator
 * @param {*} filterValue - The filter value to compare against
 * @returns {boolean}
 */
function evaluateStringFilter(courseValue, op, filterValue) {
  switch (op) {
    case 'eq': return courseValue === filterValue;
    case 'ne': return courseValue !== filterValue;
    case 'in': return Array.isArray(filterValue) && filterValue.includes(courseValue);
    case 'not-in': return Array.isArray(filterValue) && !filterValue.includes(courseValue);
    case 'wildcard': return true; // matches all values
    default: return false;
  }
}

/**
 * Evaluate a number-field filter. For equality (eq/ne), uses exact string
 * comparison. For ordering comparisons (gt/gte/lt/lte), extracts leading
 * digits from the course number for numeric comparison.
 *
 * @param {string} courseNumber - The course's number field (string, e.g. "101", "101A")
 * @param {string} op - Comparison operator
 * @param {*} filterValue - The filter value (string for eq/ne, number for comparisons)
 * @returns {boolean}
 */
function evaluateNumberFilter(courseNumber, op, filterValue) {
  switch (op) {
    case 'eq': return courseNumber === String(filterValue);
    case 'ne': return courseNumber !== String(filterValue);
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte': {
      const numeric = extractLeadingNumber(courseNumber);
      if (numeric === null) return false;
      const target = Number(filterValue);
      if (op === 'gt') return numeric > target;
      if (op === 'gte') return numeric >= target;
      if (op === 'lt') return numeric < target;
      if (op === 'lte') return numeric <= target;
    }
    // falls through only if op is somehow none of the above (unreachable)
    default: return false;
  }
}

/**
 * Extract the leading numeric portion of a course number string.
 * E.g. "101" → 101, "101A" → 101, "220.2" → 220.2, "ABC" → null
 *
 * @param {string} s - Course number string
 * @returns {number|null}
 */
function extractLeadingNumber(s) {
  const match = s.match(/^(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : null;
}

/**
 * Evaluate a credits filter against a course's credit range.
 *
 * Credit range semantics:
 * - gte: course can provide at least the threshold → creditsMax >= value
 * - gt:  course can provide more than the threshold → creditsMax > value
 * - lte: course can cost at most the threshold → creditsMin <= value
 * - lt:  course can cost less than the threshold → creditsMin < value
 * - eq:  threshold falls within the course's credit range
 * - ne:  threshold falls outside the course's credit range
 *
 * @param {object} course - Normalized catalog course
 * @param {string} op - Comparison operator
 * @param {number} value - Credit threshold
 * @returns {boolean}
 */
function evaluateCreditsFilter(course, op, value) {
  switch (op) {
    case 'eq': return course.creditsMin <= value && value <= course.creditsMax;
    case 'ne': return value < course.creditsMin || value > course.creditsMax;
    case 'gte': return course.creditsMax >= value;
    case 'gt': return course.creditsMax > value;
    case 'lte': return course.creditsMin <= value;
    case 'lt': return course.creditsMin < value;
    default: return false;
  }
}

/**
 * Evaluate an attribute filter against a course's attributes array.
 *
 * @param {object} course - Normalized catalog course (attributes defaults to [])
 * @param {string} op - Comparison operator (eq or ne)
 * @param {string} value - Attribute code to match
 * @returns {boolean}
 */
function evaluateAttributeFilter(course, op, value) {
  switch (op) {
    case 'eq': return course.attributes.includes(value);
    case 'ne': return !course.attributes.includes(value);
    case 'in': return Array.isArray(value) && value.some(v => course.attributes.includes(v));
    case 'not-in': return Array.isArray(value) && !value.some(v => course.attributes.includes(v));
    default: return false;
  }
}

/**
 * Check whether an AST tree contains a course node matching the given
 * course reference. Used for prerequisite-includes and corequisite-includes
 * filter evaluation.
 *
 * @param {object|null} ast - An AST node (typically a course's prerequisites or corequisites)
 * @param {object} courseRef - A course AST node { type:'course', subject, number }
 * @returns {boolean} Whether the AST contains a matching course reference
 */
function astContainsCourse(ast, courseRef) {
  if (!ast || typeof ast !== 'object') return false;

  if (ast.type === 'course') {
    return ast.subject === courseRef.subject && ast.number === courseRef.number;
  }

  // Recurse into children using the same traversal pattern as walkNode
  if (Array.isArray(ast.items)) {
    for (const item of ast.items) {
      if (astContainsCourse(item, courseRef)) return true;
    }
  }
  if (ast.source && astContainsCourse(ast.source, courseRef)) return true;
  if (ast.value && astContainsCourse(ast.value, courseRef)) return true;
  if (ast.requirement && astContainsCourse(ast.requirement, courseRef)) return true;
  if (ast.expression && astContainsCourse(ast.expression, courseRef)) return true;

  return false;
}

/**
 * Expand a list of matched courses to include cross-listed equivalents.
 * Deduplicates by subject:number.
 *
 * @param {object[]} courses - Directly matched courses
 * @param {Map<string, object[]>} crossListIndex - Cross-list group index
 * @returns {object[]} Expanded course list
 */
function expandCrossListed(courses, crossListIndex) {
  const seen = new Map();
  for (const c of courses) {
    const key = courseKey(c);
    if (!seen.has(key)) seen.set(key, c);
    if (c.crossListGroup) {
      const group = crossListIndex.get(c.crossListGroup);
      if (group) {
        for (const equiv of group) {
          const eKey = courseKey(equiv);
          if (!seen.has(eKey)) seen.set(eKey, equiv);
        }
      }
    }
  }
  return Array.from(seen.values());
}

/**
 * Recursively walk the AST, resolving course references and collecting
 * filter nodes. Filter evaluation is handled separately — this walk
 * identifies which nodes need resolution and dispatches accordingly.
 *
 * @param {object} node - AST node
 * @param {object} ctx - Resolution context
 */
function walkNode(node, ctx) {
  if (!node || typeof node !== 'object') return;

  switch (node.type) {
    case 'course': {
      const key = courseKey(node);
      if (!ctx.collected.has(key)) {
        const course = ctx.courseIndex.get(key);
        if (course) {
          const expanded = expandCrossListed([course], ctx.crossListIndex);
          for (const c of expanded) {
            const cKey = courseKey(c);
            if (!ctx.collected.has(cKey)) {
              ctx.collected.set(cKey, c);
            }
          }
        }
      }
      break;
    }

    case 'course-filter': {
      const directMatches = evaluateFilters(node.filters, ctx.catalog.courses);
      // Expand matches with cross-listed equivalents
      const matched = expandCrossListed(directMatches, ctx.crossListIndex);
      ctx.filters.push({ node, matched });
      for (const course of matched) {
        const key = courseKey(course);
        if (!ctx.collected.has(key)) {
          ctx.collected.set(key, course);
        }
      }
      break;
    }

    case 'all-of':
    case 'any-of':
    case 'none-of':
    case 'n-of':
    case 'one-from-each':
    case 'from-n-groups':
      if (Array.isArray(node.items)) {
        for (const item of node.items) {
          walkNode(item, ctx);
        }
      }
      break;

    case 'credits-from':
      walkNode(node.source, ctx);
      break;

    case 'with-constraint':
      walkNode(node.requirement, ctx);
      break;

    case 'except':
      walkNode(node.source, ctx);
      if (Array.isArray(node.exclude)) {
        for (const item of node.exclude) {
          walkNode(item, ctx);
        }
      }
      break;

    case 'variable-def':
      // Don't walk the value here — it will be expanded through variable-refs.
      // Walking it here would cause duplicate resolution when the variable
      // is also referenced via $name.
      break;

    case 'variable-ref': {
      const key = node.scope ? `${node.scope}.${node.name}` : node.name;
      const def = ctx.defs.get(key);
      if (def && def.value && !ctx.expanding.has(key)) {
        ctx.expanding.add(key);
        walkNode(def.value, ctx);
        ctx.expanding.delete(key);
      }
      break;
    }

    case 'scope':
      // Defs are registered by the collectDefs pre-pass and resolved lazily
      // through variable-ref expansion. Walking them here would be a no-op
      // (variable-def's case is intentionally empty).
      walkNode(node.body, ctx);
      break;

    // Non-course types — nothing to resolve against the catalog
    case 'score':
    case 'attainment':
    case 'quantity':
    case 'program':
    case 'program-context-ref':
    case 'overlap-limit':
    case 'outside-program':
      break;
  }
}

module.exports = { resolve, normalizeCatalog };
