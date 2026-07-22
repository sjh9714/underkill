import type { Condition } from "./types.js";

// Prepare an isolated workspace for one run and return its path + a scratch
// CLAUDE_CONFIG_DIR. Implements design decision D5 (isolation).
//
// TODO(phase-1):
//  - mkdtemp under bench/.workspaces/
//  - copy tasks/<taskId>/template/ into it
//  - `git init && git add -A && git commit -m baseline` (anchor for diff metrics)
//  - if condition === "on": write CLAUDE.md with the byte-exact contents of
//    skill/dist/claude-code/CLAUDE.md.snippet — the artifact users are told to
//    install — so the measured effect is the shipped product's; else nothing
//  - create a separate empty dir to use as CLAUDE_CONFIG_DIR so the user's global
//    ~/.claude config never leaks into either condition
export async function prepareWorkspace(
  _taskId: string,
  _condition: Condition,
): Promise<{ dir: string; configDir: string }> {
  throw new Error("not implemented");
}
