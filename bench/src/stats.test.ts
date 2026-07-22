import { describe, expect, it } from "vitest";
import { median, summarize } from "./stats.js";
import type { RunResult } from "./types.js";

describe("median", () => {
  it("picks the middle of an odd-length list", () => {
    expect(median([9, 1, 5])).toBe(5);
  });
  it("averages the middle pair of an even-length list", () => {
    expect(median([1, 2, 3, 10])).toBe(2.5);
  });
});

function run(partial: Partial<RunResult>): RunResult {
  return {
    runId: "x",
    taskId: "t",
    condition: "off",
    trial: 1,
    model: "m",
    cliVersion: "v",
    ranAt: "2026-07-22T00:00:00Z",
    accepted: true,
    failingTests: [],
    locAddedSrc: 0,
    locAddedTest: 0,
    filesCreated: 0,
    depsAdded: [],
    exportedSymbols: 0,
    trapsTriggered: [],
    numTurns: 1,
    totalCostUsd: 0.1,
    durationMs: 1000,
    ...partial,
  };
}

const runs: RunResult[] = [
  // task a: off [20, 30, 40] → 30, on [10, 15, 20] → 15 ⇒ −50%
  ...[20, 30, 40].map((loc, i) => run({ taskId: "a", condition: "off", trial: i + 1, locAddedSrc: loc, trapsTriggered: i === 0 ? ["opts"] : [] })),
  ...[10, 15, 20].map((loc, i) => run({ taskId: "a", condition: "on", trial: i + 1, locAddedSrc: loc })),
  // task b: off [10, 10, 10] → 10, on [10, 10, 12] → 10 ⇒ 0%, one on-run fails acceptance
  ...[10, 10, 10].map((loc, i) => run({ taskId: "b", condition: "off", trial: i + 1, locAddedSrc: loc })),
  ...[10, 10, 12].map((loc, i) => run({ taskId: "b", condition: "on", trial: i + 1, locAddedSrc: loc, accepted: i !== 2 })),
];

describe("summarize", () => {
  const summary = summarize(runs);

  it("computes per-task medians and deltas", () => {
    const a = summary.perTask.find((t) => t.taskId === "a")!;
    expect(a.medSrcLocOff).toBe(30);
    expect(a.medSrcLocOn).toBe(15);
    expect(a.deltaPct).toBe(-50);
    const b = summary.perTask.find((t) => t.taskId === "b")!;
    expect(b.deltaPct).toBe(0);
  });

  it("counts trap runs and pass rates per condition", () => {
    const a = summary.perTask.find((t) => t.taskId === "a")!;
    expect(a.trapRunsOff).toBe(1);
    expect(a.trapRunsOn).toBe(0);
    expect(summary.passRateOff).toBe(1);
    expect(summary.passRateOn).toBeCloseTo(5 / 6);
  });

  it("reports tasks reduced and the overall median delta", () => {
    expect(summary.tasksTotal).toBe(2);
    expect(summary.tasksReduced).toBe(1);
    expect(summary.medianDeltaPct).toBe(-25);
  });

  it("bootstraps a deterministic 95% CI bracketing the median", () => {
    expect(summary.ci95).toEqual(summarize(runs).ci95);
    expect(summary.ci95[0]).toBeLessThanOrEqual(summary.medianDeltaPct);
    expect(summary.ci95[1]).toBeGreaterThanOrEqual(summary.medianDeltaPct);
  });

  it("sums cost", () => {
    expect(summary.totalCostUsd).toBeCloseTo(1.2);
  });
});
