'use strict';

const { parse } = require('../../src/parser');

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
