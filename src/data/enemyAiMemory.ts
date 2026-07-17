import type { EnemyIntent } from '../types/run';
import type { CompositionEnemyRole } from '../types/encounterComposition';

/** Lightweight per-unit AI memory — prevents defensive loops and fuels urgency scoring. */
export interface EnemyAiMemory {
  lastIntent?: EnemyIntent;
  turnsSinceDefensive: number;
  turnsSinceAttack: number;
  /** Damaged during the most recent player turn. */
  recentlyDamaged: boolean;
  /** Was a primary/selected target during the most recent player turn. */
  targetedLastTurn: boolean;
  openedWithIntent?: EnemyIntent;
  /** Remaining turns where FORTIFY is heavily suppressed after a Fortify opener. */
  fortifyDisabledTurns: number;
  /** Remaining turns where EVADE is heavily suppressed after an Evade opener. */
  evadeDisabledTurns: number;
}

export function createEmptyEnemyAiMemory(): EnemyAiMemory {
  return {
    turnsSinceDefensive: 99,
    turnsSinceAttack: 99,
    recentlyDamaged: false,
    targetedLastTurn: false,
    fortifyDisabledTurns: 0,
    evadeDisabledTurns: 0,
  };
}

export function ensureEnemyAiMemory(
  memory?: EnemyAiMemory | null,
): EnemyAiMemory {
  return memory ? { ...createEmptyEnemyAiMemory(), ...memory } : createEmptyEnemyAiMemory();
}

const DEFENSIVE_INTENTS = new Set<EnemyIntent>(['EVADE', 'FORTIFY']);
const ATTACK_INTENTS = new Set<EnemyIntent>([
  'STRIKE',
  'DOUBLE_STRIKE',
  'SWARM_BITE',
  'WORLD_ENDER',
  'OVERDRIVE_DISCHARGE',
  'STRIP_STAMINA',
  'STAMINA_DRAIN_LEAP',
  'PAVEMENT_CRUSHER',
  'ARTILLERY_FIRE',
  'PREMATURE_IGNITION',
  'RESONANCE_OVERLOAD',
  'VOID_AMBUSH',
  'HEX_MARK',
  'KINETIC_AFTERSHOCK',
  'TAR_BIND',
]);

export function isDefensiveIntent(intent: EnemyIntent): boolean {
  return DEFENSIVE_INTENTS.has(intent);
}

export function isAttackIntent(intent: EnemyIntent): boolean {
  return ATTACK_INTENTS.has(intent);
}

/** Mark that this unit took damage from the operative this player turn. */
export function markEnemyRecentlyDamaged(memory?: EnemyAiMemory | null): EnemyAiMemory {
  const next = ensureEnemyAiMemory(memory);
  return { ...next, recentlyDamaged: true, targetedLastTurn: true };
}

/** Mark that this unit was targeted (hit or miss) this player turn. */
export function markEnemyTargetedLastTurn(memory?: EnemyAiMemory | null): EnemyAiMemory {
  const next = ensureEnemyAiMemory(memory);
  return { ...next, targetedLastTurn: true };
}

/**
 * Advance memory after a new intent is selected for the next player-facing telegraph.
 * Consumes recentlyDamaged / targetedLastTurn so they only apply to one scoring cycle.
 */
export function tickEnemyAiMemoryAfterIntent(
  memory: EnemyAiMemory | null | undefined,
  nextIntent: EnemyIntent,
): EnemyAiMemory {
  const prev = ensureEnemyAiMemory(memory);
  const openedWithIntent = prev.openedWithIntent ?? nextIntent;
  let fortifyDisabledTurns = Math.max(0, prev.fortifyDisabledTurns - 1);
  let evadeDisabledTurns = Math.max(0, prev.evadeDisabledTurns - 1);

  if (!prev.openedWithIntent && nextIntent === 'FORTIFY') {
    fortifyDisabledTurns = Math.max(fortifyDisabledTurns, 2);
  }
  if (!prev.openedWithIntent && nextIntent === 'EVADE') {
    evadeDisabledTurns = Math.max(evadeDisabledTurns, 2);
  }

  return {
    lastIntent: nextIntent,
    turnsSinceDefensive: isDefensiveIntent(nextIntent) ? 0 : prev.turnsSinceDefensive + 1,
    turnsSinceAttack: isAttackIntent(nextIntent) ? 0 : prev.turnsSinceAttack + 1,
    recentlyDamaged: false,
    targetedLastTurn: false,
    openedWithIntent,
    fortifyDisabledTurns,
    evadeDisabledTurns,
  };
}

/** Soft tactical roles used by opener + urgency bias (composition primary role). */
export type EnemyAiTacticalRole =
  | CompositionEnemyRole
  | 'PRESSURE'
  | 'DEFENDER'
  | 'UNKNOWN';

export function isPressureArchetype(role: EnemyAiTacticalRole | undefined): boolean {
  return role === 'BRUISER' || role === 'ASSASSIN' || role === 'SWARM' || role === 'PRESSURE';
}

export function isSupportLikeRole(role: EnemyAiTacticalRole | undefined): boolean {
  return role === 'SUPPORT' || role === 'ARTILLERY' || role === 'DEFENDER';
}
