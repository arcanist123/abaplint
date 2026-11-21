# Agenda

Changes I want to get into abaplint/abaplint and abaplint/transpiler `main`, shared across laptops.
Numbers: `abaplint#` = abaplint/abaplint, `transpiler#` = abaplint/transpiler.

## Purpose

Support the open-steamgate development of oisee: make the abaplint parser and the transpiler behave
as close to ABAP as possible, while keeping the output compilable to Go.

- ABAP behaviour is the reference, not abaplint's rules: when they differ, follow ABAP
- the expected behaviour is worked out (keyword documentation, the snippets in the issues) before it goes
  into a test or a PR
- no change that would stop the generated code from compiling to Go

This branch (`agenda`) has no code, only this file. Pull before editing, push after.

```
git fetch origin agenda && git worktree add ../abaplint-agenda agenda   # first time on a laptop
git -C ../abaplint-agenda pull                                           # afterwards
```

## Working rules

- larshp reviews and merges; I have triage only. Do not merge main into an open PR or press "Update branch"
  unless GitHub shows a conflict or larshp asks: out of date is fine, neither repo requires up-to-date branches,
  and an update restarts CI and races with his merges
- close only my own issues; for other people's fixed issues, comment with the evidence (PR, test) and let them close


## In progress (status 2026-11-21 night)

### abaplint: open PRs, waiting for review

- [ ] **abaplint#4625** `me` cannot be used in static methods (#3560), branch `me-in-static-method`
- [ ] **abaplint#4626** implement_methods: a method once when its interface is reached via several interfaces (#3212;
  maybe also #3594, not checked), branch `implement-methods-duplicates`
- [ ] **abaplint#4628** FOR TESTING method in a class which is not a test class (#2612; void super class not
  reported), branch `for-testing-in-non-test-class`
- [ ] **abaplint#4629** ALIASES name already used by a method, attribute or type (#2685), branch `alias-name-conflicts`
- [ ] **abaplint#4632** DEFAULT and OPTIONAL on the same method parameter (closes #1738), branch `default-and-optional`
- [ ] **abaplint#4633** METHODS see only the types defined above them (closes #2556), branch `type-before-definition`
- [ ] **abaplint#4631** IntegerType: byte size for DDIC INT1 and INT2 (closes #4630, my issue), branch `integer-bytes`;
  the abaplint side of transpiler#2199
- #4625 and #4628 add tests at the same place in `test/abap/syntax/syntax.ts` as the merged #4627: a conflict is
  likely, rebase only when GitHub shows it

### transpiler: open PRs

Approved by larshp, waiting for him to merge:
- [ ] transpiler#2168 hex to int8, last eight bytes, two's complement (#1673)
- [ ] transpiler#2173 tests for operations on p
- [ ] transpiler#2198 tests for operations on int8
- [ ] transpiler#2211 f to c with a decimal point, right-aligned (closes #2186); changes the expectation of the #1847
  test "Float, a value written out can be read back" (oisee) from a comma to the expected ABAP result

Waiting for review:
- [ ] transpiler#2151 VALUE integer literal above 2^53 (#2150)
- [ ] transpiler#2169 int8 arithmetic overflow (#2042), branch `int8-overflow`
- [ ] transpiler#2201 class constructors run at the first use of the class (closes #1849); larshp was reluctant over
  overhead, results posted on #1849 2026-11-20
- [ ] transpiler#2209 f to p rounds a half away from zero, also negative (closes #2187)
- [ ] transpiler#2210 sqrt, log, log10, acos outside their domain raise (closes #2190); only the cases worked out,
  `log10( 0 )` and `asin` unchanged
- [ ] transpiler#2212 f in string templates with 17 significant digits, without trailing zeros (part of #2185);
  updates the "basic float" expectation in `test/expressions/string_template.ts` (10.239000000000001)

Not mine: transpiler#2101 (christianguenter2) super class constructor calls reach the redefinition (#2100), still open.

Asked larshp to close (comment 2026-11-21): transpiler#636, fixed by #1178, test "throw CX_SY_DYN_CALL_ILLEGAL_METHOD".

## Next

### abaplint: class issues, plan of fixes (2026-11-21)

Reproduced with check_syntax and the rules on main: abaplint misses all five. One PR each, in this order.

- [ ] **#1738** DEFAULT and OPTIONAL on the same parameter: expected to be a syntax error at `OPTIONAL`.
  PR abaplint#4632, tests in `test/abap/syntax/method_param_keyword.ts`
- [ ] **#2556** type used in the class definition before its `TYPES`: expected error "type unknown", both when the
  type follows in the same section and in a later one. PR abaplint#4633, branch `type-before-definition`:
  while a METHODS statement is checked, `CurrentScope.findType` skips the class or interface types defined after
  it and keeps searching outward (a program type of the same name is used, as expected in ABAP); reported by
  unknown_types, tests in `test/rules/unknown_types.ts`. DATA, CONSTANTS, TYPES before their TYPES were already
  reported. Follow-ups of the same kind, later PRs: `METHODS m IMPORTING p LIKE mv` before `DATA mv`, `EVENTS`
  parameters, `TYPE lcl=>ty` qualified with the class itself
- [ ] **#1561** implement_methods false positive: interface implemented ABSTRACT in the super class with an alias,
  method redefined through the alias in the subclass that also implements an interface including the first one.
  Expected: no error
- [ ] **#2097** write to a READ-ONLY attribute from outside the class: expected errors for `SORT ref->attr`,
  `ref->attr = ...`, `cls=>static_attr = ...` and `ref->intf~attr = ...`; reads are fine, and so are writes in the
  class itself and in a subclass. Broader: every write position needs the check. Still to work out: oisee's
  comment that a write through an interface reference is refused also inside the implementing class
- [ ] **#2033** prefix_is_current_class `me->attribute`: a new option, as larshp suggested; ask him for the name
  before a PR. Leave `me->val = val` (parameter shadows the attribute) unreported. The `unused_types` part of the
  issue no longer reproduces on main
- [ ] side finding, no issue yet: `DATA lv TYPE me=>ty_i` is expected to be a syntax error (type ME unknown),
  abaplint accepts it; `TYPE me->ty_i` is valid. Small separate PR
- [ ] #1727 leftover: duplicate parameter names also give a follow-on "Method definition ... not found"
- [ ] #3593 `METHODS setup FOR TESTING`: larshp says only a warning, leave
- not checked: #1753 (needs the abapGit code), #3355 (needs the reporter's deps), #3730 (looks as expected)

Reviewed earlier, 2026-11-21. Open with a PR: #3560 (#4625), #3212 (#4626), #2612 (#4628), #2685 (#4629); fixed:
#2096 (#4627). Already fixed on main, asked the authors to close (comments 2026-11-21): #3715, #2274, #2099, #1727,
#1712 (hover part not checked), #1695, #1539, #3161, #3596. #4393 / #2212 non-final global class with only a PUBLIC
SECTION: in modern ABAP expected to be a warning, not an error; nothing for check_syntax, thread updated.

### abaplint: redundant_conversion #4254 (mbtools, low priority, bug)

`DATA(y) = CONV ty_p( 2 * x ).` with x of the same p type: the CONV is needed, without it the inline
declaration gets the calculation type, not ty_p.

- [x] reproduced on main 2026-11-21: no issue any more. Fixed after the issue was opened (2026-08-28) by larshp's
  #4448 (merged 2026-10-15), which stopped reporting a CONV around arithmetic in an inline declaration; its test
  `DATA(t31) = CONV f( t30 / 2 )` (cnt 0) in `test/rules/redundant_conversion.ts` is the f variant of the snippet
- [ ] small PR: the snippet of the issue as a test in `test/rules/redundant_conversion.ts` (p with DECIMALS,
  `2 * x`, cnt 0), plus the case that stays reported: `y = CONV ty_p( 2 * x ).` with `y TYPE ty_p` declared
  (the assignment converts into ty_p by itself, cnt 1)
- [ ] after the PR: comment on #4254 with #4448 and the test, mbtools closes (not my issue)

### abaplint: internal table issues, rest

Reviewed 2026-11-21 (each snippet through check_syntax on main). Fixed and closed: #363, #609, #1548, #1744, #3431
(already fixed, closed after my comments), #3218, #3924, #3231, #1790, #2529, #3209, #2455 (my PRs).

- [ ] #3041 `APPEND INITIAL LINE TO sorted_tab`: the issue gives no message, the docs suggest a runtime check
  (ITAB_ILLEGAL_SORT_ORDER); work out the expected behaviour before any PR, ask to close if runtime only
- [ ] #1545 `FILTER ... IN` below 7.51: one line, `ver(Release.v751, ...)` in `filter_body.ts`; older releases, optional
- [ ] #1459 v702 method call in `READ TABLE ... WITH KEY`: the shared `SimpleSource4` allows method calls in all
  statements, a fix touches widely used grammar; defer
- [ ] `INSERT itab.` parses as InsertDatabase (context-free parser); putting it in the InsertInternal grammar is a
  design question for larshp, not raised
- [ ] abaplint#4615 follow-up: `cloneType` does not handle packed (`TYPES ty TYPE <DEC dtel>` keeps the DDIC name)
- need DDIC dependencies to reproduce (ed-holland, deps not public): #3352, #3361
- rule ideas, not parsing (leave): #737, #1855, #1933, #2234, #2381, #3244, #3825
- testing note: `npm test`/`--parallel` gives 25-37 "statement type" failures, all 250ms timeouts under load, and a
  timeout skips the rest of that file. Serial: `npx mocha --no-config --no-package --recursive build/test/abap/syntax`
  (the package.json `spec` overrides a folder argument otherwise)

### transpiler: f, rest of the fix plan (2026-11-21)

- [ ] #2188 f overflow gives Infinity: in `Float.set(number)`, a value that is not finite raises
  CX_SY_ARITHMETIC_OVERFLOW (all f operations build their result through it; text goes another path).
  After #2210 is merged, else `sqrt( -1 )` would give the overflow instead of the domain error
- [ ] #2189 f to i beyond the range: CX_SY_CONVERSION_OVERFLOW in the f/decfloat branch of `Integer.set( )` only,
  not the commented-out general check (integer arithmetic goes through it, that is #2192 with another class).
  The int8 target after #2168 and #2169 are merged (both touch `integer8.ts`); the other sources in the comments
  (int8, p, text, n to i/int8) as later PRs of the same pattern
- [ ] #2185 rest: STYLE = ENGINEERING and EXPONENT, together with #2176 (p, i) and #2182 (decfloat)
- testing: `rm -rf build && npx tsc` in the transpiler root (stale compiled tests of other branches stay in
  `build/` otherwise), then `npx mocha --no-config --no-package --recursive --require source-map-support/register
  build/test`; the 163 "Top level tests, Database" need Postgres and fail locally on every branch

### transpiler: other

- [ ] int8 issues raised by others: #1963 (oisee) int8 to and from x/xstring disagree with ABAP, nobody on it;
  #1673 PR #2168; #2042 PR #2169 (known gap stated in the PR: unary minus or abs( ) of the int8 minimum into p)
- [ ] abaplint#4615 follow-up: `transpile_types.ts` emits ddicName only for Character and Structure, so RTTI
  `is_ddic_type( )` for i, string, n, x and tables needs a transpiler PR
- [ ] abaplint#4619 follow-up: a transpiler test that `!lines( )` works

### Raised by me, nobody on them yet (transpiler)

Found in the type-by-type review (2026-11-20); passing operations are covered by the test PRs.

- found while fixing #2042: #2165 `**` with int8 is exact, ABAP calculates in f; #2166 p compared with int8
  through a double; #2167 p arithmetic loses digits above 2^53
- p (not covered by tests yet: MOD, DIV, **, compares, ADD/SUBTRACT/..., COLLECT/SORT/READ by p, SELECT/INSERT
  with p columns, template SIGN/NUMBER/STYLE, EXACT, zero divide):
  - #2170 unary minus applies to the whole expression, `- a + b` is `- ( a + b )` (all types)
  - #2171 MOD with p operands rounds the remainder, 7.5 MOD 2 gives 2
  - #2172 p target too small: CX_SY_CONVERSION_OVERFLOW, ABAP raises CX_SY_ARITHMETIC_OVERFLOW
  - #2174 p to c: number text instead of right-aligned, decimals, sign last; overflow not cut left with `*`
  - #2175 p to n truncates and keeps the minus sign (comments: decfloat, f, i, n arithmetic too)
  - #2176 string templates ignore SIGN = LEFTPLUS/RIGHTPLUS/RIGHT, ALIGN with WIDTH, STYLE = SCIENTIFIC
- decfloat16/34:
  - #2177 ** with a fractional exponent and sqrt( ) as a double; sqrt( 6.25 ) gives the root of 6
  - #2178 integer literals into a decfloat34 target as a double (1 / 3)
  - #2179 decfloat34 to c and string: decimal comma, alignment, scale
  - #2180 f to decfloat34: ABAP takes 17 digits (0.1 -> 0.10000000000000001)
  - #2181 no CX_SY_ARITHMETIC_OVERFLOW beyond the exponent range
  - #2182 templates ignore SCIENTIFIC, ENGINEERING, SIGN_AS_POSTFIX, SCALE_PRESERVING, EXPONENT
  - #2183 COLLECT sums decfloat34 as a double
  - comment on #963 (decfloat16 not rounded to 16 digits)
- f: #2185 (PR #2212 for the plain text), #2186 (PR #2211), #2187 (PR #2209), #2188, #2189, #2190 (PR #2210),
  see the f plan above
- i:
  - #2192 no CX_SY_ARITHMETIC_OVERFLOW for i; the skipped integer.ts "overflow" test expects the wrong class
  - #2193 i to a short c keeps the leading digits, ABAP keeps the right end with *
- int8:
  - #2195 ipow( ) with an int8 base as a double (ABAP exact; ** is f, #2165)
  - #2196 text with decimals to int8: JavaScript SyntaxError, ABAP rounds ('2.5' -> 3)
  - #2197 template DECIMALS ignored for int8
- b and s (DDIC INT1/INT2):
  - #2199 run as i (abaplint ddic.ts maps INT1/INT2 to IntegerType): no range check, DESCRIBE FIELD gives I 4;
    abaplint side in abaplint#4631
- n:
  - #2202 text to n keeps only the digits of a leading number: '12.5' gives 00012, '#' gives 00NaN
  - #2203 n compared with c, string or n of another length as text, ABAP compares numbers
  - #2204 x to n gives zeros, n to x reads the digits as hex
  - #2205 write to n with offset and length replaces the whole field
  - #2206 n cannot hold blanks: SHIFT and TRANSLATE lose them
  - #2207 template ALPHA = OUT on n drops the field length, all zeros give an empty text

Not reviewed yet: c, string, x, xstring, d, t, utclong.

## Fork branches

Merged PR branches are deleted after the merge. To delete now (merged since the last cleanup):
abaplint `delete-itab-short-form`, `escaped-method-names`, `header-line-method-param`,
`insert-text-into-numeric-table`, `me-reserved-name`; transpiler branches of #2162, #2163, #2184, #2191,
#2194, #2200, #2208.

## Done

### abaplint

- [x] abaplint#4627 `me` cannot be declared as parameter, attribute or variable in classes (#2096; `super`,
  `space` from the comments not covered), merged 2026-11-21
- [x] abaplint#4622 INSERT a character-like data object into a numeric table (#2455), merged 2026-11-21
- [x] abaplint#4621 table with header line passed to a table parameter (#3209), merged 2026-11-21
- [x] abaplint#4620 DELETE short forms need a header line, outside a LOOP (closes #1790), merged 2026-11-21
- [x] abaplint#4619 escaped function and method names, `!line_exists( )` (closes #2529), merged 2026-11-21
- [x] abaplint#4618 MODIFY and INSERT short forms need a header line (#1790 part 1), merged 2026-11-21
- [x] abaplint#4617 LIKE REF TO a generically typed data object (closes #3231), merged 2026-11-21
- [x] abaplint#4616 HASHED key cannot be NON-UNIQUE, EMPTY KEY cannot be UNIQUE (closes #3218, #3924), merged 2026-11-21
- [x] abaplint#4615 DDIC name for data elements of every data type and for table types (closes #4610), merged 2026-11-21
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

- [x] transpiler#2163 CASE TYPE OF: WHEN TYPE without INTO, and interfaces (closes #2156), merged 2026-11-21
- [x] transpiler#2162 CALL METHOD (name)=>(meth) finds local classes (closes #2157), merged 2026-11-21
- [x] tests for operations: #2184 (decfloat16/34), #2191 (f), #2194 (i), #2200 (INT1/INT2), #2208 (n), merged 2026-11-21
- [x] transpiler#2158 inheritance tests, merged 2026-11-20
- [x] transpiler#2155 int8 to string and c puts the sign last, as for i, merged 2026-11-20
- [x] transpiler#2152, #2153, #2154 SHIFT IN BYTE MODE, flat structure moves, SORT without BY, merged 2026-11-20
- [x] transpiler#2139 AS TEXT: SORT and FOR GROUPS (#2159), LOOP AT ... GROUP BY (#2161, issue #2160), merged 2026-11-20
- [x] transpiler#2138 LOOP AT ... GROUP BY and LOOP AT GROUP (closes #2022), merged 2026-11-19
- inheritance gaps (transpiler `instructions/inheritance-gaps.md`): #2156 and #2157 fixed; #2100 (PR #2101,
  christianguenter2) and #1849 (PR #2201) open
