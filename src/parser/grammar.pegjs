// Reqit Grammar
// Built incrementally — each phase adds new constructs

start
  = _ node:Expression _ !. { return node; }

Expression
  = expr:PrimaryExpression
    except:(_ EXCEPT _ "(" _ ItemList _ ")")?
    wheres:(_ WhereClause)*
    constraint:(_ WITH __ Constraint)? {
      let node = expr;
      if (except) {
        node = { type: 'except', source: node, exclude: except[5] };
      }
      if (wheres.length > 0) {
        node.post_constraints = wheres.map(w => w[1]);
      }
      if (constraint) {
        node = { type: 'with-constraint', requirement: node, constraint: constraint[3] };
      }
      return node;
    }

WhereClause
  = WHERE __ AT __ LEAST __ n:Integer __ MATCH _ "(" _ filter:SimpleFilter _ ")" {
      return { comparison: 'at-least', count: n, filter };
    }
  / WHERE __ AT __ MOST __ n:Integer __ MATCH _ "(" _ filter:SimpleFilter _ ")" {
      return { comparison: 'at-most', count: n, filter };
    }
  / WHERE __ EXACTLY __ n:Integer __ MATCH _ "(" _ filter:SimpleFilter _ ")" {
      return { comparison: 'exactly', count: n, filter };
    }

SimpleFilter
  = field:FilterField _ op:ComparisonOp _ value:FilterValue {
      return { field, op, value };
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
  = ScopeBlock
  / AllOf
  / AnyOf
  / NoneOf
  / NOf
  / CreditsFrom
  / OneFromEach
  / FromNGroups
  / CourseFilter
  / OverlapLimit
  / OutsideProgram
  / ProgramRef
  / ProgramContextRef
  / Score
  / Attainment
  / Quantity
  / VariableDef
  / VariableRef
  / CourseRef

ScopeBlock
  = SCOPE __ scopeName:StringLiteral _ "{" _ defs:(VariableDef _)* body:Expression _ "}" {
      const annotatedDefs = defs.map(d => {
        const def = d[0];
        def.scope = scopeName;
        return def;
      });
      return { type: 'scope', name: scopeName, defs: annotatedDefs, body };
    }

VariableDef
  = "$" name:VarName _ "=" _ value:Expression {
      return { type: 'variable-def', name, value };
    }

VariableRef
  = "$" scope:ScopeName "." name:VarName {
      return { type: 'variable-ref', name, scope };
    }
  / "$" name:VarName {
      return { type: 'variable-ref', name };
    }

VarName "variable name"
  = $([a-zA-Z_] [a-zA-Z0-9_]*)

ScopeName "scope name"
  = $([a-zA-Z] [a-zA-Z0-9_-]*)

ProgramRef
  = PROGRAM __ code:StringLiteral __ progType:ProgramType __ level:ProgramLevel {
      return { type: 'program', code, 'program-type': progType, level };
    }
  / ANY __ PROGRAM __ progType:ProgramType __ level:ProgramLevel {
      return { type: 'program', 'program-type': progType, level };
    }

ProgramContextRef
  = PRIMARY __ MAJOR { return { type: 'program-context-ref', role: 'primary-major' }; }
  / PRIMARY __ MINOR { return { type: 'program-context-ref', role: 'primary-minor' }; }

OverlapLimit
  = OVERLAP __ BETWEEN _ "(" _ left:OverlapTarget _ "," _ right:OverlapTarget _ ")" __ AT __ MOST __ n:Integer __ unit:OverlapUnit {
      return { type: 'overlap-limit', left, right, constraint: { comparison: 'at-most', value: n, unit } };
    }

OutsideProgram
  = OUTSIDE _ "(" _ prog:OverlapTarget _ ")" __ AT __ LEAST __ n:Integer __ CREDITS {
      return { type: 'outside-program', program: prog, constraint: { comparison: 'at-least', value: n, unit: 'credits' } };
    }

OverlapTarget
  = ProgramContextRef
  / VariableRef

ProgramType
  = "major"i         !IdentChar { return 'major'; }
  / "minor"i         !IdentChar { return 'minor'; }
  / "certificate"i   !IdentChar { return 'certificate'; }
  / "concentration"i !IdentChar { return 'concentration'; }
  / "track"i         !IdentChar { return 'track'; }
  / "cluster"i       !IdentChar { return 'cluster'; }

ProgramLevel
  = "undergraduate"i  !IdentChar { return 'undergraduate'; }
  / "graduate"i        !IdentChar { return 'graduate'; }
  / "doctoral"i        !IdentChar { return 'doctoral'; }
  / "professional"i    !IdentChar { return 'professional'; }
  / "post-graduate"i   !IdentChar { return 'post-graduate'; }
  / "post-doctoral"i   !IdentChar { return 'post-doctoral'; }

OverlapUnit
  = "courses"i !IdentChar { return 'courses'; }
  / "credits"i !IdentChar { return 'credits'; }
  / "%"                    { return 'percent'; }

Score
  = SCORE __ name:StringLiteral _ op:ComparisonOp _ value:Decimal {
      return { type: 'score', name, op, value };
    }

Attainment
  = ATTAINMENT __ name:StringLiteral {
      return { type: 'attainment', name };
    }

Quantity
  = QUANTITY __ name:StringLiteral _ op:ComparisonOp _ value:Decimal {
      return { type: 'quantity', name, op, value };
    }

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

OneFromEach
  = ONE __ FROM __ EACH __ OF _ "(" _ items:ItemList _ ")" {
      return { type: 'one-from-each', items };
    }

FromNGroups
  = FROM __ AT __ LEAST __ n:Integer __ OF _ "(" _ items:ItemList _ ")" {
      return { type: 'from-n-groups', count: n, items };
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
SCORE        = "score"i        !IdentChar
ATTAINMENT   = "attainment"i   !IdentChar
QUANTITY     = "quantity"i     !IdentChar
ONE          = "one"i          !IdentChar
EACH         = "each"i         !IdentChar
SCOPE        = "scope"i        !IdentChar
MATCH        = "match"i        !IdentChar
PREREQUISITE = "prerequisite"i !IdentChar
COREQUISITE  = "corequisite"i  !IdentChar
INCLUDES     = "includes"i     !IdentChar
PROGRAM      = "program"i      !IdentChar
PRIMARY      = "primary"i      !IdentChar
MAJOR        = "major"i        !IdentChar
MINOR        = "minor"i        !IdentChar
OVERLAP      = "overlap"i      !IdentChar
BETWEEN      = "between"i      !IdentChar
OUTSIDE      = "outside"i      !IdentChar

IdentChar = [A-Za-z0-9]

// Whitespace and comments
_ "optional whitespace"
  = ([ \t\n\r] / Comment)*

__ "required whitespace"
  = [ \t]+

Comment "comment"
  = "#" [^\n\r]*
