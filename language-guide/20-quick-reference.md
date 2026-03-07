# Quick Reference Card

[← Glossary](19-glossary.md) | [Table of Contents](README.md)

---

Every Reqit construct on one page.

## Course References

```
MATH 151                              # Specific course
CHEM 101A                             # Course with letter suffix
CSCI 220.2                            # Course with decimal number
```

## Combinations

```
all of (A, B, C)                      # Every item required
any of (A, B, C)                      # At least one required
none of (A, B, C)                     # None may be completed
```

## Counted Requirements

```
at least 3 of (A, B, C, D, E)        # 3 or more
at most 2 of (A, B, C)               # No more than 2
exactly 2 of (A, B, C, D)            # Precisely 2
```

## Course Filters

```
courses where subject = "CMPS"                       # By department
courses where number >= 300                           # By number (numeric)
courses where attribute = "WI"                        # By attribute
courses where credits >= 4                            # By credits
courses where subject = "CMPS" and number >= 300      # Combined
courses where subject in ("CSCI", "MATH")             # Multiple values
courses where subject not in ("PHYS", "CHEM")         # Exclude values
courses where subject != "PHYS"                       # Not equal
courses where subject = "*"                           # All courses
```

**Comparison operators:** `=`, `!=`, `>`, `>=`, `<`, `<=`, `in`, `not in`

**Filter fields:** `subject`, `number`, `attribute`, `credits`

## Credit Requirements

```
at least 12 credits from (...)        # 12+ credits
at most 6 credits from (...)          # No more than 6 credits
exactly 12 credits from (...)         # Precisely 12 credits
```

## Exclusions

```
... except (CMPS 490, CMPS 491)       # Remove from pool
none of (CMPS 490, CMPS 491)          # Prohibition
```

## Grade and GPA Constraints

```
MATH 151 with grade >= "C"            # Minimum grade
all of (...) with grade >= "C-"       # Grade on a group
all of (...) with gpa >= 2.0          # GPA on a group
```

## Post-Selection Constraints

```
at least 5 of (...) where at least 3 match (subject = "POLI")
at least 4 of (...) where at most 1 match (number < 300)
at least 4 of (...) where exactly 2 match (number >= 400)
```

## Non-Course Requirements

```
score SAT_MATH >= 580                 # Test score
attainment JUNIOR_STANDING            # Yes/no achievement
quantity CLINICAL_HOURS >= 500        # Measurable quantity
```

## Group Requirements

```
one from each of (                    # One from every group
  courses where attribute = "HUM",
  courses where attribute = "SCI",
  courses where attribute = "SS"
)

from at least 3 of (                  # Courses from N+ groups
  courses where attribute = "HUM",
  courses where attribute = "SCI",
  courses where attribute = "SS",
  courses where attribute = "FA",
  courses where attribute = "QR"
)
```

## Variables

```
$core = all of (CMPS 130, CMPS 230)   # Define
$core                                  # Reference
$core with grade >= "C"                # Reference with modifier
```

## Scopes

```
scope "cmps-major" {                   # Named scope
  $core = all of (...)
  all of ($core)
}

$cmps-major.core                       # Cross-scope reference
```

## Prerequisite Features

```
CMPS 230 (concurrent)                 # May co-enroll
courses where prerequisite includes (MATH 151)
courses where corequisite includes (ENGL 201)
```

## Labels

```
"Core Courses": all of (CMPS 130, CMPS 230)    # Named section
"Electives": at least 3 of (...)                # Named section
```

## Program References

```
program CS major undergraduate                  # By code, type, and level
program DATA_SCIENCE certificate graduate
program "CMPS-BS"                               # By quoted catalog code
any program major undergraduate
any program minor undergraduate
```

## Program Filters

```
all programs where type = "major"                           # Every matching program
any program where level = "undergraduate"                   # At least one
at least 2 programs where type = "major"                    # 2 or more
at most 1 programs where type = "concentration"             # No more than 1
all programs where type = "minor" and level = "undergraduate"  # Combined conditions
```

**Program filter fields:** `type`, `level`, `code`

## Program Context References

```
primary major                          # Student's declared major
primary minor                          # Student's declared minor
```

## Overlap Rules

```
overlap between ($gen_ed, primary major) at most 3 courses
overlap between ($minor, primary major) at most 50 %
overlap between ($a, $b) at most 6 credits
outside (primary major) at least 72 credits
```

## Comments

```
# Full-line comment
MATH 151  # Inline comment
```

## Formatting Rules

- **Case insensitive:** keywords, subject codes, course numbers, filter fields, codes (score/attainment/quantity/program)
- **Case sensitive:** quoted strings, variable names
- **Whitespace:** flexible — spaces, tabs, newlines between tokens
- **Commas:** required between list items; no trailing comma
- **Quotes:** double quotes for string values

---

[← Glossary](19-glossary.md) | [Table of Contents](README.md)
