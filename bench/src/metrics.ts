import type { Task } from "./types.js";

// Compute scope metrics from `git diff baseline..worktree` in the workspace.
// This module produces the evidence behind the headline claim, so keep it
// pure and unit-testable against fixture diffs (that is what CI checks).
//
// TODO(phase-1):
//  - locAddedSrc / locAddedTest: count added lines, splitting src/** vs *.test.*
//    (agents that write their own tests must not inflate the src number)
//  - filesCreated: added files in the diff
//  - depsAdded: diff of package.json dependencies + devDependencies
//  - exportedSymbols: count exports in src/** via ts-morph
//  - trapsTriggered: evaluate each task.traps[] detector (regex / deps-added /
//    exports-gt) against the final workspace
export interface ScopeMetrics {
  locAddedSrc: number;
  locAddedTest: number;
  filesCreated: number;
  depsAdded: string[];
  exportedSymbols: number;
  trapsTriggered: string[];
}

export async function collectMetrics(_dir: string, _task: Task): Promise<ScopeMetrics> {
  throw new Error("not implemented");
}
