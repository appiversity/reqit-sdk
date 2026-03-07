# Courses

[← Introduction](01-introduction.md) | [Table of Contents](README.md) | [Next: Combining Requirements →](03-combining-requirements.md)

---

The most basic building block in Reqit is a **course reference** — a subject code followed by a course number.

## Basic Course References

```
MATH 151
```

This means: "the student must complete MATH 151." It's the simplest possible requirement.

A course reference has two parts separated by a space:

- **Subject code** — starts with a letter, followed by one or more letters or digits (e.g., `MATH`, `CSCI`, `BIOL`, `INTD`, `CS2`)
- **Course number** — typically starts with a digit (e.g., `151`, `301`, `490`), but may also start with a letter if it contains at least one digit (e.g., `A101`)

More examples:

```
CSCI 141
BIOL 220
ENGL 101
PHYS 011
```

## Case Doesn't Matter

Reqit is case-insensitive for course references. All of these refer to the same course:

```
MATH 151
math 151
Math 151
```

Reqit normalizes everything to uppercase internally, so `math 151` and `MATH 151` are identical. Write whichever way is most comfortable for you — uppercase is the convention, but it's not required.

## Course Numbers with Letters and Decimals

Course numbers aren't always plain digits. Many institutions use letters or decimal points in their numbering:

```
CHEM 101A        # A lab section designation
CSCI 220.2       # A module within a course sequence
MATH 076         # Leading zeros are fine
BIOL 3XX         # Alphanumeric patterns
```

Reqit accepts any course number that starts with a digit, or starts with a letter provided it contains at least one digit. In either case, digits, letters, and periods are all allowed. The number is normalized to uppercase, so `101a` becomes `101A`.

## What a Course Reference Means

A course reference identifies a course by its subject and number. This pair is stable across catalog years — MATH 151 is MATH 151 whether it's the 2024–2025 or 2025–2026 catalog. The course title, credits, and description may change, but the identity stays the same.

When used as a requirement (which is almost always), a course reference means "the student must complete this course." Whether "complete" means earning a passing grade, earning a specific minimum grade, or simply enrolling depends on the context and any grade constraints attached (covered in [Chapter 8](08-grade-and-gpa.md)).

## Course References vs. Course Filters

A course reference names a *specific* course. When you need to describe a *category* of courses — like "any 300-level CMPS course" — you'll use a course filter instead. Filters are covered in [Chapter 5](05-course-filters.md).

## Summary

| What you write | What it means |
|---|---|
| `MATH 151` | The student must complete MATH 151 |
| `CSCI 220.2` | The student must complete CSCI 220.2 |
| `CHEM 101A` | The student must complete CHEM 101A |

A single course reference is the foundation. Everything else in Reqit is built by combining, filtering, counting, and constraining course references.

---

[Next: Combining Requirements →](03-combining-requirements.md)
