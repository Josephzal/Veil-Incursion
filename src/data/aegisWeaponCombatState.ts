/**
 * Phase B — encounter-scoped Aegis weapon combat state.
 * Tempo / Eclipse / Poise / Dreadbound / Doomfall / No Respite.
 */
export interface AegisDreadboundEntry {
  /** Mastery (Brand + Fracture) awarded at most once per application. */
  masteryAwarded: boolean;
}

export interface AegisWeaponCombatState {
  /** Paired Blades Tempo — single armed flag; never stacks. */
  tempoArmed: boolean;
  /** Expires at end of this player-turn number. */
  tempoExpiresAfterPlayerTurn: number | null;
  eclipseActive: boolean;
  /** Cleared at the beginning of this player-turn number if still unused. */
  eclipseExpiresAtPlayerTurnStart: number | null;
  poiseActive: boolean;
  poiseExpiresAtPlayerTurnStart: number | null;
  /** Per-enemy Dreadbound watch. */
  dreadboundByUnitId: Record<string, AegisDreadboundEntry>;
  /** Doomfall Charge — Committed. */
  committed: boolean;
  /** Same authored DOOMFALL origin across Charge → Release. */
  doomfallOriginActionId: string | null;
  /** Release available this player turn. */
  doomfallReleaseAvailable: boolean;
  /** No Respite payoff once per player turn. */
  noRespiteUsedThisPlayerTurn: boolean;
}

export function createDefaultAegisWeaponCombatState(): AegisWeaponCombatState {
  return {
    tempoArmed: false,
    tempoExpiresAfterPlayerTurn: null,
    eclipseActive: false,
    eclipseExpiresAtPlayerTurnStart: null,
    poiseActive: false,
    poiseExpiresAtPlayerTurnStart: null,
    dreadboundByUnitId: {},
    committed: false,
    doomfallOriginActionId: null,
    doomfallReleaseAvailable: false,
    noRespiteUsedThisPlayerTurn: false,
  };
}

export function armAegisTempo(
  state: AegisWeaponCombatState,
  currentPlayerTurn: number,
): AegisWeaponCombatState {
  return {
    ...state,
    tempoArmed: true,
    tempoExpiresAfterPlayerTurn: currentPlayerTurn + 1,
  };
}

export function consumeAegisTempo(state: AegisWeaponCombatState): AegisWeaponCombatState {
  if (!state.tempoArmed) return state;
  return {
    ...state,
    tempoArmed: false,
    tempoExpiresAfterPlayerTurn: null,
  };
}

export function expireAegisTempoAtPlayerTurnEnd(
  state: AegisWeaponCombatState,
  endingPlayerTurn: number,
): AegisWeaponCombatState {
  if (
    state.tempoArmed
    && state.tempoExpiresAfterPlayerTurn != null
    && endingPlayerTurn >= state.tempoExpiresAfterPlayerTurn
  ) {
    return consumeAegisTempo(state);
  }
  return state;
}

export function beginAegisPlayerTurnWeaponState(
  state: AegisWeaponCombatState,
  playerTurn: number,
): AegisWeaponCombatState {
  let next = {
    ...state,
    noRespiteUsedThisPlayerTurn: false,
  };

  if (next.eclipseActive && next.eclipseExpiresAtPlayerTurnStart === playerTurn) {
    next = {
      ...next,
      eclipseActive: false,
      eclipseExpiresAtPlayerTurnStart: null,
    };
  }
  if (next.poiseActive && next.poiseExpiresAtPlayerTurnStart === playerTurn) {
    next = {
      ...next,
      poiseActive: false,
      poiseExpiresAtPlayerTurnStart: null,
    };
  }

  // Doomfall: end COMMITTED at start of next player turn → Release available.
  if (next.committed && next.doomfallOriginActionId) {
    next = {
      ...next,
      committed: false,
      doomfallReleaseAvailable: true,
    };
  }

  return next;
}

export function enterDoomfallCharge(
  state: AegisWeaponCombatState,
  originActionId: string,
): AegisWeaponCombatState {
  return {
    ...state,
    committed: true,
    doomfallOriginActionId: originActionId,
    doomfallReleaseAvailable: false,
  };
}

export function cancelDoomfallCharge(state: AegisWeaponCombatState): AegisWeaponCombatState {
  if (!state.committed && !state.doomfallReleaseAvailable) return state;
  return {
    ...state,
    committed: false,
    doomfallOriginActionId: null,
    doomfallReleaseAvailable: false,
  };
}

export function consumeDoomfallRelease(state: AegisWeaponCombatState): AegisWeaponCombatState {
  return {
    ...state,
    committed: false,
    doomfallOriginActionId: null,
    doomfallReleaseAvailable: false,
  };
}

/** Ending turn without Release loses the charge. */
export function expireDoomfallReleaseAtTurnEnd(
  state: AegisWeaponCombatState,
): AegisWeaponCombatState {
  if (!state.doomfallReleaseAvailable) return state;
  return consumeDoomfallRelease(state);
}

export function applyDreadbound(
  state: AegisWeaponCombatState,
  unitId: string,
): AegisWeaponCombatState {
  return {
    ...state,
    dreadboundByUnitId: {
      ...state.dreadboundByUnitId,
      [unitId]: { masteryAwarded: false },
    },
  };
}

export function clearDreadbound(
  state: AegisWeaponCombatState,
  unitId: string,
): AegisWeaponCombatState {
  if (!state.dreadboundByUnitId[unitId]) return state;
  const next = { ...state.dreadboundByUnitId };
  delete next[unitId];
  return { ...state, dreadboundByUnitId: next };
}

export function markDreadboundMastery(
  state: AegisWeaponCombatState,
  unitId: string,
): AegisWeaponCombatState {
  const entry = state.dreadboundByUnitId[unitId];
  if (!entry || entry.masteryAwarded) return state;
  return {
    ...state,
    dreadboundByUnitId: {
      ...state.dreadboundByUnitId,
      [unitId]: { masteryAwarded: true },
    },
  };
}

export function enterEclipse(
  state: AegisWeaponCombatState,
  nextPlayerTurnStart: number,
): AegisWeaponCombatState {
  return {
    ...state,
    eclipseActive: true,
    eclipseExpiresAtPlayerTurnStart: nextPlayerTurnStart,
  };
}

export function clearEclipse(state: AegisWeaponCombatState): AegisWeaponCombatState {
  if (!state.eclipseActive) return state;
  return {
    ...state,
    eclipseActive: false,
    eclipseExpiresAtPlayerTurnStart: null,
  };
}

export function enterPoise(
  state: AegisWeaponCombatState,
  nextPlayerTurnStart: number,
): AegisWeaponCombatState {
  return {
    ...state,
    poiseActive: true,
    poiseExpiresAtPlayerTurnStart: nextPlayerTurnStart,
  };
}

export function clearPoise(state: AegisWeaponCombatState): AegisWeaponCombatState {
  if (!state.poiseActive) return state;
  return {
    ...state,
    poiseActive: false,
    poiseExpiresAtPlayerTurnStart: null,
  };
}
