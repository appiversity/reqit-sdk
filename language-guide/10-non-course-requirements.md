# Non-Course Requirements

[← Post-Selection Constraints](09-post-selection-constraints.md) | [Table of Contents](README.md) | [Next: Group Requirements →](11-group-requirements.md)

---

Not every academic requirement is a course. Test scores, certifications, clinical hours, and standing requirements are all part of the academic landscape. Reqit handles these with three constructs: **score**, **attainment**, and **quantity**.

All three use **codes** — unquoted identifiers that map to entries in your institution's catalog. Codes are case-insensitive and normalized to uppercase.

## Codes

A code is an unquoted identifier used to name scores, attainments, quantities, and programs. Codes follow these rules:

- Start with a letter
- Contain letters, digits, and underscores
- No spaces (use underscores instead)
- Case-insensitive — `sat_math` and `SAT_MATH` are the same code (normalized to uppercase)

**Legal codes:** `SAT_MATH`, `JUNIOR_STANDING`, `CLINICAL_HOURS`, `ACT`, `WI`, `AP_CALC_AB`, `GPA_CHECK`

**Illegal:** `3RD_YEAR` (starts with digit), `SAT MATH` (contains space), `"SAT_MATH"` (quoted)

Codes are short, machine-friendly identifiers. Your institution's catalog maps each code to a full display name and description — for example, the code `SAT_MATH` maps to "SAT Math" in the catalog UI. This separation keeps the requirement language simple while allowing rich display names.

## Score — Test Score Requirements

Many institutions use test scores as prerequisites or placement criteria. The `score` construct specifies a test code and a minimum threshold:

```
score SAT_MATH >= 580
```

"The student must have an SAT Math score of 580 or higher."

The test name is an unquoted code:

```
score ACT_COMPOSITE >= 26
score ACCUPLACER_QUANT_REASONING >= 258
score ACCUPLACER_ADV_ALG >= 260
score AP_CALCULUS_AB >= 3
score IB_MATHEMATICS >= 5
```

### Score Operators

Score supports all comparison operators, and values can be integers or decimals:

```
score SAT_MATH >= 580        # 580 or higher
score SAT_MATH > 500         # Above 500
score SAT_MATH <= 700        # 700 or lower
score GRE_VERBAL >= 155      # Graduate exam threshold
score AP_CALCULUS_AB >= 3.5   # Decimal threshold
```

### Test Scores as Prerequisite Alternatives

The most common pattern is offering test scores as alternatives to course prerequisites:

```
any of (
  MATH 110 with grade >= "D",
  score ACCUPLACER_ADV_ALG >= 280
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
  score SAT_MATH >= 580,
  score ACCUPLACER_QUANT_REASONING >= 258,
  score ACCUPLACER_ADV_ALG >= 260,
  score ACT_COMPOSITE >= 26
)
```

"Any one of these math courses (with a D or better), or any one of these test scores." This is a real pattern from a Computer Science I prerequisite — the institution accepts multiple paths to demonstrate math readiness.

## Attainment — Yes/No Achievements

An `attainment` is a binary requirement — the student either has it or doesn't. There's no score or quantity, just a status:

```
attainment JUNIOR_STANDING
```

"The student must have achieved Junior Standing."

More examples:

```
attainment DEPARTMENT_APPROVAL
attainment PRAXIS_EXAM
attainment BACKGROUND_CHECK
attainment PORTFOLIO_REVIEW
attainment ADVISOR_SIGNATURE
```

### Using Attainments

Attainments appear naturally within larger requirements:

```
all of (
  attainment JUNIOR_STANDING,
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
  attainment OVERALL_GPA_2_0,
  attainment RESIDENCY_REQUIREMENT
)
```

### Overall GPA as an Attainment

As mentioned in [Chapter 8](08-grade-and-gpa.md), overall transcript GPA — the average across *all* courses, not just those in a requirement — is best modeled as an attainment:

```
attainment OVERALL_GPA_2_0
```

This is because Reqit's `with gpa >= 2.0` is scoped to the courses in the requirement it wraps. An overall GPA involves every course on the transcript, which is outside any single requirement's scope.

## Quantity — Measurable Milestones

A `quantity` requirement checks a numeric value against a threshold:

```
quantity CLINICAL_HOURS >= 500
```

"The student must have accumulated at least 500 clinical hours."

Like scores, quantities support all comparison operators and decimal values:

```
quantity CLINICAL_HOURS >= 500
quantity RESEARCH_CREDITS >= 6
quantity COMMUNITY_SERVICE_HOURS >= 40
quantity PRACTICUM_DAYS >= 30
quantity LAB_HOURS >= 2.5
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
    score ACCUPLACER_ADV_ALG >= 280
  ),

  # Standing requirement
  attainment SOPHOMORE_STANDING,

  # Previous coursework
  CMPS 148
)
```

"To enroll, the student needs: calculus (via course or test), Sophomore Standing, and CMPS 148."

## Summary

| Construct | Meaning | Example |
|---|---|---|
| `score CODE >= N` | Test score threshold | `score SAT_MATH >= 580` |
| `attainment CODE` | Binary achievement | `attainment JUNIOR_STANDING` |
| `quantity CODE >= N` | Cumulative quantity threshold | `quantity CLINICAL_HOURS >= 500` |

All three support being nested inside `all of`, `any of`, `at least N of`, and other combinations — they're full requirement expressions, just like course references and filters.

---

[Next: Group Requirements →](11-group-requirements.md)
