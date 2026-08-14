/** @deprecated Neutral compatibility surface for retired historical tests. */
export const APEX_TRIGGER_AP_REFUND_CAP_PER_ENCOUNTER = 0;
/** @deprecated Neutral compatibility surface for retired historical tests. */
export const GRID_HACKER_AP_REFUND_CAP_PER_ENCOUNTER = 0;
/** @deprecated Universal action upgrades never generate salvage. */
export const GRAFT_SALVAGE_CREDIT_CAP_PER_ENCOUNTER = 0;
/** @deprecated Universal action upgrades never generate salvage. */
export const GRAFT_SALVAGE_CREDIT_PER_KILL = 0;

export type GraftEncounterSafetyState = {
  apexTriggerApRefunds: number;
  gridHackerApRefunds: number;
  salvageCreditsAccrued: number;
};

export function createDefaultGraftEncounterSafetyState(): GraftEncounterSafetyState {
  return { apexTriggerApRefunds: 0, gridHackerApRefunds: 0, salvageCreditsAccrued: 0 };
}

export function canRefundGridHackerAp(state: GraftEncounterSafetyState): boolean {
  void state;
  return false;
}

export function recordGridHackerApRefund(
  state: GraftEncounterSafetyState,
): GraftEncounterSafetyState {
  return state;
}

export function canRefundApexTriggerAp(state: GraftEncounterSafetyState): boolean {
  void state;
  return false;
}

export function recordApexTriggerApRefund(
  state: GraftEncounterSafetyState,
): GraftEncounterSafetyState {
  return state;
}

export function accrueGraftSalvageCredits(
  state: GraftEncounterSafetyState,
  amount = GRAFT_SALVAGE_CREDIT_PER_KILL,
): { next: GraftEncounterSafetyState; granted: number } {
  void amount;
  return { next: state, granted: 0 };
}
