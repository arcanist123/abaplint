import {expect} from "chai";
import {runProgram} from "./syntax";

const program = (body: string): string => `
REPORT zparen.
CLASS lcl DEFINITION.
  PUBLIC SECTION.
    CLASS-DATA attr TYPE i.
    CLASS-METHODS get RETURNING VALUE(r) TYPE i.
ENDCLASS.
CLASS lcl IMPLEMENTATION.
  METHOD get.
  ENDMETHOD.
ENDCLASS.
DATA i TYPE i.
DATA j TYPE i.
DATA f TYPE f.
DATA c TYPE c LENGTH 5.
DATA s TYPE string.
DATA ref TYPE REF TO i.
DATA tab TYPE STANDARD TABLE OF i WITH DEFAULT KEY.
FIELD-SYMBOLS <i> TYPE i.
START-OF-SELECTION.
${body}`;

const issuesOf = (body: string) => runProgram(program(body)).map(i => i.getMessage());

const parentheses = (body: string) => issuesOf(body).filter(m => m.includes("arentheses"));

describe("syntax.ts, parentheses in the argument of a numeric function outside of a calculation", () => {

  const comparisons = [
    "abs( ( i ) ) = 1",
    "i = abs( ( i ) )",
    "abs( ( ( i ) ) ) = 1",
    "abs( ( 1 ) ) = 1",
    "abs( ( -1 ) ) = 1",
    "abs( ( sy-index ) ) = 1",
    "abs( ( c+1(2) ) ) = 1",
    "abs( ( ref->* ) ) = 1",
    "abs( ( <i> ) ) = 1",
    "abs( ( lcl=>attr ) ) = 1",
    "sign( ( i ) ) = 1",
    "sqrt( ( f ) ) = 1",
    "( abs( ( i ) ) ) = 1",
    "abs( ( i ) ) = j",
    "abs( ( i ) ) = ( j )",
    "abs( ( i ) ) = abs( j )",
    "abs( ( i ) ) = strlen( s )",
    "abs( ( i ) ) = lines( tab )",
    "abs( ( i ) ) = lcl=>get( )",
    "abs( ( i ) ) = 1 AND i + 1 = 2",
    "NOT abs( ( i ) ) = 1",
    "i BETWEEN abs( ( i ) ) AND 2",
    "abs( ( i ) ) BETWEEN 1 AND 2",
    "abs( ( i ) ) IS INITIAL",
  ];
  for (const condition of comparisons) {
    it("error, IF " + condition, () => {
      expect(parentheses(`IF ${condition}.\nENDIF.`))
        .to.deep.equal([`Parentheses around the argument of "${condition.includes("sign(") ? "sign"
          : condition.includes("sqrt(") ? "sqrt" : "abs"}" are only allowed in a calculation`]);
    });
  }

  const calculations = [
    "abs( ( i + 1 ) ) = 1",
    "abs( ( ( i ) + 1 ) ) = 1",
    "abs( ( - i ) ) = 1",
    "abs( ( lcl=>get( ) ) ) = 1",
    "abs( ( abs( i ) ) ) = 1",
    "abs( ( strlen( s ) ) ) = 1",
    "abs( ( CONV i( i ) ) ) = 1",
    "abs( ( tab[ 1 ] ) ) = 1",
    "abs( abs( ( i ) ) ) = 1",
    "abs( ( i ) ) + 1 = 1",
    "1 + abs( ( i ) ) = 1",
    "( abs( ( i ) ) ) + 1 = 1",
    "abs( ( i ) ) = j + 1",
    "abs( ( i ) ) = - j",
    "abs( ( i ) ) = ( abs( j ) + 1 )",
    "abs( ( i ) ) = abs( ( j + 1 ) )",
    "abs( ( i ) ) = abs( lcl=>get( ) )",
    "abs( ( i ) ) = strlen( s && s )",
    "abs( ( i ) ) = ipow( base = j exp = 2 )",
    "abs( ( i ) ) = find( val = s sub = 'a' )",
    "abs( ( i ) ) BETWEEN 1 AND j + 1",
    "ipow( base = ( i ) exp = 2 ) = 1",
    "lcl=>get( ) = 1 AND i = 1",
  ];
  for (const condition of calculations) {
    it("ok, IF " + condition, () => {
      expect(issuesOf(`IF ${condition}.\nENDIF.`)).to.deep.equal([]);
    });
  }

  for (const condition of ["table_line = abs( ( i ) )", "table_line BETWEEN abs( ( i ) ) AND j + 1"]) {
    it("error, LOOP AT WHERE " + condition, () => {
      expect(parentheses(`LOOP AT tab INTO j WHERE ${condition}.\nENDLOOP.`)).to.have.length(1);
    });
  }

  for (const condition of ["table_line = ( i )", "table_line = abs( ( i + 1 ) )", "table_line = abs( ( i ) ) + 1"]) {
    it("ok, LOOP AT WHERE " + condition, () => {
      expect(issuesOf(`LOOP AT tab INTO j WHERE ${condition}.\nENDLOOP.`)).to.deep.equal([]);
    });
  }

  it("error, CASE abs( ( i ) )", () => {
    expect(parentheses("CASE abs( ( i ) ).\n  WHEN 1.\nENDCASE.")).to.have.length(1);
  });

  it("error, CASE ( abs( ( i ) ) ), reported once", () => {
    expect(parentheses("CASE ( abs( ( i ) ) ).\n  WHEN 1.\nENDCASE.")).to.have.length(1);
  });

  const statements = ["i = abs( ( i ) ).", "i = ( abs( ( i ) ) ).", "i = abs( ( i ) ) + 1.", "s = |{ abs( ( i ) ) }|.",
    "APPEND abs( ( i ) ) TO tab."];
  for (const statement of statements) {
    it("ok, " + statement, () => {
      expect(issuesOf(statement)).to.deep.equal([]);
    });
  }

  for (const operand of ["abs( ( i + 1 ) )", "abs( ( i ) ) + 1"]) {
    it("ok, CASE " + operand, () => {
      expect(issuesOf(`CASE ${operand}.\n  WHEN 1.\nENDCASE.`)).to.deep.equal([]);
    });
  }

});
