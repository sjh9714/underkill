import { describe, expect, it } from "vitest";
import { pickRepresentative, renderReport, splice } from "./report.js";
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
