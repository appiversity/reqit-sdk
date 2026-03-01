'use strict';

/**
 * Rewrite a Peggy SyntaxError into a human-friendly error message.
 * The goal is actionable messages for non-programmers using a code editor.
 *
 * @param {Error} err - Peggy SyntaxError
 * @param {string} input - The original input text
 * @returns {Error} A new error with a friendlier message and location info
 */
function rewriteError(err, input) {
  const loc = err.location;
  if (!loc) return err;

  const line = loc.start.line;
  const column = loc.start.column;
  const found = err.found;
  const expected = err.expected || [];

  // Extract the line of text where the error occurred
  const lines = input.split(/\r?\n/);
  const errorLine = lines[line - 1] || '';

  let problem, suggestion;

  // Pattern: empty input (including whitespace-only)
  if (found === null && (loc.start.offset === 0 || input.trim() === '')) {
    problem = 'Empty input — no requirement text was provided.';
    suggestion = 'Enter a requirement expression, for example: all of (MATH 151, MATH 152)';
  }
  // Pattern: empty list — ")" found right after "(" (check before trailing comma)
  else if (found === ')' && looksLikeEmptyList(input, loc.start.offset)) {
    problem = 'Empty list — at least one item is required inside the parentheses.';
    suggestion = 'Add one or more items between the parentheses.';
  }
  // Pattern: trailing comma — ")" found where expression expected
  else if (found === ')' && expectsExpression(expected)) {
    problem = 'Unexpected closing parenthesis — there may be a trailing comma before it.';
    suggestion = 'Remove the trailing comma before the closing parenthesis.';
  }
  // Pattern: missing comma between items — letter found where comma/paren expected
  else if (found && /[A-Za-z]/.test(found) && expectsCommaOrParen(expected)) {
    problem = 'Missing comma — items in a list must be separated by commas.';
    suggestion = `Add a comma before "${getWordAt(input, loc.start.offset)}".`;
  }
  // Pattern: unclosed parenthesis — end of input where comma/paren expected
  else if (found === null && expectsCloseParen(expected)) {
    problem = 'Unexpected end of input — there may be an unclosed parenthesis.';
    suggestion = 'Check that every opening parenthesis "(" has a matching closing parenthesis ")".';
  }
  // Pattern: misspelled keyword — unexpected char where course number expected
  else if (expectsCourseNumber(expected)) {
    const word = getWordBefore(input, loc.start.offset);
    if (word) {
      problem = `Unrecognized keyword or subject code "${word}".`;
      const correction = suggestKeyword(word);
      suggestion = correction
        ? `Did you mean "${correction}"?`
        : `Check the spelling. Valid keywords include: all of, any of, at least, at most, exactly, courses where, none of, one from each of, from at least, score, attainment, quantity.`;
    }
  }

  if (!problem) {
    // Fall back to a slightly cleaned-up version of Peggy's message
    problem = err.message;
    suggestion = null;
  }

  const friendly = new Error(formatMessage(problem, suggestion, line, column, errorLine));
  friendly.name = 'ReqitSyntaxError';
  friendly.location = loc;
  friendly.problem = problem;
  friendly.suggestion = suggestion;
  friendly.line = line;
  friendly.column = column;
  return friendly;
}

/**
 * Format the full error message with location and context.
 */
function formatMessage(problem, suggestion, line, column, errorLine) {
  let msg = `Syntax error at line ${line}, column ${column}: ${problem}`;
  if (suggestion) {
    msg += `\n  Suggestion: ${suggestion}`;
  }
  if (errorLine) {
    msg += `\n  | ${errorLine}`;
    msg += `\n  | ${' '.repeat(column - 1)}^`;
  }
  return msg;
}

/**
 * Check if the expected tokens include expression-starting tokens.
 */
function expectsExpression(expected) {
  return expected.some(e =>
    (e.type === 'literal' && ['all', 'any', 'at', 'exactly', 'courses', 'none', 'one', 'from', 'scope', 'score', 'attainment', 'quantity', 'program', 'overlap', 'outside', 'primary'].includes(e.text.toLowerCase())) ||
    (e.type === 'literal' && e.text === '$') ||
    (e.type === 'other' && e.description === 'subject code')
  );
}

/**
 * Check if expected tokens include comma or close paren.
 */
function expectsCommaOrParen(expected) {
  return expected.some(e => e.type === 'literal' && (e.text === ',' || e.text === ')'));
}

/**
 * Check if expected tokens include close paren.
 */
function expectsCloseParen(expected) {
  return expected.some(e => e.type === 'literal' && e.text === ')');
}

/**
 * Check if expected tokens include "course number".
 */
function expectsCourseNumber(expected) {
  return expected.some(e => e.type === 'other' && e.description === 'course number');
}

/**
 * Check if position looks like it's right after an open paren (empty list).
 */
function looksLikeEmptyList(input, offset) {
  // Walk backwards skipping whitespace to find "("
  let i = offset - 1;
  while (i >= 0 && /[\s]/.test(input[i])) i--;
  return i >= 0 && input[i] === '(';
}

/**
 * Get the word at the given offset.
 */
function getWordAt(input, offset) {
  const match = input.slice(offset).match(/^[A-Za-z0-9_-]+/);
  return match ? match[0] : '';
}

/**
 * Get the word immediately before the given offset (skipping whitespace).
 */
function getWordBefore(input, offset) {
  let i = offset - 1;
  while (i >= 0 && /[\s]/.test(input[i])) i--;
  if (i < 0) return '';
  let end = i + 1;
  while (i >= 0 && /[A-Za-z0-9_-]/.test(input[i])) i--;
  return input.slice(i + 1, end);
}

/**
 * Suggest a correction for a misspelled keyword.
 */
function suggestKeyword(word) {
  const keywords = {
    'allof': 'all of', 'anyof': 'any of', 'noneof': 'none of',
    'atleast': 'at least', 'atmost': 'at most',
    'creditsfrom': 'credits from', 'courseswhere': 'courses where',
    'onefrom': 'one from each of', 'fromateast': 'from at least',
    'al': 'all', 'alll': 'all', 'anay': 'any',
    'cours': 'courses', 'couses': 'courses', 'coures': 'courses',
    'wher': 'where', 'whre': 'where',
    'exacly': 'exactly', 'exatly': 'exactly',
    'leaset': 'least', 'leats': 'least',
    'scor': 'score', 'scroe': 'score',
    'atainment': 'attainment', 'atenment': 'attainment',
    'quatity': 'quantity', 'quantiy': 'quantity',
  };
  return keywords[word.toLowerCase()] || null;
}

module.exports = { rewriteError };
