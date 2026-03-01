# Group Requirements

[← Non-Course Requirements](10-non-course-requirements.md) | [Table of Contents](README.md) | [Next: Variables →](12-variables.md)

---

General education programs often require students to take courses across multiple distribution areas — "one from each area" or "courses from at least 3 of 5 areas." Reqit provides two constructs designed specifically for these patterns.

## One From Each Of — Full Distribution

`one from each of (...)` means the student must take at least one course from *every* group in the list:

```
one from each of (
  courses where attribute = "HUM",       # Humanities
  courses where attribute = "SCI",       # Natural Science
  courses where attribute = "SS",        # Social Science
  courses where attribute = "FA"         # Fine Arts
)
```

"Take one course from Humanities, one from Natural Science, one from Social Science, and one from Fine Arts."

This is the classic gen-ed distribution pattern. Each item in the list represents a distribution area, and the student must be represented in every area.

### Groups Can Be Any Expression

The groups inside `one from each of` don't have to be course filters. They can be any Reqit expression:

```
one from each of (
  any of (MATH 111, MATH 131),         # A calculus course
  any of (CSCI 141, CSCI 143),         # An intro CS course
  courses where attribute = "WI"        # A writing intensive course
)
```

"One from each group: a calculus course, an intro CS course, and a writing intensive course."

### Real-World Example: COLL Curriculum

A general education curriculum with multiple distribution levels:

```
one from each of (
  courses where attribute = "C200",      # COLL 200 courses
  courses where attribute = "C300",      # COLL 300 courses
  courses where attribute = "C400"       # COLL 400 courses
)
```

"One course from each of the three COLL levels."

## From At Least N Of — Partial Distribution

`from at least N of (...)` means the student must take courses from at least N of the groups, but not necessarily all of them:

```
from at least 3 of (
  courses where attribute = "HUM",       # Humanities
  courses where attribute = "SCI",       # Natural Science
  courses where attribute = "SS",        # Social Science
  courses where attribute = "FA",        # Fine Arts
  courses where attribute = "QR"         # Quantitative Reasoning
)
```

"Take courses from at least 3 of these 5 areas." The student picks which 3 (or more) areas to satisfy. They need at least one course from each chosen area.

### When To Use From At Least N Of

This pattern appears in distribution requirements where institutions want breadth but allow some flexibility:

**Gen-ed distribution — 2 of 3 categories:**
```
from at least 2 of (
  courses where attribute = "GE-CULTURE-CREATIVITY",
  courses where attribute = "GE-VALUES-ETHICS",
  courses where attribute = "GE-SYSTEMS-SUSTAINABILITY"
)
```

"Take at least one course from at least 2 of these 3 distribution categories."

**Graduate program — breadth across specializations:**
```
from at least 2 of (
  courses where attribute = "SPEC-AI",
  courses where attribute = "SPEC-SYSTEMS",
  courses where attribute = "SPEC-THEORY",
  courses where attribute = "SPEC-APPLIED"
)
```

"Take courses from at least 2 of the 4 specialization areas."

## Nesting Distribution Requirements

Distribution requirements nest naturally inside larger program requirements:

```
all of (
  # Major core
  CMPS 130,
  CMPS 230,
  CMPS 490,

  # Gen-ed distribution
  one from each of (
    courses where attribute = "HUM",
    courses where attribute = "SCI",
    courses where attribute = "SS"
  ),

  # Total credits
  at least 120 credits from (courses where subject = "*")
)
```

## Combining with Other Constructs

You can nest counted requirements inside distribution areas:

```
at least 2 of (
  at least 1 of (courses where attribute = "GE-CULTURE"),
  at least 1 of (courses where attribute = "GE-VALUES"),
  at least 1 of (courses where attribute = "GE-SYSTEMS")
)
```

"Select 2 of the 3 distribution categories, and take at least 1 course from each selected category."

This is equivalent to `from at least 2 of (...)` but shows how you can build up the same pattern using other constructs. Use `from at least N of` when it's available — it's more readable.

## One From Each Of vs. All Of

These look similar but serve different purposes:

```
# One From Each — one course per group, groups are categories
one from each of (
  courses where attribute = "HUM",
  courses where attribute = "SCI",
  courses where attribute = "SS"
)

# All Of — each item must be satisfied
all of (
  courses where attribute = "HUM",
  courses where attribute = "SCI",
  courses where attribute = "SS"
)
```

For course filters, both require one course matching each filter. The semantic difference matters for auditing — `one from each of` explicitly marks these as distribution categories, which allows the system to report which areas a student has and hasn't satisfied.

With counted requirements, the difference is clearer:

```
# One from each: one course from each of 3 groups
one from each of (
  at least 1 of (MATH 151, MATH 161),
  at least 1 of (CSCI 141, CSCI 143),
  at least 1 of (PHYS 011, PHYS 021)
)

# All of: every sub-requirement must be satisfied
all of (
  at least 1 of (MATH 151, MATH 161),
  at least 1 of (CSCI 141, CSCI 143),
  at least 1 of (PHYS 011, PHYS 021)
)
```

In this case, both require 3 courses. But `one from each of` signals that these are independent distribution areas, while `all of` is a general conjunction.

## Summary

| Construct | Meaning | Example |
|---|---|---|
| `one from each of (A, B, C)` | One course from every group | Gen-ed: one from HUM, SCI, and SS |
| `from at least N of (A, B, C)` | Courses from N or more groups | Distribution: 2 of 3 categories |

---

[Next: Variables →](12-variables.md)
