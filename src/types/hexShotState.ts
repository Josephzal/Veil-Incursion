import type { ClassCombatEncounterState } from './classCombatAbility';
import type { EnemyCombatProfile } from './run';
import { hasCombatTag } from '../data/combatFractureEngine';
import { isUnitAlive } from '../data/combatSquadEngine';

/** Stamina ripped when reload timing is missed (void-feed jam). */
export const HEX_RELOAD_JAM_STAMINA_PENALTY = 20;

/** Every reload initiation costs 1 AP — including at 0/6. */
export const HEX_RELOAD_AP_COST = 1;

export interface HexShotCombatState {
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  ap: number;
  ammo: number;
  maxAmmo: number;
  /** Damage bonus multiplier (0.0–0.50) from perfect reload timing. */
  overchargeMultiplier: number;
  isUltimateAvailable: boolean;
  /** Flow-state reload after emptying the magazine (still costs 1 AP to open). */
  isAutoLoadMinigameActive: boolean;
  /** Player-initiated tactical reload minigame. */
  isManualReloadMinigameActive: boolean;
  /** Ammo count captured when reload began — drives overcharge math. */
  ammoAtReloadStart: number;
  /** AoE damage queued by Dead-Man's Switch graft (phase 2). */
  pendingEjectDamage: number;
  /** Magazine hit 0 — player must reload when AP is available. */
  autoReloadPending: boolean;
}

export function createInitialHexShotCombatState(input: {
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  ap: number;
  ammo: number;
  maxAmmo: number;
}): HexShotCombatState {
  return {
    ...input,
    overchargeMultiplier: 0,
    isUltimateAvailable: false,
    isAutoLoadMinigameActive: false,
    isManualReloadMinigameActive: false,
    ammoAtReloadStart: input.ammo,
    pendingEjectDamage: 0,
    autoReloadPending: false,
  };
}

/**
 * Perfect-reload overcharge from how empty the mag was at reload start.
 * 5/6 → +0%, 4/6 → +10%, … 0/6 → +50%.
 */
export function overchargeFromAmmoAtReloadStart(
  ammoAtReloadStart: number,
  maxAmmo: number,
): number {
  const missing = Math.max(0, maxAmmo - ammoAtReloadStart);
  if (missing <= 1) return 0;
  return Math.min(0.5, (missing - 1) * 0.1);
}

/** Immediate tactical debuffs qualify for Zero-Protocol — seeded traps do not. */
export function enemyHasQualifyingUltimateDebuff(
  unit: EnemyCombatProfile,
  encounter: ClassCombatEncounterState,
): boolean {
  if (!unit.unitId || !isUnitAlive(unit)) return false;
  const tags = unit.combatTags ?? [];
  if (
    hasCombatTag(unit, 'EXPOSED')
    || hasCombatTag(unit, 'CONCUSSED')
    || hasCombatTag(unit, 'BLINDED')
    || hasCombatTag(unit, 'DOOMED')
    || hasCombatTag(unit, 'FRACTURED')
  ) {
    return true;
  }
  if (encounter.bleedingPayloadTurns[unit.unitId] != null) return true;
  if (encounter.entropyHexTurns[unit.unitId] != null) return true;
  if (encounter.enemyApDrainNextTurn[unit.unitId] != null) return true;
  return false;
}

export function evaluateHexShotUltimateAvailable(
  overchargeMultiplier: number,
  squad: readonly EnemyCombatProfile[],
  encounter: ClassCombatEncounterState,
): boolean {
  if (overchargeMultiplier <= 0) return false;
  return squad.some((unit) => enemyHasQualifyingUltimateDebuff(unit, encounter));
}

export function isReloadMinigameVisible(state: HexShotCombatState): boolean {
  return state.isAutoLoadMinigameActive || state.isManualReloadMinigameActive;
}
