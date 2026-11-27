import {expect} from "chai";
import {runProgram} from "./syntax";

const program = (body: string): string => `
REPORT zcompare_byte.
TYPES: BEGIN OF ENUM color, red, green, END OF ENUM color.
TYPES hex4 TYPE x LENGTH 4.
CLASS lcl DEFINITION.
  PUBLIC SECTION.
    CLASS-METHODS num RETURNING VALUE(r) TYPE i.
    CLASS-METHODS xstr RETURNING VALUE(r) TYPE xstring.
    CLASS-METHODS hex RETURNING VALUE(r) TYPE hex4.
ENDCLASS.
CLASS lcl IMPLEMENTATION.
  METHOD num.
  ENDMETHOD.
  METHOD xstr.
  ENDMETHOD.
  METHOD hex.
  ENDMETHOD.
ENDCLASS.
DATA x TYPE x LENGTH 4.
DATA y TYPE xstring.
DATA c TYPE c LENGTH 4.
DATA s TYPE string.
DATA i TYPE i.
DATA f TYPE f.
DATA d TYPE d.
DATA u TYPE utclong.
DATA col TYPE color.
DATA ref TYPE REF TO i.
DATA xref TYPE REF TO xstring.
DATA: BEGIN OF bytes, a TYPE x LENGTH 2, b TYPE x LENGTH 2, END OF bytes.
DATA itab TYPE STANDARD TABLE OF i WITH EMPTY KEY.
DATA xtab TYPE STANDARD TABLE OF xstring WITH EMPTY KEY.
DATA x_header TYPE STANDARD TABLE OF x WITH HEADER LINE.
DATA: BEGIN OF struct_header OCCURS 0, a TYPE x LENGTH 2, END OF struct_header.
CONSTANTS hex TYPE x LENGTH 1 VALUE '01'.
FIELD-SYMBOLS <x> TYPE x.
FIELD-SYMBOLS <seq> TYPE xsequence.
START-OF-SELECTION.
${body}`;

const issuesOf = (body: string) => runProgram(program(body)).map(i => i.getMessage());

const message = (operator: string) => `${operator} operands must be byte-like (data type X or XSTRING)`;

describe("syntax.ts, operands of the comparison operators for byte-like data", () => {

  const errors: [string, string][] = [
    ["BYTE-CO", "c BYTE-CO x"],
    ["BYTE-CN", "x BYTE-CN c"],
    ["BYTE-CA", "s BYTE-CA y"],
    ["BYTE-NA", "x BYTE-NA i"],
    ["BYTE-CS", "x BYTE-CS '01'"],
    ["BYTE-NS", "'01' BYTE-NS x"],
    ["BYTE-CA", "x BYTE-CA `01`"],
    ["BYTE-CO", "x BYTE-CO 1"],
    ["BYTE-CO", "bytes BYTE-CO x"],
    ["BYTE-CS", "xstrlen( x ) BYTE-CS x"],
    ["O", "c O x"],
    ["O", "x O c"],
    ["Z", "x Z '01'"],
    ["M", "x M 1"],
    ["Z", "i Z x"],
    ["O", "bytes O x"],
    ["M", "x M bytes"],
    ["O", "x O CONV i( 1 )"],
    ["O", "f O x"],
    ["O", "d O x"],
    ["O", "u O x"],
    ["O", "col O x"],
    ["O", "ref O x"],
    ["M", "x M space"],
    ["Z", "x Z sy-index"],
    ["O", "x O -1"],
    ["O", "x O itab"],
    ["O", "x O xtab"],
    ["O", "xtab O x"],
    ["O", "x_header[] O x"],
    ["O", "struct_header O x"],
    ["O", "to_upper( s ) O x"],
    ["O", "x O boolc( i = 1 )"],
    ["O", "x O xsdbool( i = 1 )"],
    ["O", "x O |a|"],
    ["O", "x O s && s"],
    ["O", "lcl=>num( ) O x"],
    ["O", "x O lcl=>num( )"],
    ["O", "itab[ 1 ] O x"],
    ["O", "x O itab[ 1 ]"],
    ["O", "CONV i( 1 ) O x"],
    ["O", "x O utclong_current( )"],
    ["O", "x O strlen( s && s )"],
    ["O", "x O strlen( to_upper( s ) )"],
    ["O", "x O find( val = s sub = 'a' )"],
    ["M", "x M count( val = s sub = 'a' )"],
    ["O", "x BIT-AND y O strlen( s )"],
    ["O", "BIT-NOT x O strlen( s )"],
  ];
  for (const [operator, condition] of errors) {
    it("error, " + condition, () => {
      expect(issuesOf(`IF ${condition}.\nENDIF.`)).to.deep.equal([message(operator)]);
    });
  }

  const ok = [
    "x BYTE-CO y",
    "x BYTE-CN y",
    "x BYTE-CA y",
    "x BYTE-NA y",
    "x BYTE-CS y",
    "y BYTE-NS x",
    "x O y",
    "x Z y",
    "x M y",
    "x BIT-AND y BYTE-CA x",
    "x+1(1) O y",
    "x Z y BIT-OR x",
    "x M ( x BIT-XOR y )",
    "( x ) M x",
    "BIT-NOT x O y",
    "CONV xstring( x ) M x",
    "x BYTE-CO bytes-a",
    "hex O <x>",
    "<seq> BYTE-NA hex",
    "xref->* BYTE-CO x",
    "xtab[ 1 ] BYTE-CO x",
    "x BYTE-CO xtab[ 1 ]",
    "x_header O x",
    "lcl=>xstr( ) Z x",
    "x Z lcl=>xstr( )",
    "lcl=>hex( ) O x",
    "x O VALUE xstring( )",
    "x O strlen( s )",
    "x M strlen( c )",
    "x Z xstrlen( y )",
    "x BYTE-CO lines( itab )",
    "x BYTE-NS abs( i )",
    "x BYTE-CS ( xstrlen( x ) )",
    "x O sqrt( f )",
    "x BYTE-CN numofchar( s )",
    "x O abs( -1 )",
    "CONV hex4( x ) O xstrlen( x )",
    "lcl=>hex( ) O xstrlen( x )",
  ];
  for (const condition of ok) {
    it("ok, " + condition, () => {
      expect(issuesOf(`IF ${condition}.\nENDIF.`)).to.deep.equal([]);
    });
  }

  const generic: [string, boolean][] = [
    ["any", true],
    ["data", true],
    ["xsequence", true],
    ["x", true],
    ["simple", false],
    ["clike", false],
    ["csequence", false],
    ["c", false],
    ["n", false],
    ["numeric", false],
    ["p", false],
    ["decfloat", false],
    ["ANY TABLE", false],
    ["REF TO object", false],
  ];
  for (const [type, valid] of generic) {
    for (const [operator, condition] of [["O", "par O hex"], ["BYTE-CO", "hex BYTE-CO par"]]) {
      it(`${valid ? "ok" : "error"}, TYPE ${type}, ${condition}`, () => {
        const abap = `
CLASS lcl DEFINITION.
  PUBLIC SECTION.
    CLASS-METHODS run IMPORTING par TYPE ${type}.
ENDCLASS.
CLASS lcl IMPLEMENTATION.
  METHOD run.
    CONSTANTS hex TYPE x LENGTH 1 VALUE '01'.
    IF ${condition}.
    ENDIF.
  ENDMETHOD.
ENDCLASS.`;
        expect(runProgram(abap).map(i => i.getMessage())).to.deep.equal(valid ? [] : [message(operator)]);
      });
    }
  }

});
