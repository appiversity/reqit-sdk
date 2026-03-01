# Credit Requirements

[← Course Filters](05-course-filters.md) | [Table of Contents](README.md) | [Next: Exclusions →](07-exclusions.md)

---

Some requirements count **credits** rather than courses. "At least 12 credits of upper-level CS courses" is different from "at least 4 upper-level CS courses" — a student taking four 3-credit courses satisfies the course count but falls short on credits if the requirement asks for 12.

## At Least N Credits From

```
at least 12 credits from (
  courses where subject = "CMPS" and number >= 300
)
```

"The student needs at least 12 credits from CMPS courses numbered 300 and above."

If the eligible courses are 4 credits each, that's 3 courses. If some are 3 credits, the student might need 4 courses. The requirement doesn't care about the course count — it cares about the total credits.

### From a Specific List

You can count credits from named courses:

```
at least 6 credits from (
  CMPS 301, CMPS 302, CMPS 350, CMPS 360
)
```

"At least 6 credits chosen from these specific courses."

### From a Filter

More commonly, you'll count credits from a filtered pool:

```
at least 15 credits from (
  courses where subject = "CSE" and number >= 200
)
```

"At least 15 credits of CSE courses at the 200-level or above."

### Total Credit Minimum

A graduation requirement might specify a minimum total credit count:

```
at least 120 credits from (
  courses where subject = "*"
)
```

"At least 120 total credits from any courses."

Or a more specific total:

```
at least 128 credits from (
  courses where subject = "*"
)
```

## At Most N Credits From

Set a credit ceiling:

```
at most 6 credits from (
  courses where subject = "CMPS" and number >= 200 and number <= 299
)
```

"No more than 6 credits from 200-level CMPS courses may count." This prevents students from loading up on easier mid-level courses.

## Exactly N Credits From

Require a precise credit count:

```
exactly 12 credits from (
  courses where attribute = "LAB-SCI"
)
```

"Exactly 12 credits of lab science courses."

## Credits From with Multiple Sources

When the source list has multiple items, they all contribute to the credit pool:

```
at least 12 credits from (
  courses where subject = "CMPS" and number >= 300,
  courses where subject = "DATA" and number >= 300,
  MATH 350
)
```

"At least 12 credits from upper-level CMPS courses, upper-level DATA courses, and MATH 350."

## Real-World Examples

**Science and technology electives:**
```
at least 12 credits from (
  courses where attribute = "APPROVED-SCI-TECH"
)
```

**General education distribution — credits per area:**
```
all of (
  at least 3 credits from (courses where attribute = "ALV"),     # Arts, Letters, and Values
  at least 3 credits from (courses where attribute = "CSI"),     # Cultures, Societies, Individuals
  at least 3 credits from (courses where attribute = "NQR")      # Natural and Quantitative Reasoning
)
```

"At least 3 credits in each of three distribution areas."

**Capstone with supporting electives:**
```
all of (
  CMPS 490,
  at least 15 credits from (
    courses where subject = "CMPS" and number >= 300
  )
)
```

## Credits From vs. Counted Requirements

Choose the right tool for the job:

| Use this | When you're counting |
|---|---|
| `at least 3 of (...)` | **Courses** — "take at least 3 courses" |
| `at least 12 credits from (...)` | **Credits** — "accumulate at least 12 credits" |

If all eligible courses have the same number of credits, both approaches may yield the same result. But when credit values vary (3-credit vs. 4-credit courses, or variable-credit courses), credits-from gives you precise control.

## Summary

| Construct | Meaning | Example |
|---|---|---|
| `at least N credits from (...)` | N or more credits | `at least 12 credits from (...)` |
| `at most N credits from (...)` | No more than N credits | `at most 6 credits from (...)` |
| `exactly N credits from (...)` | Precisely N credits | `exactly 12 credits from (...)` |

---

[Next: Exclusions →](07-exclusions.md)
