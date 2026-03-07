# HTML Renderer Reference

The `toHTML()` renderer produces semantic HTML with CSS classes that you style in your application. This document covers every CSS class, the DOM structure, and how to customize the output.

## Quick Start

```javascript
const reqit = require('reqit');

const req = reqit.parse('all of (MATH 151, CMPS 130)');
const catalog = reqit.catalog({ /* ... */ });

// Without audit — just the requirement structure
const html = req.toHTML(catalog);

// With audit — adds status classes, checkmarks, grades
const result = req.audit(catalog, transcript);
const auditHtml = result.toHTML(catalog);
```

## Options

```javascript
result.toHTML(catalog, {
  classPrefix: 'deg-',             // replace 'reqit-' prefix (default: 'reqit-')
  wrapperTag: 'div',               // wrap output in <div class="reqit-root">...</div>
  annotations: new Map([           // add labels to specific courses
    ['MATH:151', ['shared', 'gen-ed']],
  ]),
  labelFormat: (defaultLabel, node, catalog) => {
    return `<em>Section:</em> ${defaultLabel}`;
  },
});
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `classPrefix` | `string` | `'reqit-'` | Prefix for all CSS classes. |
| `wrapperTag` | `string` | none | Wraps the entire output in this element with class `${prefix}root`. |
| `annotations` | `Map<string, string[]>` | none | Keyed by `'SUBJECT:NUMBER'`. Values are appended as annotation spans. |
| `labelFormat` | `function` | none | Transform composite labels. Receives the default HTML label, the AST node, and the catalog. |

---

## DOM Structure

### Leaf Nodes

**Course** — `<span>` with nested subject, number, and optional title:
```html
<span class="reqit-course">
  <span class="reqit-subject">MATH</span>
  <span class="reqit-number">151</span>
  <span class="reqit-title">Calculus I</span>
</span>
```

With concurrent flag:
```html
<span class="reqit-course">
  <span class="reqit-subject">MATH</span>
  <span class="reqit-number">151</span>
  <span class="reqit-title">Calculus I</span>
  <span class="reqit-concurrent">(concurrent)</span>
</span>
```

With annotation:
```html
<span class="reqit-course">
  <span class="reqit-subject">MATH</span>
  <span class="reqit-number">151</span>
  <span class="reqit-title">Calculus I</span>
  <span class="reqit-annotation">(shared)</span>
</span>
```

**Course filter:**
```html
<span class="reqit-course-filter">Any course where subject = &quot;CMPS&quot; and number &gt;= 300</span>
```

**Score:**
```html
<span class="reqit-score">Score SAT_MATH &ge; 580</span>
```

**Attainment:**
```html
<span class="reqit-attainment">Attainment: JUNIOR_STANDING</span>
```

**Quantity:**
```html
<span class="reqit-quantity">Quantity: CLINICAL_HOURS &ge; 500</span>
```

**Variable reference:**
```html
<span class="reqit-variable-ref">$core</span>
```

**Program reference:**
```html
<span class="reqit-program-ref">Program &quot;CMPS&quot;</span>
```

**Program:**
```html
<span class="reqit-program">Program CMPS (major, undergraduate)</span>
```

**Program context ref:**
```html
<span class="reqit-program-context-ref">primary major</span>
```

**Program filter:**
```html
<span class="reqit-program-filter">Any program where type = &quot;major&quot;</span>
```

### Composite Nodes

All composites follow the same pattern — a `<div>` wrapper with a `<p>` label and a `<ul>` item list:

```html
<div class="reqit-requirement reqit-all-of">
  <p class="reqit-label">Complete <strong>all</strong> of the following:</p>
  <ul class="reqit-items">
    <li><!-- child node --></li>
    <li><!-- child node --></li>
  </ul>
</div>
```

Composite type classes: `reqit-all-of`, `reqit-any-of`, `reqit-none-of`, `reqit-n-of`, `reqit-one-from-each`, `reqit-from-n-groups`, `reqit-credits-from`.

**Named label** — when a composite has a `label` property:
```html
<div class="reqit-requirement reqit-all-of">
  <p class="reqit-label">
    <span class="reqit-named-label">Math Core</span> — complete <strong>all</strong> of the following:
  </p>
  ...
</div>
```

**With constraint:**
```html
<div class="reqit-requirement reqit-with-constraint">
  <!-- inner requirement -->
  <p class="reqit-constraint">With a minimum grade of C</p>
</div>
```

**Except:**
```html
<div class="reqit-requirement reqit-except">
  <!-- source requirement -->
  <p class="reqit-label">Except:</p>
  <ul class="reqit-items">
    <li><!-- excluded items --></li>
  </ul>
</div>
```

**Post-constraints:**
```html
<span class="reqit-post-constraint">where at least 2 have subject = &quot;CMPS&quot;</span>
```

**Overlap limit:**
```html
<div class="reqit-requirement reqit-overlap-limit">
  <p class="reqit-label">Overlap between ... and ...: at most 2 courses</p>
</div>
```

**Outside program:**
```html
<div class="reqit-requirement reqit-outside-program">
  <p class="reqit-label">At least 30 credits from outside ...</p>
</div>
```

### Transparent Wrappers

`variable-def` and `scope` nodes produce no HTML of their own — they render through to their inner content.

---

## Audit Mode

When `toHTML` is called with an audit result, every node gains status information:

### Status Classes

Added to the element's existing classes:

| Class | Meaning |
|-------|---------|
| `reqit-status-met` | Requirement satisfied. |
| `reqit-status-not-met` | Requirement not satisfied. |
| `reqit-status-in-progress` | Course currently being taken. |
| `reqit-status-partial-progress` | Some children met, but not enough. |

```html
<span class="reqit-course reqit-status-met">...</span>
<div class="reqit-requirement reqit-all-of reqit-status-not-met">...</div>
```

### Status Indicators

A `<span>` with a Unicode checkmark/circle prepended to each node:

```html
<span class="reqit-status-indicator">&#10003;</span>  <!-- ✓ met -->
<span class="reqit-status-indicator">&#9675;</span>   <!-- ○ not-met -->
<span class="reqit-status-indicator">&#9685;</span>   <!-- ◕ in-progress -->
<span class="reqit-status-indicator">&#9681;</span>   <!-- ◑ partial-progress -->
```

### Grade and Term

For met courses, grade and term info from `satisfiedBy`:

```html
<span class="reqit-course reqit-status-met">
  <span class="reqit-status-indicator">&#10003;</span>
  <span class="reqit-subject">MATH</span>
  <span class="reqit-number">151</span>
  <span class="reqit-title">Calculus I</span>
  <span class="reqit-grade">A</span>
  <span class="reqit-term">Fall 2023</span>
</span>
```

### Program Reference — Not Declared

```html
<span class="reqit-program-ref reqit-status-not-met">
  <span class="reqit-status-indicator">&#9675;</span>
  Program &quot;CMPS&quot; <em>(not declared)</em>
</span>
```

---

## Complete CSS Class Reference

### Structural Classes

| Class | Element | Appears On |
|-------|---------|-----------|
| `reqit-root` | `<wrapperTag>` | Outermost wrapper (only when `wrapperTag` option is set). |
| `reqit-requirement` | `<div>` | Every composite node. Always paired with a type class. |
| `reqit-label` | `<p>` | Label paragraph inside composites. |
| `reqit-named-label` | `<span>` | User-defined label text (e.g. "Math Core"). |
| `reqit-items` | `<ul>` | Child item list inside composites. |
| `reqit-constraint` | `<p>` | Constraint description (grade/GPA requirements). |
| `reqit-post-constraint` | `<span>` | Post-selection constraint clause. |

### Node Type Classes

| Class | Element | Node Type |
|-------|---------|-----------|
| `reqit-course` | `<span>` | `course` |
| `reqit-course-filter` | `<span>` | `course-filter` |
| `reqit-score` | `<span>` | `score` |
| `reqit-attainment` | `<span>` | `attainment` |
| `reqit-quantity` | `<span>` | `quantity` |
| `reqit-variable-ref` | `<span>` | `variable-ref` |
| `reqit-program` | `<span>` | `program` |
| `reqit-program-ref` | `<span>` | `program-ref` |
| `reqit-program-context-ref` | `<span>` | `program-context-ref` |
| `reqit-program-filter` | `<span>` | `program-filter` |
| `reqit-all-of` | `<div>` | `all-of` (with `reqit-requirement`) |
| `reqit-any-of` | `<div>` | `any-of` |
| `reqit-none-of` | `<div>` | `none-of` |
| `reqit-n-of` | `<div>` | `n-of` |
| `reqit-one-from-each` | `<div>` | `one-from-each` |
| `reqit-from-n-groups` | `<div>` | `from-n-groups` |
| `reqit-credits-from` | `<div>` | `credits-from` |
| `reqit-with-constraint` | `<div>` | `with-constraint` |
| `reqit-except` | `<div>` | `except` |
| `reqit-overlap-limit` | `<div>` | `overlap-limit` |
| `reqit-outside-program` | `<div>` | `outside-program` |

### Course Detail Classes

| Class | Element | Description |
|-------|---------|-------------|
| `reqit-subject` | `<span>` | Subject code (e.g. "MATH"). |
| `reqit-number` | `<span>` | Course number (e.g. "151"). |
| `reqit-title` | `<span>` | Course title from catalog. |
| `reqit-concurrent` | `<span>` | "(concurrent)" marker. |
| `reqit-annotation` | `<span>` | Annotation text from options (e.g. "(shared)"). |

### Audit Status Classes

| Class | Element | Description |
|-------|---------|-------------|
| `reqit-status-met` | `<span>` or `<div>` | Added to the node's element when status is met. |
| `reqit-status-not-met` | `<span>` or `<div>` | Status is not-met. |
| `reqit-status-in-progress` | `<span>` or `<div>` | Status is in-progress. |
| `reqit-status-partial-progress` | `<span>` or `<div>` | Status is partial-progress. |
| `reqit-status-indicator` | `<span>` | Unicode status icon (✓, ○, ◕, ◑). |
| `reqit-grade` | `<span>` | Grade earned (e.g. "A"). |
| `reqit-term` | `<span>` | Term completed (e.g. "Fall 2023"). |

---

## Starter Stylesheet

```css
/* Layout */
.reqit-requirement { margin: 0.5em 0; }
.reqit-items { list-style: none; padding-left: 1.5em; }
.reqit-label { font-weight: 600; margin: 0.25em 0; }
.reqit-named-label { color: #2563eb; }

/* Leaf nodes */
.reqit-course { display: inline; }
.reqit-subject { font-weight: 600; }
.reqit-number { font-weight: 600; }
.reqit-title { color: #64748b; font-style: italic; }
.reqit-title::before { content: '— '; }
.reqit-concurrent { color: #9333ea; font-size: 0.85em; }
.reqit-annotation { color: #6b7280; font-size: 0.85em; }

/* Constraints */
.reqit-constraint { color: #b45309; font-style: italic; margin: 0.25em 0; }
.reqit-post-constraint { color: #7c3aed; font-size: 0.9em; }

/* Audit status — background colors */
.reqit-status-met { background-color: #f0fdf4; }
.reqit-status-not-met { background-color: #fef2f2; }
.reqit-status-in-progress { background-color: #fffbeb; }
.reqit-status-partial-progress { background-color: #fefce8; }

/* Audit status — icons */
.reqit-status-indicator { font-weight: bold; margin-right: 0.25em; }
.reqit-status-met > .reqit-status-indicator { color: #16a34a; }
.reqit-status-not-met > .reqit-status-indicator { color: #dc2626; }
.reqit-status-in-progress > .reqit-status-indicator { color: #d97706; }

/* Audit details */
.reqit-grade { font-weight: 600; color: #166534; }
.reqit-grade::before { content: '['; }
.reqit-grade::after { content: ']'; }
.reqit-term { color: #64748b; font-size: 0.85em; }
```

---

## Custom Prefix Example

If your app already has CSS classes starting with `reqit-`, or you want isolated namespacing:

```javascript
const html = result.toHTML(catalog, { classPrefix: 'audit-' });
```

All classes become `audit-course`, `audit-status-met`, `audit-label`, etc. Update your stylesheet selectors to match.

---

## Building Custom UIs with walk()

If the HTML renderer doesn't fit your needs, use `result.walk()` to build any output format:

```javascript
result.walk((node, path, parent, depth) => {
  if (node.type === 'course' && node.status === 'met') {
    // Build your own course card, React component, Pug template, etc.
    console.log(`${'  '.repeat(depth)}✓ ${node.subject} ${node.number}`);
  }
});
```

See the [Tutorial](tutorial.md) for complete examples of custom rendering.
