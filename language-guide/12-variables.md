# Variables

[← Group Requirements](11-group-requirements.md) | [Table of Contents](README.md) | [Next: Scopes →](13-scopes.md)

---

As requirements grow more complex, you'll want to name parts of them for clarity and reuse. Reqit **variables** let you define a sub-expression once and reference it by name.

## Defining a Variable

A variable definition starts with `$`, followed by a name, an equals sign, and the expression it represents:

```
$core = all of (CMPS 130, CMPS 230, CMPS 340, CMPS 490)
```

This defines a variable named `core` whose value is the `all of` expression. The `$` prefix marks it as a variable.

### Variable Names

Variable names can contain letters, digits, and underscores. They must start with a letter or underscore:

| Valid | Invalid |
|---|---|
| `$core` | `$123` (starts with digit) |
| `$math_core` | `$core math` (no spaces) |
| `$cs_electives` | (bare `$` with nothing after it) |
| `$pool2` | |
| `$_private` | |

## Referencing a Variable

Use the variable name with `$` to reference it:

```
$core
```

This is a complete expression that means "the requirement defined by the `core` variable." Use variable references inside other expressions:

```
all of ($core, $math, $electives)
```

"Satisfy the core requirement, the math requirement, and the electives requirement."

## Why Use Variables

### 1. Readability

Without variables, a complex program requirement is a deeply nested expression that's hard to follow. With variables, you can break it into named pieces:

**Without variables** (hard to read):

```
all of (
  all of (CMPS 130, CMPS 230, CMPS 340, CMPS 360, CMPS 380, CMPS 490),
  all of (MATH 151, MATH 152, MATH 250, any of (MATH 280, MATH 285)),
  at least 4 of (courses where subject = "CMPS" and number >= 300) except (CMPS 490),
  at least 2 of (courses where attribute = "LAB-SCI"),
  one from each of (
    courses where attribute = "HUM",
    courses where attribute = "SCI",
    courses where attribute = "SS",
    courses where attribute = "FA",
    courses where attribute = "WI"
  ),
  at least 120 credits from (courses where subject = "*")
)
```

**With variables** (much clearer):

```
$core = all of (
  CMPS 130, CMPS 230, CMPS 340,
  CMPS 360, CMPS 380, CMPS 490
)

$math = all of (
  MATH 151, MATH 152, MATH 250,
  any of (MATH 280, MATH 285)
)

$cs_electives = at least 4 of (
  courses where subject = "CMPS" and number >= 300
) except (CMPS 490)

$science = at least 2 of (
  courses where attribute = "LAB-SCI"
)

$gen_ed = one from each of (
  courses where attribute = "HUM",
  courses where attribute = "SCI",
  courses where attribute = "SS",
  courses where attribute = "FA",
  courses where attribute = "WI"
)

$total_credits = at least 120 credits from (
  courses where subject = "*"
)

all of (
  $core,
  $math,
  $cs_electives,
  $science,
  $gen_ed,
  $total_credits
)
```

Both versions describe exactly the same requirement. The second is vastly easier to understand and maintain.

### 2. Reuse

A variable defined once can be referenced in multiple places:

```
$cs_core = all of (
  CMPS 147, CMPS 148, CMPS 231,
  CMPS 311, CMPS 361, CMPS 366, CMPS 450
)

# The core itself requires a 2.0 GPA
$cs_core with gpa >= 2.0

# The core also appears in the overall degree
all of ($cs_core, $math, $electives) with gpa >= 2.0
```

### 3. Modifiers on Named Groups

You can apply modifiers to variables:

```
$core with grade >= "C"              # Minimum grade on all core courses
$electives except (CMPS 490)         # Electives minus one course
$core with gpa >= 2.0                # GPA requirement on the core
```

## Variables with Different Expression Types

Variables can hold any Reqit expression:

```
# A single course
$capstone = CMPS 490

# An any-of choice
$discrete = any of (CSCI 140, MATH 212)

# A counted selection
$electives = at least 4 of (
  courses where subject = "CMPS" and number >= 300
)

# A credit requirement
$total = at least 120 credits from (
  courses where subject = "*"
)

# A course filter
$upper_cs = courses where subject = "CMPS" and number >= 300

# Another variable
$upper = $core
```

## Variables Referencing Other Variables

Variables can reference other variables:

```
$math_core = all of (
  any of (MATH 021, MATH 031, MATH 076),
  MATH 022,
  any of (MATH 205, MATH 241, MATH 242)
)

$cs_core = all of (
  CMPS 130, CMPS 230, CMPS 490
)

# This variable references the two above
$degree = all of ($math_core, $cs_core)
```

A variable must be defined before it's referenced — you can't use `$core` before the `$core = ...` definition.

## Real-World Examples

### CS Major with Named Components

```
$core = all of (
  CMPS 147,           # CS I
  CMPS 148,           # CS II
  CMPS 220,           # Assembly Language
  CMPS 231,           # Data Structures
  CMPS 311,           # Operating Systems
  CMPS 361,           # Software Design
  CMPS 366,           # Programming Languages
  CMPS 450            # Senior Project
)

$math_required = all of (
  MATH 121,           # Calculus I
  MATH 122            # Calculus II
)

$math_electives = at least 2 of (
  courses where subject = "MATH" and number >= 122
    except (MATH 205, MATH 210, MATH 237)
)

$cs_electives = at least 7 of (
  CMPS 240, CMPS 285, CMPS 305, CMPS 310, CMPS 315,
  CMPS 320, CMPS 327, CMPS 331, CMPS 342, CMPS 345,
  CMPS 350, CMPS 357, CMPS 364, CMPS 367, CMPS 369,
  CMPS 370, CMPS 373, CMPS 375, DATA 301
)

all of (
  $core with gpa >= 2.0,
  $math_required,
  $math_electives,
  $cs_electives,
  at least 128 credits from (courses where subject = "*")
) with gpa >= 2.0
```

### Gen-Ed with Named Areas

```
$first_year = any of (INTD 101, HNRS 101)
$writing = CRWT 102
$arts = any of (AIID 201, HNRS 201)
$social_science = any of (SOSC 110, HNRS 110)

$distribution = at least 2 of (
  at least 1 of (courses where attribute = "GE-CULTURE"),
  at least 1 of (courses where attribute = "GE-VALUES"),
  at least 1 of (courses where attribute = "GE-SYSTEMS")
)

all of (
  $first_year,
  $writing,
  $arts,
  $social_science,
  $distribution
)
```

## Summary

| Construct | Meaning | Example |
|---|---|---|
| `$name = expression` | Define a named sub-expression | `$core = all of (CMPS 130, CMPS 230)` |
| `$name` | Reference a defined variable | `all of ($core, $math)` |

Variables make complex requirements readable and maintainable. Use them whenever a requirement has distinct logical sections — which is almost always for program requirements.

---

[Next: Scopes →](13-scopes.md)
