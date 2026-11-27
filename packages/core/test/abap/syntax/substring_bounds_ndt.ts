import {expect} from "chai";
import {runProgram} from "./syntax";

describe("syntax.ts, static offset and length outside a numeric text, date or time field", () => {
  const program = (code: string): string => `
TYPES: BEGIN OF ty_struc,
         n TYPE n LENGTH 4,
       END OF ty_struc.
DATA n TYPE n LENGTH 4.
DATA d TYPE d.
DATA t TYPE t.
DATA s TYPE string.
DATA off TYPE i.
DATA struc TYPE ty_struc.
DATA ref TYPE REF TO d.
FIELD-SYMBOLS <n> TYPE n.
FIELD-SYMBOLS <d> TYPE d.
FIELD-SYMBOLS <any> TYPE any.
CONSTANTS lc_off TYPE i VALUE 8.
${code}`;

  const errors: [string, string][] = [
    [`s = n+4.`, "Offset 4 is outside the field of length 4"],
    [`s = n+3(2).`, "Length 2 exceeds the remaining length 1 of the field"],
    [`s = n(5).`, "Length 5 exceeds the remaining length 4 of the field"],
    [`n+4(1) = '1'.`, "Offset 4 is outside the field of length 4"],
    [`s = d+8.`, "Offset 8 is outside the field of length 8"],
    [`s = d+7(2).`, "Length 2 exceeds the remaining length 1 of the field"],
    [`d(9) = '1'.`, "Length 9 exceeds the remaining length 8 of the field"],
    [`s = t+6.`, "Offset 6 is outside the field of length 6"],
    [`s = t+5(2).`, "Length 2 exceeds the remaining length 1 of the field"],
    [`t(7) = '1'.`, "Length 7 exceeds the remaining length 6 of the field"],
    [`s = struc-n+4.`, "Offset 4 is outside the field of length 4"],
    [`s = ref->*+8.`, "Offset 8 is outside the field of length 8"],
    [`s = d+8(lc_off).`, "Offset 8 is outside the field of length 8"],
    [`CLEAR d+8.`, "Offset 8 is outside the field of length 8"],
    [`ASSIGN t+6(*) TO <any>.`, "Offset 6 is outside the field of length 6"],
  ];
  for (const [code, message] of errors) {
    it("error, " + code, () => {
      const issues = runProgram(program(code));
      expect(issues.map(i => i.getMessage())).to.deep.equal([message]);
    });
  }

  it("ok, inside the field", () => {
    const issues = runProgram(program(`s = n+3(1).
s = n+3.
s = n(4).
s = d+7(1).
s = d+4(2).
s = d(8).
s = t(6).
s = t+4.
n+3(1) = '1'.
d+6(2) = '01'.
t(2) = '12'.
ASSIGN d+7(*) TO <any>.`));
    expect(issues.map(i => i.getMessage())).to.deep.equal([]);
  });

  it("ok, the offset or the length is a variable", () => {
    const issues = runProgram(program(`s = n+off(5).
s = d+8(off).
t+off(7) = '1'.
s = d+off.`));
    expect(issues.map(i => i.getMessage())).to.deep.equal([]);
  });

  it("ok, field symbols", () => {
    const issues = runProgram(program(`s = <n>+4.
<n>+5(1) = '1'.
s = <d>+7(1).`));
    expect(issues.map(i => i.getMessage())).to.deep.equal([]);
  });

  it("ok, generic parameter", () => {
    const abap = `
FORM foo CHANGING cv TYPE n.
  cv+5 = '1'.
ENDFORM.

CLASS lcl DEFINITION.
  PUBLIC SECTION.
    METHODS run CHANGING cv TYPE n.
ENDCLASS.

CLASS lcl IMPLEMENTATION.
  METHOD run.
    cv+5(1) = '1'.
  ENDMETHOD.
ENDCLASS.`;
    const issues = runProgram(abap);
    expect(issues.map(i => i.getMessage())).to.deep.equal([]);
  });

  it("a substring of a date has type n", () => {
    const issues = runProgram(program(`DATA(sub) = d+4(2).
DATA i TYPE i.
i = sub.`));
    expect(issues.map(i => i.getMessage())).to.deep.equal([]);
  });
});
