# Agenda

Changes I want to get into abaplint/abaplint `main`, shared across laptops.

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

## In progress

- [ ] **#1988 type D allows LENGTH** — branch `type-length-decimals-check` (local, not pushed yet)
  - check_syntax: LENGTH only for c/n/x/p, DECIMALS only for p, neither on program-defined types
  - to decide: is DECIMALS on `TYPE c` really rejected on a real system? delete the commented-out checks in `ddic.ts`?
  - fork also has an older branch `type-length-decimals`, compare before opening the PR

## Open transpiler PRs (status 2026-11-20)

- #2163 CASE TYPE OF (#2156): changes requested by larshp, CI timed out twice (c9ede517, 4b480613),
  stalled at ~97% of `npm test`; not reproducible locally, passed after merging main (b69fb1a7).
  Comment asking for a re-review posted; main merged in again, CI rerunning
- #2162 CALL METHOD (name)=>(meth) local classes (#2157): up to date with main, waiting for review
- #2151 VALUE integer literal above 2^53 (#2150): rebased onto main (3dba93c4), conflict in
  `test/types/integer8.ts` resolved (kept both tests), waiting for review

## Next

- [ ] transpiler: make sure inheritance behaves as on a real ABAP system
  - review the inheritance tests the transpiler already has
  - list the gaps and add tests for them
  - syntax-check and run every new test on the real system before it goes into a PR
  - 2026-11-20: 16 SAP-checked tests in `test/code_structure/inheritance.ts`, PR #2158, merged
  - gaps raised 2026-11-20 (details in transpiler `instructions/inheritance-gaps.md`):
    1. indirect and dynamic calls from a super class constructor reach the redefinition: #2100, fix in PR #2101 by christianguenter2
    2. CASE TYPE OF: `WHEN TYPE x.` without INTO crashes, `WHEN TYPE <interface>` never matches: #2156, PR #2163 (changes requested over a CI timeout, see above)
    3. class constructors run at load, SAP on first use: #1849, SAP timing measured and a proposal posted
       (larshp is reluctant, overhead); prototype + measurements on branch `lazy-class-constructor`, results posted on #1849 2026-11-20, waiting for larshp on a PR
       (design in transpiler `instructions/class-constructor-1849.md`), to share with oisee
    4. `CALL METHOD ('LCL_X')=>('M')` does not find local classes: #2157, PR #2162
  - each fix PR brings its own test

## Fork branches to clean up or finish

- `for-let-local-names`
- `like-decimals`
- `new-object-data-ref-inferred-type`
- `hvam/align2310`, `hvam/memory2110`

## Done

- [x] transpiler#2155 int8 to string and c puts the sign last, as for i, merged 2026-11-20

- [x] transpiler#2139 AS TEXT: SORT and FOR GROUPS (#2159), LOOP AT ... GROUP BY (#2161, issue #2160), merged 2026-11-20

- [x] transpiler#2138 LOOP AT ... GROUP BY and LOOP AT GROUP (closes #2022), merged 2026-11-19
- [x] #4551 LOOP AT ... GROUP BY typing (closes #4482)
- [x] #4600 GROUP BY DESCENDING and AS TEXT (closes #4599)
- [x] #4545 predicate functions outside logical expressions, numeric functions in WRITE and MESSAGE
