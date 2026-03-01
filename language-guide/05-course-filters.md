# Course Filters

[← Counted Requirements](04-counted-requirements.md) | [Table of Contents](README.md) | [Next: Credit Requirements →](06-credit-requirements.md)

---

So far, every requirement we've written lists courses by name. But many requirements describe courses by their *properties* instead — "any 300-level CS course" or "a course with the Writing Intensive attribute." Reqit handles this with **course filters**.

## The Basics

A course filter starts with `courses where` followed by one or more conditions:

```
courses where subject = "CMPS"
```

"Any course with the subject code CMPS." This matches every CMPS course in your catalog — CMPS 130, CMPS 230, CMPS 340, and so on.

Course filters resolve against your institution's catalog. When a new CMPS course is added next year, it automatically matches this filter. You don't need to update the requirement.

## Filterable Fields

There are four fields you can filter on:

### Subject

The course's subject code (department prefix):

```
courses where subject = "MATH"
courses where subject = "CSCI"
```

### Number

The course number. Numeric comparisons extract the leading digits, so `number >= 300` matches "301", "315", "340", and also "301A" or "315.2":

```
courses where number >= 300            # 300-level and above
courses where number >= 200 and number <= 299    # 200-level only
courses where number >= 100 and number <= 499    # All undergraduate
```

For exact matching, the comparison is done on the full string:

```
courses where number = "301"           # Exactly "301" — not "301A"
```

### Attribute

Course attributes are labels your institution assigns — Writing Intensive, Lab Science, General Education categories, and so on. The attribute codes are whatever your institution uses:

```
courses where attribute = "WI"         # Writing Intensive
courses where attribute = "LAB-SCI"    # Lab Science
courses where attribute = "GE-HUM"     # Gen-Ed Humanities
```

### Credits

The course's credit value:

```
courses where credits >= 4             # 4-credit courses and above
courses where credits <= 3             # 3 credits or fewer
courses where credits = 3              # Exactly 3-credit courses
```

Some courses have variable credits (like independent study, 1–4 credits). For these courses, `credits >= 4` checks the maximum available credits, and `credits <= 3` checks the minimum.

## Comparison Operators

Reqit supports six comparison operators:

| Operator | Meaning | Example |
|---|---|---|
| `=` | Equals | `subject = "MATH"` |
| `!=` | Not equals | `subject != "PHYS"` |
| `>` | Greater than | `number > 200` |
| `>=` | Greater than or equal | `number >= 300` |
| `<` | Less than | `number < 300` |
| `<=` | Less than or equal | `credits <= 3` |

## Combining Filters with And

Add multiple conditions with `and`:

```
courses where subject = "CMPS" and number >= 300
```

"CMPS courses numbered 300 or above."

You can chain as many conditions as you need:

```
courses where subject = "CMPS" and number >= 300 and number <= 399
```

"CMPS courses in the 300-level range."

```
courses where subject = "CSCI" and number >= 200 and credits >= 3
```

"CSCI courses numbered 200 or above that are at least 3 credits."

## The In and Not In Operators

When you need to match multiple values for a single field, use `in`:

```
courses where subject in ("CSCI", "MATH", "ECON", "ENVR")
```

"Courses in any of these four departments." This is more concise than writing four separate conditions.

```
courses where attribute in ("C300", "C30C", "C30D", "C30G")
```

"Courses with any of these general education attributes."

The opposite is `not in`:

```
courses where subject not in ("PHYS", "CHEM")
```

"Courses in any department except Physics and Chemistry."

## The Not-Equals Operator

For simple single-value exclusions, use `!=`:

```
courses where subject != "PHYS"
```

"Any course that isn't in the Physics department."

This is equivalent to `subject not in ("PHYS")` but reads more naturally for a single value.

## Using Filters Inside Other Constructs

Course filters become powerful when combined with the operators from previous chapters:

### Counted selection from a filtered pool

```
at least 3 of (
  courses where subject = "CMPS" and number >= 300
)
```

"Take at least 3 CMPS courses at the 300-level or above."

### All of with mixed courses and filters

```
all of (
  CMPS 130,
  CMPS 230,
  CMPS 490,
  at least 4 of (
    courses where subject = "CMPS" and number >= 300
  )
)
```

"Take these three specific courses, plus at least 4 upper-level CMPS electives."

### One from each distribution area

```
one from each of (
  courses where attribute = "HUM",
  courses where attribute = "SCI",
  courses where attribute = "SS"
)
```

"Take one course from each of these three areas." (The `one from each of` construct is covered in [Chapter 11](11-group-requirements.md).)

## A Real-World Example

Here's how a typical CS elective requirement might look, combining filters with specific courses:

```
# Upper-level electives: at least 5 courses
# Must be CMPS 300-level, excluding senior project
at least 5 of (
  courses where subject = "CMPS" and number >= 300 and number <= 499
)
```

Compare this to listing every eligible course by name. The filter version is shorter, and it automatically includes new courses added in future catalog years.

But sometimes you *want* to list specific courses — for example, when the eligible list crosses departments:

```
at least 7 of (
  CMPS 240, CMPS 285, CMPS 305, CMPS 310, CMPS 315,
  CMPS 320, CMPS 327, CMPS 331, CMPS 342, CMPS 345,
  CMPS 350, CMPS 357, CMPS 364, CMPS 367, CMPS 369,
  CMPS 370, CMPS 373, CMPS 375, DATA 301
)
```

Notice the last item is `DATA 301` — a course from a different department. A simple subject filter wouldn't capture this. You could combine a filter with an explicit course:

```
at least 7 of (
  courses where subject = "CMPS" and number >= 200,
  DATA 301
)
```

Both approaches are valid. Use whichever is clearer for your situation.

## Wildcard Matching

To match every course in the catalog, use the wildcard:

```
courses where subject = "*"
```

This is useful for total credit minimums (see [Chapter 6](06-credit-requirements.md)):

```
at least 120 credits from (
  courses where subject = "*"
)
```

"At least 120 total credits from any courses."

## Summary

| Filter | Meaning | Example |
|---|---|---|
| `subject = "X"` | Courses in department X | `subject = "CMPS"` |
| `number >= N` | Courses numbered N or above | `number >= 300` |
| `attribute = "X"` | Courses with attribute X | `attribute = "WI"` |
| `credits >= N` | Courses with N or more credits | `credits >= 4` |
| `!=` | Not equal to | `subject != "PHYS"` |
| `in (...)` | Matches any value in the list | `subject in ("MATH", "CSCI")` |
| `not in (...)` | Excludes all values in the list | `subject not in ("PHYS", "CHEM")` |
| `and` | Combines multiple conditions | `subject = "CMPS" and number >= 300` |

---

[Next: Credit Requirements →](06-credit-requirements.md)
