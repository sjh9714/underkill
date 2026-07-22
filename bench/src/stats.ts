import type { RunResult } from "./types.js";

// Aggregate raw runs into the numbers the README reports. No p-value spam —
// per-task paired medians plus a task-level bootstrap CI (10k resample).
//
// TODO(phase-2):
//  - group runs by task; compute median per condition for each metric
//  - overall effect = bootstrap CI over per-task deltas
//  - accuracy pass rate per condition (must be reported, never hidden)
export interface Summary {
  model: string;
  tasksReduced: number;
  tasksTotal: number;
  medianSrcLocDeltaPct: number;
  passRateOff: number;
  passRateOn: number;
  perTask: unknown[];
}

export function summarize(_runs: RunResult[]): Summary {
  throw new Error("not implemented");
}
