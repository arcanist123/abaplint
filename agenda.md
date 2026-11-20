# Agenda

Changes I want to get into abaplint/abaplint `main`, shared across laptops.
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

## Next

- [ ] transpiler#2139: AS TEXT in SORT, FOR GROUPS, LOOP AT ... GROUP BY
- [ ] transpiler: make sure inheritance behaves as on a real ABAP system
  - review the inheritance tests the transpiler already has
  - list the gaps and add tests for them
  - syntax-check and run every new test on the real system before it goes into a PR
  - 2026-11-20: 16 SAP-checked tests in `test/code_structure/inheritance.ts`, PR #2158 (branch `inheritance-tests`)
  - gaps raised 2026-11-20 (details in transpiler `instructions/inheritance-gaps.md`):
    1. indirect and dynamic calls from a super class constructor reach the redefinition: #2100 (existing, commented)
    2. CASE TYPE OF: `WHEN TYPE x.` without INTO crashes, `WHEN TYPE <interface>` never matches: #2156
    3. class constructors run at load, SAP on first use: #1849 (existing, commented with SAP results)
    4. `CALL METHOD ('LCL_X')=>('M')` does not find local classes: #2157
  - each fix PR brings its own test

## Fork branches to clean up or finish

- `for-let-local-names`
- `like-decimals`
- `new-object-data-ref-inferred-type`
- `hvam/align2310`, `hvam/memory2110`

## Done

- [x] transpiler#2138 LOOP AT ... GROUP BY and LOOP AT GROUP (closes #2022), merged 2026-11-19
- [x] #4551 LOOP AT ... GROUP BY typing (closes #4482)
- [x] #4600 GROUP BY DESCENDING and AS TEXT (closes #4599)
- [x] #4545 predicate functions outside logical expressions, numeric functions in WRITE and MESSAGE
