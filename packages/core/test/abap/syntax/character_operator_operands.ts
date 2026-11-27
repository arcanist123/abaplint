import {expect} from "chai";
import {runProgram} from "./syntax";

const program = (body: string): string => `
REPORT zcompare_string.
TYPES: BEGIN OF ENUM color, red, green, END OF ENUM color.
CLASS lcl DEFINITION.
  PUBLIC SECTION.
    CLASS-METHODS num RETURNING VALUE(r) TYPE i.
    CLASS-METHODS str RETURNING VALUE(r) TYPE string.
ENDCLASS.
CLASS lcl IMPLEMENTATION.
  METHOD num.
  ENDMETHOD.
  METHOD str.
  ENDMETHOD.
ENDCLASS.
DATA c TYPE c LENGTH 4.
DATA s TYPE string.
DATA i TYPE i.
DATA p TYPE p LENGTH 8 DECIMALS 2.
DATA f TYPE f.
DATA x TYPE x LENGTH 4.
DATA u TYPE utclong.
DATA col TYPE color.
DATA ref TYPE REF TO i.
DATA: BEGIN OF chars, a TYPE c LENGTH 2, b TYPE n LENGTH 2, END OF chars.
DATA: BEGIN OF nested, a TYPE c LENGTH 2, BEGIN OF sub, d TYPE d, t TYPE t, END OF sub, END OF nested.
DATA: BEGIN OF mixed, a TYPE c LENGTH 2, b TYPE i, END OF mixed.
DATA: BEGIN OF deep, a TYPE string, END OF deep.
DATA: BEGIN OF nested_deep, a TYPE c LENGTH 2, BEGIN OF sub, s TYPE string, END OF sub, END OF nested_deep.
DATA itab TYPE STANDARD TABLE OF i WITH EMPTY KEY.
DATA stab TYPE STANDARD TABLE OF string WITH EMPTY KEY.
DATA int_header TYPE STANDARD TABLE OF i WITH HEADER LINE.
DATA: BEGIN OF char_header OCCURS 0, a TYPE c LENGTH 2, END OF char_header.
START-OF-SELECTION.
${body}`;

const issuesOf = (body: string) => runProgram(program(body)).map(i => i.getMessage());

const message = (operator: string) => `${operator} operands must be character-like (data type C, N, D, T, or STRING)`;

describe("syntax.ts, operands of the comparison operators for character-like data", () => {

  const errors: [string, string][] = [
    ["CO", "i CO c"],
    ["CO", "c CO i"],
    ["CA", "p CA c"],
    ["CN", "c CN f"],
    ["CP", "x CP c"],
    ["NA", "c NA x"],
    ["NS", "u NS c"],
    ["NP", "c NP u"],
    ["CS", "i CS c"],
    ["CO", "5 CO c"],
    ["CP", "c CP 5"],
    ["CO", "c CO sy-index"],
    ["CO", "itab CO c"],
    ["CO", "c CO itab"],
    ["CO", "int_header CO c"],
    ["CO", "c CO char_header[]"],
    ["CO", "col CO c"],
    ["CO", "ref CO c"],
    ["CP", "mixed CP c"],
    ["CO", "c CO mixed"],
    ["CS", "deep CS c"],
    ["CA", "c CA deep"],
    ["CO", "nested_deep CO c"],
    ["CO", "strlen( s ) CO c"],
    ["CP", "abs( c ) CP c"],
    ["CO", "( strlen( s ) ) CO c"],
    ["CO", "i CO strlen( s )"],
    ["CO", "lcl=>num( ) CO c"],
    ["CO", "c CO lcl=>num( )"],
    ["CO", "CONV i( c ) CO c"],
    ["CO", "c CO CONV i( c )"],
    ["CO", "itab[ 1 ] CO c"],
    ["CO", "c CO itab[ 1 ]"],
    ["CO", "x BIT-AND x CO c"],
    ["CO", "utclong_current( ) CO c"],
    ["CO", "c CO utclong_current( )"],
    ["CO", "c CO strlen( s && s )"],
    ["CO", "c CO strlen( lcl=>str( ) )"],
    ["CS", "c CS find( val = s sub = 'a' )"],
    ["CO", "c CO count( val = s sub = 'a' )"],
  ];
  for (const [operator, condition] of errors) {
    it("error, " + condition, () => {
      expect(issuesOf(`IF ${condition}.\nENDIF.`)).to.deep.equal([message(operator)]);
    });
  }

  const ok = [
    "c CO s",
    "chars CP c",
    "c CS chars",
    "nested CO c",
    "char_header CO c",
    "to_upper( s ) CA c",
    "s && c NS c",
    "|a{ i }| CP c",
    "CONV string( i ) CO c",
    "c+1(1) CN '1'",
    "'abc' NA `b`",
    "c CO space",
    "c CO sy-datum",
    "lcl=>str( ) CO c",
    "stab[ 1 ] CO c",
    "boolc( i = 1 ) CO c",
    "c CO xsdbool( i = 1 )",
    "c CO strlen( s )",
    "c CS strlen( s )",
    "s CP strlen( s )",
    "c CN xstrlen( x )",
    "c CA numofchar( s )",
    "c NA lines( itab )",
    "c NS abs( i )",
    "c NP sqrt( f )",
    "c CO abs( -1 )",
    "c CO ( strlen( s ) )",
  ];
  for (const condition of ok) {
    it("ok, " + condition, () => {
      expect(issuesOf(`IF ${condition}.\nENDIF.`)).to.deep.equal([]);
    });
  }

  const generic: [string, boolean][] = [
    ["simple", true],
    ["any", true],
    ["data", true],
    ["clike", true],
    ["csequence", true],
    ["c", true],
    ["n", true],
    ["numeric", false],
    ["xsequence", false],
    ["x", false],
    ["p", false],
    ["decfloat", false],
    ["ANY TABLE", false],
    ["REF TO object", false],
  ];
  for (const [type, valid] of generic) {
    for (const [operator, condition] of [["CS", "par CS 'a'"], ["CO", "'a' CO par"]]) {
      it(`${valid ? "ok" : "error"}, TYPE ${type}, ${condition}`, () => {
        const abap = `
CLASS lcl DEFINITION.
  PUBLIC SECTION.
    CLASS-METHODS run IMPORTING par TYPE ${type}.
ENDCLASS.
CLASS lcl IMPLEMENTATION.
  METHOD run.
    IF ${condition}.
    ENDIF.
  ENDMETHOD.
ENDCLASS.`;
        expect(runProgram(abap).map(i => i.getMessage())).to.deep.equal(valid ? [] : [message(operator)]);
      });
    }
  }

});
