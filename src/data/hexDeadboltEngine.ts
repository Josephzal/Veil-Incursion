/**
 * Hex Black Door Deadbolt + reload opportunity — W.4.
 * Encounter-local only; never serialize.
 */

export const DEADBOLT_AP_COST = 2;
export const DEADBOLT_STAMINA_COST = 14;
export const DEADBOLT_AMMO_COST = 1;
export const DEADBOLT_BASE_DAMAGE = 22;
export const DEADBOLT_PRIMED_DAMAGE = 28;

export interface HexDeadboltOpportunityState {
  deadboltReloadOpportunity: boolean;
}

export function createDefaultHexDeadboltOpportunityState(): HexDeadboltOpportunityState {
  return { deadboltReloadOpportunity: false };
}

export function clearHexDeadboltOpportunity(
  state: HexDeadboltOpportunityState,
): HexDeadboltOpportunityState {
  return createDefaultHexDeadboltOpportunityState();
}

/**
 * Arm after a completed Phase-Shift Reload that restored ≥1 round
 * while Nullbreach is equipped. Refresh to one; never stack.
 */
export function armHexDeadboltReloadOpportunity(
  state: HexDeadboltOpportunityState,
  args: {
    familyId: string | null | undefined;
    roundsRestored: number;
  },
): HexDeadboltOpportunityState {
  if (args.familyId !== 'hex-void-cannon') return state;
  if (args.roundsRestored <= 0) return state;
  return { deadboltReloadOpportunity: true };
}

export function consumeHexDeadboltReloadOpportunity(
  state: HexDeadboltOpportunityState,
): HexDeadboltOpportunityState {
  return { deadboltReloadOpportunity: false };
}

export function deadboltAuthoredBase(primed: boolean): number {
  return primed ? DEADBOLT_PRIMED_DAMAGE : DEADBOLT_BASE_DAMAGE;
}
