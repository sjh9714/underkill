import type { Task } from "./types.js";

// Run the coding agent once inside a prepared workspace, capturing the full
// stream-json log. Implements the run-flow step 3 in docs/DESIGN.md.
//
// VERIFY the flag surface against the installed CLI (`claude --help`) before
// implementing — flags shift between versions; pin the global
// @anthropic-ai/claude-code version and record it (D6).
//
// Intended invocation:
//   CLAUDE_CONFIG_DIR=<configDir> claude -p "<prompt>" \
//     --model <model> --output-format stream-json --verbose \
//     --max-turns <task.maxTurns> --permission-mode acceptEdits \
//     --allowedTools "Write Edit Read Glob Grep Bash(npm:*) Bash(node:*) Bash(npx:*)"
//
// TODO(phase-1):
//  - spawn the CLI, stream stdout to logs/<runId>.ndjson
//  - enforce a wall-clock timeout (task.timeoutMin) and kill on overrun
//  - parse the final result event for num_turns / total_cost_usd / duration_ms
export async function runAgent(_opts: {
  runId: string;
  task: Task;
  dir: string;
  configDir: string;
  model: string;
  prompt: string;
}): Promise<{ numTurns: number; totalCostUsd: number; durationMs: number; logPath: string }> {
  throw new Error("not implemented");
}
