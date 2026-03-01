# Introduction

[← Table of Contents](README.md) | [Next: Courses →](02-courses.md)

---

## What Reqit Does

Every institution has academic requirements. Prerequisites, corequisites, major requirements, general education distribution rules, graduation credit minimums, GPA thresholds — these requirements live in the catalog, in advising handbooks, in DegreeWorks scripts, in spreadsheets, and sometimes only in a registrar's head.

Reqit gives you a single, clear language for writing all of these requirements. Once a requirement is written in Reqit, it can be used to generate catalog copy, power degree audits, drive what-if analyses, and feed advising tools — all from the same source of truth that you, the registrar, control.

## Why This Matters

Today, requirements are typically scattered across multiple systems:

- **The catalog** describes requirements in prose — accurate for humans but impossible for software to interpret reliably.
- **Degree audit systems** encode requirements in their own scripting languages — powerful for auditing but opaque, fragile, and owned by IT, not by you.
- **Spreadsheets and checklists** track requirements informally — useful for advisors but disconnected from the official catalog and audit system.

When the Computer Science department adds a new 400-level elective, someone updates the catalog, someone else updates the degree audit rules, and someone else updates the advising worksheet. If any of these get out of sync — and they do — students get incorrect audit results and bad advising.

Reqit eliminates this problem. You write the requirement once, in language you can read and understand. Everything else — the catalog display, the audit logic, the advising tools — is derived from what you wrote. When the requirement changes, you change it in one place.

## What Reqit Looks Like

Here's a simple prerequisite. To enroll in Data Structures, a student needs Computer Science I:

```
CMPS 147
```

That's it. A single course reference. Most prerequisites are this simple.

Here's something a little more complex — a math requirement where students can choose between two calculus sequences:

```
any of (
  MATH 170,
  all of (MATH 106, MATH 166)
)
```

This reads naturally: "any of these options — either MATH 170, or all of MATH 106 and MATH 166."

And here's a real program requirement — the elective portion of a Computer Science major:

```
at least 7 of (
  CMPS 240, CMPS 285, CMPS 305, CMPS 310, CMPS 315,
  CMPS 320, CMPS 327, CMPS 331, CMPS 342, CMPS 345,
  CMPS 350, CMPS 357, CMPS 364, CMPS 367, CMPS 369,
  CMPS 370, CMPS 373, CMPS 375, DATA 301
)
```

"At least 7 of" these 19 courses. A student picks any 7 (or more) from the list.

## Your First Requirement

Let's write a complete major requirement step by step. Suppose your Computer Science major requires:

- A set of core courses that every student must complete
- At least 4 electives chosen from upper-level CS courses
- A two-semester calculus sequence

In Reqit:

```
all of (
  # Core courses — every student takes these
  CMPS 130,
  CMPS 230,
  CMPS 340,
  CMPS 360,
  CMPS 380,
  CMPS 490,

  # Electives — pick at least 4 from 300-level courses
  at least 4 of (
    courses where subject = "CMPS" and number >= 300
  ),

  # Math — both semesters required
  MATH 151,
  MATH 152
)
```

The `all of (...)` wrapper means every item inside must be satisfied. Items are separated by commas. The `#` symbol starts a comment — everything after it on that line is ignored, so you can annotate your requirements for clarity.

Don't worry about understanding every piece of this yet. The rest of this guide will walk through each construct in detail, with plenty of examples.

## How This Guide Is Organized

Each chapter introduces one concept, explains it in plain language, and shows multiple real-world examples. The chapters build on each other:

- **Chapters 2–7** cover the foundations: courses, combinations, filters, credits, and exclusions
- **Chapters 8–10** add conditions: grades, GPA requirements, and non-course requirements like test scores
- **Chapters 11–13** introduce organization tools: variables and scopes for managing complex programs
- **Chapters 14–15** cover specialized constructs for prerequisites, program references, and overlap rules
- **Chapters 16–20** provide formatting guidance, complete examples, troubleshooting, and reference material

You can read straight through, or jump to the chapter that addresses what you need right now. If you're writing a simple prerequisite, you may only need Chapters 2–3. If you're encoding an entire degree program with general education requirements, you'll want to work through the full guide.

---

[Next: Courses →](02-courses.md)
