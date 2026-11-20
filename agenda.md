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
- [ ] transpiler#2022 / #2138: LOOP AT ... GROUP BY, unblocked by the abaplint type fixes
- [ ] transpiler: make sure inheritance behaves as on a real ABAP system
  - review the inheritance tests the transpiler already has
  - list the gaps and add tests for them
  - syntax-check and run every new test on the real system before it goes into a PR
  - 2026-11-20: 16 SAP-checked tests in `test/code_structure/inheritance.ts`, branch `inheritance-tests` (local, not pushed)
  - gaps found, no issues raised yet (drafts in transpiler `instructions/inheritance-gaps.md`):
    1. indirect and dynamic calls from a super class constructor reach the redefinition (SAP `AB`, transpiler `BB`)
    2. CASE TYPE OF: `WHEN TYPE x.` without INTO crashes, `WHEN TYPE <interface>` never matches
    3. class constructors run at load, SAP runs them on first use (only the declaring class for inherited statics)
    4. `CALL METHOD ('LCL_X')=>('M')` does not find local classes

## Fork branches to clean up or finish

- `for-let-local-names`
- `like-decimals`
- `new-object-data-ref-inferred-type`
- `hvam/align2310`, `hvam/memory2110`

## Done

- [x] #4551 LOOP AT ... GROUP BY typing (closes #4482)
- [x] #4600 GROUP BY DESCENDING and AS TEXT (closes #4599)
- [x] #4545 predicate functions outside logical expressions, numeric functions in WRITE and MESSAGE
