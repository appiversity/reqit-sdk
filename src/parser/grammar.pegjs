// Reqit Grammar
// Built incrementally — each phase adds new constructs

start
  = _ node:Expression _ !. { return node; }

Expression
  = AllOf
  / AnyOf
  / NOf
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

CourseFilter
  = COURSES __ WHERE __ filters:FilterList {
      return { type: 'course-filter', filters };
    }

FilterList
  = head:Filter tail:(_ AND _ Filter)* {
      return [head, ...tail.map(t => t[3])];
    }

Filter
  = field:FilterField _ op:ComparisonOp _ value:FilterValue {
      return { field, op, value };
    }

FilterField
  = "subject"i !IdentChar { return 'subject'; }
  / "number"i  !IdentChar { return 'number'; }

ComparisonOp
  = ">=" { return 'gte'; }
  / "<=" { return 'lte'; }
  / ">"  { return 'gt'; }
  / "<"  { return 'lt'; }
  / "="  { return 'eq'; }

FilterValue
  = StringLiteral
  / Integer

StringLiteral "string"
  = '"' chars:$([^"]*) '"' { return chars; }

Integer "integer"
  = digits:$([0-9]+) { return parseInt(digits, 10); }

ItemList
  = head:Expression tail:(_ "," _ Expression)* {
      return [head, ...tail.map(t => t[3])];
    }

CourseRef
  = subject:Subject __ number:Number {
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
COURSES = "courses"i !IdentChar
WHERE   = "where"i   !IdentChar
AND     = "and"i     !IdentChar

IdentChar = [A-Za-z0-9]

// Whitespace and comments
_ "optional whitespace"
  = ([ \t\n\r] / Comment)*

__ "required whitespace"
  = [ \t]+

Comment "comment"
  = "#" [^\n\r]*
