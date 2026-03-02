'use strict';

const { parse } = require('../../src/parser');
const { rewriteError } = require('../../src/parser/errors');

/**
 * Helper: parse and expect a ReqitSyntaxError with specific properties.
 */
function expectParseError(input, checks) {
  let error;
  try {
    parse(input);
    throw new Error('Expected parse to throw');
  } catch (e) {
    error = e;
  }
  expect(error.name).toBe('ReqitSyntaxError');
  if (checks.problem) {
    expect(error.problem).toContain(checks.problem);
  }
  if (checks.suggestion) {
    expect(error.suggestion).toContain(checks.suggestion);
  }
  if (checks.line) {
    expect(error.line).toBe(checks.line);
  }
  if (checks.column) {
    expect(error.column).toBe(checks.column);
  }
  return error;
}

describe('error: missing comma between items', () => {
  test('two courses without comma', () => {
    expectParseError('all of (MATH 151 MATH 152)', {
      problem: 'Missing comma',
      suggestion: 'comma',
    });
  });

  test('reports correct location', () => {
    const err = expectParseError('all of (MATH 151 MATH 152)', {});
    expect(err.line).toBe(1);
    expect(err.column).toBe(18);
  });

  test('multiline missing comma', () => {
    const input = `all of (
      MATH 151
      MATH 152
    )`;
    const err = expectParseError(input, {
      problem: 'Missing comma',
    });
    expect(err.line).toBe(3);
  });
});

describe('error: unclosed parenthesis', () => {
  test('missing close paren', () => {
    expectParseError('all of (MATH 151, MATH 152', {
      problem: 'unclosed parenthesis',
    });
  });

  test('nested unclosed paren', () => {
    expectParseError('all of (any of (MATH 151, MATH 152), CSCI 141', {
      problem: 'unclosed parenthesis',
    });
  });
});

describe('error: trailing comma', () => {
  test('trailing comma in list', () => {
    expectParseError('all of (MATH 151, MATH 152,)', {
      problem: 'trailing comma',
    });
  });

  test('trailing comma in n-of', () => {
    expectParseError('at least 2 of (MATH 151,)', {
      problem: 'trailing comma',
    });
  });
});

describe('error: empty list', () => {
  test('empty all-of', () => {
    expectParseError('all of ()', {
      problem: 'Empty list',
      suggestion: 'Add one or more items',
    });
  });

  test('empty any-of', () => {
    expectParseError('any of ()', {
      problem: 'Empty list',
    });
  });
});

describe('error: empty input', () => {
  test('empty string', () => {
    expectParseError('', {
      problem: 'Empty input',
      suggestion: 'Enter a requirement expression',
    });
  });

  test('whitespace only', () => {
    // Whitespace-only parses past the whitespace, then expects an expression
    expectParseError('   ', {
      problem: 'Empty input',
    });
  });
});

describe('error: misspelled keyword', () => {
  test('allof without space', () => {
    expectParseError('allof (MATH 151)', {
      problem: 'Unrecognized keyword',
      suggestion: 'all of',
    });
  });

  test('courseswhere without space', () => {
    expectParseError('courseswhere subject = "MATH"', {
      problem: 'Unrecognized keyword',
      suggestion: 'courses where',
    });
  });
});

describe('error message format', () => {
  test('includes line and column', () => {
    const err = expectParseError('all of (MATH 151 MATH 152)', {});
    expect(err.message).toContain('line 1');
    expect(err.message).toContain('column 18');
  });

  test('includes context line and caret', () => {
    const err = expectParseError('all of (MATH 151 MATH 152)', {});
    expect(err.message).toContain('all of (MATH 151 MATH 152)');
    expect(err.message).toContain('^');
  });

  test('error has location property', () => {
    const err = expectParseError('all of (MATH 151 MATH 152)', {});
    expect(err.location).toBeDefined();
    expect(err.location.start.line).toBe(1);
    expect(err.location.start.column).toBe(18);
  });
});

describe('error: still throws for genuinely invalid input', () => {
  test('completely invalid syntax', () => {
    expect(() => parse('!!!')).toThrow();
  });

  test('$ without name', () => {
    expect(() => parse('$')).toThrow();
  });

  test('number without subject', () => {
    expect(() => parse('151')).toThrow();
  });
});

describe('rewriteError edge cases', () => {
  test('error without location is returned as-is', () => {
    const err = new Error('some error');
    const result = rewriteError(err, 'MATH 151');
    expect(result).toBe(err);
  });

  test('error with missing expected property', () => {
    const err = new Error('test');
    err.name = 'SyntaxError';
    err.location = { start: { line: 1, column: 1, offset: 0 } };
    err.found = null;
    // expected is undefined — falls through to fallback
    const result = rewriteError(err, '');
    expect(result.name).toBe('ReqitSyntaxError');
  });

  test('misspelled keyword with no word before', () => {
    // Simulate: cursor at start, expected includes course number
    const err = new Error('test');
    err.name = 'SyntaxError';
    err.location = { start: { line: 1, column: 1, offset: 0 } };
    err.found = '!';
    err.expected = [{ type: 'other', description: 'course number' }];
    const result = rewriteError(err, '!');
    // getWordBefore returns '' at offset 0, so the 'if (word)' check is false
    // Falls through to fallback
    expect(result.name).toBe('ReqitSyntaxError');
  });

  test('unknown keyword (no suggested correction)', () => {
    const err = new Error('test');
    err.name = 'SyntaxError';
    err.location = { start: { line: 1, column: 7, offset: 6 } };
    err.found = ' ';
    err.expected = [{ type: 'other', description: 'course number' }];
    const result = rewriteError(err, 'foobar 151');
    expect(result.problem).toContain('foobar');
    expect(result.suggestion).toContain('Valid keywords');
  });

  test('fallback when no pattern matches', () => {
    const err = new Error('Peggy raw message');
    err.name = 'SyntaxError';
    err.location = { start: { line: 1, column: 1, offset: 0 } };
    err.found = '@';
    err.expected = [{ type: 'literal', text: 'something-unlikely' }];
    const result = rewriteError(err, '@');
    expect(result.name).toBe('ReqitSyntaxError');
    expect(result.suggestion).toBeNull();
  });

  test('expectsExpression matches $ literal', () => {
    // Trigger the e.text === '$' branch in expectsExpression
    const err = new Error('test');
    err.name = 'SyntaxError';
    err.location = { start: { line: 1, column: 3, offset: 2 } };
    err.found = ')';
    err.expected = [{ type: 'literal', text: '$' }];
    const result = rewriteError(err, 'x )');
    // found === ')' and expectsExpression returns true → trailing comma message
    expect(result.name).toBe('ReqitSyntaxError');
  });

  test('getWordAt returns empty string for non-word chars', () => {
    // Trigger the match ? match[0] : '' falsy branch
    // The 'missing comma' pattern calls getWordAt; we need found to be a letter
    // but offset pointing to a non-alphanumeric position
    const err = new Error('test');
    err.name = 'SyntaxError';
    err.location = { start: { line: 1, column: 9, offset: 8 } };
    err.found = 'M';
    err.expected = [{ type: 'literal', text: ',' }, { type: 'literal', text: ')' }];
    // offset 8 is past end of the 3-char input — getWordAt gets empty slice
    const result = rewriteError(err, 'ab');
    expect(result.name).toBe('ReqitSyntaxError');
    expect(result.suggestion).toContain('comma before');
  });

  test('non-SyntaxError propagated by parse()', () => {
    // rewriteError returns error as-is when no location
    const err = new Error('unexpected');
    const result = rewriteError(err, 'test');
    expect(result).toBe(err);
  });
});

describe('parse() error propagation', () => {
  test('non-SyntaxError is re-thrown directly', () => {
    // Trigger via invalid argument type (not a string) — Peggy throws TypeError
    expect(() => parse(null)).toThrow();
  });

  test('SyntaxError without location is re-thrown directly', () => {
    // A SyntaxError missing the .location property goes through the else path
    // This is nearly impossible to trigger naturally, but validates the code path
    const peg = require('../../src/parser/grammar.js');
    const original = peg.parse;
    peg.parse = () => {
      const e = new SyntaxError('no location');
      throw e;
    };
    try {
      expect(() => parse('test')).toThrow(SyntaxError);
    } finally {
      peg.parse = original;
    }
  });
});
