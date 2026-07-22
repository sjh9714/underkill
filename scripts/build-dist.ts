// Generate skill/SKILL.md and skill/dist/* from the single source skill/rules.md
// (design decision D7). Every variant carries the rules body verbatim so the
// benchmark-measured artifact and every shipped artifact are byte-identical.
// CI runs this with --check and fails if the committed files drift.
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";

const GENERATED = "Generated from skill/rules.md by scripts/build-dist.ts. Do not edit by hand.";

// The rules body = rules.md minus its title and editor-facing comment header.
function extractBody(rulesMd: string): string {
  return rulesMd
    .replace(/^# .*\n/, "")
    .replace(/<!--[\s\S]*?-->\n?/, "")
    .trim();
}

export function render(rulesMd: string): Record<string, string> {
  const body = extractBody(rulesMd);

  const skillMd = `---
name: underkill
description: Use when writing or modifying code — implementing features, refactoring, or fixing bugs — to prevent over-engineering: unrequested abstractions, options, config, dependencies, and defensive code. Build exactly what was asked, nothing more.
---

# underkill

<!-- ${GENERATED} -->

${body}
`;

  const snippet = (target: string) => `<!-- underkill — paste this section into your ${target} -->
<!-- ${GENERATED} -->
## Avoid over-engineering (underkill)

${body}
`;

  const mdc = `---
description: Avoid over-engineering — build exactly what was asked
globs:
alwaysApply: true
---

<!-- ${GENERATED} -->

# Avoid over-engineering (underkill)

${body}
`;

  return {
    "skill/SKILL.md": skillMd,
    "skill/dist/claude-code/CLAUDE.md.snippet": snippet("CLAUDE.md (project or ~/.claude/CLAUDE.md)"),
    "skill/dist/codex/AGENTS.md.snippet": snippet("AGENTS.md (for Codex CLI and other agents)"),
    "skill/dist/cursor/underkill.mdc": mdc,
  };
}

function main(): void {
  const root = path.join(path.dirname(new URL(import.meta.url).pathname), "..");
  const out = render(readFileSync(path.join(root, "skill/rules.md"), "utf8"));
  const check = process.argv.includes("--check");
  let drifted = false;
  for (const [rel, content] of Object.entries(out)) {
    const file = path.join(root, rel);
    if (check) {
      let current = "";
      try {
        current = readFileSync(file, "utf8");
      } catch {}
      if (current !== content) {
        console.error(`drift: ${rel} differs from generated output`);
        drifted = true;
      }
    } else {
      writeFileSync(file, content);
      console.log(`wrote ${rel}`);
    }
  }
  if (drifted) process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
