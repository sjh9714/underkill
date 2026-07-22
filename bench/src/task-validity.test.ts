// Task-validity gate, run in CI (no API calls): for every task,
//  - reference/ passes the hold-out acceptance tests   (tests are satisfiable)
//  - the bare template fails them                      (tests are non-trivial)
//  - reference/ fires zero traps                       (no false positives)
//  - overbuilt/ fires every trap                       (no false negatives)
import { cp, readFile, readdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { collectMetrics } from "./metrics.js";
import { prepareWorkspace } from "./workspace.js";
import { verifyAcceptance } from "./verify.js";
import type { Task } from "./types.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const tasksDir = path.join(root, "bench/tasks");
const taskIds = (await readdir(tasksDir, { withFileTypes: true }))
  .filter((e) => e.isDirectory())
  .map((e) => e.name);

const created: string[] = [];
afterAll(async () => {
  for (const dir of created) await rm(dir, { recursive: true, force: true });
});

async function workspaceWith(taskId: string, overlay?: "reference" | "overbuilt") {
  const ws = await prepareWorkspace(taskId, "off");
  created.push(ws.dir, ws.configDir);
  if (overlay) {
    await cp(path.join(tasksDir, taskId, overlay), ws.dir, { recursive: true });
  }
  return ws.dir;
}

describe.each(taskIds)("%s", (taskId) => {
  const LONG = 240_000;

  it("reference passes the acceptance tests", { timeout: LONG }, async () => {
    const dir = await workspaceWith(taskId, "reference");
    const result = await verifyAcceptance(dir, taskId);
    expect(result.failingTests).toEqual([]);
    expect(result.accepted).toBe(true);
  });

  it("bare template fails the acceptance tests", { timeout: LONG }, async () => {
    const dir = await workspaceWith(taskId);
    const result = await verifyAcceptance(dir, taskId);
    expect(result.accepted).toBe(false);
  });

  it("reference fires zero traps", { timeout: LONG }, async () => {
    const task: Task = JSON.parse(
      await readFile(path.join(tasksDir, taskId, "task.json"), "utf8"),
    );
    const dir = await workspaceWith(taskId, "reference");
    const metrics = await collectMetrics(dir, task);
    expect(metrics.trapsTriggered).toEqual([]);
  });

  it("overbuilt fixture fires every trap", { timeout: LONG }, async () => {
    const task: Task = JSON.parse(
      await readFile(path.join(tasksDir, taskId, "task.json"), "utf8"),
    );
    const dir = await workspaceWith(taskId, "overbuilt");
    const metrics = await collectMetrics(dir, task);
    expect(metrics.trapsTriggered).toEqual(task.traps.map((t) => t.name));
  });
});
