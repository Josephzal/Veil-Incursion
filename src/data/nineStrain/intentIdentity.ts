import type { EnemyIntentSeverity } from '../../types/enemyIntentMeta';
import type { CombatGridSlotId } from '../../types/combatGrid';
import { ALL_GRID_SLOTS } from '../../types/combatGrid';
import type { HostileIntentSnapshot, IntentGenerationRecord } from '../../types/counterfate';

const SEVERITY_RANK: Record<EnemyIntentSeverity, number> = {
  CRITICAL: 3,
  HIGH: 2,
  MODERATE: 1,
  LOW: 0,
};

export function positionRankForSlot(slot: CombatGridSlotId | string | undefined): number {
  const index = ALL_GRID_SLOTS.indexOf(slot as CombatGridSlotId);
  return index >= 0 ? index : 99;
}

export function mintIntentInstanceId(
  unitId: string,
  intentKind: string,
  generation: number,
): string {
  return `${unitId}::${intentKind}::g${generation}`;
}

/**
 * Stable across countdown ticks: same unit + same intent kind keeps generation
 * until that instance is retired (resolved, removed, or otherwise ended).
 * A later same-kind intent from the same unit then mints a new identity.
 */
export function nextIntentGeneration(
  previous: IntentGenerationRecord | undefined,
  intentKind: string,
): IntentGenerationRecord {
  if (previous && previous.intentKind === intentKind && !previous.retired) return previous;
  return { intentKind, generation: (previous?.generation ?? 0) + 1, retired: false };
}

export function retireIntentGeneration(
  previous: IntentGenerationRecord | undefined,
): IntentGenerationRecord | undefined {
  if (!previous) return previous;
  return { ...previous, retired: true };
}

export function compareFateboundCandidates(
  a: HostileIntentSnapshot,
  b: HostileIntentSnapshot,
  jammed: boolean,
): number {
  if (jammed) {
    if (a.hostileTurnOrder !== b.hostileTurnOrder) return a.hostileTurnOrder - b.hostileTurnOrder;
    return a.positionRank - b.positionRank;
  }
  const sev = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
  if (sev !== 0) return sev;
  if (a.countdown !== b.countdown) return a.countdown - b.countdown;
  if (a.hostileTurnOrder !== b.hostileTurnOrder) return a.hostileTurnOrder - b.hostileTurnOrder;
  return a.positionRank - b.positionRank;
}

export function compareTraceFallback(
  a: HostileIntentSnapshot,
  b: HostileIntentSnapshot,
  jammed: boolean,
): number {
  if (jammed) {
    if (a.hostileTurnOrder !== b.hostileTurnOrder) return a.hostileTurnOrder - b.hostileTurnOrder;
    if (a.positionRank !== b.positionRank) return a.positionRank - b.positionRank;
    return a.unitId.localeCompare(b.unitId);
  }
  const ranked = compareFateboundCandidates(a, b, false);
  if (ranked !== 0) return ranked;
  return a.unitId.localeCompare(b.unitId);
}

export function selectFateboundCandidate(
  intents: readonly HostileIntentSnapshot[],
  jammed: boolean,
): HostileIntentSnapshot | null {
  const eligible = intents.filter((row) => row.alive);
  if (eligible.length === 0) return null;
  return [...eligible].sort((a, b) => compareFateboundCandidates(a, b, jammed))[0] ?? null;
}

export function nextHighestRevealed(
  intents: readonly HostileIntentSnapshot[],
  excludeInstanceId: string | null,
): HostileIntentSnapshot | null {
  const eligible = intents.filter((row) => (
    row.alive && !row.concealed && row.intentInstanceId !== excludeInstanceId
  ));
  if (eligible.length === 0) return null;
  return [...eligible].sort((a, b) => compareFateboundCandidates(a, b, false))[0] ?? null;
}
