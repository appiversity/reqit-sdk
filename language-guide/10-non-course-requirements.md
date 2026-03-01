# Non-Course Requirements

[← Post-Selection Constraints](09-post-selection-constraints.md) | [Table of Contents](README.md) | [Next: Group Requirements →](11-group-requirements.md)

---

Not every academic requirement is a course. Test scores, certifications, clinical hours, and standing requirements are all part of the academic landscape. Reqit handles these with three constructs: **score**, **attainment**, and **quantity**.

## Score — Test Score Requirements

Many institutions use test scores as prerequisites or placement criteria. The `score` construct specifies a test name and a minimum threshold:

```
score "SAT MATH" >= 580
```

"The student must have an SAT Math score of 580 or higher."

The test name is enclosed in quotes and can be any descriptive string your institution uses:

```
score "ACT Composite" >= 26
score "ACCUPLACER Quant Reasoning" >= 258
score "ACCUPLACER Adv Alg & Functions" >= 260
score "AP Calculus AB" >= 3
score "IB Mathematics" >= 5
```

### Score Operators

Score supports all comparison operators:

```
score "SAT MATH" >= 580        # 580 or higher
score "SAT MATH" > 500         # Above 500
score "SAT MATH" <= 700        # 700 or lower
score "GRE Verbal" >= 155      # Graduate exam threshold
```

### Test Scores as Prerequisite Alternatives

The most common pattern is offering test scores as alternatives to course prerequisites:

```
any of (
  MATH 110 with grade >= "D",
  score "ACCUPLACER Adv Alg & Functions" >= 280
)
```

"The student can satisfy this prerequisite by completing MATH 110 with a D or better, *or* by scoring 280+ on the ACCUPLACER."

A more comprehensive prerequisite with multiple course and test alternatives:

```
any of (
  MATH 022 with grade >= "D",
  MATH 024 with grade >= "D",
  MATH 101 with grade >= "D",
  MATH 104 with grade >= "D",
  MATH 108 with grade >= "D",
  MATH 110 with grade >= "D",
  MATH 121 with grade >= "D",
  score "SAT MATH" >= 580,
  score "ACCUPLACER Quant Reasoning" >= 258,
  score "ACCUPLACER Adv Alg & Functions" >= 260,
  score "ACT Composite" >= 26
)
```

"Any one of these math courses (with a D or better), or any one of these test scores." This is a real pattern from a Computer Science I prerequisite — the institution accepts multiple paths to demonstrate math readiness.

## Attainment — Yes/No Achievements

An `attainment` is a binary requirement — the student either has it or doesn't. There's no score or quantity, just a status:

```
attainment "Junior Standing"
```

"The student must have achieved Junior Standing."

More examples:

```
attainment "Department Approval"
attainment "Praxis Exam"
attainment "Background Check"
attainment "Portfolio Review"
attainment "Advisor Signature"
```

### Using Attainments

Attainments appear naturally within larger requirements:

```
all of (
  attainment "Junior Standing",
  at least 60 credits from (courses where subject = "*"),
  CMPS 490
)
```

"Senior project requires Junior Standing, at least 60 total credits, and CMPS 490."

**Graduation requirements** often include attainments:

```
all of (
  $major_requirements,
  $gen_ed_requirements,
  at least 120 credits from (courses where subject = "*"),
  attainment "Overall GPA >= 2.0",
  attainment "Residency Requirement"
)
```

### Overall GPA as an Attainment

As mentioned in [Chapter 8](08-grade-and-gpa.md), overall transcript GPA — the average across *all* courses, not just those in a requirement — is best modeled as an attainment:

```
attainment "Overall GPA >= 2.0"
```

This is because Reqit's `with gpa >= 2.0` is scoped to the courses in the requirement it wraps. An overall GPA involves every course on the transcript, which is outside any single requirement's scope.

## Quantity — Measurable Milestones

A `quantity` requirement checks a numeric value against a threshold:

```
quantity "Clinical Hours" >= 500
```

"The student must have accumulated at least 500 clinical hours."

Like scores, quantities support all comparison operators:

```
quantity "Clinical Hours" >= 500
quantity "Research Credits" >= 6
quantity "Community Service Hours" >= 40
quantity "Practicum Days" >= 30
```

### Quantities vs. Scores

Both `score` and `quantity` test a number against a threshold. The difference is semantic:

- **Scores** are typically test results — one-time measurements (SAT, ACT, AP exams)
- **Quantities** are typically cumulative — they grow over time (clinical hours, service hours)

Use whichever term matches how your institution thinks about the value.

## Mixing Course and Non-Course Requirements

Non-course requirements combine freely with course requirements:

```
all of (
  # Course prerequisites
  any of (
    MATH 121 with grade >= "C",
    score "ACCUPLACER Adv Alg & Functions" >= 280
  ),

  # Standing requirement
  attainment "Sophomore Standing",

  # Previous coursework
  CMPS 148
)
```

"To enroll, the student needs: calculus (via course or test), Sophomore Standing, and CMPS 148."

## Summary

| Construct | Meaning | Example |
|---|---|---|
| `score "name" >= N` | Test score threshold | `score "SAT MATH" >= 580` |
| `attainment "name"` | Binary achievement | `attainment "Junior Standing"` |
| `quantity "name" >= N` | Cumulative quantity threshold | `quantity "Clinical Hours" >= 500` |

All three support being nested inside `all of`, `any of`, `at least N of`, and other combinations — they're full requirement expressions, just like course references and filters.

---

[Next: Group Requirements →](11-group-requirements.md)
