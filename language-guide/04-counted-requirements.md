# Counted Requirements

[← Combining Requirements](03-combining-requirements.md) | [Table of Contents](README.md) | [Next: Course Filters →](05-course-filters.md)

---

Sometimes a requirement isn't "all of these" or "any of these" — it's "at least 3 of these" or "at most 2 of these." Reqit handles this with **counted requirements**.

## At Least N Of

`at least N of (...)` means the student must satisfy at least N items from the list:

```
at least 3 of (
  CMPS 301,
  CMPS 302,
  CMPS 350,
  CMPS 360,
  CMPS 380
)
```

"Choose at least 3 of these 5 courses." The student could take 3, 4, or all 5 — any number that's 3 or more satisfies the requirement.

### When To Use At Least

Use `at least` whenever students have flexibility within a constrained pool:

**Elective pool — pick 4 from a list of 12:**
```
at least 4 of (
  CMPS 240, CMPS 285, CMPS 305, CMPS 310,
  CMPS 320, CMPS 327, CMPS 331, CMPS 342,
  CMPS 345, CMPS 364, CMPS 367, CMPS 369
)
```

**Science breadth — take at least 2 lab courses:**
```
at least 2 of (
  BIOL 110,
  CHEM 030,
  PHYS 011,
  GEOL 101
)
```

**Note:** `at least 1 of (...)` is equivalent to `any of (...)`. Both mean "pick at least one." Use whichever reads more naturally for your context.

## At Most N Of

`at most N of (...)` sets an upper limit on how many items from the list can count:

```
at most 2 of (
  CMPS 490,
  CMPS 491,
  CMPS 492
)
```

"No more than 2 of these 3 courses may count." This is useful for capping how many independent studies, internships, or special topics courses can apply toward a requirement.

### When To Use At Most

**Limit internship credits:**
```
at most 1 of (
  CMPS 488,       # Internship I
  CMPS 489        # Internship II
)
```

**Limit 200-level courses in an upper-level elective pool:**
```
at most 1 of (
  courses where subject = "CMPS" and number >= 200 and number <= 299
)
```

## Exactly N Of

`exactly N of (...)` means the student must satisfy exactly N items — no more, no fewer:

```
exactly 2 of (
  ART 101,
  ART 201,
  ART 301,
  ART 401
)
```

"Complete exactly 2 of these 4 courses." Taking 1 doesn't satisfy it; taking 3 doesn't satisfy it; only 2 does.

This is less common than `at least` but useful for requirements with a precise course count:

**Language requirement — exactly 2 semesters:**
```
exactly 2 of (
  SPAN 101,
  SPAN 102,
  SPAN 201,
  SPAN 202
)
```

## Nesting with Counted Requirements

Counted requirements nest just like `all of` and `any of`. You can put counted requirements inside other combinations:

```
all of (
  # Core — all required
  CMPS 130,
  CMPS 230,
  CMPS 490,

  # Upper-level electives — choose at least 4
  at least 4 of (
    CMPS 305, CMPS 310, CMPS 320, CMPS 331,
    CMPS 342, CMPS 345, CMPS 364, CMPS 367
  ),

  # Lab science — choose at least 2
  at least 2 of (
    BIOL 110,
    CHEM 030,
    PHYS 011
  )
)
```

You can also put other expressions inside counted requirements:

```
at least 2 of (
  any of (MATH 151, MATH 161),      # A calculus course
  any of (MATH 250, MATH 260),      # A discrete math course
  any of (STAT 201, STAT 211)       # A statistics course
)
```

"Complete at least 2 of these 3 math areas, choosing one course from each area you select."

## The Difference Between Counted Requirements and All/Any

These three constructs are related:

| Construct | Equivalent to |
|---|---|
| `all of (A, B, C)` | `at least 3 of (A, B, C)` |
| `any of (A, B, C)` | `at least 1 of (A, B, C)` |

Use `all of` and `any of` when you mean "all" or "any" — they're clearer. Use the counted forms when you need a specific number.

## Summary

| Construct | Meaning | Example |
|---|---|---|
| `at least N of (...)` | Satisfy N or more items | `at least 3 of (A, B, C, D, E)` |
| `at most N of (...)` | Satisfy no more than N items | `at most 2 of (A, B, C)` |
| `exactly N of (...)` | Satisfy exactly N items | `exactly 2 of (A, B, C, D)` |

---

[Next: Course Filters →](05-course-filters.md)
