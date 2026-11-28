import {expect} from "chai";
import {runProgram} from "./syntax";
import {MemoryFile} from "../../../src/files/memory_file";
import {Registry} from "../../../src/registry";
import {ABAPObject} from "../../../src/objects/_abap_object";
import {SyntaxLogic} from "../../../src/abap/5_syntax/syntax";
import {Position} from "../../../src/position";

const declarations = `
DATA i TYPE i.
DATA i8 TYPE int8.
DATA f TYPE f.
DATA d34 TYPE decfloat34.
DATA p TYPE p LENGTH 8 DECIMALS 2.
DATA c TYPE c LENGTH 4.
DATA n TYPE n LENGTH 4.
DATA s TYPE string.
DATA x TYPE x LENGTH 4.
DATA d TYPE d.
`;

function typeOf(code: string, name: string): string | undefined {
  const filename = "zfoobar.prog.abap";
  const reg = new Registry().addFile(new MemoryFile(filename, declarations + code)).parse();
  const obj = reg.getFirstObject() as ABAPObject;
  const scope = new SyntaxLogic(reg, obj).run().spaghetti.lookupPosition(new Position(1, 1), filename);
  return scope?.findVariable(name)?.getType().toABAP();
}

describe("syntax.ts, calculation with a character-like operand", () => {
  const packed = "p LENGTH 8 DECIMALS 0";

  const types: {code: string, type: string}[] = [
    {code: `i * '2'`, type: packed},
    {code: `i * c`, type: packed},
    {code: `i + n`, type: packed},
    {code: `i + s`, type: packed},
    {code: `1 + '2'`, type: packed},
    {code: "i + `2`", type: packed},
    {code: `i8 + '1'`, type: packed},
    {code: `+ n`, type: packed},
    {code: `- c`, type: packed},
    {code: `- '2'`, type: packed},
    {code: `c + i`, type: packed},
    {code: `c * n`, type: packed},
    {code: `'1' + '2'`, type: packed},
    {code: `i + c + i`, type: packed},
    {code: `( c + i ) * 2`, type: packed},
    {code: `2 * ( i + c )`, type: packed},
    {code: `( i + c )`, type: packed},
    {code: `x + c`, type: packed},
    {code: `d + c`, type: packed},
    {code: `p * c`, type: packed},
    {code: `i + |2|`, type: packed},
    {code: `|2| + i`, type: packed},
    {code: `f * c`, type: "f"},
    {code: `c * f`, type: "f"},
    {code: `d34 + s`, type: "decfloat34"},
    {code: `c ** 2`, type: "f"},
    // without a character-like operand
    {code: `i / 2`, type: "i"},
    {code: `i8 + i`, type: "int8"},
    {code: `+ i`, type: "i"},
    // not a calculation
    {code: `n`, type: "n LENGTH 4"},
    {code: `c && c`, type: "string"},
    {code: `|2|`, type: "string"},
  ];

  for (const t of types) {
    it(`DATA(y) = ${t.code} is ${t.type}`, () => {
      const code = `DATA(y) = ${t.code}.`;
      expect(runProgram(declarations + code).map(issue => issue.getMessage())).to.deep.equal([]);
      expect(typeOf(code, "y")).to.equal(t.type);
    });
  }

  const valid = [
    `i = i + c.`,
    `i = + n.`,
    `c = c + 1.`,
    `s = '1' + '2'.`,
    `n = - c.`,
    `d = c + 1.`,
    `x = c + 1.`,
    `IF c + 1 = i. ENDIF.`,
    `CASE c + 1. WHEN 1. ENDCASE.`,
    `s = |{ c + 1 }|.`,
    `i = abs( c + 1 ).`,
  ];

  for (const code of valid) {
    it(`ok, ${code}`, () => {
      expect(runProgram(declarations + code).map(issue => issue.getMessage())).to.deep.equal([]);
    });
  }

  for (const type of ["i", "p LENGTH 8 DECIMALS 2", "c LENGTH 4", "n LENGTH 4", "string"]) {
    for (const argument of ["+ c", "- n", "+ '1'", "c + 1", "c + n"]) {
      it(`ok, ${argument} passed to a parameter of type ${type}`, () => {
        const code = `
CLASS lcl DEFINITION.
  PUBLIC SECTION.
    TYPES ty TYPE ${type}.
    CLASS-METHODS run IMPORTING val TYPE ty.
ENDCLASS.
CLASS lcl IMPLEMENTATION.
  METHOD run.
  ENDMETHOD.
ENDCLASS.
START-OF-SELECTION.
  lcl=>run( ${argument} ).`;
        expect(runProgram(declarations + code).map(issue => issue.getMessage())).to.deep.equal([]);
      });
    }
  }

  it("error, a reference next to a character-like operand", () => {
    const issues = runProgram(declarations + `
DATA ref TYPE REF TO i.
i = c + ref.`);
    expect(issues[0]?.getMessage()).to.contain(`"ref" is a reference`);
  });
});
