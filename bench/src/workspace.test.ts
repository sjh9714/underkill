import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { prepareWorkspace } from "./workspace.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const created: string[] = [];

afterAll(() => {
  for (const dir of created) rmSync(dir, { recursive: true, force: true });
});

async function prepare(condition: "on" | "off" | "placebo" | "ponytail") {
  const ws = await prepareWorkspace("01-fetch-retry", condition);
  created.push(ws.dir, ws.configDir);
  return ws;
}

describe("prepareWorkspace", () => {
  it("copies the template and commits a clean git baseline", async () => {
    const { dir } = await prepare("off");
    expect(existsSync(path.join(dir, "src/index.ts"))).toBe(true);
    expect(existsSync(path.join(dir, "package.json"))).toBe(true);
    const status = execFileSync("git", ["-C", dir, "status", "--porcelain"], { encoding: "utf8" });
    expect(status.trim()).toBe("");
    const log = execFileSync("git", ["-C", dir, "log", "--oneline"], { encoding: "utf8" });
    expect(log.trim().split("\n")).toHaveLength(1);
  });

  it("on: writes CLAUDE.md byte-identical to the shipped snippet, inside the baseline", async () => {
    const { dir } = await prepare("on");
    const snippet = readFileSync(
      path.join(root, "skill/dist/claude-code/CLAUDE.md.snippet"),
      "utf8",
    );
    expect(readFileSync(path.join(dir, "CLAUDE.md"), "utf8")).toBe(snippet);
    // committed in the baseline so it never shows up in diff-based metrics
    const status = execFileSync("git", ["-C", dir, "status", "--porcelain"], { encoding: "utf8" });
    expect(status.trim()).toBe("");
  });

  it("off: writes no CLAUDE.md", async () => {
    const { dir } = await prepare("off");
    expect(existsSync(path.join(dir, "CLAUDE.md"))).toBe(false);
  });

  it("placebo: injects the neutral instructions without the meta comment, saying nothing about scope or size", async () => {
    const { dir } = await prepare("placebo");
    const content = readFileSync(path.join(dir, "CLAUDE.md"), "utf8");
    expect(content).toContain("## Code quality notes");
    // the file's meta comment describes the experiment and must never reach the model
    expect(content).not.toContain("<!--");
    for (const word of ["scope", "minimal", "abstraction", "simplif", "exactly what", "placebo"]) {
      expect(content.toLowerCase()).not.toContain(word);
    }
  });

  it("ponytail: injects the vendored ruleset verbatim, without the provenance comment", async () => {
    const { dir } = await prepare("ponytail");
    const content = readFileSync(path.join(dir, "CLAUDE.md"), "utf8");
    expect(content.startsWith("# Ponytail, lazy senior dev mode")).toBe(true);
    expect(content).toContain("lazy senior developer");
    // provenance metadata must never reach the model
    expect(content).not.toContain("<!--");
    expect(content).not.toContain("Vendored");
  });

  it("provides an isolated empty config dir", async () => {
    const { configDir } = await prepare("off");
    expect(readdirSync(configDir)).toEqual([]);
  });
});
