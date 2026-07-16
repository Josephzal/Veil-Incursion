import type { ClassCombatEncounterState } from './classCombatAbility';
import type { EnemyCombatProfile } from './run';
import { hasCombatTag } from '../data/combatFractureEngine';
import { isUnitAlive } from '../data/combatSquadEngine';
import {
  DEFAULT_HEX_AMMO_TYPE,
  HEX_MAGAZINE_CONFIG,
  type HexAmmoType,
  type ReloadQuality,
} from './hexAmmo';

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
  // --- Hex Magazine (ammo-type reload refactor v1) ---
  /** Loaded ammo type — inherited by BALLISTIC abilities. */
  currentAmmoType: HexAmmoType;
  /** Protocol Charges (0..maxProtocolCharges) — Perfect reloads grant +1. */
  protocolCharges: number;
  maxProtocolCharges: number;
  /** Ammo type loaded by the previous reload (for combo/telemetry). */
  lastAmmoType?: HexAmmoType;
  /** Ammo types from the last N Perfect reloads — feeds Zero Protocol riders. */
  calibratedAmmoTypes: HexAmmoType[];
  /** Perfect reload primes the next BALLISTIC shot. */
  nextShotOvercharged: boolean;
  /** Quality of the last resolved reload. */
  lastReloadQuality?: ReloadQuality;
  /** Failed reload lightly penalizes the next BALLISTIC shot (−10%). */
  firstShotPenaltyPending: boolean;
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
  currentAmmoType?: HexAmmoType;
  protocolCharges?: number;
}): HexShotCombatState {
  return {
    ...input,
    overchargeMultiplier: 0,
    currentAmmoType: input.currentAmmoType ?? DEFAULT_HEX_AMMO_TYPE,
    protocolCharges: input.protocolCharges ?? 0,
    maxProtocolCharges: HEX_MAGAZINE_CONFIG.maxProtocolCharges,
    lastAmmoType: undefined,
    calibratedAmmoTypes: [],
    nextShotOvercharged: false,
    lastReloadQuality: undefined,
    firstShotPenaltyPending: false,
    isUltimateAvailable: false,
    isAutoLoadMinigameActive: false,
    isManualReloadMinigameActive: false,
    ammoAtReloadStart: input.ammo,
    pendingEjectDamage: 0,
    autoReloadPending: false,
  };
}

/** Zero Protocol readiness — Protocol Charges gate (no full-mag requirement). */
export function evaluateZeroProtocolReady(state: Pick<HexShotCombatState, 'protocolCharges' | 'maxProtocolCharges'>): boolean {
  return state.protocolCharges >= state.maxProtocolCharges;
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
