'use strict';

/**
 * prereq-graph.js — Build a prerequisite graph from catalog data.
 *
 * Extracts direct and transitive prerequisites from catalog course ASTs.
 */

const { courseKey } = require('../render/shared');
const { walk } = require('../ast/walk');

/**
 * Build a prerequisite graph from catalog courses.
 *
 * Returns a Map from courseKey → { direct: Set<courseKey>, transitive: Set<courseKey> }.
 *
 * @param {object} catalog - Catalog with `courses` array
 * @returns {Map<string, { direct: Set<string>, transitive: Set<string> }>}
 */
function buildPrereqGraph(catalog) {
  const graph = new Map();

  // Build direct edges
  for (const course of catalog.courses) {
    const key = courseKey(course);
    const direct = new Set();

    if (course.prerequisites) {
      walk(course.prerequisites, (node) => {
        if (node.type === 'course') {
          direct.add(courseKey(node));
        }
      });
    }

    graph.set(key, { direct, transitive: new Set() });
  }

  // Compute transitive closure via BFS for each course
  for (const [key, entry] of graph) {
    const visited = new Set();
    const queue = [...entry.direct];

    while (queue.length > 0) {
      const prereq = queue.shift();
      if (visited.has(prereq)) continue;
      visited.add(prereq);

      const prereqEntry = graph.get(prereq);
      if (prereqEntry) {
        for (const indirect of prereqEntry.direct) {
          if (!visited.has(indirect)) {
            queue.push(indirect);
          }
        }
      }
    }

    // Transitive = everything reachable minus direct
    for (const v of visited) {
      if (!entry.direct.has(v)) {
        entry.transitive.add(v);
      }
    }
  }

  return graph;
}

module.exports = { buildPrereqGraph };
