# Glossary

[← Common Mistakes](18-common-mistakes.md) | [Table of Contents](README.md) | [Next: Quick Reference Card →](20-quick-reference.md)

---

Plain-English definitions of every term used in the Reqit language. Terms are listed alphabetically.

---

**All of**
A combination that requires every item in the list to be satisfied. "All of A, B, and C" means the student must complete A and B and C.

**Any of**
A combination that requires at least one item in the list to be satisfied. "Any of A, B, or C" means the student must complete at least one of A, B, or C. Equivalent to `at least 1 of`.

**At least N of**
A counted requirement that requires the student to satisfy N or more items from a list. "At least 3 of these 5 courses" means pick 3 or more.

**At most N of**
A counted requirement that limits how many items from a list can count. "At most 2 of these courses" means no more than 2 may be used.

**Attainment**
A yes-or-no achievement that isn't a course or a test score. Examples: Junior Standing, Department Approval, Background Check, Praxis Exam. Written as `attainment CODE` (e.g., `attainment JUNIOR_STANDING`).

**Attribute**
A label assigned to a course by your institution. Attributes categorize courses — for example, Writing Intensive (WI), Lab Science (LAB-SCI), or a general education area code (GE-HUM). Used in filters: `courses where attribute = "WI"`.

**Comment**
Text after a `#` symbol that is ignored by Reqit. Used to annotate requirements with course titles, explanations, or notes. Example: `MATH 151  # Calculus I`.

**Code**
An unquoted identifier used to name scores, attainments, quantities, and programs. Starts with a letter, contains letters, digits, and underscores. Case-insensitive, normalized to uppercase. Example: `SAT_MATH`, `JUNIOR_STANDING`, `CS`.

**Concurrent**
A modifier on a course reference indicating that the course may be taken in the same term rather than strictly before. Written as `CMPS 230 (concurrent)`. Only meaningful in prerequisite contexts.

**Corequisite**
A course that must be taken in the same term as another course (not before, not after). Distinct from a prerequisite and from "concurrent."

**Corequisite includes**
A filter that finds courses whose corequisite tree contains a specific course. Written as `courses where corequisite includes (MATH 151)`.

**Course filter**
An expression that describes courses by their properties rather than listing them by name. Written as `courses where ...` followed by one or more conditions. Example: `courses where subject = "CMPS" and number >= 300`.

**Course reference**
A specific course identified by subject code and number. Example: `MATH 151`. The most basic building block in Reqit.

**Credits from**
A requirement that counts credits rather than courses. "At least 12 credits from" means the student needs enough courses to accumulate 12 or more credits. Written as `at least N credits from (...)`.

**Cross-scope reference**
A variable reference that explicitly names the scope it comes from, using dot notation. Written as `$scope.name`. Example: `$rcnj.asb_core` references the `asb_core` variable from the `rcnj` scope.

**Exactly N of**
A counted requirement that requires the student to satisfy precisely N items — no more, no fewer. "Exactly 2 of these 4 courses" means take exactly 2.

**Except**
A modifier that removes specific courses from a pool. Written as `... except (CMPS 490)`. The excluded courses cannot satisfy the requirement.

**Expression**
Any complete Reqit construct — a course reference, a combination, a filter, a variable reference, or any other construct. Expressions can be nested inside other expressions.

**Filter field**
A property of a course that can be used in a filter condition. The four filter fields are: `subject` (department code), `number` (course number), `attribute` (course attribute code), and `credits` (credit value).

**From at least N of**
A distribution requirement where the student must take courses from at least N of the listed groups. "From at least 3 of these 5 areas" means the student must have at least one course in at least 3 different areas.

**GPA**
Grade Point Average. In Reqit, `with gpa >= 2.0` means the average grade across the courses matched by the requirement must be at least 2.0. The GPA is always scoped to the courses in the requirement, not the entire transcript.

**Grade**
A letter grade or equivalent mark assigned to a completed course. In Reqit, `with grade >= "C"` means the student must earn a C or better. Grade values are configured per institution.

**In**
A comparison operator that matches a field against multiple values. Written as `subject in ("CSCI", "MATH", "DATA")`. Matches if the field equals any of the listed values.

**Label**
A display name attached to a composite expression using the syntax `"label": composite`. Labels give human-readable names to sections of a requirement tree. Example: `"Core Courses": all of (CMPS 130, CMPS 230)`. Labels appear in rendered output (outlines, HTML) as section headings.

**Institution scope**
A scope that holds variables shared across all programs at an institution. Variables defined here are accessible from any program scope without a qualified reference.

**None of**
A prohibition that requires the student to *not* have completed any of the listed items. "None of A, B, C" means the student must not have completed A, B, or C.

**Not in**
A comparison operator that excludes multiple values. Written as `subject not in ("PHYS", "CHEM")`. Matches if the field does *not* equal any of the listed values.

**One from each of**
A distribution requirement where the student must take at least one course from every group in the list. "One from each of Humanities, Science, Social Science" means one course in each area.

**Outside**
A constraint on credits that come from courses *not* counted toward a specific program. Written as `outside (primary major) at least 72 credits`. Ensures breadth in the student's overall program.

**Overlap**
A rule limiting how many courses (or credits, or percentage) can count toward two different programs simultaneously. Written as `overlap between (A, B) at most N unit`.

**Post-selection constraint**
A `where` clause that constrains the composition of a selection. Written as `where at least N match (filter)` after a counted requirement. Constrains which courses are selected without requiring additional courses.

**Prerequisite**
A requirement that must be satisfied before enrolling in a course. In Reqit, prerequisites are written as requirement expressions attached to courses.

**Prerequisite includes**
A filter that finds courses whose prerequisite tree contains a specific course. Written as `courses where prerequisite includes (CMPS 104)`.

**Primary major**
A program context reference that resolves to the student's declared primary major at evaluation time. Written as `primary major`. Used in overlap rules.

**Primary minor**
A program context reference that resolves to the student's declared minor at evaluation time. Written as `primary minor`. Used in overlap rules.

**Program**
An academic program — a major, minor, certificate, concentration, track, or cluster. In Reqit, referenced as `program CODE type level` (e.g., `program CS major undergraduate`) or by quoted code alone: `program "CMPS-BS"`.

**Program context reference**
A reference to a student's declared program that resolves at evaluation time. The two program context references are `primary major` and `primary minor`.

**Program filter**
An expression that describes programs by their properties rather than naming them individually. Written as `all programs where type = "major"` or with other quantifiers (`any program where`, `at least N programs where`, `at most N programs where`, `exactly N programs where`). Filterable fields: `type`, `level`, `code`.

**Program level**
The academic level of a program: `undergraduate`, `graduate`, `doctoral`, `professional`, `post-graduate`, or `post-doctoral`.

**Program type**
The kind of academic program: `major`, `minor`, `certificate`, `concentration`, `track`, or `cluster`.

**Quantity**
A measurable numeric value that isn't a test score. Examples: Clinical Hours, Community Service Hours, Research Credits. Written as `quantity CODE >= N` (e.g., `quantity CLINICAL_HOURS >= 500`).

**Scope**
A named container for variables, typically corresponding to a program. Written as `scope "name" { ... }`. Prevents variable name collisions between programs.

**Score**
A test score requirement. Written as `score CODE >= N`. Examples: `score SAT_MATH >= 580`, `score AP_CALCULUS_AB >= 3`.

**Subject code**
The department prefix on a course — the letters before the course number. Examples: MATH, CSCI, BIOL, CMPS. In filters, referenced as `subject`.

**Variable**
A named sub-expression. Defined with `$name = expression` and referenced with `$name`. Variables make complex requirements readable by breaking them into named pieces.

**Where clause**
See *Post-selection constraint*.

**Wildcard**
The value `"*"` used in filters to match any value. `courses where subject = "*"` matches every course in the catalog. Most commonly used with credit requirements for total credit minimums.

**With**
A modifier that attaches a constraint (grade or GPA) to a requirement. Written as `with grade >= "C"` or `with gpa >= 2.0`. Applies to whatever expression precedes it.

---

[Next: Quick Reference Card →](20-quick-reference.md)
