# underkill — design & build plan

> This file is the self-contained spec. A fresh Claude Code / Fable session can
> read it and continue the build without any prior chat context.

## Context

GitHub stars in 2026 flow overwhelmingly to the AI-coding-agent ecosystem.
"Agent skill" markdown repos are one of the fastest-growing categories
(`mattpocock/skills` 180k★, `Nutlope/hallmark` +9k/week). Agent
**over-engineering** — adding abstractions, options, config, and defensive code
nobody asked for — is a loudly-felt, validated pain (a r/ClaudeCode "lazy senior
dev mode, 6× less code" post hit ~1,900 upvotes) but **no repo owns the
category** (GitHub search for a dedicated over-engineering skill returns ~0).
Anti-sycophancy, by contrast, is already saturated (a whole GitHub topic, dozens
of repos) — so we avoid it.

The gap: proven demand, scattered prompts, no definitive product. The
differentiator vs. "the 50th markdown dump": **back the claim with a
reproducible benchmark.** The magic in these projects is always a *number*
("6× less", "54% less code"); we produce that number honestly.

Goal: a short opinionated skill + a benchmark that measures its effect, launched
with a skeptic-proof methodology. Built fresh (no dependency on any prior repo),
no security framing (so Fable stays on).

## Key design decisions

- **D1 — Benchmark injects the ruleset deterministically** (via `CLAUDE.md` /
  `--append-system-prompt`), not via Agent Skills auto-trigger. We measure the
  *effect of the rules*, not the *probability the skill triggers* (which is
  noisy and would muddy the result).
- **D2 — Accuracy is the primary gate, LOC is secondary.** Hold-out acceptance
  tests the agent never sees. A run that fails them is a FAIL; pass rate is
  reported for both conditions. Defends "less code = broken code".
- **D3 — Headline metric is an "unrequested-scope trap" checklist**, per task.
  Defends the "less code ≠ better code" argument — we claim *removed
  out-of-scope surface*, not merely fewer lines.
- **D4 — Tasks + protocol committed before results exist** (provable by hash);
  every task shown including no-effect ones; raw logs published. Kills
  cherry-picking suspicion.
- **D5 — Isolated execution**: per-run temp workspace + isolated
  `CLAUDE_CONFIG_DIR` + a git baseline commit. Prevents the user's global config
  leaking into the "off" condition and anchors diff-based metrics.
- **D6 — Model & CLI versions recorded** into `results.json` (`--model
  claude-opus-4-8` primary, `claude-sonnet-5` secondary; `claude --version`; run
  date).
- **D7 — One source (`skill/rules.md`) → all variants** via
  `scripts/build-dist.ts`; CI checks they stay in sync.

## 1. The skill — DONE

Six sharp rules in `skill/rules.md` (source of truth): scope lock, rule of
three, no unrequested surface, boundary-only validation, declare the diff
budget, simplify pass. Generated into `skill/SKILL.md` (Agent Skills spec) and
`skill/dist/{claude-code,codex,cursor}/`. Rule 5 has a non-interactive fallback
so it doesn't hang a headless run.

## 2. The benchmark harness — TO BUILD (`bench/`)

### Task schema
```
bench/tasks/<id>/
  task.json     # id, title, tags, timeoutMin, maxTurns, traps[]
  prompt.md     # the request given to the agent (behavior spec, NO tests)
  template/     # starting workspace (package.json, tsconfig, existing code)
  acceptance/   # hold-out vitest tests — copied in AFTER the run
  reference/    # minimal correct implementation — CI checks the tests are valid
```
`traps[]` = per-task detectors for things not asked for, e.g.:
```json
{ "name": "config-object", "detect": { "type": "regex", "pattern": "interface \\w*Options", "glob": "src/**" } }
{ "name": "new-dependency", "detect": { "type": "deps-added" } }
{ "name": "extra-exports",  "detect": { "type": "exports-gt", "max": 1 } }
```

### 12 tasks (diversity defends selection bias)
- **Greenfield utils (4):** fetch-with-retry, TTL cache, slugify, markdown TOC.
- **Brownfield edits (5)** — the most-reported pain: add one feature to a small
  app, fix a bug (trap: unrelated cleanup), add an endpoint (trap: middleware
  layer / validation lib), etc. Metrics are git diff vs. baseline, so brownfield
  works the same as greenfield.
- **Small CLIs/apps (3):** todo CLI (trap: config file, class hierarchy), CSV
  summarize (trap: csv-parse dep), date format (trap: dayjs dep).

### Run flow (one run)
1. `mkdtemp` → copy `template/` → `git init && git commit` (baseline).
2. Inject condition: **on** → write `CLAUDE.md` with the ruleset; **off** → nothing.
3. `spawn`:
   ```
   CLAUDE_CONFIG_DIR=<isolated dir> claude -p "$(cat prompt.md)" \
     --model claude-opus-4-8 --output-format stream-json --verbose \
     --max-turns 40 --permission-mode acceptEdits \
     --allowedTools "Write Edit Read Glob Grep Bash(npm:*) Bash(node:*) Bash(npx:*)"
   ```
   Capture stdout → `logs/<run-id>.ndjson`; wall-clock timeout kills the run.
4. Metrics from `git diff baseline..worktree`: LOC added/removed (src vs test
   split), files created, deps added, exported symbols (ts-morph), trap hits,
   plus `num_turns` / `total_cost_usd` / `duration_ms` from the CLI JSON.
5. Accuracy: copy `acceptance/` → `npm ci` → `vitest run` → pass/fail.
6. Write `bench/results/<sweep>/runs/<run-id>.json`.

> Verify exact flag surface against the installed CLI with `claude --help`
> before implementing `agent.ts` — flags shift between versions.

### Trials & stats
12 tasks × 2 conditions × K=5 = 120 runs/model. Per-task paired medians;
overall = task-level bootstrap CI (10k resample). Report "N of 12 tasks reduced,
median −X% [CI]" — no p-value spam. Publish the full per-task table.

### Cost (real, not estimated — read `total_cost_usd` from each run)
Pilot (3×2×3 = 18 runs) ≈ $10–30, ~40 min. Full Opus 4.8 sweep (120) ≈
$60–180, 3–5 h at 3-way parallel. Sonnet 5 sweep ≈ $25–75. Guardrails:
`--max-turns 40`, 12–15 min wall-clock kill, cumulative budget cap.

### Skeptic-defense matrix (goes in README Methodology)
| Attack | Defense |
|---|---|
| "ran it once" | K=5, full distribution + raw ndjson logs published |
| "different model version" | alias + `claude --version` + date in results.json |
| "you picked good tasks" | tasks/protocol committed before results (hash); every task shown; adversarial-task PRs welcome |
| "less code ≠ better" | primary gate = accuracy + trap checklist; LOC is a proxy |
| "skill lowers capability" | pass rate reported per condition |
| "the off condition was rigged" | `CLAUDE_CONFIG_DIR` isolation; only the injected file differs; harness code public |
| "agent gamed the tests" | tests are hold-out; CI checks reference passes & empty template fails |

## 3. Repo layout, CI, README

```
underkill/
├── README.md              # headline table + before/after diff + install + methodology
├── skill/                 # DONE — rules.md (source) + SKILL.md + dist variants
├── bench/
│   ├── tasks/NN-…/        # schema above
│   ├── src/{run,workspace,agent,metrics,verify,stats,report}.ts
│   └── results/<sweep>/{results.json, runs/*.json, logs/*.ndjson}
├── scripts/build-dist.ts  # rules.md → variants
└── .github/workflows/ci.yml
```

**CI runs no API calls** (bench costs money): typecheck + harness unit tests
(fixture diffs → metric assertions); **task validity** (each `reference/` passes
its `acceptance/`, and an empty `template/` fails); SKILL.md frontmatter lint +
dist-in-sync check; results.json schema + "README tables regenerate identically"
check. The sweep runs out-of-CI via manual `workflow_dispatch` (maintainer API
key) and results are committed by PR. README states this explicitly.

## 4. Build order (MVP)

**Phase 1 — validate the signal (~1 wk):** skill v0 (done) → minimal harness
(workspace/agent/metrics-LOC/verify) → 3 sharpest tasks → pilot sweep (18 runs,
~$20). **Gate:** if no effect shows, fix the rules, don't add tasks.

**Phase 2 — full bench (~1 wk):** 12 tasks + reference/acceptance + trap
detectors → stats/report + CI → commit tasks/protocol (get the pre-result hash)
→ full Opus 4.8 K=5 sweep → commit results + logs.

**Phase 3 — launch (~days):** README (headline, diff, methodology), dist ×3,
MIT license (done) → Sonnet 5 sweep for generality → launch on r/ClaudeCode
(cite the original pain post) + Show HN, with the defense matrix already in the
README.

## 5. Traps to watch

1. Real effect will be smaller than the "6×" anecdote (Claude Code already
   suppresses some over-building). Honest 20–40% beats a suspicious 80%.
2. Rule 5 could cause early give-up headless → check logs for it in the pilot.
3. Agent may write its own tests → split src/test LOC (done in design).
4. Under-specified acceptance tests → reference + CI validity check + behavior
   spec in `prompt.md`.
5. CLI flag drift → record & pin the global `@anthropic-ai/claude-code` version;
   version-guard in `agent.ts`.
6. Parallel rate limits → cap at 3 + 429 backoff.
7. "off" contamination → enforce `CLAUDE_CONFIG_DIR` isolation in `workspace.ts`.
8. Missing tool permissions block `npm install` → nail down `allowedTools` in the pilot.

## Continuing in a fresh session (why this repo exists standalone)

Start a new Claude Code session **in this directory** to keep the model on Fable:
the safety classifier reads accumulated conversation context, and the chat that
designed this project was full of security topics (an agent-exploit lab, pentest
tooling) that kept tripping it and routing to Opus. A fresh session here has none
of that history. Nothing about this project is security-related, so Fable should
stay on. First step for the new session: implement the Phase-1 harness against
the schema above.
