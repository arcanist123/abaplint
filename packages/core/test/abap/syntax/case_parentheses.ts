import {expect} from "chai";
import {runProgram} from "./syntax";

const program = (body: string): string => `
REPORT zcase.
CLASS lcl DEFINITION.
  PUBLIC SECTION.
    CLASS-DATA attr TYPE i.
    CLASS-METHODS get IMPORTING p TYPE i OPTIONAL RETURNING VALUE(r) TYPE i.
    CLASS-METHODS str RETURNING VALUE(r) TYPE string.
ENDCLASS.
CLASS lcl IMPLEMENTATION.
  METHOD get.
  ENDMETHOD.
  METHOD str.
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
DATA stab TYPE STANDARD TABLE OF string WITH DEFAULT KEY.
FIELD-SYMBOLS <i> TYPE i.
START-OF-SELECTION.
${body}`;

const issuesOf = (body: string) => runProgram(program(body)).map(i => i.getMessage());

describe("syntax.ts, parentheses after CASE and WHEN", () => {

  const caseMessage = "Parentheses after CASE only around a calculation, not around a single operand";

  const single = ["( a )", "( ( a ) )", "( 1 )", "( -1 )", "( 'x' )", "( `x` )", "( |x| )", "( c+1(2) )",
    "( ref->* )", "( <i> )", "( text-001 )", "( lcl=>attr )", "( sy-index )", "( lcl=>get( ) )",
    "( lcl=>get( a + 1 ) )", "( CONV i( a ) )", "( CONV i( a + 1 ) )", "( VALUE i( ) )",
    "( COND i( WHEN a = 1 THEN 2 ) )", "( tab[ 1 ] )", "( abs( a ) )", "( abs( -1 ) )", "( abs( c+1(2) ) )",
    "( abs( sy-index ) )", "( abs( ( a ) ) )", "( sign( a ) )", "( ceil( f ) )", "( strlen( s ) )",
    "( strlen( 'a' ) )", "( xstrlen( x ) )", "( numofchar( s ) )", "( charlen( s ) )", "( dbmaxlen( s ) )",
    "( lines( tab ) )", "( lines( stab ) )", "( count( val = s sub = 'a' ) )", "( find( val = s sub = 'a' ) )",
    "( ipow( base = a exp = 2 ) )", "( round( val = f dec = 1 ) )", "( nmax( val1 = a val2 = a ) )",
    "( strlen( c && s ) )", "( strlen( condense( s ) ) )", "( count( val = c && s sub = 'a' ) )",
    "( condense( s ) )", "( substring( val = s len = 1 ) )", "( boolc( a = 1 ) )", "( xsdbool( a = 1 ) )",
    "( c && s )", "( 'a' & 'b' )"];
  for (const operand of single) {
    it("error, CASE " + operand, () => {
      expect(issuesOf(`CASE ${operand}.\n  WHEN 1.\nENDCASE.`)).to.include(caseMessage);
    });
  }

  const calculations = ["( a + 1 )", "( - 1 )", "( - a )", "( + a )", "- ( a )", "( a ) + 1", "1 + ( a )",
    "( ( a ) + 1 )", "( ( a + 1 ) )", "( ( ( a + 1 ) ) )", "( ( ( a ) ) + 1 )", "( ( a ) ) + 1", "( - ( a ) )",
    "- ( abs( a ) )", "( a ) ** 2", "( a ) MOD ( a )", "lcl=>get( ) + ( a )", "( CONV i( a ) + 1 )",
    "( lcl=>get( ) + 1 )", "( strlen( s ) + 0 )", "( abs( a + 1 ) )", "( abs( ( a + 1 ) ) )", "( abs( - a ) )",
    "( abs( abs( a ) ) )", "( abs( strlen( s ) ) )", "( abs( lcl=>get( ) ) )", "( abs( CONV i( a ) ) )",
    "( abs( COND i( WHEN a = 1 THEN 2 ) ) )", "( abs( tab[ 1 ] ) )", "( abs( ipow( base = a exp = 2 ) ) )",
    "( strlen( lcl=>str( ) ) )", "( strlen( CONV string( c ) ) )", "( strlen( stab[ 1 ] ) )",
    "( lines( VALUE string_table( ) ) )", "( count( val = lcl=>str( ) sub = 'a' ) )",
    "( find( val = s sub = 'a' off = a + 1 ) )", "( ipow( base = a + 1 exp = 2 ) )",
    "( ipow( base = lcl=>get( ) exp = 2 ) )", "( ipow( base = abs( a ) exp = 2 ) )",
    "( ipow( base = a exp = a + 1 ) )", "( nmin( val1 = a val2 = CONV i( a ) ) )",
    "( round( val = f + 1 dec = 1 ) )", "abs( ( a + 1 ) )"];
  for (const operand of calculations) {
    it("ok, CASE " + operand, () => {
      expect(issuesOf(`CASE ${operand}.\n  WHEN 1.\nENDCASE.`)).to.not.include(caseMessage);
    });
  }

  for (const operand of ["( x BIT-AND x )", "( BIT-NOT x )", "( x ) BIT-AND x", "BIT-NOT ( x )",
    "( ( x BIT-AND x ) )"]) {
    it("ok, CASE " + operand, () => {
      expect(issuesOf(`CASE ${operand}.\n  WHEN x.\nENDCASE.`)).to.not.include(caseMessage);
    });
  }

  for (const value of ["( b )", "( ( b ) )", "( 1 )", "( lcl=>get( ) )", "( abs( b ) )", "( CONV i( b ) )",
    "2 OR ( b )", "( b ) OR 2", "1 OR ( ( b ) ) OR 3", "( abs( lcl=>get( ) ) )", "( 'a' & 'b' )"]) {
    it("error, WHEN " + value, () => {
      expect(issuesOf(`CASE a.\n  WHEN ${value}.\nENDCASE.`)).to.include("Parentheses not allowed after WHEN");
    });
  }

  // a calculation in parentheses is reported as a calculation
  it("error, WHEN ( abs( strlen( s ) ) )", () => {
    expect(issuesOf(`CASE a.\n  WHEN ( abs( strlen( s ) ) ).\nENDCASE.`))
      .to.deep.equal(["Arithmetic expression not allowed after WHEN"]);
  });

  for (const value of ["( c ) && 'a'", "( c && s )"]) {
    it("error, WHEN " + value, () => {
      expect(issuesOf(`CASE c.\n  WHEN ${value}.\nENDCASE.`)).to.include("Parentheses not allowed after WHEN");
    });
  }

  for (const statement of ["a = ( a ).", "a = abs( ( a ) ).", "a = ( abs( a ) ).", "s = ( c )."]) {
    it("ok, outside CASE, " + statement, () => {
      expect(issuesOf(statement)).to.deep.equal([]);
    });
  }

});
