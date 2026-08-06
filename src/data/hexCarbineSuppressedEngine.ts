/**
 * Hex Carbine Suppressed (from SUPPRESSIVE_BARRAGE / [ SUPPRESSIVE FIRE ]).
 * Distinct from boon SUPPRESSIVE_FIRE and encounter.suppressiveFireUnits.
 */

export const CARBINE_SUPPRESSED_DAMAGE_MULT = 0.7;

export interface HexCarbineSuppressedState {
  /** At most one tracked enemy. */
  carbineSuppressedUnitId: string | null;
  /**
   * True while the tracked enemy's current eligible direct action has already
   * applied the ×0.70 multiplier; consume when that action finishes.
   */
  carbineSuppressedAppliedThisAction: boolean;
}

export function createDefaultHexCarbineSuppressedState(): HexCarbineSuppressedState {
  return {
    carbineSuppressedUnitId: null,
    carbineSuppressedAppliedThisAction: false,
  };
}

export function clearHexCarbineSuppressed(
  state: HexCarbineSuppressedState,
): HexCarbineSuppressedState {
  return createDefaultHexCarbineSuppressedState();
}

export function applyHexCarbineSuppressed(
  state: HexCarbineSuppressedState,
  unitId: string,
): HexCarbineSuppressedState {
  return {
    carbineSuppressedUnitId: unitId,
    carbineSuppressedAppliedThisAction: false,
  };
}

export function clearHexCarbineSuppressedIfUnit(
  state: HexCarbineSuppressedState,
  unitId: string | null | undefined,
): HexCarbineSuppressedState {
  if (!unitId || state.carbineSuppressedUnitId !== unitId) return state;
  return clearHexCarbineSuppressed(state);
}

export function isHexCarbineSuppressedEligibleIncoming(args: {
  rawDamage: number;
  attackerUnitId: string | null | undefined;
  suppressedUnitId: string | null | undefined;
  environmental?: boolean;
  damageOverTime?: boolean;
  indirectDamage?: boolean;
  /** Healing / support / buff / defensive — not direct attacks. */
  ineligibleAction?: boolean;
}): boolean {
  if (args.rawDamage <= 0) return false;
  if (!args.attackerUnitId || !args.suppressedUnitId) return false;
  if (args.attackerUnitId !== args.suppressedUnitId) return false;
  if (args.environmental) return false;
  if (args.damageOverTime) return false;
  if (args.indirectDamage) return false;
  if (args.ineligibleAction) return false;
  return true;
}

/** Scale one packet of an eligible direct action. */
export function applyCarbineSuppressedDamage(raw: number): number {
  return Math.max(0, Math.floor(raw * CARBINE_SUPPRESSED_DAMAGE_MULT));
}

/**
 * Whether Suppressive Barrage authored hits qualify to apply Suppressed.
 * FS present at action start → ≥1 authored hit; else both must hit.
 */
export function shouldApplySuppressedFromAuthoredHits(args: {
  authoredHitCount: number;
  authoredPacketCount: number;
  hadFiringSolutionAtStart: boolean;
}): boolean {
  if (args.authoredPacketCount <= 0) return false;
  if (args.hadFiringSolutionAtStart) return args.authoredHitCount >= 1;
  return args.authoredHitCount >= args.authoredPacketCount;
}
