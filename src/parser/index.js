'use strict';

const peg = require('./grammar.js');

/**
 * Parse reqit requirement text into an AST.
 * @param {string} text - Reqit requirement text
 * @returns {Object} AST node
 */
function parse(text) {
  return peg.parse(text);
}

module.exports = { parse };
