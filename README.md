# underkill

**Your AI coding agent over-builds. This is a 6-rule skill that stops it — and the first accuracy-gated benchmark of the prompts that claim to.**

[![ci](https://github.com/sjh9714/underkill/actions/workflows/ci.yml/badge.svg)](https://github.com/sjh9714/underkill/actions/workflows/ci.yml)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

Ask a coding agent for a small thing and it pads the diff with scope you never
asked for: guards for inputs that can't occur, a usage banner, a helper with
one call site, an options object "for flexibility". It optimizes for *looking*
complete. `underkill` is a short, opinionated skill (for Claude Code, Codex,
and Cursor) that makes it build **exactly what you asked — nothing more.**

The internet is full of "lazy senior dev mode" prompts — the biggest,
[ponytail](https://github.com/DietrichGebert/ponytail), even ships its own
numbers. What none of them have is a **hold-out correctness gate**: proof the
smaller code still does what was asked. `underkill` ships a reproducible
benchmark that scores every condition — no instructions, underkill, ponytail,
and a placebo — against acceptance tests the agent never sees, and publishes
whatever comes out, including where the competition wins.

## The claim (measured, not vibes)

Everything between the markers below — tables and the before/after diff — is
generated deterministically from the raw runs in `bench/results/` by
`npm run report`, never typed by hand (CI fails if it doesn't reproduce
byte-identically). See [Methodology](#methodology).

<!-- BENCH:START -->
### `claude-opus-4-8` — 12 tasks × 5 trials per condition

Run 2026-07-22, CLI `2.1.216 (Claude Code)`, sweep `opus-4-8` (120 runs, $14.40 total). Raw runs, stream logs, and per-run diffs: [`bench/results/opus-4-8/`](bench/results/opus-4-8/).

| Metric (skill off → on) | Result |
|---|---|
| Tasks with reduced source LOC | **8 of 12** |
| Median src LOC delta per task | **-21%** (bootstrap 95% CI -58.5% … 0%) |
| Runs hitting ≥1 unrequested-scope trap | 0/60 → 0/60 |
| Acceptance pass rate (must not drop) | 100% → 100% |

| Task | src LOC (median, off → on) | Δ | trap runs (off → on) | pass (off → on) |
|---|---|---|---|---|
| 01-fetch-retry | 15 → 13 | -13.3% | 0/5 → 0/5 | 5/5 → 5/5 |
| 02-ttl-cache | 20 → 13 | -35% | 0/5 → 0/5 | 5/5 → 5/5 |
| 03-todo-cli | 42 → 18 | -57.1% | 0/5 → 0/5 | 5/5 → 5/5 |
| 04-slugify | 8 → 8 | 0% | 0/5 → 0/5 | 5/5 → 5/5 |
| 05-markdown-toc | 21 → 15 | -28.6% | 0/5 → 0/5 | 5/5 → 5/5 |
| 06-cart-total | 4 → 4 | 0% | 0/5 → 0/5 | 5/5 → 5/5 |
| 07-search-bugfix | 3 → 3 | 0% | 0/5 → 0/5 | 5/5 → 5/5 |
| 08-users-endpoint | 9 → 9 | 0% | 0/5 → 0/5 | 5/5 → 5/5 |
| 09-bulk-discount | 5 → 2 | -60% | 0/5 → 0/5 | 5/5 → 5/5 |
| 10-relative-time | 11 → 10 | -9.1% | 0/5 → 0/5 | 5/5 → 5/5 |
| 11-csv-summarize | 21 → 7 | -66.7% | 0/5 → 0/5 | 5/5 → 5/5 |
| 12-date-format | 15 → 6 | -60% | 0/5 → 0/5 | 5/5 → 5/5 |

#### Before / after — `11-csv-summarize`, the runs at each condition's median (21 → 7 src LOC)

Skill **on** (`11-csv-summarize-on-t2`):

```diff
diff --git a/src/cli.ts b/src/cli.ts
new file mode 100644
index 0000000..defd4ef
--- /dev/null
+++ b/src/cli.ts
@@ -0,0 +1,7 @@
+import { readFileSync } from "node:fs";
+
+const [file] = process.argv.slice(2);
+const lines = readFileSync(file, "utf8").split("\n").filter((l) => l !== "");
+
+console.log(`rows: ${lines.length - 1}`);
+console.log(`cols: ${lines[0].split(",").length}`);
```

<details>
<summary>Skill <b>off</b> (`11-csv-summarize-off-t1`) — click to expand</summary>

```diff
diff --git a/src/cli.ts b/src/cli.ts
new file mode 100644
index 0000000..1a44e18
--- /dev/null
+++ b/src/cli.ts
@@ -0,0 +1,21 @@
+import { readFileSync } from "node:fs";
+
+const file = process.argv[2];
+if (!file) {
+  console.error("usage: npx tsx src/cli.ts <file>");
+  process.exit(1);
+}
+
+const content = readFileSync(file, "utf8");
+const lines = content.split("\n");
+
+// Drop a trailing empty line from a final newline.
+if (lines.length > 0 && lines[lines.length - 1] === "") {
+  lines.pop();
+}
+
+const cols = lines.length > 0 ? lines[0].split(",").length : 0;
+const rows = Math.max(0, lines.length - 1);
+
+console.log(`rows: ${rows}`);
+console.log(`cols: ${cols}`);
```

</details>

#### How does it compare? off / ponytail / underkill

An independent, pre-registered comparison (see D8 in [docs/DESIGN.md](docs/DESIGN.md)): [ponytail](https://github.com/DietrichGebert/ponytail)'s canonical `AGENTS.md` ruleset (v4.8.4 @16f2980, vendored verbatim) ran the same tasks, model, and trial count, injected exactly the way our snippet is. The hold-out accuracy gate applies to every condition equally. Raw runs: [`bench/results/opus-4-8-ponytail/`](bench/results/opus-4-8-ponytail/).

| Metric | off | ponytail | underkill |
|---|---|---|---|
| Median src LOC delta per task | — | -27.9% | -21% |
| Acceptance pass rate | 100% | 100% | 100% |
| Median test LOC written per run¹ | 0 | 11 | 0 |
| Median cost per run | $0.11 | $0.17 | $0.12 |

¹ ponytail's ruleset asks for "one runnable check" after non-trivial logic — that footprint lands in test LOC, which we track separately and never count against src LOC.

| Task | src LOC (median, off / ponytail / underkill) | pass (off / ponytail / underkill) |
|---|---|---|
| 01-fetch-retry | 15 / 13 / 13 | 5/5 · 5/5 · 5/5 |
| 02-ttl-cache | 20 / 19 / 13 | 5/5 · 5/5 · 5/5 |
| 03-todo-cli | 42 / 25 / 18 | 5/5 · 5/5 · 5/5 |
| 04-slugify | 8 / 8 / 8 | 5/5 · 5/5 · 5/5 |
| 05-markdown-toc | 21 / 15 / 15 | 5/5 · 5/5 · 5/5 |
| 06-cart-total | 4 / 4 / 4 | 5/5 · 5/5 · 5/5 |
| 07-search-bugfix | 3 / 2 / 3 | 5/5 · 5/5 · 5/5 |
| 08-users-endpoint | 9 / 9 / 9 | 5/5 · 5/5 · 5/5 |
| 09-bulk-discount | 5 / 2 / 2 | 5/5 · 5/5 · 5/5 |
| 10-relative-time | 11 / 8 / 10 | 5/5 · 5/5 · 5/5 |
| 11-csv-summarize | 21 / 14 / 7 | 5/5 · 5/5 · 5/5 |
| 12-date-format | 15 / 4 / 6 | 5/5 · 5/5 · 5/5 |

### `claude-sonnet-5` — 12 tasks × 5 trials per condition

Run 2026-07-22, CLI `2.1.216 (Claude Code)`, sweep `sonnet-5` (120 runs, $13.80 total). Raw runs, stream logs, and per-run diffs: [`bench/results/sonnet-5/`](bench/results/sonnet-5/).

| Metric (skill off → on) | Result |
|---|---|
| Tasks with reduced source LOC | **6 of 12** |
| Median src LOC delta per task | **-4.1%** (bootstrap 95% CI -21.1% … 0%) |
| Runs hitting ≥1 unrequested-scope trap | 0/60 → 0/60 |
| Acceptance pass rate (must not drop) | 100% → 100% |

| Task | src LOC (median, off → on) | Δ | trap runs (off → on) | pass (off → on) |
|---|---|---|---|---|
| 01-fetch-retry | 18 → 15 | -16.7% | 0/5 → 0/5 | 5/5 → 5/5 |
| 02-ttl-cache | 20 → 16 | -20% | 0/5 → 0/5 | 5/5 → 5/5 |
| 03-todo-cli | 36 → 25 | -30.6% | 0/5 → 0/5 | 5/5 → 5/5 |
| 04-slugify | 8 → 8 | 0% | 0/5 → 0/5 | 5/5 → 5/5 |
| 05-markdown-toc | 20 → 15 | -25% | 0/5 → 0/5 | 5/5 → 5/5 |
| 06-cart-total | 4 → 4 | 0% | 0/5 → 0/5 | 5/5 → 5/5 |
| 07-search-bugfix | 3 → 3 | 0% | 0/5 → 0/5 | 5/5 → 5/5 |
| 08-users-endpoint | 9 → 9 | 0% | 0/5 → 0/5 | 5/5 → 5/5 |
| 09-bulk-discount | 5 → 5 | 0% | 0/5 → 0/5 | 5/5 → 5/5 |
| 10-relative-time | 10 → 10 | 0% | 0/5 → 0/5 | 5/5 → 5/5 |
| 11-csv-summarize | 12 → 11 | -8.3% | 0/5 → 0/5 | 5/5 → 5/5 |
| 12-date-format | 9 → 7 | -22.2% | 0/5 → 0/5 | 5/5 → 5/5 |
<!-- BENCH:END -->

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

## Methodology

Skeptical? Good. The benchmark is built to survive scrutiny:

- **Accuracy is the primary gate.** Every task has hold-out acceptance tests the
  agent never sees. Less code that breaks the tests counts as a failure, and the
  pass rate is reported for both conditions — if the skill makes the agent worse,
  that number shows it.
- **We measure unrequested scope, not "less code."** The headline metric is a
  per-task checklist of things you didn't ask for (an options object, a new
  dependency, a strategy pattern). LOC is a secondary proxy.
- **No cherry-picking.** Tasks and the protocol were committed *before* results
  existed — protocol-freeze commit `b8b53da`; the sweeps land in later commits.
  Every task appears in the table, including the ones where the skill does
  nothing. Raw runs, stream logs, and per-run diffs are committed under
  [`bench/results/`](bench/results/). Think a task is rigged or missing?
  Adversarial task PRs are welcome — the validity gate (reference passes,
  bare template fails, overbuilt fixture fires every trap) runs in CI.
- **Fixed and recorded.** Model alias, CLI version, and run date are written into
  `results.json` for every run.
- **"Any instructions would do that" — checked, and no.** The "on" condition
  injects the exact snippet you'd install; "off" is a bare workspace. A placebo
  arm (style-only instructions of comparable length, no scope rules —
  [`bench/placebo-instructions.md`](bench/placebo-instructions.md)) run on the
  three strongest-effect tasks did **not** reduce code: median src LOC vs off
  went 42→56, 21→26, 15→14, while the skill sits at 18, 7, 6. The effect comes
  from what the rules say, not from a CLAUDE.md existing
  ([raw runs](bench/results/pilot-placebo/)).

See [`docs/DESIGN.md`](docs/DESIGN.md) for the full design and the skeptic-defense matrix.

Reproduce:

```bash
npm install
npm run bench -- --model claude-opus-4-8 --trials 5 --sweep my-sweep
npm run report      # regenerates the tables above from bench/results/
```

Runs are isolated (temp workspace, scratch `CLAUDE_CONFIG_DIR`), capped with
`--max-budget-usd` per run plus a cumulative sweep cap, and resumable — rerun
the same command after a crash and completed runs are skipped.

## License

MIT — see [LICENSE](LICENSE).
