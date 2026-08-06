/**
 * Hex Carbine Firing Solution — W.3.
 * Accuracy-only mark: +15 on authored Carbine checks vs the tracked living enemy.
 */

export const FIRING_SOLUTION_ACCURACY_BONUS_PCT = 15;

export interface HexFiringSolutionState {
  firingSolutionUnitId: string | null;
  /** Expires at end of this player-turn number (see establish/refresh). */
  firingSolutionExpiresAfterPlayerTurn: number | null;
}

export function createDefaultHexFiringSolutionState(): HexFiringSolutionState {
  return {
    firingSolutionUnitId: null,
    firingSolutionExpiresAfterPlayerTurn: null,
  };
}

export function clearHexFiringSolution(state: HexFiringSolutionState): HexFiringSolutionState {
  return createDefaultHexFiringSolutionState();
}

export function hasFiringSolutionOn(
  state: HexFiringSolutionState,
  unitId: string | null | undefined,
): boolean {
  return !!unitId && state.firingSolutionUnitId === unitId;
}

/**
 * Establish / transfer / refresh on a successful Center Mass hit.
 * Created on player turn N → expires after player turn N+1.
 * Refresh on turn N+1 → expires after N+2.
 */
export function establishHexFiringSolution(
  state: HexFiringSolutionState,
  unitId: string,
  currentPlayerTurn: number,
): HexFiringSolutionState {
  const turn = Math.max(1, currentPlayerTurn);
  return {
    firingSolutionUnitId: unitId,
    firingSolutionExpiresAfterPlayerTurn: turn + 1,
  };
}

/** Clear when tracked unit dies / leaves / invalid. */
export function clearHexFiringSolutionIfUnit(
  state: HexFiringSolutionState,
  unitId: string | null | undefined,
): HexFiringSolutionState {
  if (!unitId || state.firingSolutionUnitId !== unitId) return state;
  return clearHexFiringSolution(state);
}

/**
 * End-of-player-turn expiry. Does not expire on the same turn boundary it was created
 * (expiresAfter is always ≥ creationTurn+1).
 */
export function expireHexFiringSolutionAtPlayerTurnEnd(
  state: HexFiringSolutionState,
  endingPlayerTurn: number,
): { next: HexFiringSolutionState; expired: boolean } {
  if (
    state.firingSolutionUnitId
    && state.firingSolutionExpiresAfterPlayerTurn != null
    && endingPlayerTurn >= state.firingSolutionExpiresAfterPlayerTurn
  ) {
    return { next: clearHexFiringSolution(state), expired: true };
  }
  return { next: state, expired: false };
}

export function firingSolutionAccuracyBonusPct(
  state: HexFiringSolutionState,
  targetId: string | null | undefined,
  /** Snapshot at action start — preferred over live state. */
  snapshottedHasSolution?: boolean,
): number {
  const tracked = snapshottedHasSolution
    ?? hasFiringSolutionOn(state, targetId);
  return tracked ? FIRING_SOLUTION_ACCURACY_BONUS_PCT : 0;
}

/** Preview/tooltip lifetime without an ambiguous “1 turn” label. */
export function formatFiringSolutionLifetimePreview(
  state: HexFiringSolutionState,
  currentPlayerTurn: number,
): string | null {
  if (!state.firingSolutionUnitId || state.firingSolutionExpiresAfterPlayerTurn == null) {
    return null;
  }
  const turn = Math.max(1, currentPlayerTurn);
  const expires = state.firingSolutionExpiresAfterPlayerTurn;
  if (expires <= turn) {
    return 'Firing Solution — expires at end of this player turn';
  }
  if (expires === turn + 1) {
    return 'Firing Solution — lasts through next enemy phase and next player turn';
  }
  return `Firing Solution — expires at end of player turn ${expires}`;
}
