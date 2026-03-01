# Grade and GPA Requirements

[← Exclusions](07-exclusions.md) | [Table of Contents](README.md) | [Next: Post-Selection Constraints →](09-post-selection-constraints.md)

---

Many requirements don't just require that a student *take* a course — they require a specific minimum grade. And many programs require a minimum GPA across a set of courses. Reqit handles both with the `with` keyword.

## Minimum Grade on a Single Course

Add `with grade >= "X"` after a course reference:

```
CSCI 121 with grade >= "C-"
```

"The student must complete CSCI 121 with a grade of C- or better."

The grade value is enclosed in quotes. Standard US letter grades are supported: A+, A, A-, B+, B, B-, C+, C, C-, D+, D, D-, and F. Your institution can configure additional grade values (see below).

### More Examples

```
MATH 121 with grade >= "D"
```

"MATH 121 with a D or better." (Some institutions accept a D for prerequisites.)

```
CMPS 230 with grade >= "B"
```

"CMPS 230 with a B or better." (Some programs have higher standards for core courses.)

```
NURS 400 with grade >= "P"
```

"NURS 400 with a passing grade." (Pass/Fail grading.)

## Minimum Grade on a Group

Apply a grade requirement to an entire group by placing `with grade` after the closing parenthesis:

```
all of (
  CSCI 121,
  CSCI 244,
  CSCI 234
) with grade >= "C-"
```

"Each of these three courses must be completed with a C- or better."

This is equivalent to writing the constraint on each course individually:

```
all of (
  CSCI 121 with grade >= "C-",
  CSCI 244 with grade >= "C-",
  CSCI 234 with grade >= "C-"
)
```

The group form is more concise when many courses share the same grade requirement.

### Grade Requirements on Mixed Expressions

You can apply grade requirements to any expression:

```
at least 3 of (
  courses where subject = "CMPS" and number >= 300
) with grade >= "C"
```

"At least 3 upper-level CMPS courses, each with a C or better."

```
any of (
  MATH 022,
  MATH 024,
  MATH 101,
  MATH 110,
  MATH 121
) with grade >= "D"
```

"Any one of these math courses with a D or better." This is a common pattern for prerequisites where the institution has a low bar — the student just needs to have passed the course.

## A Real-World Pattern: Prerequisites with Grade Floors

Many institutions require a minimum grade in prerequisite courses. Here's a common pattern for a CS course with multiple math prerequisites:

```
any of (
  MATH 022 with grade >= "D",
  MATH 024 with grade >= "D",
  MATH 101 with grade >= "D",
  MATH 104 with grade >= "D",
  MATH 108 with grade >= "D",
  MATH 110 with grade >= "D",
  MATH 121 with grade >= "D"
)
```

"One of these math courses, with at least a D." When each item has the same grade constraint, you can also write:

```
any of (
  MATH 022, MATH 024, MATH 101, MATH 104,
  MATH 108, MATH 110, MATH 121
) with grade >= "D"
```

Both forms are equivalent. Use whichever is clearer for your situation.

## GPA Requirements

`with gpa >= N` requires a minimum GPA across the courses matched by the requirement:

```
all of (
  CMPS 147,
  CMPS 148,
  CMPS 220,
  CMPS 231,
  CMPS 311,
  CMPS 361,
  CMPS 366,
  CMPS 450
) with gpa >= 2.0
```

"All 8 core courses must be completed, and the GPA across those courses must be at least 2.0."

The GPA is calculated from the grades the student earned in *these specific courses* — not the student's overall transcript GPA. This means different requirements can have different GPA thresholds:

```
all of (
  $cs_core with gpa >= 2.0,                     # Major core GPA
  $cs_electives,                                  # No GPA constraint on electives
  at least 4 of (
    courses where subject = "CMPS" and number >= 300
  ) with gpa >= 2.5                               # Higher GPA on upper-level
)
```

### GPA on a Full Program

Apply GPA to an entire degree requirement:

```
all of (
  $cs_core,
  $math,
  $electives
) with gpa >= 2.0
```

"Complete all components of the major, with a combined GPA of at least 2.0 across all courses that count toward the major."

## Overall Transcript GPA

Reqit's `with gpa` is always scoped to the courses in the requirement it wraps. If your institution requires an overall transcript GPA (across *all* courses a student has taken, not just major courses), model this as an attainment:

```
attainment OVERALL_GPA_2_0
```

This is covered in [Chapter 10: Non-Course Requirements](10-non-course-requirements.md). The distinction matters: Reqit evaluates requirements against course sets, but a transcript-wide GPA involves every course, including those outside any program requirement.

## Quality Points and GPA Computation

GPA computation requires a grade scale that maps letter grades to numeric point values (quality points). For example: A = 4.0, A- = 3.7, B+ = 3.3, and so on.

The grade-to-points mapping is **institution configuration**, not part of the Reqit language. Reqit's `with gpa >= 2.0` syntax specifies the threshold; your institution configures the grade scale that defines what each letter grade is worth in points. This configuration lives in the catalog/database layer and is applied by the auditing engine at evaluation time.

## Grade Scales

Reqit ships with a standard US letter grade scale:

A+, A, A-, B+, B, B-, C+, C, C-, D+, D, D-, F

Your institution can configure the grade scale to include additional grades:

- **Pass/Fail:** P, NP
- **Transfer grades:** T, TR, XA, XB+
- **Withdrawal:** W, WP, WF
- **Incomplete:** I, IP
- **Audit:** AU

The grade scale determines the ordering — what "C or better" means. In the standard US scale, C- < C < C+ < B- < B < B+ < A- < A < A+. Your institution's configuration defines this ordering for any custom grades.

## Combining Grade and GPA

You can use both `grade` and `gpa` in the same program:

```
all of (
  # Core courses — each must earn at least a C
  all of (
    CSCI 141,
    CSCI 241,
    CSCI 301,
    CSCI 303,
    CSCI 304,
    CSCI 312,
    CSCI 423
  ) with grade >= "C",

  # Electives — no per-course grade requirement, but GPA must be 2.5+
  at least 12 credits from (
    courses where subject = "CSCI" and number >= 300
  ) with gpa >= 2.5
)
```

## Summary

| Construct | Meaning | Example |
|---|---|---|
| `with grade >= "X"` | Minimum grade per course | `MATH 151 with grade >= "C"` |
| `with gpa >= N` | Minimum GPA across matched courses | `all of (...) with gpa >= 2.0` |

The `with` modifier applies to whatever expression comes before it — a single course, an `all of` group, an `at least N of` selection, or any other expression.

---

[Next: Post-Selection Constraints →](09-post-selection-constraints.md)
