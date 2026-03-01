# Prerequisites and Corequisites

[← Scopes](13-scopes.md) | [Table of Contents](README.md) | [Next: Programs and Overlap Rules →](15-programs-and-overlap.md)

---

Prerequisites, corequisites, and concurrent enrollment are fundamental to how courses relate to each other. In Reqit, a prerequisite is simply a requirement expression attached to a course. This chapter covers the patterns used for prerequisite and corequisite requirements, plus two specialized constructs: **concurrent** and **prerequisite/corequisite includes** queries.

## Prerequisites Are Just Requirements

A course prerequisite is any Reqit expression. Everything you've learned so far applies. Here are common prerequisite patterns:

### Single Course Prerequisite

```
MATH 121
```

"Must complete MATH 121 before enrolling."

### Multiple Prerequisites (All Required)

```
all of (CMPS 230, MATH 250)
```

"Must complete both CMPS 230 and MATH 250."

### Alternative Prerequisites (Any One Accepted)

```
any of (CSCI 140, MATH 212)
```

"Must complete either CSCI 140 or MATH 212."

### Prerequisites with Grade Requirements

```
CSCI 121 with grade >= "C-"
```

"Must complete CSCI 121 with a grade of C- or better."

A common pattern — prerequisites where the institution requires a minimum grade:

```
any of (
  MATH 022 with grade >= "D",
  MATH 024 with grade >= "D",
  MATH 101 with grade >= "D",
  MATH 110 with grade >= "D",
  MATH 121 with grade >= "D"
)
```

"Any one of these math courses with at least a D."

### Prerequisites with Test Score Alternatives

```
any of (
  MATH 110 with grade >= "D",
  score ACCUPLACER_ADV_ALG >= 280
)
```

"Complete MATH 110 with a D or better, or score 280+ on the placement test."

### Complex Prerequisite Trees

Prerequisites can be deeply nested:

```
all of (
  any of (
    all of (CSE 003, CSE 004),
    CSE 007
  ),
  CSE 017,
  CSE 140
)
```

"Complete the intro sequence (either CSE 003+004 or CSE 007), plus CSE 017 and CSE 140."

## Concurrent Allowed

Many courses allow a prerequisite to be taken in the same term. The student doesn't need to have *completed* the prerequisite — they just need to be *enrolled* in it during the same term.

Mark this with `(concurrent)` after the course reference:

```
CMPS 230 (concurrent)
```

"Complete CMPS 230 before this course begins, or enroll in CMPS 230 in the same term."

### In Context

```
all of (
  CMPS 230 (concurrent),
  MATH 250
)
```

"CMPS 230 (may be taken concurrently) and MATH 250 (must be completed beforehand)."

### Concurrent Allowed vs. Corequisite

These are different concepts:

| Term | Meaning |
|---|---|
| **Prerequisite** | Must be completed *before* enrolling |
| **Prerequisite with concurrent** | Must be completed before *or* taken in the same term |
| **Corequisite** | Must be taken in the *same term* (not before, not after) |

`(concurrent)` is a relaxation of the "before" rule. A corequisite is a different relationship entirely — "you must take these two courses together in the same term."

The `(concurrent)` modifier has no effect outside of prerequisite contexts. If it appears on a course reference in a program requirement or degree requirement, it's ignored — those contexts don't have a "before" concept.

## Prerequisite Includes and Corequisite Includes

These are specialized course filters that find courses based on their prerequisite or corequisite chains.

### Prerequisite Includes

```
courses where prerequisite includes (CMPS 104)
```

"Find all courses whose prerequisite tree includes CMPS 104." This matches any course that directly or transitively requires CMPS 104.

If CMPS 230 requires CMPS 148, and CMPS 148 requires CMPS 104, then CMPS 230 matches this filter because its prerequisite chain includes CMPS 104 (transitively).

### Corequisite Includes

```
courses where corequisite includes (ENGL 201)
```

"Find all courses whose corequisite tree includes ENGL 201."

### Using These in Requirements

These filters are most useful for institutional analysis and reporting. For example, finding all courses that depend on a particular foundational course:

```
at least 1 of (
  courses where prerequisite includes (MATH 151)
)
```

"The student must have taken at least one course that has MATH 151 somewhere in its prerequisite chain."

### Combining with Other Filters

```
courses where subject = "CMPS" and prerequisite includes (MATH 250)
```

"CMPS courses whose prerequisites include MATH 250."

## Real-World Prerequisite Examples

### Simple Chain

CMPS 148 requires CMPS 147:
```
CMPS 147
```

CMPS 231 requires CMPS 148:
```
CMPS 148
```

### Branching Prerequisites

A course where students can arrive via different paths:
```
any of (
  all of (CSE 003, CSE 004),    # Two-part intro
  CSE 007,                       # Combined intro
  all of (
    any of (CMPS 130, CMPS 135),
    MATH 151
  )
)
```

### Grade-Gated Prerequisites

A course where the institution requires more than just passing:
```
all of (
  CSCI 121 with grade >= "C-",
  CSCI 244 with grade >= "C-",
  CSCI 234 with grade >= "C-"
)
```

"All three courses, each with at least a C-."

### Mixed Course and Test Prerequisites

```
all of (
  any of (
    MATH 121 with grade >= "C",
    score ACCUPLACER_ADV_ALG >= 280
  ),
  CMPS 148 (concurrent)
)
```

"Calculus (via course or test) and CMPS 148 (which may be taken concurrently)."

## Summary

| Construct | Meaning | Example |
|---|---|---|
| `MATH 151` | Simple prerequisite | Must complete MATH 151 |
| `MATH 151 (concurrent)` | May be taken in the same term | Complete or co-enroll in MATH 151 |
| `courses where prerequisite includes (X)` | Courses requiring X | All courses that depend on X |
| `courses where corequisite includes (X)` | Courses with X as coreq | All courses that must be taken with X |

Prerequisites and corequisites are just requirement expressions. Every construct in this guide — combinations, filters, credits, grades, test scores — works in prerequisite contexts.

---

[Next: Programs and Overlap Rules →](15-programs-and-overlap.md)
