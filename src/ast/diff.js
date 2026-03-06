'use strict';

/**
 * diff.js — Structural comparison of two reqit ASTs.
 *
 * Returns an array of change objects describing the differences.
 */

const { courseKey } = require('../render/shared');
const { CHILD_PROPS } = require('./children');

/**
 * Compare two ASTs and return an array of changes.
 *
 * Change types:
 *   - `added`   — node exists in newAst but not oldAst
 *   - `removed` — node exists in oldAst but not newAst
 *   - `changed` — same position, different content
 *   - `moved`   — same content, different position (detected by identity)
 *
 * @param {object} oldAst - The old AST
 * @param {object} newAst - The new AST
 * @returns {Array<{ type: string, path: string[], details: object }>}
 */
function diff(oldAst, newAst) {
  const changes = [];
  diffNodes(oldAst, newAst, [], changes);
  return changes;
}

/**
 * Get an identity key for a node (for move detection in arrays).
 */
function nodeIdentity(node) {
  if (!node || typeof node !== 'object') return null;
  if (node.type === 'course') return 'course:' + courseKey(node);
  if (node.label) return node.type + ':' + node.label;
  return null;
}

/**
 * Compute longest common subsequence indices for two arrays using node identity.
 */
function lcs(oldItems, newItems) {
  const m = oldItems.length;
  const n = newItems.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (nodesMatch(oldItems[i - 1], newItems[j - 1])) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find aligned pairs
  const aligned = [];
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (nodesMatch(oldItems[i - 1], newItems[j - 1])) {
      aligned.unshift({ oldIdx: i - 1, newIdx: j - 1 });
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return aligned;
}

/**
 * Check if two nodes match for LCS alignment.
 * Uses identity (courseKey or label) if available, otherwise type equality.
 */
function nodesMatch(a, b) {
  if (!a || !b) return false;
  if (a.type !== b.type) return false;

  const idA = nodeIdentity(a);
  const idB = nodeIdentity(b);
  if (idA && idB) return idA === idB;

  // For non-identifiable nodes, use deep equality
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Recursively diff two nodes.
 */
function diffNodes(oldNode, newNode, path, changes) {
  // Both null/undefined — no diff
  if (!oldNode && !newNode) return;

  // One side missing
  if (!oldNode) {
    changes.push({ type: 'added', path: [...path], node: newNode });
    return;
  }
  if (!newNode) {
    changes.push({ type: 'removed', path: [...path], node: oldNode });
    return;
  }

  // Type changed — report as changed at this level
  if (oldNode.type !== newNode.type) {
    changes.push({ type: 'changed', path: [...path], oldNode, newNode, field: 'type' });
    return;
  }

  // Check non-child fields for changes
  const childKeys = new Set();
  const props = CHILD_PROPS.get(oldNode.type) || [];
  for (const { key } of props) childKeys.add(key);

  const allKeys = new Set([...Object.keys(oldNode), ...Object.keys(newNode)]);
  for (const key of allKeys) {
    if (childKeys.has(key)) continue;
    if (key === 'resolved') continue;
    const oldVal = JSON.stringify(oldNode[key]);
    const newVal = JSON.stringify(newNode[key]);
    if (oldVal !== newVal) {
      changes.push({ type: 'changed', path: [...path], field: key, oldValue: oldNode[key], newValue: newNode[key] });
    }
  }

  // Diff children
  for (const { key, array } of props) {
    const oldChild = oldNode[key];
    const newChild = newNode[key];

    if (array) {
      const oldArr = Array.isArray(oldChild) ? oldChild : [];
      const newArr = Array.isArray(newChild) ? newChild : [];
      diffArrays(oldArr, newArr, [...path, key], changes);
    } else {
      if (oldChild || newChild) {
        diffNodes(oldChild || null, newChild || null, [...path, key], changes);
      }
    }
  }
}

/**
 * Diff two arrays of child nodes using LCS alignment.
 */
function diffArrays(oldArr, newArr, path, changes) {
  if (oldArr.length === 0 && newArr.length === 0) return;

  const aligned = lcs(oldArr, newArr);

  // Build sets of aligned indices
  const oldAligned = new Set(aligned.map(a => a.oldIdx));
  const newAligned = new Set(aligned.map(a => a.newIdx));

  // Unaligned old items: check if moved or removed
  const newIdentities = new Map();
  for (let j = 0; j < newArr.length; j++) {
    if (!newAligned.has(j)) {
      const id = nodeIdentity(newArr[j]);
      if (id) newIdentities.set(id, j);
    }
  }

  const movedNewIndices = new Set();

  for (let i = 0; i < oldArr.length; i++) {
    if (oldAligned.has(i)) continue;
    const id = nodeIdentity(oldArr[i]);
    if (id && newIdentities.has(id)) {
      const newIdx = newIdentities.get(id);
      changes.push({
        type: 'moved',
        path: [...path],
        oldIndex: i,
        newIndex: newIdx,
        node: newArr[newIdx],
      });
      movedNewIndices.add(newIdx);
    } else {
      changes.push({ type: 'removed', path: [...path, i], node: oldArr[i] });
    }
  }

  // Unaligned new items that weren't matched as moves → added
  for (let j = 0; j < newArr.length; j++) {
    if (!newAligned.has(j) && !movedNewIndices.has(j)) {
      changes.push({ type: 'added', path: [...path, j], node: newArr[j] });
    }
  }

  // Recurse into aligned pairs for nested changes
  for (const { oldIdx, newIdx } of aligned) {
    diffNodes(oldArr[oldIdx], newArr[newIdx], [...path, newIdx], changes);
  }
}

module.exports = { diff };
