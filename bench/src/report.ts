// Regenerate the README benchmark section deterministically from
// bench/results/. CI re-runs this and fails on any diff, which proves the
// headline numbers are generated, never hand-typed (D4).
//
// Usage: npm run report [-- --check]
import { existsSync } from "node:fs";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { median, summarize, type Summary } from "./stats.js";
import type { RunResult } from "./types.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const START = "<!-- BENCH:START -->";
const END = "<!-- BENCH:END -->";

export function splice(readme: string, generated: string): string {
  const start = readme.indexOf(START);
  const end = readme.indexOf(END);
  if (start < 0 || end < 0) throw new Error(`README is missing ${START} / ${END} sentinels`);
  return `${readme.slice(0, start + START.length)}\n${generated}\n${readme.slice(end)}`;
}

export function pickRepresentative(runs: RunResult[], target: number): RunResult {
  return [...runs].sort(
    (a, b) =>
      Math.abs(a.locAddedSrc - target) - Math.abs(b.locAddedSrc - target) ||
      a.runId.localeCompare(b.runId),
  )[0];
}

export interface Showcase {
  taskId: string;
  offRunId: string;
  onRunId: string;
  offLoc: number;
  onLoc: number;
  offPatch: string;
  onPatch: string;
}

// Competing-skill comparison (D8): a "<base>-ponytail" sweep attaches a
// three-way table to its base sweep's section.
export interface ComparisonRow {
  taskId: string;
  trials: number;
  off: number;
  pony: number;
  on: number;
  passOff: number;
  passPony: number;
  passOn: number;
}

export interface Comparison {
  rows: ComparisonRow[];
  medianDeltaOffPony: number;
  medianDeltaOffOn: number;
  passRatePony: number;
  // per-run medians: ponytail's rules mandate a self-check, so its footprint
  // shows up as test LOC and cost rather than src LOC — report it, don't hide it
  medianTestLoc: { off: number; pony: number; on: number };
  medianCostUsd: { off: number; pony: number; on: number };
}

export interface ComparisonData extends Comparison {
  ponytailVersion: string;
  sweep: string;
}

const round1 = (x: number): number => Math.round(x * 10) / 10;

export function buildComparison(baseRuns: RunResult[], ponyRuns: RunResult[]): Comparison {
  const taskIds = [...new Set([...baseRuns, ...ponyRuns].map((r) => r.taskId))].sort();
  const rows: ComparisonRow[] = taskIds.map((taskId) => {
    const of = (runs: RunResult[], c: string) =>
      runs.filter((r) => r.taskId === taskId && r.condition === c);
    const off = of(baseRuns, "off");
    const on = of(baseRuns, "on");
    const pony = of(ponyRuns, "ponytail");
    return {
      taskId,
      trials: off.length,
      off: median(off.map((r) => r.locAddedSrc)),
      pony: median(pony.map((r) => r.locAddedSrc)),
      on: median(on.map((r) => r.locAddedSrc)),
      passOff: off.filter((r) => r.accepted).length,
      passPony: pony.filter((r) => r.accepted).length,
      passOn: on.filter((r) => r.accepted).length,
    };
  });
  const deltas = (pick: (row: ComparisonRow) => number) =>
    rows.filter((r) => r.off !== 0).map((r) => round1(((pick(r) - r.off) / r.off) * 100));
  const ponyRunsAll = ponyRuns.filter((r) => r.condition === "ponytail");
  const offAll = baseRuns.filter((r) => r.condition === "off");
  const onAll = baseRuns.filter((r) => r.condition === "on");
  const perRun = (pick: (r: RunResult) => number, round: (x: number) => number) => ({
    off: round(median(offAll.map(pick))),
    pony: round(median(ponyRunsAll.map(pick))),
    on: round(median(onAll.map(pick))),
  });
  return {
    rows,
    medianDeltaOffPony: round1(median(deltas((r) => r.pony))),
    medianDeltaOffOn: round1(median(deltas((r) => r.on))),
    passRatePony: ponyRunsAll.filter((r) => r.accepted).length / Math.max(ponyRunsAll.length, 1),
    medianTestLoc: perRun((r) => r.locAddedTest, round1),
    medianCostUsd: perRun((r) => r.totalCostUsd, (x) => Math.round(x * 1000) / 1000),
  };
}

export interface SweepReport {
  sweep: string;
  startedAt: string;
  summary: Summary;
  showcase?: Showcase;
  comparison?: ComparisonData;
}

const pct = (x: number): string => `${Math.round(x * 100)}%`;
const signed = (x: number): string => (x > 0 ? `+${x}%` : `${x}%`);

function renderComparison(c: ComparisonData): string {
  const sum = (pick: (r: ComparisonRow) => number) => c.rows.reduce((n, r) => n + pick(r), 0);
  const trialsTotal = sum((r) => r.trials);
  const lines = [
    "",
    "#### How does it compare? off / ponytail / underkill",
    "",
    `An independent, pre-registered comparison (see D8 in [docs/DESIGN.md](docs/DESIGN.md)): [ponytail](https://github.com/DietrichGebert/ponytail)'s canonical \`AGENTS.md\` ruleset (${c.ponytailVersion}, vendored verbatim) ran the same tasks, model, and trial count, injected exactly the way our snippet is. The hold-out accuracy gate applies to every condition equally. Raw runs: [\`bench/results/${c.sweep}/\`](bench/results/${c.sweep}/).`,
    "",
    "| Metric | off | ponytail | underkill |",
    "|---|---|---|---|",
    `| Median src LOC delta per task | — | ${signed(c.medianDeltaOffPony)} | ${signed(c.medianDeltaOffOn)} |`,
    `| Acceptance pass rate | ${pct(sum((r) => r.passOff) / trialsTotal)} | ${pct(c.passRatePony)} | ${pct(sum((r) => r.passOn) / trialsTotal)} |`,
    `| Median test LOC written per run¹ | ${c.medianTestLoc.off} | ${c.medianTestLoc.pony} | ${c.medianTestLoc.on} |`,
    `| Median cost per run | $${c.medianCostUsd.off.toFixed(2)} | $${c.medianCostUsd.pony.toFixed(2)} | $${c.medianCostUsd.on.toFixed(2)} |`,
    "",
    `¹ ponytail's ruleset asks for "one runnable check" after non-trivial logic — that footprint lands in test LOC, which we track separately and never count against src LOC.`,
    "",
    "| Task | src LOC (median, off / ponytail / underkill) | pass (off / ponytail / underkill) |",
    "|---|---|---|",
  ];
  for (const r of c.rows) {
    lines.push(
      `| ${r.taskId} | ${r.off} / ${r.pony} / ${r.on} | ${r.passOff}/${r.trials} · ${r.passPony}/${r.trials} · ${r.passOn}/${r.trials} |`,
    );
  }
  return lines.join("\n");
}

function renderSweep({ sweep, startedAt, summary: s, showcase, comparison }: SweepReport): string {
  const lines: string[] = [];
  lines.push(
    `### \`${s.model}\` — ${s.tasksTotal} tasks × ${s.perTask[0]?.trials ?? 0} trials per condition`,
    "",
    `Run ${startedAt.slice(0, 10)}, CLI \`${s.cliVersion}\`, sweep \`${sweep}\` (${s.runsTotal} runs, $${s.totalCostUsd.toFixed(2)} total). Raw runs, stream logs, and per-run diffs: [\`bench/results/${sweep}/\`](bench/results/${sweep}/).`,
    "",
    "| Metric (skill off → on) | Result |",
    "|---|---|",
    `| Tasks with reduced source LOC | **${s.tasksReduced} of ${s.tasksTotal}** |`,
    `| Median src LOC delta per task | **${signed(s.medianDeltaPct)}** (bootstrap 95% CI ${signed(s.ci95[0])} … ${signed(s.ci95[1])}) |`,
    `| Runs hitting ≥1 unrequested-scope trap | ${s.trapRunsOff}/${s.runsTotal / 2} → ${s.trapRunsOn}/${s.runsTotal / 2} |`,
    `| Acceptance pass rate (must not drop) | ${pct(s.passRateOff)} → ${pct(s.passRateOn)} |`,
    "",
    "| Task | src LOC (median, off → on) | Δ | trap runs (off → on) | pass (off → on) |",
    "|---|---|---|---|---|",
  );
  for (const t of s.perTask) {
    lines.push(
      `| ${t.taskId} | ${t.medSrcLocOff} → ${t.medSrcLocOn} | ${t.deltaPct === null ? "—" : signed(t.deltaPct)} | ${t.trapRunsOff}/${t.trials} → ${t.trapRunsOn}/${t.trials} | ${t.passOff}/${t.trials} → ${t.passOn}/${t.trials} |`,
    );
  }
  if (showcase) {
    lines.push(
      "",
      `#### Before / after — \`${showcase.taskId}\`, the runs at each condition's median (${showcase.offLoc} → ${showcase.onLoc} src LOC)`,
      "",
      `Skill **on** (\`${showcase.onRunId}\`):`,
      "",
      "```diff",
      showcase.onPatch.trimEnd(),
      "```",
      "",
      "<details>",
      `<summary>Skill <b>off</b> (\`${showcase.offRunId}\`) — click to expand</summary>`,
      "",
      "```diff",
      showcase.offPatch.trimEnd(),
      "```",
      "",
      "</details>",
    );
  }
  let out = lines.join("\n");
  if (comparison) out += `\n${renderComparison(comparison)}`;
  return out;
}

export function renderReport(sweeps: SweepReport[]): string {
  return sweeps.map(renderSweep).join("\n\n");
}

async function loadRuns(sweep: string): Promise<RunResult[]> {
  const runsDir = path.join(root, "bench/results", sweep, "runs");
  return Promise.all(
    (await readdir(runsDir)).sort().map(async (f) => JSON.parse(await readFile(path.join(runsDir, f), "utf8"))),
  );
}

async function loadSweep(sweep: string, withShowcase: boolean): Promise<SweepReport> {
  const sweepDir = path.join(root, "bench/results", sweep);
  const meta = JSON.parse(await readFile(path.join(sweepDir, "sweep.json"), "utf8"));
  const runs = await loadRuns(sweep);
  const summary = summarize(runs);

  let showcase: Showcase | undefined;
  if (withShowcase) {
    const best = [...summary.perTask]
      .filter((t) => t.deltaPct !== null)
      .sort((a, b) => a.deltaPct! - b.deltaPct! || a.taskId.localeCompare(b.taskId))[0];
    if (best) {
      const off = pickRepresentative(
        runs.filter((r) => r.taskId === best.taskId && r.condition === "off"),
        best.medSrcLocOff,
      );
      const on = pickRepresentative(
        runs.filter((r) => r.taskId === best.taskId && r.condition === "on"),
        best.medSrcLocOn,
      );
      showcase = {
        taskId: best.taskId,
        offRunId: off.runId,
        onRunId: on.runId,
        offLoc: off.locAddedSrc,
        onLoc: on.locAddedSrc,
        offPatch: await readFile(path.join(sweepDir, "logs", `${off.runId}.patch`), "utf8"),
        onPatch: await readFile(path.join(sweepDir, "logs", `${on.runId}.patch`), "utf8"),
      };
    }
  }
  return { sweep, startedAt: meta.startedAt, summary, showcase };
}

async function main(): Promise<void> {
  const resultsDir = path.join(root, "bench/results");
  // pilot/smoke sweeps are gate checks, not headline results — their raw data
  // stays committed but they are not rendered into the README
  const sweeps = existsSync(resultsDir)
    ? (await readdir(resultsDir, { withFileTypes: true }))
        .filter((e) => e.isDirectory() && existsSync(path.join(resultsDir, e.name, "sweep.json")))
        .map((e) => e.name)
        .filter((name) => !name.startsWith("pilot") && !name.startsWith("smoke"))
        .sort()
    : [];
  if (sweeps.length === 0) {
    console.log("no sweeps under bench/results — README left unchanged");
    return;
  }
  // "<base>-ponytail" sweeps are comparison arms (D8), attached to their base
  // sweep's section rather than rendered as standalone on/off sections
  const arms = sweeps.filter((name) => name.endsWith("-ponytail"));
  const normal = sweeps.filter((name) => !name.endsWith("-ponytail"));
  const reports = await Promise.all(normal.map((s, i) => loadSweep(s, i === 0)));
  for (const arm of arms) {
    const report = reports.find((r) => r.sweep === arm.replace(/-ponytail$/, ""));
    if (!report) continue;
    const rulesMeta = await readFile(path.join(root, "bench/ponytail-rules.md"), "utf8");
    const m = /Version: (\S+) · commit ([0-9a-f]+)/.exec(rulesMeta);
    report.comparison = {
      ...buildComparison(await loadRuns(report.sweep), await loadRuns(arm)),
      ponytailVersion: m ? `${m[1]} @${m[2].slice(0, 7)}` : "unknown",
      sweep: arm,
    };
  }
  const readmePath = path.join(root, "README.md");
  const updated = splice(await readFile(readmePath, "utf8"), renderReport(reports));
  if (process.argv.includes("--check")) {
    if (updated !== (await readFile(readmePath, "utf8"))) {
      console.error("README benchmark section is stale — run `npm run report`");
      process.exit(1);
    }
    console.log("README benchmark section is up to date");
    return;
  }
  await writeFile(readmePath, updated);
  console.log(`README updated from ${sweeps.length} sweep(s): ${sweeps.join(", ")}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
