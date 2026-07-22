// Generate skill/SKILL.md and skill/dist/* from the single source skill/rules.md
// (design decision D7). CI runs this with a --check flag and fails if the
// committed files drift from what this produces.
//
// TODO(phase-1):
//  - read skill/rules.md (the six numbered rules are the source of truth)
//  - emit skill/SKILL.md: Agent Skills frontmatter + the rules body verbatim
//  - emit the condensed one-line-per-rule variants for claude-code / codex / cursor
//  - with `--check`: regenerate in memory and exit non-zero on any diff
async function main(): Promise<void> {
  throw new Error("not implemented");
}

main();
