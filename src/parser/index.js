'use strict';

const peg = require('./grammar.js');
const { rewriteError } = require('./errors.js');

/**
 * Parse reqit requirement text into an AST.
 * @param {string} text - Reqit requirement text
 * @returns {Object} AST node
 * @throws {Error} ReqitSyntaxError with human-friendly message
 */
function parse(text) {
  try {
    return peg.parse(text);
  } catch (err) {
    if (err.name === 'SyntaxError' && err.location) {
      throw rewriteError(err, text);
    }
    throw err;
  }
}

module.exports = { parse };
