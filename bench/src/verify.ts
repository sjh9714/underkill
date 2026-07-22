// Run the hold-out acceptance tests against a finished workspace — the primary
// accuracy gate (D2). A run that fails here is a FAIL regardless of how little
// code it wrote.
//
// TODO(phase-1):
//  - copy tasks/<taskId>/acceptance/ into the workspace
//  - `npm install` then `npx vitest run` (capture JSON reporter output)
//  - return pass/fail plus the list of failing test names
export async function verifyAcceptance(
  _dir: string,
  _taskId: string,
): Promise<{ accepted: boolean; failingTests: string[] }> {
  throw new Error("not implemented");
}
