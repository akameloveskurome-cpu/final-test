# READ ME FIRST BEFORE MAKING ANY CHANGES

Whenever you change anything in this project (a fix, a new feature, a tweak, a new or deleted file), do these 3 things BEFORE you hand back the ZIP.

## 1. Check your work
- Run `npm test` (if `node_modules` is missing, run `npm ci` first). It must show `fail 0` and `skipped 0`. The GitHub build runs it first, and one failing test stops the build ("Process completed with exit code 1").
- If you cannot run it, say so. Do not say it passes.

## 2. Update the docs and the .md files so the next AI knows what happened
- `HANDOFF_STATUS.md`: add a short entry BELOW its first block: WHAT you changed, WHICH files, WHY, and DO NOT REDO (what must not be undone or repeated).
- `docs/HANDOFF.md`: update it if the project changed (new or removed file, new rule, new setting, new test, changed behaviour).
- `UPDATES.md`: add an entry for anything the user can see (one new, unique heading; do not repeat an old heading).
- `README.md` and `docs/FEATURES.md`: update them if a feature was added, removed or changed.
- New feature or fix: add a test in `tests/`.
- Do not change the version number: the owner decides it. Never put a keystore, token or password in the project.

## 3. Tell the user exactly what you changed
In your final answer list: every file you changed, what you changed in it and why, which docs / .md files you updated, and the `npm test` result.

## Careful when editing .md files
Some .md files are checked by `tests/docs-claims.test.mjs`. For example line 1 of `HANDOFF_STATUS.md` must keep mentioning `BUGS.txt`, and `UPDATES.md` must not have two identical headings. After you edit any .md or .json file, run `npm test` again.
