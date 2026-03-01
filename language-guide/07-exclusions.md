# Exclusions

[← Credit Requirements](06-credit-requirements.md) | [Table of Contents](README.md) | [Next: Grade and GPA Requirements →](08-grade-and-gpa.md)

---

Sometimes you need to define a pool of courses and then remove specific ones. "Any 300-level CMPS course except the senior project." Reqit provides three ways to exclude courses: the `except` modifier, `none of`, and negative filters.

## Except — Removing Courses from a Pool

The `except` modifier removes specific courses from a requirement:

```
courses where subject = "CMPS" and number >= 300
  except (CMPS 490)
```

"All CMPS courses at the 300-level or above, except CMPS 490."

You can exclude multiple courses:

```
courses where subject = "MATH" and number >= 122
  except (MATH 205, MATH 210, MATH 237)
```

"MATH courses numbered 122 or above, but not MATH 205, MATH 210, or MATH 237."

### Except with Counted Requirements

Combine `except` with counted selection:

```
at least 4 of (
  courses where subject = "CMPS" and number >= 300
) except (CMPS 490)
```

"Take at least 4 CMPS courses at the 300-level or above, excluding the senior project from the eligible pool."

### Except with Credit Requirements

Exclude courses before counting credits:

```
at least 15 credits from (
  courses where subject = "CSE" and number >= 200
) except (CSE 490)
```

"At least 15 credits from CSE courses at 200-level or above, but CSE 490 doesn't count toward this requirement."

### Except with All Of

Remove courses from a group requirement:

```
all of (
  courses where subject = "CMPS"
) except (CMPS 490, CMPS 491, CMPS 492)
```

### Except with Variable References

You can also use `except` with [variables](12-variables.md):

```
$electives except (CMPS 490)
```

"Everything in the electives variable, minus CMPS 490."

## None Of — Explicit Prohibition

`none of (...)` states that the student must *not* have completed any of the listed courses:

```
none of (CMPS 490, CMPS 491)
```

This is different from `except`. The `except` modifier removes courses from an eligible pool. `none of` is a standalone prohibition — it fails if the student has completed any listed course.

### When To Use None Of

**Courses that can't both count:**
```
all of (
  CMPS 130,
  none of (CMPS 135)    # If you take CMPS 130, CMPS 135 cannot count
)
```

**Restriction on a prerequisite:**
```
all of (
  CSCI 140,
  none of (MATH 212)    # Can't take this if already completed MATH 212
)
```

## Negative Filters

For simple exclusions within a filter, use the `!=` operator or `not in`:

```
courses where subject != "PHYS"
```

"Any course except Physics."

```
courses where subject not in ("PHYS", "CHEM")
```

"Any course except Physics and Chemistry."

These are part of the filter itself (see [Chapter 5](05-course-filters.md)), not a separate modifier.

## Except vs. None Of vs. Negative Filters

These three tools serve different purposes:

| Tool | What it does | Example |
|---|---|---|
| `except (...)` | Removes courses from a pool | `courses where subject = "CMPS" except (CMPS 490)` |
| `none of (...)` | Prohibits specific courses | `none of (CMPS 490, CMPS 491)` |
| `subject != "X"` | Excludes by property in a filter | `courses where subject != "PHYS"` |

**Use `except`** when you have a broad pool and need to carve out specific courses.

**Use `none of`** when you need to express a standalone prohibition — "the student must not have taken these."

**Use negative filters** when the exclusion is based on a property (subject, attribute, etc.) rather than specific courses.

## Real-World Examples

**CS elective pool with exclusions:**
```
at least 5 of (
  courses where subject = "CSCI" and number >= 300
    except (CSCI 320, CSCI 430, CSCI 498)
)
```

"At least 5 upper-level CSCI electives, excluding independent study, capstone, and special topics."

**Math electives excluding specific courses already counted elsewhere:**
```
at least 2 of (
  courses where subject = "MATH" and number >= 122
    except (MATH 205, MATH 210, MATH 237)
)
```

**Gen-ed that excludes courses in your major department:**
```
courses where attribute = "HUM" and subject != "CSCI"
```

"A humanities course, but not from your own department."

## Summary

| Construct | Meaning | Example |
|---|---|---|
| `... except (A, B)` | Remove A and B from the pool | `courses where subject = "CMPS" except (CMPS 490)` |
| `none of (A, B)` | Student must not have completed A or B | `none of (CMPS 490, CMPS 491)` |
| `!= "X"` | Exclude by property value | `subject != "PHYS"` |
| `not in ("X", "Y")` | Exclude by multiple property values | `subject not in ("PHYS", "CHEM")` |

---

[Next: Grade and GPA Requirements →](08-grade-and-gpa.md)
