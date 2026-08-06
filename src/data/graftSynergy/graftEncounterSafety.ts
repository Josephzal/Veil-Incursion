/**
 * Phase 3J — encounter-scoped graft safety (AP refund / salvage caps).
 * Encounter state clears between combats; run-scoped Sanctuary graft assignments persist on ActiveIncursion.
 */

/** Apex-Trigger: at most this many AP refunds per encounter (prevents unbounded chaining). */
export const APEX_TRIGGER_AP_REFUND_CAP_PER_ENCOUNTER = 1;

/** Grid-Hacker (Aegis): at most one AP refund per encounter. */
export const GRID_HACKER_AP_REFUND_CAP_PER_ENCOUNTER = 1;

/** Scavenger-style credit drops: capped per encounter; resolved as post-combat salvage. */
export const GRAFT_SALVAGE_CREDIT_CAP_PER_ENCOUNTER = 25;
export const GRAFT_SALVAGE_CREDIT_PER_KILL = 5;

export type GraftEncounterSafetyState = {
  apexTriggerApRefunds: number;
  /** Aegis Grid-Hacker kill AP refunds this encounter. */
  gridHackerApRefunds: number;
  salvageCreditsAccrued: number;
};

export function createDefaultGraftEncounterSafetyState(): GraftEncounterSafetyState {
  return { apexTriggerApRefunds: 0, gridHackerApRefunds: 0, salvageCreditsAccrued: 0 };
}

export function canRefundGridHackerAp(state: GraftEncounterSafetyState): boolean {
  return state.gridHackerApRefunds < GRID_HACKER_AP_REFUND_CAP_PER_ENCOUNTER;
}

export function recordGridHackerApRefund(
  state: GraftEncounterSafetyState,
): GraftEncounterSafetyState {
  if (!canRefundGridHackerAp(state)) return state;
  return { ...state, gridHackerApRefunds: state.gridHackerApRefunds + 1 };
}

export function canRefundApexTriggerAp(state: GraftEncounterSafetyState): boolean {
  return state.apexTriggerApRefunds < APEX_TRIGGER_AP_REFUND_CAP_PER_ENCOUNTER;
}

export function recordApexTriggerApRefund(
  state: GraftEncounterSafetyState,
): GraftEncounterSafetyState {
  if (!canRefundApexTriggerAp(state)) return state;
  return { ...state, apexTriggerApRefunds: state.apexTriggerApRefunds + 1 };
}

export function accrueGraftSalvageCredits(
  state: GraftEncounterSafetyState,
  amount = GRAFT_SALVAGE_CREDIT_PER_KILL,
): { next: GraftEncounterSafetyState; granted: number } {
  const room = Math.max(0, GRAFT_SALVAGE_CREDIT_CAP_PER_ENCOUNTER - state.salvageCreditsAccrued);
  const granted = Math.min(room, amount);
  return {
    next: {
      ...state,
      salvageCreditsAccrued: state.salvageCreditsAccrued + granted,
    },
    granted,
  };
}
