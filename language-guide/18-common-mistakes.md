# Common Mistakes

[← Putting It All Together](17-putting-it-all-together.md) | [Table of Contents](README.md) | [Next: Glossary →](19-glossary.md)

---

Reqit provides clear error messages when something goes wrong. This chapter covers the most common mistakes, what the error messages look like, and how to fix them.

## Missing Comma Between Items

**The mistake:**
```
all of (MATH 151 MATH 152)
```

**The error:**
```
Syntax error at line 1, column 18: Missing comma —
items in a list must be separated by commas.
  Suggestion: Add a comma before "MATH".
```

**The fix:**
```
all of (MATH 151, MATH 152)
```

Items inside parentheses must be separated by commas. This is the most common mistake, especially when entering courses quickly.

### Multi-Line Version

The same error across multiple lines:

```
all of (
  MATH 151
  MATH 152
)
```

Fix by adding commas:

```
all of (
  MATH 151,
  MATH 152
)
```

## Trailing Comma

**The mistake:**
```
all of (MATH 151, MATH 152,)
```

**The error:**
```
Syntax error at line 1, column 28: Unexpected closing parenthesis —
there may be a trailing comma before it.
  Suggestion: Remove the trailing comma before the closing parenthesis.
```

**The fix:**
```
all of (MATH 151, MATH 152)
```

The last item in a list should not have a comma after it. Remove the trailing comma.

## Unclosed Parenthesis

**The mistake:**
```
all of (MATH 151, MATH 152
```

**The error:**
```
Syntax error at line 1, column 27: Unexpected end of input —
there may be an unclosed parenthesis.
  Suggestion: Check that every opening parenthesis "(" has a
  matching closing parenthesis ")".
```

**The fix:**
```
all of (MATH 151, MATH 152)
```

Every `(` needs a matching `)`. In deeply nested expressions, this can be hard to spot. Use proper indentation to make the nesting visually clear:

```
all of (
  any of (
    MATH 170,
    all of (MATH 106, MATH 166)
  ),                                # ← closes "any of"
  CMPS 130
)                                   # ← closes "all of"
```

## Empty List

**The mistake:**
```
all of ()
```

**The error:**
```
Syntax error at line 1, column 9: Empty list —
at least one item is required inside the parentheses.
  Suggestion: Add one or more items between the parentheses.
```

**The fix:** Add at least one item inside the parentheses.

## Misspelled Keywords

**The mistake:**
```
allof (MATH 151, MATH 152)
```

**The error:**
```
Syntax error at line 1, column 7: Unrecognized keyword or
subject code "allof".
  Suggestion: Did you mean "all of"?
```

**The fix:**
```
all of (MATH 151, MATH 152)
```

Keywords that are multiple words need spaces between them. Common misspellings:

| Wrong | Right |
|---|---|
| `allof` | `all of` |
| `anyof` | `any of` |
| `noneof` | `none of` |
| `atleast` | `at least` |
| `atmost` | `at most` |
| `courseswhere` | `courses where` |
| `creditsfrom` | `credits from` |

## Missing Quotes Around String Values

**The mistake:**
```
courses where subject = MATH
```

**The fix:**
```
courses where subject = "MATH"
```

String values (subject codes, attribute names, test names) must be enclosed in double quotes when used as filter values. Note that this applies to values in filters — course *references* like `MATH 151` do not use quotes.

## Confusing Filter Syntax with Course References

**The mistake** — trying to use a course reference inside a filter:
```
courses where MATH 151
```

**The fix** — use field-based filters:
```
courses where subject = "MATH" and number = "151"
```

Or just use a course reference directly:
```
MATH 151
```

Filters describe properties (`subject`, `number`, `attribute`, `credits`). If you want a specific course, use a course reference. If you want courses matching a pattern, use a filter.

## Using Where Without a Preceding Expression

**The mistake:**
```
where at least 3 match (subject = "POLI")
```

**The fix:**
```
at least 5 of (POLI 215, POLI 301, POLI 309)
  where at least 3 match (subject = "POLI")
```

The `where ... match` clause modifies a preceding expression — it can't stand alone. It must follow an `at least`, `at most`, or `exactly` expression (or any other expression).

## Dollar Sign Without a Variable Name

**The mistake:**
```
all of ($, MATH 152)
```

**The fix:**
```
all of ($core, MATH 152)
```

The `$` must be followed by a valid variable name (letters, digits, underscores, starting with a letter or underscore).

## Variable Name Starting with a Digit

**The mistake:**
```
$3rd_year = all of (...)
```

**The fix:**
```
$third_year = all of (...)
```

Variable names must start with a letter or underscore, not a digit.

## Comparing Number with String Values

**Watch out for:**
```
courses where number = "300"     # Exact string match — only "300"
courses where number >= 300      # Numeric comparison — 300, 301, 350, etc.
```

These are different. The `=` operator with a quoted string does exact matching. The `>=` operator with a bare number does numeric comparison. For "300-level and above," use `number >= 300` (not `number = "300"`).

## Quick Reference: What Needs Quotes

| Needs quotes | No quotes |
|---|---|
| Filter values: `subject = "MATH"` | Course references: `MATH 151` |
| Attribute codes: `attribute = "WI"` | Numbers: `number >= 300` |
| Test names: `score "SAT MATH" >= 580` | Credit values: `credits >= 4` |
| Attainment names: `attainment "Praxis"` | Counts: `at least 3 of (...)` |
| Quantity names: `quantity "Hours" >= 40` | GPA values: `gpa >= 2.0` |
| Grade values: `grade >= "C"` | |
| Scope names: `scope "cmps-major"` | |
| Program names: `program "CS" major` | |

The general rule: **descriptive text and codes go in quotes; numbers and counts do not.**

---

[Next: Glossary →](19-glossary.md)
