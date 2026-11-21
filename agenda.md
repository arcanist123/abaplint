# Agenda

Changes I want to get into abaplint/abaplint and abaplint/transpiler `main`, shared across laptops.
Numbers: `abaplint#` = abaplint/abaplint, `transpiler#` = abaplint/transpiler.

## Purpose

Support the open-steamgate development of Alice Vinogradova (oisee): make the abaplint parser and the transpiler behave
as close to a real SAP system as possible, while keeping the output compilable to Go.

- SAP behaviour is the reference, not abaplint's rules: when they differ, follow the system
- every behaviour is measured on a real system (A4H 7.58) before it goes into a test or a PR
- no change that would stop the generated code from compiling to Go

This branch (`agenda`) has no code, only this file. Pull before editing, push after.

```
git fetch origin agenda && git worktree add ../abaplint-agenda agenda   # first time on a laptop
git -C ../abaplint-agenda pull                                           # afterwards
```

## In progress (status 2026-11-21)

### abaplint

No open abaplint PRs (2026-11-21).

- [ ] **abaplint#4610** DDIC name missing for data elements with a non-character domain (INT4, STRING_UNICODE)
  and for table types (STRING_TABLE); measured on 7.58 in the issue, no PR yet
  - checked 2026-11-21 (scratchpad probe with Z objects): wider than the issue says. DDIC name set only for
    CHAR-like and packed types and structures; missing for INT1/2/4, INT8, NUMC, RAW, DATS, TIMS, FLTP, decfloat,
    STRING, XSTRING (domain-based and predefined-type data elements alike) and for every TTYP
  - cause 1: `DDIC.textToType` (`ddic.ts`) builds `extra` (qualifiedName, conversionExit, ddicName, description)
    but passes only `{qualifiedName}` to these types; `NumericType`, `HexType`, `FloatingPointType` constructors
    take only a qualifiedName string. Conversion exit and description are lost the same way (NUMC with ALPHA)
  - cause 2: `objects/table_type.ts` `parseType` never sets a DDIC name, `TableType` constructor has no parameter for it
  - plan, one PR, two commits: (1) pass `extra` to all types in `textToType`, widen the three constructors to
    `string | AbstractTypeData` (keeps the public API); (2) `TableType` takes a ddicName, TTYP passes its name.
    Tests in `test/abap/syntax/basic_variables.ts` next to the existing getDDICName tests (~line 1354-1491)
  - transpiler follow-up: `transpile_types.ts` emits ddicName only for Character and Structure, so RTTI
    `is_ddic_type( )` for i, string, n, x, tables needs a transpiler PR too (runtime types carry `extra`)

### transpiler: open PRs, waiting for review by larshp

All CI green. Only #2163 has a review.

- transpiler#2163 CASE TYPE OF (#2156): changes requested by larshp over CI timeouts (not reproducible locally);
  main merged in, CI green, re-review asked for
- transpiler#2162 CALL METHOD (name)=>(meth) finds local classes (#2157)
- transpiler#2151 VALUE integer literal above 2^53 (#2150), rebased, `test/types/integer8.ts` conflict resolved
- transpiler#2168 hex to int8, last eight bytes, two's complement (#1673)
- transpiler#2169 int8 arithmetic overflow (#2042), branch `int8-overflow`
- transpiler#2201 class constructors run at the first use of the class (closes #1849), opened 2026-11-20
- tests only, checked on a real system: #2173 (p), #2184 (decfloat16/34), #2191 (f), #2194 (i), #2198 (int8),
  #2200 (INT1/INT2), #2208 (n)
- not mine: transpiler#2101 (christianguenter2) super class constructor calls reach the redefinition (#2100), still open

To consider: 13 PRs queue on one reviewer, 7 of them tests only. Ask larshp which order he prefers, or bundle the test PRs.

## Next

- [ ] transpiler: inheritance as on a real ABAP system
  - 16 SAP-checked tests in `test/code_structure/inheritance.ts`, transpiler#2158, merged 2026-11-20
  - gaps (details in transpiler `instructions/inheritance-gaps.md`), each fix PR brings its own test:
    1. indirect and dynamic calls from a super class constructor reach the redefinition: #2100, PR #2101 (christianguenter2)
    2. CASE TYPE OF: `WHEN TYPE x.` without INTO crashes, `WHEN TYPE <interface>` never matches: #2156, PR #2163
    3. class constructors run at load, SAP on first use: #1849, PR #2201 (design in transpiler
       `instructions/class-constructor-1849.md`, prototype on branch `lazy-class-constructor`); larshp was
       reluctant over overhead, share with oisee
    4. `CALL METHOD ('LCL_X')=>('M')` does not find local classes: #2157, PR #2162
- [ ] transpiler: int8 issues raised by others
  - #1963 (oisee) int8 to and from byte fields (x, xstring) disagree with ABAP 7.58; measured on 7.58 in the issue; nobody on it
  - #1673 (larshp) int8 from hex keeps the last 8 bytes: PR #2168
  - #2042 (larshp) int8 arithmetic overflow: PR #2169. p, f, decfloat34 targets compute as decfloat34 (no int8
    overflow, as on SAP), also fixes int8 / int8 into p or f (3.5, was 3). Known gap stated in the PR: unary
    minus or abs( ) of the int8 minimum into a p target still raises
  - re-check each behaviour on the real system before a PR

### Raised by me, nobody on them yet (transpiler)

Found in the type-by-type review (2026-11-20). Passing operations are covered by the test PRs above.

- found while fixing #2042: #2165 `**` with int8 is exact, SAP calculates in f; #2166 p compared with int8
  through a double; #2167 p arithmetic loses digits above 2^53
- p (not covered by tests yet: MOD, DIV, **, compares, ADD/SUBTRACT/..., COLLECT/SORT/READ by p, SELECT/INSERT
  with p columns, template SIGN/NUMBER/STYLE, EXACT, zero divide):
  - #2170 unary minus applies to the whole expression, `- a + b` is `- ( a + b )` (all types)
  - #2171 MOD with p operands rounds the remainder, 7.5 MOD 2 gives 2
  - #2172 p target too small: CX_SY_CONVERSION_OVERFLOW, SAP CX_SY_ARITHMETIC_OVERFLOW
  - #2174 p to c: number text instead of right-aligned, decimals, sign last; overflow not cut left with `*`
  - #2175 p to n truncates and keeps the minus sign (comments: decfloat, f, i, n arithmetic too)
  - #2176 string templates ignore SIGN = LEFTPLUS/RIGHTPLUS/RIGHT, ALIGN with WIDTH, STYLE = SCIENTIFIC
- decfloat16/34:
  - #2177 ** with a fractional exponent and sqrt( ) as a double; sqrt( 6.25 ) gives the root of 6
  - #2178 integer literals into a decfloat34 target as a double (1 / 3)
  - #2179 decfloat34 to c and string: decimal comma, alignment, scale
  - #2180 f to decfloat34: SAP takes 17 digits (0.1 -> 0.10000000000000001)
  - #2181 no CX_SY_ARITHMETIC_OVERFLOW beyond the exponent range
  - #2182 templates ignore SCIENTIFIC, ENGINEERING, SIGN_AS_POSTFIX, SCALE_PRESERVING, EXPONENT
  - #2183 COLLECT sums decfloat34 as a double
  - comment on #963 (decfloat16 not rounded to 16 digits)
- f:
  - #2185 f in templates: 16 fixed decimals instead of the shortest text; ENGINEERING, EXPONENT ignored
  - #2186 f to c: decimal comma, not right-aligned
  - #2187 f to p rounds a negative half up (Math.round)
  - #2188 f overflow gives Infinity instead of CX_SY_ARITHMETIC_OVERFLOW
  - #2189 f to i / int8 beyond the range: no CX_SY_CONVERSION_OVERFLOW (comments: int8, p, text, n, ** into i)
  - #2190 sqrt/log/log10/acos outside the domain give NaN instead of CX_SY_ARG_OUT_OF_DOMAIN
- i:
  - #2192 no CX_SY_ARITHMETIC_OVERFLOW for i; the skipped integer.ts "overflow" test expects the wrong class
  - #2193 i to a short c keeps the leading digits, SAP the right end with *
- int8:
  - #2195 ipow( ) with an int8 base as a double (SAP exact; ** is f, #2165)
  - #2196 text with decimals to int8: JavaScript SyntaxError, SAP rounds ('2.5' -> 3)
  - #2197 template DECIMALS ignored for int8
- b and s (DDIC INT1/INT2):
  - #2199 run as i (abaplint ddic.ts maps INT1/INT2 to IntegerType): no range check, DESCRIBE FIELD gives I 4
- n:
  - #2202 text to n keeps only the digits of a leading number: '12.5' gives 00012, '#' gives 00NaN
  - #2203 n compared with c, string or n of another length as text, SAP compares numbers
  - #2204 x to n gives zeros, n to x reads the digits as hex
  - #2205 write to n with offset and length replaces the whole field
  - #2206 n cannot hold blanks: SHIFT and TRANSLATE lose them
  - #2207 template ALPHA = OUT on n drops the field length, all zeros give an empty text

Not reviewed yet: c, string, x, xstring, d, t, utclong.

### abaplint: internal table issues to check

- [ ] open issues on parsing / syntax checking internal tables, reviewed 2026-11-21
  - reviewed: the snippet of each issue run through check_syntax + parser_error on main (after abaplint#4614).
    Next step for each: run it on the real system, then fix with a test, or comment and ask to close
  - **still wrong in abaplint** (no error, or an error on valid code):
    - abaplint#2529 `IF !line_exists( ... )`, `!lines( )`, `!to_upper( )`: parser error, SAP accepts the `!`
    - abaplint#3218 `HASHED TABLE ... WITH NON-UNIQUE KEY`: no error, SAP: a hashed key must be unique
    - abaplint#3924 `SORTED TABLE ... WITH UNIQUE EMPTY KEY`: no error (expected on SAP: an empty key must be non-unique)
    - abaplint#1790 `DELETE itab.`, `MODIFY itab.`, `INSERT itab.` (short forms) on a table without a header line: no error
    - abaplint#2455 `INSERT str INTO TABLE int_tab` (string into a table of i): no error, SAP: incompatible
      (the SPLIT ... INTO TABLE half of the issue is fixed)
    - abaplint#3209 a table WITH HEADER LINE passed to a table-typed method parameter: no error
    - abaplint#3231 `DATA lr LIKE REF TO val` with `val TYPE data`: no error (the `TYPE STANDARD TABLE` half
      of the issue now gives "cannot be generic", check the message SAP gives)
    - abaplint#1459 v702: `READ TABLE ... WITH KEY f = lcl=>m( )`, method call as a key value: no error
    - abaplint#1545 v750: `FILTER #( tab IN ftab WHERE ... )`: no error; check on SAP which release allows `IN`
    - abaplint#3041 `APPEND INITIAL LINE TO sorted_tab`: no error (hashed gives one); check on SAP whether
      sorted is a syntax error or only a runtime one (ITAB_ILLEGAL_SORT_ORDER), close if runtime
  - **already fixed**, commented 2026-11-21 asking to close, waiting for larshp:
    - abaplint#363 `APPEND ... TO tab[ ... ]-files`: "table expression not allowed in target"
    - abaplint#609 `DATA foo TYPE STANDARD TABLE.` / `... TABLE OF.`: generic / parser error
    - abaplint#1548 `integers = 2.` into a table: "Incompatible types"
    - abaplint#1744 `FOR GROUPS _grp OF ...` inside VALUE: `_grp` found now
    - abaplint#3431 table with DEFAULT KEY into a parameter typed WITH EMPTY KEY: "Method parameter type not compatible"
  - **need DDIC dependencies to reproduce** (ed-holland, deps not public): abaplint#3352 `READ TABLE` on a
    TABLES work area "not a table type", abaplint#3361 `INCLUDE STRUCTURE bdclm` "not structured"
  - not parsing, rule ideas only (leave): #737, #1855, #1933, #2234, #2381, #3244, #3825

#### Fix plan (2026-11-21), target 7.58 (816), reporters assumed right for now

Rules for these PRs (larshp reviews each one):
- one issue per PR (or two that touch the same lines), ~10-30 lines of code plus tests in `test/rules/check_syntax.ts`
- a new error fires only for the exact case of the issue, nothing broader
- only if several of these PRs are open at the same time: keep them on different source files

Priority 1, small and safe, independent files (can run two in parallel):
- [ ] PR 1: #3218 + #3924 table keys, in `5_syntax/expressions/type_table.ts`: error for an explicit `NON-UNIQUE`
  key on HASHED, and for `UNIQUE EMPTY KEY`; a hashed `WITH KEY` without uniqueness stays allowed (generic, TYPES)
- [ ] PR 2: #3231 `LIKE REF TO` a generically typed data object (`TYPE data`, `any`): error in the `LIKE REF TO`
  branch of `basic_types.ts` (`DataReference` of `data` is not generic, as `TYPE REF TO data` is valid)
- [ ] PR 3: #1790 part 1, `MODIFY itab.` and `INSERT itab.` on a table without a header line:
  `modify_internal.ts`, `insert_internal.ts`
- [ ] PR 4: #2529 `!` before function and method names: `MethodName` regex `^!?`, strip the `!` in the method /
  builtin lookup (precedent: ClassName, MethodParamName, FormName, `_current_scope.ts`). Accepts more, no breakage.
  Follow-up: transpiler test that `!lines( )` works

Priority 2, more care:
- [ ] PR 5: #1790 part 2, `DELETE itab.`: valid inside `LOOP AT itab` (deletes the current line) on any index table,
  outside it needs a header line; needs the loop stack (`loopTables` in `syntax.ts`) passed via `SyntaxInput`
- [ ] PR 6: #3209 table with header line, without `[]`, to a table-typed method parameter: check in
  `method_call_param.ts`, not in `TypeUtils.isAssignableStrict`; first make sure `tab[]` resolves without header line
- [ ] PR 7: #2455 `INSERT str INTO TABLE int_tab`: add the pair character-like source -> numeric row type to the
  special cases in `insert_internal.ts`, no general "must be compatible" rule

Priority 3, unclear or outside 7.58:
- [ ] #3041 `APPEND INITIAL LINE TO sorted_tab`: the issue gives no SAP message, the docs suggest a runtime check
  (ITAB_ILLEGAL_SORT_ORDER); measure on 7.58 before any PR, ask to close if runtime only
- [ ] #1545 `FILTER ... IN` below 7.51: one line, `ver(Release.v751, ...)` in `filter_body.ts`; optional
- [ ] #1459 v702 method call in `READ TABLE ... WITH KEY`: the shared `SimpleSource4` allows method calls in all
  statements, a fix touches widely used grammar; defer

## Fork branches

Cleaned up 2026-11-21: all merged branches deleted on the fork and locally. Left: `main`, `agenda`,
`types-alias-qualified-name` (abaplint#4612).

## Done

### abaplint

- [x] abaplint#4612 TYPES TYPE <integer, string or table type> creates a new type (closes #4609), merged 2026-11-21
- [x] abaplint#4614 length in brackets, `DATA foo(8) TYPE d` (closes #4613), merged 2026-11-21
- [x] abaplint#4611 TYPES TYPE <DDIC structure> creates a new type (closes #4608), merged 2026-11-21
- [x] abaplint#4602 LENGTH only for c/n/x/p, DECIMALS only for p (closes #1988), merged 2026-11-19
- [x] abaplint#4603 DECIMALS with LIKE, merged 2026-11-19
- [x] abaplint#4600 GROUP BY DESCENDING and AS TEXT (closes #4599), merged 2026-11-19
- [x] abaplint#4551 LOOP AT ... GROUP BY typing (closes #4482), merged 2026-11-19
- [x] abaplint#4545 predicate functions outside logical expressions, numeric functions in WRITE and MESSAGE, merged 2026-11-20
- [x] abaplint#4562 FOR and LET local names, merged 2026-11-18

### transpiler

- [x] transpiler#2158 inheritance tests, checked on a real system, merged 2026-11-20
- [x] transpiler#2155 int8 to string and c puts the sign last, as for i, merged 2026-11-20
- [x] transpiler#2152, #2153, #2154 SHIFT IN BYTE MODE, flat structure moves, SORT without BY, merged 2026-11-20
- [x] transpiler#2139 AS TEXT: SORT and FOR GROUPS (#2159), LOOP AT ... GROUP BY (#2161, issue #2160), merged 2026-11-20
- [x] transpiler#2138 LOOP AT ... GROUP BY and LOOP AT GROUP (closes #2022), merged 2026-11-19
