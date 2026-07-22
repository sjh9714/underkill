# Contributing

The most valuable contribution to `underkill` is an **adversarial task**: one
you believe breaks the headline claim — where the skill hurts correctness,
where the traps overcount, or where the "off" condition is unfairly penalized.
Every task ships with machine-checked validity, so a task PR argues with
evidence, not opinions.

## Repository layout

- `skill/rules.md` — the single source of truth for the ruleset.
  `npm run build-dist` regenerates `skill/SKILL.md` and every `skill/dist/*`
  variant from it; CI fails if they drift. Never edit generated files.
- `bench/src/` — the harness (workspace isolation, agent runner, metrics,
  hold-out verification, stats, README report). Unit-tested; CI runs the suite.
- `bench/tasks/<id>/` — one benchmark task per directory.
- `bench/results/<sweep>/` — committed raw runs, stream logs, and per-run
  diffs. The README tables regenerate from these via `npm run report`
  (byte-identical, CI-checked).

## Adding a task

A task directory looks like:

```
bench/tasks/NN-name/
  task.json     # id, title, tags, timeoutMin, maxBudgetUsd, traps[]
  prompt.md     # the request given to the agent — behavior spec, NO tests
  template/     # starting workspace (package.json with vitest, .gitignore, src/)
  acceptance/   # hold-out vitest tests, copied in AFTER the run
  reference/    # minimal correct implementation, mirrors the workspace root
  overbuilt/    # deliberately over-engineered fixture that fires every trap
```

Rules that keep tasks defensible:

1. **Prompt–acceptance parity.** Every behavior `prompt.md` requires must be
   verified by `acceptance/`, or it comes out of the prompt. Untested spec
   lines are attack surface.
2. **Trap precision first.** A trap must never fire on an idiom a minimal
   implementation naturally uses (a local `retries` counter is not
   configurability). Regex traps match comment-stripped source; agent-written
   test files are exempt from `touches-outside`. When in doubt, drop the trap —
   the LOC metric catches residual over-building.
3. **The validity gate must pass** (also enforced in CI):

   ```bash
   npx vitest run bench/src/task-validity.test.ts
   ```

   For every task it asserts: `reference/` passes the acceptance tests, the
   bare `template/` fails them, `reference/` fires **zero** traps, and
   `overbuilt/` fires **every** trap.

## Editing the skill

Edit `skill/rules.md` only, then `npm run build-dist`. Keep it short — shorter
rulesets get followed more reliably. Rule changes invalidate committed sweep
results, so expect a re-run discussion in the PR.

## Development

```bash
npm install
npm run typecheck
npm test                     # harness units + task validity (no API calls)
npm run build-dist -- --check
npm run report -- --check    # README tables regenerate byte-identically
```

CI never calls the model API. Sweeps run locally (`npm run bench`) and results
are committed by PR — model alias, CLI version, and run date are recorded in
each sweep's `sweep.json`.

## Disputing a result

Open an issue with the run id (e.g. `03-todo-cli-off-t2`). Every run's raw
stream log and diff are committed under `bench/results/<sweep>/logs/`, so
disputes can point at exact evidence.
