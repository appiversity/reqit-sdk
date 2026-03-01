// Reqit Grammar
// Built incrementally — each phase adds new constructs

start
  = _ node:Expression _ !. { return node; }

Expression
  = CourseRef

CourseRef
  = subject:Subject __ number:Number {
      return { type: 'course', subject: subject.toUpperCase(), number: number.toUpperCase() };
    }

Subject "subject code"
  = $([A-Za-z] [A-Za-z0-9]+)

Number "course number"
  = $([0-9] [0-9A-Za-z.]*)

// Whitespace
_ "optional whitespace"
  = [ \t\n\r]*

__ "required whitespace"
  = [ \t]+
