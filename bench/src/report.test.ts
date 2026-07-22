import { describe, expect, it } from "vitest";
import { buildComparison, pickRepresentative, renderReport, splice } from "./report.js";
import { summarize } from "./stats.js";
import type { RunResult } from "./types.js";

describe("splice", () => {
  const readme = "intro\n<!-- BENCH:START -->\nold\n<!-- BENCH:END -->\noutro";

  it("replaces only the content between the sentinels", () => {
    const out = splice(readme, "NEW");
    expect(out).toBe("intro\n<!-- BENCH:START -->\nNEW\n<!-- BENCH:END -->\noutro");
  });

  it("is idempotent", () => {
    expect(splice(splice(readme, "NEW"), "NEW")).toBe(splice(readme, "NEW"));
  });

  it("throws when sentinels are missing", () => {
    expect(() => splice("no markers", "NEW")).toThrow(/BENCH:START/);
  });
});

function run(partial: Partial<RunResult>): RunResult {
  return {
    runId: "x",
    taskId: "t",
    condition: "off",
    trial: 1,
    model: "claude-opus-4-8",
    cliVersion: "2.1.216 (Claude Code)",
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

describe("pickRepresentative", () => {
  it("picks the run closest to the target, breaking ties by runId", () => {
    const runs = [
      run({ runId: "b", locAddedSrc: 20 }),
      run({ runId: "a", locAddedSrc: 40 }),
      run({ runId: "c", locAddedSrc: 42 }),
    ];
    expect(pickRepresentative(runs, 41).runId).toBe("a");
  });
});

describe("buildComparison", () => {
  const base = [
    ...[40, 42, 44].map((loc, i) => run({ runId: `a-off-t${i + 1}`, taskId: "a", condition: "off", trial: i + 1, locAddedSrc: loc })),
    ...[18, 20, 22].map((loc, i) => run({ runId: `a-on-t${i + 1}`, taskId: "a", condition: "on", trial: i + 1, locAddedSrc: loc })),
  ];
  const pony = [28, 30, 32].map((loc, i) =>
    run({ runId: `a-ponytail-t${i + 1}`, taskId: "a", condition: "ponytail", trial: i + 1, locAddedSrc: loc, accepted: i !== 0 }),
  );
  const cmp = buildComparison(base, pony);

  it("computes per-task medians for all three conditions", () => {
    expect(cmp.rows).toEqual([
      { taskId: "a", trials: 3, off: 42, pony: 30, on: 20, passOff: 3, passPony: 2, passOn: 3 },
    ]);
  });

  it("computes median deltas vs off and pass rates", () => {
    expect(cmp.medianDeltaOffPony).toBe(-28.6);
    expect(cmp.medianDeltaOffOn).toBe(-52.4);
    expect(cmp.passRatePony).toBeCloseTo(2 / 3);
  });

  it("reports per-run test LOC and cost medians — the footprint ponytail's self-check rule adds", () => {
    const ponyWithTests = pony.map((r) => ({ ...r, locAddedTest: 20, totalCostUsd: 0.17 }));
    const c = buildComparison(base, ponyWithTests);
    expect(c.medianTestLoc).toEqual({ off: 0, pony: 20, on: 0 });
    expect(c.medianCostUsd).toEqual({ off: 0.1, pony: 0.17, on: 0.1 });
  });
});

describe("renderReport", () => {
  const runs = [
    run({ runId: "t-off-t1", condition: "off", locAddedSrc: 40, trapsTriggered: ["opts"] }),
    run({ runId: "t-off-t2", condition: "off", locAddedSrc: 42 }),
    run({ runId: "t-off-t3", condition: "off", locAddedSrc: 44 }),
    run({ runId: "t-on-t1", condition: "on", locAddedSrc: 20 }),
    run({ runId: "t-on-t2", condition: "on", locAddedSrc: 21 }),
    run({ runId: "t-on-t3", condition: "on", locAddedSrc: 22 }),
  ];
  const md = renderReport([
    {
      sweep: "opus",
      startedAt: "2026-07-22T01:00:00.000Z",
      summary: summarize(runs),
      showcase: {
        taskId: "t",
        offRunId: "t-off-t2",
        onRunId: "t-on-t2",
        offLoc: 42,
        onLoc: 21,
        offPatch: "+off diff",
        onPatch: "+on diff",
      },
    },
  ]);

  it("renders headline numbers and the per-task table", () => {
    expect(md).toContain("claude-opus-4-8");
    expect(md).toContain("2.1.216");
    expect(md).toContain("42 → 21");
    expect(md).toContain("-50%");
    expect(md).toContain("1/3 → 0/3");
    expect(md).toContain("2026-07-22");
  });

  it("embeds both showcase patches verbatim", () => {
    expect(md).toContain("+off diff");
    expect(md).toContain("+on diff");
  });

  it("renders a comparison section when the sweep has one", () => {
    const base = [
      run({ runId: "t-off-t1", condition: "off", locAddedSrc: 42 }),
      run({ runId: "t-on-t1", condition: "on", locAddedSrc: 18 }),
    ];
    const pony = [run({ runId: "t-ponytail-t1", condition: "ponytail", locAddedSrc: 30 })];
    const withCmp = renderReport([
      {
        sweep: "opus",
        startedAt: "2026-07-22T01:00:00.000Z",
        summary: summarize(base),
        comparison: {
          ...buildComparison(base, pony),
          ponytailVersion: "v4.8.4 @16f2980",
          sweep: "opus-ponytail",
        },
      },
    ]);
    expect(withCmp).toContain("ponytail");
    expect(withCmp).toContain("v4.8.4 @16f2980");
    expect(withCmp).toContain("42 / 30 / 18");
    expect(withCmp).toContain("bench/results/opus-ponytail/");
  });

  it("is deterministic", () => {
    expect(md).toBe(
      renderReport([
        {
          sweep: "opus",
          startedAt: "2026-07-22T01:00:00.000Z",
          summary: summarize(runs),
          showcase: {
            taskId: "t",
            offRunId: "t-off-t2",
            onRunId: "t-on-t2",
            offLoc: 42,
            onLoc: 21,
            offPatch: "+off diff",
            onPatch: "+on diff",
          },
        },
      ]),
    );
  });
});
