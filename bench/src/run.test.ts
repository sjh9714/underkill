import { describe, expect, it } from "vitest";
import { buildMatrix, parseArgs } from "./run.js";

describe("parseArgs", () => {
  it("applies defaults", () => {
    expect(parseArgs([])).toEqual({
      model: "claude-opus-4-8",
      trials: 5,
      tasks: undefined,
      sweep: undefined,
      budgetUsd: 40,
    });
  });

  it("parses explicit values", () => {
    expect(
      parseArgs(["--model", "claude-sonnet-5", "--trials", "3", "--tasks", "01-a,02-b", "--sweep", "pilot", "--budget-usd", "12"]),
    ).toEqual({
      model: "claude-sonnet-5",
      trials: 3,
      tasks: ["01-a", "02-b"],
      sweep: "pilot",
      budgetUsd: 12,
    });
  });
});

describe("buildMatrix", () => {
  it("produces task × condition × trial with deterministic run ids", () => {
    const matrix = buildMatrix(["01-a", "02-b"], 2);
    expect(matrix).toHaveLength(8);
    expect(matrix[0]).toEqual({ taskId: "01-a", condition: "on", trial: 1, runId: "01-a-on-t1" });
    const ids = matrix.map((m) => m.runId);
    expect(new Set(ids).size).toBe(8);
    expect(ids).toContain("02-b-off-t2");
  });

  it("keeps on/off adjacent per task and trial so conditions run under like circumstances", () => {
    const matrix = buildMatrix(["01-a"], 2);
    expect(matrix.map((m) => `${m.condition}${m.trial}`)).toEqual(["on1", "off1", "on2", "off2"]);
  });
});
