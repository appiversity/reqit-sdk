# Putting It All Together

[← Comments and Formatting](16-comments-and-formatting.md) | [Table of Contents](README.md) | [Next: Common Mistakes →](18-common-mistakes.md)

---

This chapter presents complete, real-world program requirements that combine everything from the previous chapters. Each example is modeled after actual university programs, showing how the pieces fit together.

## Example 1: B.S. in Computer Science

This is a typical four-year CS program with core courses, required math, electives, and a GPA requirement.

```
scope "cmps-major" {
  # ============================================================
  # B.S. in Computer Science
  # ============================================================

  # --- Core Courses -------------------------------------------
  # Every CS major completes these 8 courses.
  $core = all of (
    CMPS 147,           # Computer Science I (4 cr)
    CMPS 148,           # Computer Science II (4 cr)
    CMPS 220,           # Assembly Language Programming (4 cr)
    CMPS 231,           # Data Structures (4 cr)
    CMPS 311,           # Operating Systems (4 cr)
    CMPS 361,           # Software Design (4 cr)
    CMPS 366,           # Programming Languages (4 cr)
    CMPS 450            # Senior Project (4 cr)
  )

  # --- Required Mathematics -----------------------------------
  $math_required = all of (
    MATH 121,           # Calculus I
    MATH 122            # Calculus II
  )

  # --- Math Electives -----------------------------------------
  # Two additional math courses at 122-level or above.
  # Certain courses that overlap with required math are excluded.
  $math_electives = at least 2 of (
    courses where subject = "MATH" and number >= 122
      except (MATH 205, MATH 210, MATH 237)
  )

  # --- CS Electives -------------------------------------------
  # Seven electives from an approved list spanning CS and Data Science.
  $cs_electives = at least 7 of (
    CMPS 240,           # Data Analytics in Python
    CMPS 285,           # Mobile Development
    CMPS 305,           # Cyber Security
    CMPS 310,           # Big Data Programming
    CMPS 315,           # The UNIX Environment
    CMPS 320,           # Machine Learning
    CMPS 327,           # Network Programming
    CMPS 331,           # Artificial Intelligence
    CMPS 342,           # Computer Graphics
    CMPS 345,           # Analysis of Algorithms
    CMPS 350,           # Financial Modeling
    CMPS 357,           # The .NET Environment
    CMPS 364,           # Database Design
    CMPS 367,           # Advanced Topics
    CMPS 369,           # Web Application Development
    CMPS 370,           # Cyber and Network Defense
    CMPS 373,           # Object Oriented Programming
    CMPS 375,           # Mobile Robotics
    DATA 301            # Data Analysis & Visualization
  )

  # --- Full Degree Requirement --------------------------------
  all of (
    $core with gpa >= 2.0,       # Core GPA must be 2.0+
    $math_required,
    $math_electives,
    $cs_electives,
    at least 128 credits from (  # Total credit minimum
      courses where subject = "*"
    )
  ) with gpa >= 2.0              # Overall major GPA 2.0+
}
```

**Constructs used:** scope, variables, all of, at least N of, courses where (subject, number), except, with gpa, credits from, comments

## Example 2: General Education Requirements

A comprehensive gen-ed program with keystones, distribution areas, and flexible electives.

```
scope "gen-ed" {
  # ============================================================
  # General Education Requirements
  # ============================================================

  # --- Keystone Courses ---------------------------------------
  # Every student takes these foundation courses (or honors equivalents).

  $first_year_seminar = any of (
    INTD 101,           # First Year Seminar
    HNRS 101            # Honors First Year Seminar
  )

  $critical_writing = CRWT 102          # Critical Reading and Writing II

  $arts_humanities = any of (
    AIID 201,           # Studies in the Arts & Humanities
    HNRS 201            # Honors Studies in the Arts & Humanities
  )

  $social_science = any of (
    SOSC 110,           # Social Science Inquiry
    HNRS 110            # Honors Social Science Inquiry
  )

  # --- Category Requirements ---------------------------------
  # One course from each of four knowledge areas.

  $historical = at least 1 of (
    courses where attribute = "GE-HIST"
  )

  $global = at least 1 of (
    courses where attribute = "GE-GLOBAL"
  )

  $quantitative = at least 1 of (
    courses where attribute = "GE-QUANT"
  )

  $scientific = at least 1 of (
    courses where attribute = "GE-SCI"
  )

  # --- Distribution -------------------------------------------
  # Take courses from at least 2 of these 3 categories.

  $distribution = at least 2 of (
    at least 1 of (courses where attribute = "GE-CULTURE"),
    at least 1 of (courses where attribute = "GE-VALUES"),
    at least 1 of (courses where attribute = "GE-SYSTEMS")
  )

  # --- Full Gen-Ed Requirement --------------------------------
  all of (
    $first_year_seminar,         # Keystone 1
    $critical_writing,           # Keystone 2
    $arts_humanities,            # Keystone 3
    $social_science,             # Keystone 4
    $historical,                 # Category 1
    $global,                     # Category 2
    $quantitative,               # Category 3
    $scientific,                 # Category 4
    $distribution                # Distribution: 2 of 3
  )
}
```

**Constructs used:** scope, variables, any of, all of, at least N of (as both selection and distribution), courses where (attribute), comments

## Example 3: CS Program with Concentrations

A major where students choose a concentration track.

```
scope "csci-major" {
  # ============================================================
  # B.S. in Computer Science with Concentrations
  # ============================================================

  # --- Core ---------------------------------------------------
  $core = all of (
    CSCI 141,           # Introduction to Programming (4 cr)
    CSCI 241,           # Data Structures
    any of (CSCI 243, MATH 214),   # Discrete Structures
    CSCI 301,           # Software Development
    CSCI 303,           # Algorithms
    CSCI 304,           # Computer Organization
    CSCI 312,           # Programming Languages
    CSCI 423            # Theory of Computation
  )

  # --- Concentration: General ---------------------------------
  $general = at least 12 credits from (
    courses where subject = "CSCI" and number >= 300
      except (CSCI 320, CSCI 430, CSCI 498)
  )

  # --- Concentration: AI/Machine Learning ---------------------
  $aiml_proficiency = any of (
    MATH 351,           # Probability and Statistics
    MATH 451            # Probability
  )

  $aiml_electives = at least 12 credits from (
    CSCI 416, CSCI 421, CSCI 436, CSCI 446,
    CSCI 455, CSCI 456, DATA 441
  )

  $aiml = all of ($aiml_proficiency, $aiml_electives)

  # --- Concentration: Cybersecurity ---------------------------
  $cyber_required = all of (
    CSCI 444,           # Operating Systems
    CSCI 454,           # Computer and Network Security
    CSCI 464            # Applied Cybersecurity
  )

  $cyber_elective = at least 3 credits from (
    CSCI 415, CSCI 434, CSCI 445
  )

  $cyber = all of ($cyber_required, $cyber_elective)

  # --- Concentration Selection --------------------------------
  # Student chooses one concentration track.
  $concentration = any of (
    $general,
    $aiml,
    $cyber
  )

  # --- Mathematics Proficiency --------------------------------
  $math = all of (
    MATH 111,           # Calculus I
    MATH 112,           # Calculus II
    any of (MATH 211, MATH 213)   # Linear Algebra
  )

  # --- Full Major Requirement --------------------------------
  all of (
    $core,
    $math,
    $concentration
  ) with gpa >= 2.0
}
```

**Constructs used:** scope, variables, all of, any of (for choices and concentration selection), at least N credits from, except, with gpa, courses where (subject, number)

## Example 4: Course Prerequisite with Test Score Alternatives

A course that accepts multiple prerequisite paths including test scores.

```
# ============================================================
# CMPS 147 — Computer Science I
# Prerequisites
# ============================================================

any of (
  # Course prerequisites — any of these math courses with D or better
  MATH 022 with grade >= "D",       # Transitional Mathematics
  MATH 024 with grade >= "D",       # Elementary Algebra Topics
  MATH 101 with grade >= "D",       # Math with Applications
  MATH 104 with grade >= "D",       # Math for the Modern World
  MATH 108 with grade >= "D",       # Probability and Statistics
  MATH 110 with grade >= "D",       # Precalculus
  MATH 121 with grade >= "D",       # Calculus I

  # Test score alternatives
  score SAT_MATH >= 580,
  score ACCUPLACER_QUANT_REASONING >= 258,
  score ACCUPLACER_ADV_ALG >= 260,
  score ACT_COMPOSITE >= 26
)
```

**Constructs used:** any of, with grade, score, comments. No scope needed — this is a simple prerequisite.

## Example 5: Degree with Gen-Ed, Major, and Graduation Requirements

A complete degree requirement combining major, general education, and graduation-level constraints.

```
scope "bs-cmps" {
  # ============================================================
  # B.S. in Computer Science — Full Degree
  # ============================================================

  # --- Graduation Requirements --------------------------------
  $total_credits = at least 128 credits from (
    courses where subject = "*"
  )

  # --- Full Degree --------------------------------------------
  all of (
    $cmps-major.core with gpa >= 2.0,   # CS major core
    $cmps-major.math_required,            # Required math
    $cmps-major.math_electives,           # Math electives
    $cmps-major.cs_electives,             # CS electives
    $gen-ed.first_year_seminar,           # Gen-ed keystones
    $gen-ed.critical_writing,
    $gen-ed.arts_humanities,
    $gen-ed.social_science,
    $gen-ed.historical,
    $gen-ed.global,
    $gen-ed.quantitative,
    $gen-ed.scientific,
    $gen-ed.distribution,
    $total_credits,
    attainment OVERALL_GPA_2_0
  )
}

# Overlap policies
overlap between ($gen-ed, $cmps-major) at most 3 courses
outside (primary major) at least 72 credits
```

**Constructs used:** scope, cross-scope references ($scope.name), variables, all of, credits from, attainment, overlap between, outside, with gpa

## Example 6: Program with Post-Selection Constraints

A Political Science major where elective selection has composition requirements.

```
scope "poli-major" {
  # ============================================================
  # B.A. in Political Science
  # ============================================================

  $core = all of (
    POLI 101,           # American Government
    POLI 102,           # Comparative Government
    POLI 200,           # Research Methods
    POLI 490            # Senior Seminar
  )

  # Elective pool — 5 courses, but at least 3 must be POLI
  # and at most 1 may be below 300-level.
  $electives = at least 5 of (
    POLI 215, POLI 301, POLI 309, POLI 315,
    AFST 208, HIST 251, SOCI 221, SOCI 345,
    ECON 201, PSYC 218
  )
    where at least 3 match (subject = "POLI")
    where at most 1 match (number < 300)

  all of ($core, $electives)
}
```

**Constructs used:** scope, variables, all of, at least N of, where ... match (post-selection constraints)

## Building Your Own Requirements

When writing a new program requirement:

1. **Start with the pieces.** Identify the logical sections: core, electives, math, gen-ed, etc.
2. **Name each piece** with a variable: `$core`, `$electives`, `$math`.
3. **Write each piece** using the simplest construct that fits: `all of` for required lists, `at least N of` for elective pools, `courses where` for filtered pools, `credits from` for credit-counted pools.
4. **Combine** the pieces in a final `all of` at the end.
5. **Add constraints** where needed: `with grade >= "C"`, `with gpa >= 2.0`, `except (...)`.
6. **Comment liberally** — course titles, section labels, decision notes.
7. **Wrap in a scope** if you're writing a program-level requirement with variables.

The result should read like a structured English description of the requirement. If a colleague can read your Reqit and understand the requirement without additional explanation, you've written it well.

---

[Next: Common Mistakes →](18-common-mistakes.md)
