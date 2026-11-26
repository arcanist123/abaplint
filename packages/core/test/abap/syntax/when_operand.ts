import {expect} from "chai";
import {runProgram} from "./syntax";

const program = (body: string): string => `
REPORT zwhen.
CLASS lcl DEFINITION.
  PUBLIC SECTION.
    CLASS-DATA attr TYPE i.
    CLASS-METHODS get IMPORTING p TYPE i OPTIONAL RETURNING VALUE(r) TYPE i.
ENDCLASS.
CLASS lcl IMPLEMENTATION.
  METHOD get.
  ENDMETHOD.
ENDCLASS.
DATA a TYPE i.
DATA b TYPE i.
DATA c TYPE c LENGTH 10.
DATA s TYPE string.
DATA x TYPE x LENGTH 4.
DATA f TYPE f.
DATA ref TYPE REF TO i.
DATA tab TYPE STANDARD TABLE OF i WITH DEFAULT KEY.
DATA strings TYPE string_table.
TYPES: BEGIN OF ty_row,
         f TYPE string,
       END OF ty_row.
DATA rows TYPE STANDARD TABLE OF ty_row WITH DEFAULT KEY.
FIELD-SYMBOLS <i> TYPE i.
START-OF-SELECTION.
${body}`;

const issuesOf = (body: string) => runProgram(program(body)).map(i => i.getMessage());
const when = (value: string) => issuesOf(`CASE a.\n  WHEN ${value}.\nENDCASE.`);

describe("syntax.ts, calculations after WHEN", () => {

  const arithmetic = ["b + 1", "b - 1", "b * 2", "b / 2", "b ** 2", "b MOD 2", "b DIV 2", "- b", "+ b", "- 1",
    "( b + 1 )", "1 OR b * 2", "b + 1 OR 2", "1 OR 2 OR - b", "lcl=>get( ) + 1", "abs( b ) + 1",
    "lines( tab ) + 1", "CONV i( b ) + 1", "ipow( base = b exp = 2 )", "nmax( val1 = a val2 = b )",
    "nmin( val1 = a val2 = b )", "round( val = f dec = 1 )", "abs( b + 0 )", "abs( - b )", "abs( strlen( s ) )",
    "1 OR abs( b + 0 )"];
  for (const value of arithmetic) {
    it("error, WHEN " + value, () => {
      expect(when(value)).to.deep.equal(["Arithmetic expression not allowed after WHEN"]);
    });
  }

  const functions = ["abs( lcl=>get( ) )", "abs( tab[ 1 ] )", "abs( CONV i( b ) )", "abs( VALUE i( ) )",
    "abs( ( b ) )", "lines( VALUE string_table( ) )", "strlen( condense( s ) )", "strlen( c && s )",
    "count( val = s sub = 'a' )", "find( val = s sub = 'a' )", "1 OR abs( lcl=>get( ) )"];
  for (const value of functions) {
    it("error, WHEN " + value, () => {
      const issues = when(value);
      expect(issues.length).to.equal(1);
      expect(issues[0]).to.include("not allowed after WHEN, only a function of a data object");
    });
  }

  const ok = ["b", "1", "-1", "1 OR -1 OR b", "lcl=>attr", "ref->*", "<i>", "sy-index", "lcl=>get( )",
    "lcl=>get( b + 1 )", "lcl=>get( p = b * 2 )", "abs( b )", "abs( -1 )", "abs( ref->* )", "abs( <i> )",
    "abs( lcl=>attr )", "abs( sy-index )", "sign( f )", "ceil( f )", "sqrt( b )", "strlen( 'a' )", "strlen( \`a\` )",
    "strlen( s )", "strlen( c+1(2) )", "strlen( text-001 )", "xstrlen( x )", "numofchar( s )", "charlen( s )",
    "lines( tab )", "CONV i( b + 1 )", "COND i( WHEN a = 1 THEN b + 1 )"];
  for (const value of ok) {
    it("ok, WHEN " + value, () => {
      expect(when(value)).to.deep.equal([]);
    });
  }

  const expressions: [string, string][] = [
    ["s && `a`", "String expression not allowed after WHEN"],
    ["c && s && `a`", "String expression not allowed after WHEN"],
    ["|a|", "String expression not allowed after WHEN"],
    ["|a{ s }|", "String expression not allowed after WHEN"],
    ["`a` OR s && `b`", "String expression not allowed after WHEN"],
    ["x BIT-AND x", "Bit expression not allowed after WHEN"],
    ["x BIT-OR x", "Bit expression not allowed after WHEN"],
    ["x BIT-XOR x", "Bit expression not allowed after WHEN"],
    ["BIT-NOT x", "Bit expression not allowed after WHEN"],
    ["tab[ 1 ]", "Table expression not allowed after WHEN"],
    ["rows[ 1 ]-f", "Table expression not allowed after WHEN"],
    ["1 OR tab[ 1 ]", "Table expression not allowed after WHEN"],
    ["condense( s )", "Built-in function \"condense\" not allowed after WHEN, only a numeric function"],
    ["to_upper( s )", "Built-in function \"to_upper\" not allowed after WHEN, only a numeric function"],
    ["substring( val = s off = 1 )", "Built-in function \"substring\" not allowed after WHEN, only a numeric function"],
    ["repeat( val = s occ = 2 )", "Built-in function \"repeat\" not allowed after WHEN, only a numeric function"],
    ["cmax( val1 = s val2 = c )", "Built-in function \"cmax\" not allowed after WHEN, only a numeric function"],
    ["concat_lines_of( table = strings )", "Built-in function \"concat_lines_of\" not allowed after WHEN, only a numeric function"],
    ["boolc( a = 1 )", "Built-in function \"boolc\" not allowed after WHEN, only a numeric function"],
    ["xsdbool( a = 1 )", "Built-in function \"xsdbool\" not allowed after WHEN, only a numeric function"],
  ];
  for (const [value, message] of expressions) {
    it("error, WHEN " + value, () => {
      expect(when(value)).to.deep.equal([message]);
    });
  }

  for (const value of ["'a' & 'b'", "CONV string( s && `a` )", "lcl=>get( strlen( s && `a` ) )", "strlen( s )"]) {
    it("ok, WHEN " + value, () => {
      expect(issuesOf(`CASE s.\n  WHEN ${value}.\nENDCASE.`)).to.deep.equal([]);
    });
  }

  for (const operand of ["s && `a`", "|a|", "condense( s )", "to_upper( s )", "boolc( a = 1 )", "x BIT-AND x",
    "BIT-NOT x", "strings[ 1 ]", "rows[ 1 ]-f"]) {
    it("ok, CASE " + operand, () => {
      expect(issuesOf(`CASE ${operand}.\n  WHEN \`a\`.\nENDCASE.`)).to.deep.equal([]);
    });
  }

  for (const operand of ["a + 1", "- a", "abs( a + 1 )", "ipow( base = a exp = 2 )"]) {
    it("ok, CASE " + operand, () => {
      expect(issuesOf(`CASE ${operand}.\n  WHEN 1.\nENDCASE.`)).to.deep.equal([]);
    });
  }

  it("ok, a method of the class hides the built-in function", () => {
    const abap = `
CLASS lcl DEFINITION.
  PUBLIC SECTION.
    CLASS-METHODS abs IMPORTING p TYPE i RETURNING VALUE(r) TYPE i.
    CLASS-METHODS run.
ENDCLASS.
CLASS lcl IMPLEMENTATION.
  METHOD abs.
  ENDMETHOD.
  METHOD run.
    DATA a TYPE i.
    CASE a.
      WHEN abs( a + 1 ).
    ENDCASE.
  ENDMETHOD.
ENDCLASS.`;
    expect(runProgram(abap).map(i => i.getMessage())).to.deep.equal([]);
  });

});
