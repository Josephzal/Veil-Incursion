/**
 * Phase E.1e.1 — structural containment helpers for Neutron once-per-action,
 * Apex WA pre-scale ownership, and Sanguine once-per-player-turn.
 */

export type NeutronOnceLedger = {
  consumedForPlayerActionId: string | null;
};

export function createNeutronOnceLedger(): NeutronOnceLedger {
  return { consumedForPlayerActionId: null };
}

export function clearNeutronOnceLedger(ledger: NeutronOnceLedger): void {
  ledger.consumedForPlayerActionId = null;
}

/** Authored Neutron addition: floor(committedReserve × 0.8). */
export function computeNeutronReserveAdd(reserveSpent: number): number {
  return Math.floor(reserveSpent * 0.8);
}

export function neutronReserveAddAlreadyConsumed(
  ledger: NeutronOnceLedger,
  playerActionId: string,
): boolean {
  return ledger.consumedForPlayerActionId === playerActionId;
}

export function markNeutronReserveAddConsumed(
  ledger: NeutronOnceLedger,
  playerActionId: string,
): void {
  ledger.consumedForPlayerActionId = playerActionId;
}

/**
 * Apply Apex boss ×2 to a single WA packet at the delivery-ownership layer.
 * Aggregate multi-packet boss output is exactly 2× ungrafted when each packet is scaled once here.
 */
export function applyApexBossPacketScale(
  damage: number,
  bossDamageMultiplier: number,
  isBoss: boolean,
): number {
  if (!(damage > 0 && isBoss && bossDamageMultiplier > 1)) return damage;
  return Math.floor(damage * bossDamageMultiplier);
}

export type SanguineTurnGuard = {
  usedOnPlayerTurn: number | null;
};

export function createSanguineTurnGuard(): SanguineTurnGuard {
  return { usedOnPlayerTurn: null };
}

export function clearSanguineTurnGuard(guard: SanguineTurnGuard): void {
  guard.usedOnPlayerTurn = null;
}

export type SanguineActivationGate =
  | { ok: true }
  | { ok: false; code: 'SANGUINE_TURN_LIMIT'; reason: string };

/** One successful Sanguine activation per authoritative player-turn identity. */
export function canActivateSanguineThisTurn(
  guard: SanguineTurnGuard,
  currentPlayerTurn: number,
): SanguineActivationGate {
  if (guard.usedOnPlayerTurn === currentPlayerTurn) {
    return {
      ok: false,
      code: 'SANGUINE_TURN_LIMIT',
      reason: 'already used this turn',
    };
  }
  return { ok: true };
}

export function markSanguineActivatedThisTurn(
  guard: SanguineTurnGuard,
  currentPlayerTurn: number,
): void {
  guard.usedOnPlayerTurn = currentPlayerTurn;
}

/** Rollback restores availability when a committed activation is undone. */
export function restoreSanguineTurnAvailability(guard: SanguineTurnGuard): void {
  guard.usedOnPlayerTurn = null;
}

/**
 * Masochist's Joy — apply authored ×1.5, then clear pending (consume once).
 * Pending must not be cleared before the multiplier lands.
 */
export function applyMasochistsJoyAmplification(
  damage: number,
  pendingBuff: boolean,
): { damage: number; pendingBuff: boolean } {
  if (!pendingBuff) return { damage, pendingBuff: false };
  return {
    damage: Math.floor(damage * 1.5),
    pendingBuff: false,
  };
}
