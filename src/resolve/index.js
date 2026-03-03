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
    index.set(c.subject + ':' + c.number, c);
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
  const ctx = {
    catalog: norm,
    courseIndex,
    collected: new Map(),  // "SUBJECT:NUMBER" → normalized course object
    filters: [],           // { node, matched: Course[] }
  };

  walkNode(ast, ctx);

  return {
    courses: Array.from(ctx.collected.values()),
    filters: ctx.filters,
  };
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
      const key = node.subject + ':' + node.number;
      if (!ctx.collected.has(key)) {
        const course = ctx.courseIndex.get(key);
        if (course) {
          ctx.collected.set(key, course);
        }
      }
      break;
    }

    case 'course-filter': {
      // Filter evaluation will be added in steps 5.2–5.5.
      // For now, record the filter node with an empty match list.
      const matched = [];
      ctx.filters.push({ node, matched });
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
      walkNode(node.value, ctx);
      break;

    case 'variable-ref':
      // Variable expansion will be added in step 5.6.
      break;

    case 'scope':
      if (Array.isArray(node.defs)) {
        for (const def of node.defs) {
          walkNode(def, ctx);
        }
      }
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
