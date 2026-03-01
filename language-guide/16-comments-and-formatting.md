# Comments and Formatting

[← Programs and Overlap Rules](15-programs-and-overlap.md) | [Table of Contents](README.md) | [Next: Putting It All Together →](17-putting-it-all-together.md)

---

Well-formatted requirements are easier to read, maintain, and hand off to colleagues. This chapter covers comments, whitespace, case conventions, and formatting best practices.

## Comments

A comment starts with `#` and extends to the end of the line. Everything after the `#` is ignored:

```
# This is a comment on its own line
MATH 151       # This is an inline comment
```

Use comments to:

### Label Sections

```
$core = all of (
  # Required courses — every student takes these
  CMPS 130,
  CMPS 230,
  CMPS 340,
  CMPS 490
)
```

### Explain Course Titles

```
all of (
  CSCI 120,            # Introduction to Computer Science
  CSCI 121,            # Intermediate Software Development
  CSCI 244,            # Data Structures and Analysis of Algorithms
  CSCI 234,            # Introduction to Software Engineering
  CSCI 334             # Systems Design and Implementation (capstone)
)
```

This is especially helpful when reviewing requirements — subject codes and numbers aren't always self-explanatory.

### Document Decisions

```
# Three upper-level electives required.
# Changed from 2 to 3 starting AY 2025-2026 per department vote.
$electives = at least 3 of (
  courses where subject = "CMPS" and number >= 300
)
```

### Mark Sections for Navigation

```
# --- Variables ------------------------------------------------

$core = all of (...)
$math = all of (...)

# --- Degree Requirement ----------------------------------------

all of ($core, $math, $electives)
```

## Case Insensitivity

Reqit is case-insensitive for all **keywords** and **course references**:

### Keywords

All of these are identical:

```
all of (MATH 151, MATH 152)
ALL OF (MATH 151, MATH 152)
All Of (MATH 151, MATH 152)
```

Keywords include: `all`, `any`, `of`, `at`, `least`, `most`, `exactly`, `courses`, `where`, `and`, `in`, `not`, `from`, `credits`, `none`, `except`, `with`, `grade`, `gpa`, `score`, `attainment`, `quantity`, `one`, `each`, `scope`, `match`, `program`, `primary`, `major`, `minor`, `overlap`, `between`, `outside`, `prerequisite`, `corequisite`, `includes`, `concurrent`.

### Course References

```
MATH 151
math 151
Math 151
```

All normalized to `MATH 151` internally.

### Filter Field Names

```
courses where subject = "MATH"
courses where SUBJECT = "MATH"
courses where Subject = "MATH"
```

All equivalent.

### Codes

Score, attainment, quantity, and program codes are case-insensitive and normalized to uppercase:

```
score sat_math >= 580                 # Normalized to SAT_MATH
attainment junior_standing            # Normalized to JUNIOR_STANDING
program cs major undergraduate        # Normalized to CS
```

### What IS Case-Sensitive

**String values in quotes** preserve their exact case:

```
courses where attribute = "WI"        # "WI" is exact
courses where attribute = "wi"        # "wi" is different from "WI"
```

Attribute codes in filter values are case-sensitive because they must match your institution's data exactly.

**Variable names** are case-sensitive:

```
$core        # This is different from $Core
```

By convention, use lowercase with underscores for variable names: `$core`, `$math_electives`, `$gen_ed`.

## Whitespace

Reqit is flexible about whitespace. Spaces, tabs, and newlines are interchangeable between tokens (with one exception: keywords must have at least one space or tab between them).

### These Are All Equivalent

```
all of (MATH 151, MATH 152)
```

```
all of (
  MATH 151,
  MATH 152
)
```

```
all of (
  MATH 151,

  MATH 152
)
```

```
all of(MATH 151,MATH 152)
```

### The One Rule

Keywords that are separate words need at least one space or tab between them:

```
all of     ← correct (space between "all" and "of")
all  of    ← correct (multiple spaces are fine)
allof      ← incorrect (Reqit doesn't recognize "allof")
```

## Formatting Best Practices

### One Item Per Line for Long Lists

```
# Hard to scan
at least 4 of (CMPS 305, CMPS 310, CMPS 320, CMPS 331, CMPS 342, CMPS 345, CMPS 364, CMPS 367)

# Easy to scan
at least 4 of (
  CMPS 305,
  CMPS 310,
  CMPS 320,
  CMPS 331,
  CMPS 342,
  CMPS 345,
  CMPS 364,
  CMPS 367
)
```

### Indent Nested Expressions

```
all of (
  $core,
  at least 4 of (
    courses where subject = "CMPS" and number >= 300
  ),
  any of (
    all of (PHYS 011, PHYS 012),
    all of (CHEM 030, CHEM 031)
  )
)
```

Each level of nesting adds two spaces of indentation. This makes the structure visually obvious.

### Group Related Items

Use blank lines and comments to create visual sections:

```
scope "cmps-major" {
  # --- Core Courses ---
  $core = all of (
    CMPS 130, CMPS 230, CMPS 340,
    CMPS 360, CMPS 380, CMPS 490
  )

  # --- Mathematics ---
  $math = all of (
    MATH 151, MATH 152, MATH 250,
    any of (MATH 280, MATH 285)
  )

  # --- Electives ---
  $electives = at least 4 of (
    courses where subject = "CMPS" and number >= 300
  ) except (CMPS 490)

  # --- Full Requirement ---
  all of ($core, $math, $electives) with gpa >= 2.0
}
```

### Keep Lines Reasonable

If a filter has many conditions, break it across lines:

```
# Hard to read
courses where subject = "CMPS" and number >= 300 and number <= 399 and credits >= 3

# Easier to read
courses where subject = "CMPS"
  and number >= 300
  and number <= 399
  and credits >= 3
```

### Comment Course Titles

When listing specific courses, add the title as a comment:

```
all of (
  CMPS 147,       # Computer Science I
  CMPS 148,       # Computer Science II
  CMPS 231,       # Data Structures
  CMPS 311,       # Operating Systems
  CMPS 361,       # Software Design
  CMPS 366,       # Programming Languages
  CMPS 450        # Senior Project
)
```

This makes the requirement self-documenting. Anyone reading it can understand what the courses are without looking them up in the catalog.

## Summary

| Feature | Details |
|---|---|
| Comments | `# text` — extends to end of line |
| Case insensitivity | Keywords, subject codes, course numbers, filter fields |
| Case sensitivity | String values in quotes, variable names |
| Whitespace | Flexible — spaces, tabs, newlines between tokens |
| Best practices | One item per line, indent nesting, comment titles, group sections |

---

[Next: Putting It All Together →](17-putting-it-all-together.md)
