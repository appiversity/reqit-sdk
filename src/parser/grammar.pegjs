// Reqit Grammar
// Built incrementally — each phase adds new constructs

start
  = _ node:Expression _ !. { return node; }

Expression
  = AllOf
  / AnyOf
  / CourseRef

AllOf
  = ALL __ OF _ "(" _ items:ItemList _ ")" {
      return { type: 'all-of', items };
    }

AnyOf
  = ANY __ OF _ "(" _ items:ItemList _ ")" {
      return { type: 'any-of', items };
    }

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
ALL = "all"i !IdentChar
ANY = "any"i !IdentChar
OF  = "of"i  !IdentChar

IdentChar = [A-Za-z0-9]

// Whitespace and comments
_ "optional whitespace"
  = ([ \t\n\r] / Comment)*

__ "required whitespace"
  = [ \t]+

Comment "comment"
  = "#" [^\n\r]*
