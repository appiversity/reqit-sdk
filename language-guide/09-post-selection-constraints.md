# Post-Selection Constraints

[← Grade and GPA Requirements](08-grade-and-gpa.md) | [Table of Contents](README.md) | [Next: Non-Course Requirements →](10-non-course-requirements.md)

---

Sometimes you need to let a student choose from a pool, but add a condition on *what* they choose. "Pick 5 electives, but at least 3 must be from the Political Science department." This isn't the same as requiring 3 POLI courses and 2 from elsewhere — you want the student to pick 5 from the full pool, with a constraint on the selection.

Reqit handles this with the `where ... match` clause.

## The Problem: Constrained Selection

Consider this Political Science elective requirement:

> "Choose at least 5 courses from this list. At least 3 of the chosen courses must be POLI courses."

The eligible courses span multiple departments:

```
POLI 215, POLI 301, POLI 309, POLI 315,
AFST 208, HIST 251, SOCI 221
```

If you wrote this as two separate requirements — "at least 3 POLI courses" and "at least 2 more from the full list" — you'd be requiring 5 courses minimum but potentially 7 distinct courses (if the POLI courses and the 2 others don't overlap).

The `where` clause solves this by constraining the selection *after* it's made, without requiring additional courses.

## Where At Least N Match

```
at least 5 of (
  POLI 215, POLI 301, POLI 309, POLI 315,
  AFST 208, HIST 251, SOCI 221
)
  where at least 3 match (subject = "POLI")
```

"Pick at least 5 from this list. Of the courses you pick, at least 3 must have subject = POLI."

The `where` clause operates on the selected courses — it doesn't add new courses or require additional ones. The student picks 5 courses from the pool of 7, and of those 5, at least 3 must be POLI courses.

## Where At Most N Match

Set an upper limit on how many selected courses can have a particular property:

```
at least 4 of (
  BIOL 220, BIOL 315, BIOL 330, BIOL 401, BIOL 410
)
  where at most 1 match (number < 300)
```

"Pick at least 4 from this list. Of the courses you pick, at most 1 may be below the 300-level."

This prevents a student from stacking their electives with easier 200-level courses.

## Where Exactly N Match

Require a precise count:

```
at least 4 of (
  CSCI 301, CSCI 303, CSCI 304, CSCI 312, CSCI 320
)
  where exactly 2 match (number >= 400)
```

"Pick at least 4 from this list. Of the courses you pick, exactly 2 must be 400-level or above."

## Multiple Where Clauses

You can add multiple `where` clauses — all of them must be satisfied:

```
at least 5 of (
  POLI 215, POLI 301, POLI 309, POLI 315,
  AFST 208, HIST 251, SOCI 221
)
  where at least 3 match (subject = "POLI")
  where at most 1 match (number < 300)
```

"Pick at least 5. At least 3 must be POLI courses, and at most 1 may be below the 300-level."

Each `where` clause independently constrains the same selected set of courses.

## Filter Conditions in Where Clauses

The condition inside `match (...)` uses the same filter syntax as course filters — field, operator, value:

```
where at least 2 match (subject = "MATH")
where at most 1 match (number < 300)
where at least 1 match (number >= 400)
where exactly 2 match (attribute = "WI")
where at most 3 match (credits <= 3)
```

## Combining Where with Other Modifiers

### Where + Except

You can use `except` and `where` together:

```
at least 3 of (
  LAWS 203, LAWS 320, LAWS 332, PSYC 218, SOCI 315
) except (LAWS 203)
  where at least 1 match (number >= 300)
```

The `except` removes LAWS 203 from the eligible pool. The `where` constrains what the student picks from the remaining courses.

### Where + Grade Constraint

```
at least 3 of (
  CSCI 301, CSCI 303, CSCI 312, CSCI 320
)
  where at least 1 match (number >= 400)
  with grade >= "C"
```

"Pick at least 3. At least 1 must be 400-level or above. Each must earn a C or better."

## When To Use Where vs. Separate Requirements

**Use `where`** when you want to constrain the *composition* of a selection without requiring additional courses.

**Use separate requirements** when you genuinely need distinct groups of courses.

Compare:

```
# This requires 5 courses TOTAL (with composition constraint):
at least 5 of (POLI 215, POLI 301, AFST 208, HIST 251)
  where at least 3 match (subject = "POLI")

# This requires at least 5 courses (3 POLI + 2 others — could be 5, could be more):
all of (
  at least 3 of (POLI 215, POLI 301, POLI 309),
  at least 2 of (AFST 208, HIST 251, SOCI 221)
)
```

The first says "5 from the combined pool, with a composition constraint." The second says "3 from pool A and 2 from pool B." These are different requirements — choose the one that matches your intent.

## Summary

| Construct | Meaning | Example |
|---|---|---|
| `where at least N match (filter)` | N or more selected must match | `where at least 3 match (subject = "POLI")` |
| `where at most N match (filter)` | No more than N selected may match | `where at most 1 match (number < 300)` |
| `where exactly N match (filter)` | Precisely N selected must match | `where exactly 2 match (number >= 400)` |

Multiple `where` clauses can be stacked — all must be satisfied independently.

---

[Next: Non-Course Requirements →](10-non-course-requirements.md)
