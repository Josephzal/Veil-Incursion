/**
 * Idempotent run-result settlement gate.
 *
 * Gameplay mutations for a given run key must execute at most once.
 * Presentation re-renders and remounts of the debrief popup must not
 * re-award cargo, credits, or progression side-effects.
 *
 * Run: npx --yes tsx src/data/finalizeRunResults.test.ts
 */

const settledRunKeys = new Set<string>();

export function hasSettledRunResults(runKey: string): boolean {
  return settledRunKeys.has(runKey);
}

/**
 * Claims settlement for `runKey`. Returns true the first time only.
 * Subsequent calls with the same key return false (already settled).
 */
export function claimRunSettlement(runKey: string): boolean {
  if (!runKey) return false;
  if (settledRunKeys.has(runKey)) return false;
  settledRunKeys.add(runKey);
  return true;
}

/** Test helper — clears the in-memory settlement registry. */
export function resetRunSettlementRegistryForTests(): void {
  settledRunKeys.clear();
}

/**
 * Conceptual finalize entry: given a run key and a settle callback,
 * execute settlement exactly once and return whether work ran.
 */
export async function finalizeRunResultsOnce<T>(
  runKey: string,
  settle: () => T | Promise<T>,
): Promise<{ didSettle: boolean; value: T | null }> {
  if (!claimRunSettlement(runKey)) {
    return { didSettle: false, value: null };
  }
  const value = await settle();
  return { didSettle: true, value };
}
