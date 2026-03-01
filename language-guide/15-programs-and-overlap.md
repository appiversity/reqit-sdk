# Programs and Overlap Rules

[← Prerequisites and Corequisites](14-prerequisites-and-corequisites.md) | [Table of Contents](README.md) | [Next: Comments and Formatting →](16-comments-and-formatting.md)

---

When students pursue multiple programs — a major and a minor, or a major with a concentration — institutions need rules about how courses can be shared across programs. Reqit handles this with **program references**, **program context references**, and **overlap rules**.

## Program References

A program reference identifies a specific academic program by its code, type, and level:

```
program CS major undergraduate
```

This refers to the undergraduate Computer Science major. The components are:

- **Code** — an unquoted identifier: `CS` (see [Chapter 10](10-non-course-requirements.md) for code format rules)
- **Type** — the kind of program: `major`, `minor`, `certificate`, `concentration`, `track`, or `cluster`
- **Level** — the academic level: `undergraduate`, `graduate`, `doctoral`, `professional`, `post-graduate`, or `post-doctoral`

Program codes are case-insensitive and normalized to uppercase: `program cs major undergraduate` is the same as `program CS major undergraduate`.

### More Examples

```
program DATA_SCIENCE certificate graduate
program MATH minor undergraduate
program ETHICS cluster undergraduate
program SYSTEMS track undergraduate
program EDUCATION certificate post-graduate
```

### Any Program (Wildcard)

To refer to any program of a given type and level, omit the name and use `any`:

```
any program major undergraduate
```

"Any undergraduate major." This is useful in rules that apply broadly:

```
any program minor undergraduate
```

"Any undergraduate minor."

## Program Context References

While program references identify programs from the catalog, **program context references** refer to a student's declared program at the time of evaluation. These resolve based on the student's academic plan:

```
primary major
```

"The student's declared primary major — whatever it is."

```
primary minor
```

"The student's declared minor."

These are not catalog entities — they're placeholders that resolve to a specific program when a student's requirements are being evaluated. A rule using `primary major` applies differently for a Computer Science major than for an Accounting major.

### Where Program Context References Appear

Program context references are used in overlap rules (see below) and as targets for course-sharing constraints. They let you write institution-wide policies without naming every program:

```
overlap between ($gen_ed, primary major) at most 3 courses
```

"At most 3 courses may count toward both general education and the student's major." This rule works regardless of what the student's major is.

## Overlap Rules

When a student pursues multiple programs, some courses may satisfy requirements in more than one program. Institutions often have policies about this: "No more than 3 courses can count toward both your major and your minor" or "At most 50% of minor credits can overlap with the major."

### Overlap Between

```
overlap between ($coll, $cs_major) at most 3 courses
```

"At most 3 courses may count toward both the COLL curriculum and the CS major."

The syntax is:

```
overlap between (left, right) at most N unit
```

Where:
- **left** and **right** are the two requirement trees being compared (variable references or program context references)
- **N** is the maximum allowed overlap
- **unit** is `courses`, `credits`, or `%`

### Examples with Different Units

**Course count limit:**
```
overlap between ($cs_minor, primary major) at most 2 courses
```

"At most 2 courses from the CS minor can also count toward the student's primary major."

**Credit limit:**
```
overlap between ($gen_ed, primary major) at most 6 credits
```

"At most 6 credits can count toward both gen-ed and the major."

**Percentage limit:**
```
overlap between ($cs_minor, primary major) at most 50 %
```

"At most 50% of the minor's credits can overlap with the major."

### Overlap Targets

The left and right sides of an overlap rule can be:

- A **variable reference**: `$cs_major`, `$gen_ed`, `$cmps-major.core`
- A **program context reference**: `primary major`, `primary minor`

```
overlap between (primary major, primary minor) at most 2 courses
```

"At most 2 courses can count toward both the student's major and minor."

```
overlap between ($cmps-major.core, $math-minor.core) at most 1 courses
```

"At most 1 course can count toward both the CS major core and the Math minor core."

## Outside Program

The `outside` construct specifies how many credits must come from courses *not* used toward a program:

```
outside (primary major) at least 72 credits
```

"At least 72 credits on the student's transcript must come from courses that are *not* counted toward their major."

This is a graduation-level requirement that ensures breadth — the student can't satisfy their entire degree only with major courses.

### Examples

```
outside (primary major) at least 72 credits
```

"At least 72 credits outside the major."

```
outside (primary minor) at least 30 credits
```

"At least 30 credits outside the minor."

```
outside ($cmps_major) at least 60 credits
```

"At least 60 credits outside the CS major requirement tree."

## Where Overlap Rules Are Used

Overlap rules are typically part of institution-wide graduation requirements, not individual program requirements. They express cross-program policies:

```
# Graduation requirements
all of (
  $major_requirements,
  $gen_ed_requirements,
  at least 120 credits from (courses where subject = "*"),
  attainment OVERALL_GPA_2_0
)

# Overlap policies (stored separately)
overlap between ($gen_ed, primary major) at most 3 courses
outside (primary major) at least 72 credits
```

The overlap rules don't nest inside the main requirement tree — they're companion rules that constrain how courses can be shared when evaluating multiple requirement trees together.

## Program Types and Levels

For reference, here are all supported values:

### Program Types

| Type | Description |
|---|---|
| `major` | A primary field of study |
| `minor` | A secondary field of study |
| `certificate` | A focused credential, often shorter than a major |
| `concentration` | A specialization within a major |
| `track` | A pathway or emphasis within a program |
| `cluster` | A group of related courses (used at some institutions) |

### Program Levels

| Level | Description |
|---|---|
| `undergraduate` | Bachelor's degree programs |
| `graduate` | Master's degree programs |
| `doctoral` | Ph.D. and similar programs |
| `professional` | J.D., M.D., and similar programs |
| `post-graduate` | Post-master's programs |
| `post-doctoral` | Post-Ph.D. programs |

## Summary

| Construct | Meaning | Example |
|---|---|---|
| `program CODE type level` | Named program reference | `program CS major undergraduate` |
| `any program type level` | Wildcard program reference | `any program minor undergraduate` |
| `primary major` | Student's declared major | Used in overlap rules |
| `primary minor` | Student's declared minor | Used in overlap rules |
| `overlap between (A, B) at most N unit` | Limit shared courses | `overlap between ($gen_ed, primary major) at most 3 courses` |
| `outside (target) at least N credits` | Credits outside a program | `outside (primary major) at least 72 credits` |

---

[Next: Comments and Formatting →](16-comments-and-formatting.md)
