# Combining Requirements

[← Courses](02-courses.md) | [Table of Contents](README.md) | [Next: Counted Requirements →](04-counted-requirements.md)

---

A single course reference is useful for simple prerequisites, but most requirements involve multiple courses. Reqit provides three basic ways to combine requirements: **all of**, **any of**, and **none of**.

## All Of — Every Item Required

`all of (...)` means every item in the list must be satisfied:

```
all of (MATH 151, MATH 152, MATH 250)
```

"The student must complete MATH 151, and MATH 152, and MATH 250."

This is the most common combinator. A typical major requirement lists the core courses that every student must take:

```
all of (
  CMPS 130,       # Introduction to Computer Science
  CMPS 230,       # Data Structures
  CMPS 340,       # Algorithms
  CMPS 360,       # Software Engineering
  CMPS 380,       # Operating Systems
  CMPS 490        # Senior Project
)
```

Items are separated by **commas**. Each item can be a course reference, another combination, a filter, or any other Reqit expression.

### Formatting

You can write `all of` on a single line or across multiple lines. Both are identical:

```
all of (CMPS 130, CMPS 230, CMPS 340)
```

```
all of (
  CMPS 130,
  CMPS 230,
  CMPS 340
)
```

Use the multi-line form when you have more than a few items — it's easier to read and maintain.

## Any Of — Choose One

`any of (...)` means at least one item must be satisfied:

```
any of (MATH 170, MATH 171)
```

"The student must complete either MATH 170 or MATH 171."

This is how you express choices. A common pattern is offering students two paths to meet the same requirement:

```
any of (
  MATH 170,                       # Calculus I (single course)
  all of (MATH 106, MATH 166)     # Two-part calculus sequence
)
```

"The student needs calculus. They can either take the single-course version (MATH 170) or the two-part sequence (MATH 106 and MATH 166)."

Notice that one of the items inside `any of` is itself an `all of` — you can nest combinations freely. More on nesting below.

### More Examples of Any Of

A prerequisite that accepts several alternative courses:

```
any of (
  CSCI 140,       # Discrete Structures for CS
  MATH 212        # Discrete Mathematical Structures
)
```

A general education requirement where any course with a specific attribute satisfies it:

```
any of (
  INTD 101,       # First Year Seminar
  HNRS 101        # Honors First Year Seminar
)
```

## None Of — Explicit Exclusion

`none of (...)` means the student must *not* have completed any of the listed courses. This is less common but useful for expressing restrictions:

```
none of (CMPS 490, CMPS 491)
```

"The student must not have completed CMPS 490 or CMPS 491."

A more realistic use: a prerequisite that excludes students who have already taken an advanced version:

```
all of (
  CMPS 130,
  none of (CMPS 230)     # Cannot take this if already completed CMPS 230
)
```

For other ways to exclude courses, see [Chapter 7: Exclusions](07-exclusions.md).

## Nesting — Combining Combinations

The real power of Reqit comes from nesting. Each item inside `all of`, `any of`, or `none of` can itself be a combination:

```
all of (
  # Math requirement — choice of sequence
  any of (
    MATH 170,
    all of (MATH 106, MATH 166)
  ),

  # CS core — all required
  CMPS 130,
  CMPS 230,
  CMPS 340,

  # Lab science — one of two options
  any of (
    all of (PHYS 011, PHYS 012),
    all of (CHEM 030, CHEM 031)
  )
)
```

This reads from the outside in:

1. **All of** these groups must be satisfied:
   - The math requirement (calculus via either path)
   - The three CS core courses
   - The lab science requirement (physics or chemistry)

2. For the **math requirement**: any of these — either MATH 170 alone, or all of MATH 106 and MATH 166

3. For the **lab science**: any of these — either all of PHYS 011 and PHYS 012, or all of CHEM 030 and CHEM 031

You can nest as deeply as you need. There's no practical limit.

### A Deeper Example

A prerequisite with multiple branching paths:

```
any of (
  all of (
    CSE 003,
    CSE 004
  ),
  CSE 007,
  all of (
    any of (CMPS 130, CMPS 135),
    MATH 151
  )
)
```

"The student needs introductory programming. They can satisfy this by:
- Taking the two-part sequence (CSE 003 and CSE 004), or
- Taking the combined course (CSE 007), or
- Taking an intro CS course (either CMPS 130 or CMPS 135) plus Calculus I"

## Labels — Naming Sections

You can attach a display name to any composite expression by prefixing it with a quoted label and a colon:

```
"Core Courses": all of (
  CMPS 130,
  CMPS 230,
  CMPS 340
)
```

The label `"Core Courses"` doesn't change the requirement's logic — it's a display annotation. Renderers use labels as section headings in outlines, HTML, and other output formats.

### Labels in Context

Labels are most useful inside larger requirements, where they give each section a clear heading:

```
all of (
  "Core Courses": all of (
    CMPS 130,
    CMPS 230,
    CMPS 340,
    CMPS 490
  ),

  "Electives": at least 4 of (
    CMPS 305, CMPS 310, CMPS 320,
    CMPS 331, CMPS 342, CMPS 345
  ),

  "Math Requirements": all of (
    MATH 151,
    MATH 152
  )
)
```

Without labels, rendered output uses generic headings like "All of the following." With labels, it uses "Core Courses," "Electives," and "Math Requirements."

### What Can Be Labeled

Labels can be attached to any composite expression — `all of`, `any of`, `none of`, `at least N of`, `at most N of`, `exactly N of`, `one from each of`, and `from at least N of`. They cannot be attached to leaf expressions like individual course references.

## Tips for Readable Requirements

1. **Use comments** to label sections (comments start with `#`)
2. **Use line breaks** to separate logical groups
3. **Indent nested items** to show structure
4. **Put each item on its own line** when lists are long

Compare:

```
all of (any of (MATH 170, all of (MATH 106, MATH 166)), CMPS 130, CMPS 230, CMPS 340, any of (all of (PHYS 011, PHYS 012), all of (CHEM 030, CHEM 031)))
```

vs.

```
all of (
  # Math — choose a calculus path
  any of (
    MATH 170,
    all of (MATH 106, MATH 166)
  ),

  # CS core
  CMPS 130,
  CMPS 230,
  CMPS 340,

  # Lab science — physics or chemistry
  any of (
    all of (PHYS 011, PHYS 012),
    all of (CHEM 030, CHEM 031)
  )
)
```

Both are identical to Reqit. The second is far easier to read and maintain.

## Summary

| Construct | Meaning | Example |
|---|---|---|
| `all of (A, B, C)` | Every item required | `all of (MATH 151, MATH 152)` |
| `any of (A, B, C)` | At least one required | `any of (MATH 170, MATH 171)` |
| `none of (A, B, C)` | None may be completed | `none of (CMPS 490, CMPS 491)` |
| `"label": composite` | Named section | `"Core": all of (CMPS 130, CMPS 230)` |
| Nesting | Combinations inside combinations | `all of (any of (A, B), C)` |

---

[Next: Counted Requirements →](04-counted-requirements.md)
