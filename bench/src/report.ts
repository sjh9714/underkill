// Regenerate the README tables deterministically from bench/results/. CI checks
// that running this leaves no diff, which proves the headline numbers are not
// hand-typed (D4).
//
// TODO(phase-2):
//  - read the latest sweep's runs, call summarize()
//  - render the headline table + per-task table (markdown)
//  - replace the marked block in README.md between
//    <!-- BENCH:START --> and <!-- BENCH:END --> sentinels
export {};

async function main(): Promise<void> {
  throw new Error("not implemented");
}

main();
