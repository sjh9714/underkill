// Regenerate the README benchmark section deterministically from
// bench/results/. CI re-runs this and fails on any diff, which proves the
// headline numbers are generated, never hand-typed (D4).
//
// Usage: npm run report [-- --check]
import { existsSync } from "node:fs";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { summarize, type Summary } from "./stats.js";
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

export interface SweepReport {
  sweep: string;
  startedAt: string;
  summary: Summary;
  showcase?: Showcase;
}

const pct = (x: number): string => `${Math.round(x * 100)}%`;
const signed = (x: number): string => (x > 0 ? `+${x}%` : `${x}%`);

function renderSweep({ sweep, startedAt, summary: s, showcase }: SweepReport): string {
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
  return lines.join("\n");
}

export function renderReport(sweeps: SweepReport[]): string {
  return sweeps.map(renderSweep).join("\n\n");
}

async function loadSweep(sweep: string, withShowcase: boolean): Promise<SweepReport> {
  const sweepDir = path.join(root, "bench/results", sweep);
  const meta = JSON.parse(await readFile(path.join(sweepDir, "sweep.json"), "utf8"));
  const runsDir = path.join(sweepDir, "runs");
  const runs: RunResult[] = await Promise.all(
    (await readdir(runsDir)).sort().map(async (f) => JSON.parse(await readFile(path.join(runsDir, f), "utf8"))),
  );
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
  const reports = await Promise.all(sweeps.map((s, i) => loadSweep(s, i === 0)));
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
