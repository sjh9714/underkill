import type { RunResult } from "./types.js";

// Aggregate raw runs into the numbers the README reports: per-task paired
// medians plus a task-level bootstrap CI. Seeded RNG keeps regeneration
// byte-identical (CI verifies the README tables reproduce exactly).

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round1 = (x: number): number => Math.round(x * 10) / 10;

export interface TaskSummary {
  taskId: string;
  trials: number;
  medSrcLocOff: number;
  medSrcLocOn: number;
  deltaPct: number | null; // null when the off median is 0
  trapRunsOff: number;
  trapRunsOn: number;
  passOff: number;
  passOn: number;
}

export interface Summary {
  model: string;
  cliVersion: string;
  tasksTotal: number;
  tasksReduced: number;
  medianDeltaPct: number;
  ci95: [number, number];
  runsTotal: number;
  passRateOff: number;
  passRateOn: number;
  trapRunsOff: number;
  trapRunsOn: number;
  totalCostUsd: number;
  perTask: TaskSummary[];
}

export function summarize(runs: RunResult[]): Summary {
  const taskIds = [...new Set(runs.map((r) => r.taskId))].sort();
  const perTask: TaskSummary[] = taskIds.map((taskId) => {
    const off = runs.filter((r) => r.taskId === taskId && r.condition === "off");
    const on = runs.filter((r) => r.taskId === taskId && r.condition === "on");
    const medOff = median(off.map((r) => r.locAddedSrc));
    const medOn = median(on.map((r) => r.locAddedSrc));
    return {
      taskId,
      trials: off.length,
      medSrcLocOff: medOff,
      medSrcLocOn: medOn,
      deltaPct: medOff === 0 ? null : round1(((medOn - medOff) / medOff) * 100),
      trapRunsOff: off.filter((r) => r.trapsTriggered.length > 0).length,
      trapRunsOn: on.filter((r) => r.trapsTriggered.length > 0).length,
      passOff: off.filter((r) => r.accepted).length,
      passOn: on.filter((r) => r.accepted).length,
    };
  });

  const deltas = perTask.map((t) => t.deltaPct).filter((d): d is number => d !== null);
  const rng = mulberry32(42);
  const resampled: number[] = [];
  for (let i = 0; i < 10_000; i++) {
    const sample = Array.from({ length: deltas.length }, () => deltas[Math.floor(rng() * deltas.length)]);
    resampled.push(median(sample));
  }
  resampled.sort((a, b) => a - b);
  const ci95: [number, number] = [
    round1(resampled[Math.floor(0.025 * resampled.length)]),
    round1(resampled[Math.floor(0.975 * resampled.length)]),
  ];

  const offRuns = runs.filter((r) => r.condition === "off");
  const onRuns = runs.filter((r) => r.condition === "on");
  return {
    model: runs[0]?.model ?? "",
    cliVersion: runs[0]?.cliVersion ?? "",
    tasksTotal: perTask.length,
    tasksReduced: perTask.filter((t) => t.deltaPct !== null && t.deltaPct < 0).length,
    medianDeltaPct: round1(median(deltas)),
    ci95,
    runsTotal: runs.length,
    passRateOff: offRuns.filter((r) => r.accepted).length / Math.max(offRuns.length, 1),
    passRateOn: onRuns.filter((r) => r.accepted).length / Math.max(onRuns.length, 1),
    trapRunsOff: offRuns.filter((r) => r.trapsTriggered.length > 0).length,
    trapRunsOn: onRuns.filter((r) => r.trapsTriggered.length > 0).length,
    totalCostUsd: runs.reduce((sum, r) => sum + r.totalCostUsd, 0),
    perTask,
  };
}
