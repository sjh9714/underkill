# underkill

**Your AI coding agent over-builds. This is a skill that stops it — and a benchmark that proves the number.**

[![ci](https://github.com/sjh9714/underkill/actions/workflows/ci.yml/badge.svg)](https://github.com/sjh9714/underkill/actions/workflows/ci.yml)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

Ask a coding agent for a small thing and it hands you an options object, a
config file, a strategy pattern, and error handling for cases that can't happen.
It optimizes for *looking* complete. `underkill` is a short, opinionated skill
(for Claude Code, Codex, and Cursor) that makes it build **exactly what you
asked — nothing more.**

The internet is full of "lazy senior dev mode" prompts. What's missing is
evidence. So `underkill` ships with a reproducible benchmark that runs the same
tasks with the skill **on vs. off** and measures what actually changes.

## The claim (measured, not vibes)

> ⚠️ Placeholder — these numbers get filled in by the benchmark in [`bench/`](bench/).
> They are generated deterministically from `bench/results/` by `npm run report`,
> never typed by hand. See [Methodology](#methodology).

| Metric (skill off → on) | Result |
|---|---|
| Unrequested-scope traps triggered | `TBD → TBD` |
| Accuracy (acceptance tests passing) | `TBD → TBD` (must not drop) |
| Source lines added (median) | `TBD → TBD` |
| Cost per task | `TBD → TBD` |

*Run on `TBD` across `12` tasks × `5` trials. Full per-task table and raw logs below.*

## Install (30 seconds)

**Claude Code** — paste [`skill/dist/claude-code/CLAUDE.md.snippet`](skill/dist/claude-code/CLAUDE.md.snippet)
into your `CLAUDE.md` (project root, or `~/.claude/CLAUDE.md` for every project).
Or drop [`skill/SKILL.md`](skill/SKILL.md) into `.claude/skills/underkill/`.

**Codex** — paste [`skill/dist/codex/AGENTS.md.snippet`](skill/dist/codex/AGENTS.md.snippet) into your `AGENTS.md`.

**Cursor** — copy [`skill/dist/cursor/underkill.mdc`](skill/dist/cursor/underkill.mdc) into `.cursor/rules/`.

## The rules

The whole skill is six rules ([`skill/rules.md`](skill/rules.md) is the source
of truth; every variant is generated from it):

1. **Scope lock** — build only what was asked; extra ideas go in a note, not the code.
2. **Rule of three** — no abstraction until 3+ real call sites in this diff.
3. **No unrequested surface** — no config, options, flags, exports, or deps you weren't asked for.
4. **Boundary-only validation** — validate at system edges; trust internal code.
5. **Declare the diff budget** — state the size before coding; re-scope if it blows 1.5×.
6. **Simplify pass** — before "done", delete everything the request and tests don't require.

## Before / after

> ⚠️ Placeholder — replaced with a real diff pulled from a benchmark run.

```diff
  // "add a function that fetches a URL and retries on failure"
- // skill OFF: 45 lines — RetryOptions interface, backoff strategy, custom error class
+ // skill ON:  12 lines — does exactly that
```

## Methodology

Skeptical? Good. The benchmark is built to survive scrutiny:

- **Accuracy is the primary gate.** Every task has hold-out acceptance tests the
  agent never sees. Less code that breaks the tests counts as a failure, and the
  pass rate is reported for both conditions — if the skill makes the agent worse,
  that number shows it.
- **We measure unrequested scope, not "less code."** The headline metric is a
  per-task checklist of things you didn't ask for (an options object, a new
  dependency, a strategy pattern). LOC is a secondary proxy.
- **No cherry-picking.** Tasks and the protocol are committed *before* results
  exist (provable by commit hash). Every task appears in the table, including the
  ones where the skill does nothing. Raw per-run logs ship as release artifacts.
- **Fixed and recorded.** Model alias, CLI version, and run date are written into
  `results.json` for every run.
- **What on-vs-off does and doesn't claim.** The "on" condition injects the exact
  snippet you'd install; "off" is a bare workspace — the real-world default. That
  answers "does installing this help?", not "would any instructions help?" —
  instruction-presence is a possible confound, checkable with a small
  placebo-instructions arm in the pilot.

See [`docs/DESIGN.md`](docs/DESIGN.md) for the full design and the skeptic-defense matrix.

Reproduce:

```bash
npm install
npm run bench -- --model claude-opus-4-8 --trials 5
npm run report      # regenerates the tables above from bench/results/
```

## License

MIT — see [LICENSE](LICENSE).
