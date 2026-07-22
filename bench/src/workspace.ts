import { execFileSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { Condition } from "./types.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function git(dir: string, ...args: string[]): void {
  execFileSync("git", ["-C", dir, ...args], { stdio: "ignore" });
}

// Prepare an isolated workspace for one run (design decision D5): temp copy of
// the task template, a git baseline commit to anchor diff metrics, and a scratch
// CLAUDE_CONFIG_DIR so the user's global config never leaks into either
// condition. "on" injects the byte-exact shipped snippet, committed into the
// baseline so it never appears in the diff.
export async function prepareWorkspace(
  taskId: string,
  condition: Condition,
): Promise<{ dir: string; configDir: string }> {
  const base = path.join(root, "bench/.workspaces");
  await mkdir(base, { recursive: true });
  const dir = await mkdtemp(path.join(base, `${taskId}-${condition}-`));
  await cp(path.join(root, "bench/tasks", taskId, "template"), dir, { recursive: true });
  if (condition === "on") {
    await writeFile(
      path.join(dir, "CLAUDE.md"),
      await readFile(path.join(root, "skill/dist/claude-code/CLAUDE.md.snippet"), "utf8"),
    );
  } else if (condition !== "off") {
    // control arms: strip the file's meta comment — it describes the experiment
    // (or the vendoring provenance) and must never reach the model
    const source =
      condition === "placebo" ? "bench/placebo-instructions.md" : "bench/ponytail-rules.md";
    const raw = await readFile(path.join(root, source), "utf8");
    await writeFile(path.join(dir, "CLAUDE.md"), raw.replace(/^<!--[\s\S]*?-->\n/, ""));
  }
  git(dir, "init", "-q", "-b", "main");
  git(dir, "add", "-A");
  git(dir, "-c", "user.name=bench", "-c", "user.email=bench@local", "commit", "-q", "-m", "baseline");
  const configDir = await mkdtemp(path.join(base, "config-"));
  return { dir, configDir };
}
