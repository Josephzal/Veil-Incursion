/**
 * Hex Black Door Threshold — prepared reaction (W.4).
 * Distinct from Aegis Parry, Panopticon, Elusive, and other class reactions.
 */
import type { HexAmmoType } from '../types/hexAmmo';
import type { EnemyIntent } from '../types/run';
import { getIntentCatalogEntry } from './enemyIntentCatalog';

export const THRESHOLD_AP_COST = 1;
export const THRESHOLD_STAMINA_COST = 15;
export const THRESHOLD_AMMO_COST = 1;
export const THRESHOLD_AUTHORED_DAMAGE = 14;

export interface HexThresholdSnapshot {
  ammoType: HexAmmoType;
  nextShotOvercharged: boolean;
  overchargeMultiplier: number;
  firstShotPenaltyPending: boolean;
}

export interface HexThresholdState {
  thresholdArmed: boolean;
  thresholdSnapshot: HexThresholdSnapshot | null;
}

export function createDefaultHexThresholdState(): HexThresholdState {
  return {
    thresholdArmed: false,
    thresholdSnapshot: null,
  };
}

export function clearHexThreshold(state: HexThresholdState): HexThresholdState {
  return createDefaultHexThresholdState();
}

export function armHexThreshold(
  state: HexThresholdState,
  snapshot: HexThresholdSnapshot,
): HexThresholdState | null {
  if (state.thresholdArmed) return null;
  return {
    thresholdArmed: true,
    thresholdSnapshot: { ...snapshot },
  };
}

/**
 * Eligible: direct attack intents that target the player (single or multi).
 * Ineligible: buffs, guards, support, drains, debuffs, summons, cargo, etc.
 */
export function isHexThresholdEligibleEnemyAction(intent: EnemyIntent): boolean {
  const entry = getIntentCatalogEntry(intent);
  if (entry.type !== 'BASIC_ATTACK' && entry.type !== 'HEAVY_ATTACK') return false;
  return (
    entry.targetMode === 'PLAYER'
    || entry.targetMode === 'ALL_PLAYERS'
    || entry.targetMode === 'LOWEST_HP_PLAYER'
    || entry.targetMode === 'RANDOM_PLAYER'
  );
}

/** Consume armed state before reaction resolution (no recursion / double fire). */
export function consumeHexThresholdArm(
  state: HexThresholdState,
): { next: HexThresholdState; snapshot: HexThresholdSnapshot | null; fired: boolean } {
  if (!state.thresholdArmed || !state.thresholdSnapshot) {
    return { next: state, snapshot: null, fired: false };
  }
  return {
    next: createDefaultHexThresholdState(),
    snapshot: { ...state.thresholdSnapshot },
    fired: true,
  };
}
