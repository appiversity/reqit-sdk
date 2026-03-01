# Scopes

[← Variables](12-variables.md) | [Table of Contents](README.md) | [Next: Prerequisites and Corequisites →](14-prerequisites-and-corequisites.md)

---

When your institution has many programs — each with its own variables — you need a way to keep variable names from colliding. The Computer Science major and the Mathematics major might both define a variable called `$core`, but they mean different things. **Scopes** solve this problem.

## The Problem: Name Collisions

Imagine two programs:

```
# Computer Science major
$core = all of (CMPS 130, CMPS 230, CMPS 340, CMPS 490)
$electives = at least 4 of (courses where subject = "CMPS" and number >= 300)

# Mathematics major
$core = all of (MATH 151, MATH 152, MATH 250, MATH 350)
$electives = at least 3 of (courses where subject = "MATH" and number >= 300)
```

Both define `$core` and `$electives`. Which `$core` does `$core` refer to? Scopes make it unambiguous.

## Scope Blocks

A scope block wraps a program's variables and body expression in a named container:

```
scope "cmps-major" {
  $core = all of (CMPS 130, CMPS 230, CMPS 340, CMPS 490)
  $electives = at least 4 of (
    courses where subject = "CMPS" and number >= 300
  )

  all of ($core, $electives)
}
```

The scope name is in quotes — `"cmps-major"`. All variable definitions inside the block belong to this scope. The last expression in the block (here, `all of ($core, $electives)`) is the body — the actual requirement.

### Scope Names

Scope names are typically derived from the program code and type. The convention is `lowercase(code)-type`:

| Program | Code | Type | Scope Name |
|---|---|---|---|
| Computer Science major | CMPS | major | `cmps-major` |
| Computer Science minor | CMPS | minor | `cmps-minor` |
| Accounting major | ACCT | major | `acct-major` |
| Data Science certificate | DATA | certificate | `data-certificate` |

Scope names can contain letters, digits, hyphens, and underscores.

## Variable Resolution Inside a Scope

Inside a scope block, `$core` refers to the `core` variable defined in *that scope*:

```
scope "cmps-major" {
  $core = all of (CMPS 130, CMPS 230)     # This $core
  all of ($core)                            # References the line above
}
```

There's no ambiguity — variables are local to their scope first.

## Cross-Scope References

To reference a variable from another scope, use the dot-qualified syntax: `$scope.name`:

```
scope "acct-major" {
  $core = all of (ACCT 201, ACCT 202, ACCT 301, ACCT 302)

  # Reference a variable from the institution scope
  all of ($core, $rcnj.asb_core)
}
```

Here, `$rcnj.asb_core` means "the `asb_core` variable from the `rcnj` scope." The `$core` reference (without a scope prefix) resolves locally.

### When You'd Use Cross-Scope References

Cross-scope references are useful when:

- An institution defines shared requirement groups that multiple programs reference
- One program needs to reference another program's variables (for overlap rules, for example)

```
scope "math-minor" {
  $core = all of (MATH 151, MATH 152, MATH 250)

  # Include the CS major's electives in this requirement
  all of ($core, $cmps-major.electives)
}
```

In practice, cross-scope references are uncommon. Most sharing happens through institution-level variables.

## Institution Scope

The institution scope holds variables that are shared across all programs. Think of it as the "global" level:

```
scope "rcnj" {
  $asb_core = all of (BADM 110, BADM 225, INFO 224, MGMT 201, MKTG 200)
  $hgs_language = at least 2 of (courses where attribute = "HGS-LANG")
}
```

Any program at the institution can reference these:

```
scope "acct-major" {
  $core = all of (ACCT 201, ACCT 202)
  all of ($core, $rcnj.asb_core)     # Uses the institution-wide business core
}

scope "mktg-major" {
  $core = all of (MKTG 200, MKTG 300)
  all of ($core, $rcnj.asb_core)     # Same institution-wide business core
}
```

Both programs share the same `$rcnj.asb_core` definition. If the business core changes, you update it in one place.

## Variable Resolution Order

When you write `$core` (without a scope prefix), Reqit looks for it in this order:

1. **Current scope** — the scope block you're inside
2. **Institution scope** — the institution-level variables
3. **Error** — if not found in either, it's an error

This means you can reference institution-wide variables without the scope prefix, as long as there's no local variable with the same name:

```
scope "rcnj" {
  $gen_ed = all of (...)     # Institution-wide gen-ed
}

scope "cmps-major" {
  all of ($core, $gen_ed)    # $gen_ed found in institution scope
}
```

But if the local scope also defines `$gen_ed`, the local one wins:

```
scope "cmps-major" {
  $gen_ed = all of (...)     # Local override
  all of ($core, $gen_ed)    # Uses the LOCAL $gen_ed, not institution's
}
```

To explicitly reference the institution's version, use the qualified form: `$rcnj.gen_ed`.

## Scopes Are Optional

For simple requirements that don't use variables — most course prerequisites, for example — you don't need a scope block:

```
all of (CMPS 230, MATH 250)
```

This is a perfectly valid requirement with no scope and no variables.

Scope blocks become important when you're writing program-level requirements with multiple named sections. For a simple prerequisite, just write the expression directly.

## A Complete Example

Here's how a full program might look with scopes and variables:

```
scope "cmps-major" {
  # Core courses
  $core = all of (
    CMPS 147,           # CS I
    CMPS 148,           # CS II
    CMPS 231,           # Data Structures
    CMPS 311,           # Operating Systems
    CMPS 361,           # Software Design
    CMPS 366,           # Programming Languages
    CMPS 450            # Senior Project
  )

  # Required math
  $math = all of (
    MATH 121,           # Calculus I
    MATH 122            # Calculus II
  )

  # Electives — 7 from the approved list
  $electives = at least 7 of (
    CMPS 240, CMPS 285, CMPS 305, CMPS 310, CMPS 315,
    CMPS 320, CMPS 327, CMPS 331, CMPS 342, CMPS 345,
    CMPS 350, CMPS 357, CMPS 364, CMPS 367, CMPS 369,
    CMPS 370, CMPS 373, CMPS 375, DATA 301
  )

  # Full program requirement
  all of (
    $core with gpa >= 2.0,
    $math,
    $electives,
    at least 128 credits from (courses where subject = "*")
  ) with gpa >= 2.0
}
```

## Summary

| Construct | Meaning | Example |
|---|---|---|
| `scope "name" { ... }` | Named container for variables | `scope "cmps-major" { ... }` |
| `$name` | Resolves locally, then institution | `$core` |
| `$scope.name` | Explicitly targets a scope | `$rcnj.asb_core` |

Scopes keep variables organized when multiple programs define similarly-named sections. For simple requirements, they're optional.

---

[Next: Prerequisites and Corequisites →](14-prerequisites-and-corequisites.md)
