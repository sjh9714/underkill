// Orchestrator: plan the (task × condition × trial) matrix, run each in
// isolation, and write one JSON file per run under bench/results/<sweep>/runs/.
//
// Usage: npm run bench -- --model claude-opus-4-8 --trials 5 [--tasks 01,02]
//
// TODO(phase-1):
//  - load tasks from bench/tasks/*/task.json
//  - build the matrix; cap concurrency at 3 with 429 backoff (trap #6 in DESIGN)
//  - per run: prepareWorkspace -> runAgent -> collectMetrics -> verifyAcceptance
//    -> stamp model/cliVersion/ranAt -> write results/<sweep>/runs/<runId>.json
//  - enforce a cumulative cost cap; support --resume to skip completed runs
//
// Keep the sweep append-only and resumable: a 3-hour run must survive a crash.
export {};

async function main(): Promise<void> {
  throw new Error("not implemented");
}

main();
