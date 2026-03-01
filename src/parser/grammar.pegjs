// Reqit Grammar
// Built incrementally — each phase adds new constructs

start
  = _ node:Expression _ !. { return node; }

Expression
  = expr:PrimaryExpression
    except:(_ EXCEPT _ "(" _ ItemList _ ")")?
    constraint:(_ WITH __ Constraint)? {
      let node = expr;
      if (except) {
        node = { type: 'except', source: node, exclude: except[5] };
      }
      if (constraint) {
        node = { type: 'with-constraint', requirement: node, constraint: constraint[3] };
      }
      return node;
    }

Constraint
  = GRADE _ ">=" _ value:StringLiteral {
      return { kind: 'min-grade', value };
    }
  / GPA _ ">=" _ value:Decimal {
      return { kind: 'min-gpa', value };
    }

Decimal "decimal number"
  = digits:$([0-9]+ ("." [0-9]+)?) { return parseFloat(digits); }

PrimaryExpression
  = AllOf
  / AnyOf
  / NoneOf
  / NOf
  / CreditsFrom
  / CourseFilter
  / CourseRef

AllOf
  = ALL __ OF _ "(" _ items:ItemList _ ")" {
      return { type: 'all-of', items };
    }

AnyOf
  = ANY __ OF _ "(" _ items:ItemList _ ")" {
      return { type: 'any-of', items };
    }

NoneOf
  = NONE __ OF _ "(" _ items:ItemList _ ")" {
      return { type: 'none-of', items };
    }

NOf
  = AT __ LEAST __ n:Integer __ OF _ "(" _ items:ItemList _ ")" {
      return { type: 'n-of', comparison: 'at-least', count: n, items };
    }
  / AT __ MOST __ n:Integer __ OF _ "(" _ items:ItemList _ ")" {
      return { type: 'n-of', comparison: 'at-most', count: n, items };
    }
  / EXACTLY __ n:Integer __ OF _ "(" _ items:ItemList _ ")" {
      return { type: 'n-of', comparison: 'exactly', count: n, items };
    }

CreditsFrom
  = AT __ LEAST __ n:Integer __ CREDITS __ FROM _ "(" _ items:ItemList _ ")" {
      const source = items.length === 1 ? items[0] : { type: 'all-of', items };
      return { type: 'credits-from', comparison: 'at-least', credits: n, source };
    }
  / AT __ MOST __ n:Integer __ CREDITS __ FROM _ "(" _ items:ItemList _ ")" {
      const source = items.length === 1 ? items[0] : { type: 'all-of', items };
      return { type: 'credits-from', comparison: 'at-most', credits: n, source };
    }
  / EXACTLY __ n:Integer __ CREDITS __ FROM _ "(" _ items:ItemList _ ")" {
      const source = items.length === 1 ? items[0] : { type: 'all-of', items };
      return { type: 'credits-from', comparison: 'exactly', credits: n, source };
    }

CourseFilter
  = COURSES __ WHERE __ filters:FilterList {
      return { type: 'course-filter', filters };
    }

FilterList
  = head:Filter tail:(_ AND _ Filter)* {
      return [head, ...tail.map(t => t[3])];
    }

Filter
  = PREREQUISITE __ INCLUDES _ "(" _ value:Expression _ ")" {
      return { field: 'prerequisite-includes', op: 'includes', value };
    }
  / COREQUISITE __ INCLUDES _ "(" _ value:Expression _ ")" {
      return { field: 'corequisite-includes', op: 'includes', value };
    }
  / field:FilterField _ op:ComparisonOp _ value:FilterValue {
      return { field, op, value };
    }

FilterField
  = "subject"i   !IdentChar { return 'subject'; }
  / "number"i    !IdentChar { return 'number'; }
  / "attribute"i !IdentChar { return 'attribute'; }
  / "credits"i   !IdentChar { return 'credits'; }

ComparisonOp
  = ">=" { return 'gte'; }
  / "<=" { return 'lte'; }
  / ">"  { return 'gt'; }
  / "<"  { return 'lt'; }
  / "!=" { return 'ne'; }
  / "="  { return 'eq'; }
  / NOT __ IN { return 'not-in'; }
  / IN       { return 'in'; }

FilterValue
  = StringList
  / StringLiteral
  / Integer

StringList "string list"
  = "(" _ head:StringLiteral tail:(_ "," _ StringLiteral)* _ ")" {
      return [head, ...tail.map(t => t[3])];
    }

StringLiteral "string"
  = '"' chars:$([^"]*) '"' { return chars; }

Integer "integer"
  = digits:$([0-9]+) { return parseInt(digits, 10); }

ItemList
  = head:Expression tail:(_ "," _ Expression)* {
      return [head, ...tail.map(t => t[3])];
    }

CourseRef
  = subject:Subject __ number:Number _ "(" _ CONCURRENT __ ALLOWED _ ")" {
      return { type: 'course', subject: subject.toUpperCase(), number: number.toUpperCase(), concurrentAllowed: true };
    }
  / subject:Subject __ number:Number {
      return { type: 'course', subject: subject.toUpperCase(), number: number.toUpperCase() };
    }

Subject "subject code"
  = $([A-Za-z] [A-Za-z0-9]+)

Number "course number"
  = $([0-9] [0-9A-Za-z.]*)

// Case-insensitive keywords
ALL     = "all"i     !IdentChar
ANY     = "any"i     !IdentChar
AT      = "at"i      !IdentChar
LEAST   = "least"i   !IdentChar
MOST    = "most"i    !IdentChar
EXACTLY = "exactly"i !IdentChar
OF      = "of"i      !IdentChar
CREDITS  = "credits"i  !IdentChar
FROM     = "from"i     !IdentChar
COURSES  = "courses"i  !IdentChar
WHERE   = "where"i   !IdentChar
AND     = "and"i     !IdentChar
IN           = "in"i           !IdentChar
NOT          = "not"i          !IdentChar
EXCEPT       = "except"i       !IdentChar
NONE         = "none"i         !IdentChar
WITH         = "with"i         !IdentChar
GRADE        = "grade"i        !IdentChar
GPA          = "gpa"i          !IdentChar
CONCURRENT   = "concurrent"i   !IdentChar
ALLOWED      = "allowed"i      !IdentChar
PREREQUISITE = "prerequisite"i !IdentChar
COREQUISITE  = "corequisite"i  !IdentChar
INCLUDES     = "includes"i     !IdentChar

IdentChar = [A-Za-z0-9]

// Whitespace and comments
_ "optional whitespace"
  = ([ \t\n\r] / Comment)*

__ "required whitespace"
  = [ \t]+

Comment "comment"
  = "#" [^\n\r]*
