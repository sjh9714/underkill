import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { render } from "./build-dist.js";

const rulesMd = readFileSync(new URL("../skill/rules.md", import.meta.url), "utf8");

const OUTPUTS = [
  "skill/SKILL.md",
  "skill/dist/claude-code/CLAUDE.md.snippet",
  "skill/dist/codex/AGENTS.md.snippet",
  "skill/dist/cursor/underkill.mdc",
];

describe("render", () => {
  it("produces all four output files", () => {
    expect(Object.keys(render(rulesMd)).sort()).toEqual([...OUTPUTS].sort());
  });

  it("carries the full rule text verbatim in every variant (measured = shipped)", () => {
    const out = render(rulesMd);
    for (const path of OUTPUTS) {
      // distinctive line from rule 5's non-interactive fallback — the part the
      // old hand-condensed variants dropped
      expect(out[path]).toContain("do not wait for a reply");
      expect(out[path]).toContain("**Scope lock.**");
      expect(out[path]).toContain("**Simplify pass.**");
    }
  });

  it("strips the source file's editor-facing comment header", () => {
    const out = render(rulesMd);
    for (const path of OUTPUTS) {
      expect(out[path]).not.toContain("SINGLE SOURCE OF TRUTH");
    }
  });

  it("marks every output as generated", () => {
    const out = render(rulesMd);
    for (const path of OUTPUTS) {
      expect(out[path]).toContain("Generated from skill/rules.md");
    }
  });

  it("emits valid SKILL.md frontmatter", () => {
    const skill = render(rulesMd)["skill/SKILL.md"];
    expect(skill.startsWith("---\nname: underkill\ndescription: ")).toBe(true);
  });

  it("emits cursor mdc frontmatter with alwaysApply", () => {
    const mdc = render(rulesMd)["skill/dist/cursor/underkill.mdc"];
    expect(mdc.startsWith("---\n")).toBe(true);
    expect(mdc).toContain("alwaysApply: true");
  });
});
