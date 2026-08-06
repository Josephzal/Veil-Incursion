/**
 * Aegis Riposte — stored Strike bonus.
 *
 * Perfect Parry readies Riposte. Riposte empowers the Aegis’s next successful
 * Strike before the end of their next player turn. One charge. Hit-gated cash-out.
 * Miss / evade does not consume. Parry is never replaced by Riposte.
 */

import type { ClassType } from '../types/game';
import type { AbilityTag } from '../types/aegisCombat';
import { getAbilityTags } from './aegisAbilities';
import { resolveClassAbilityCost } from './classAbilityResolver';

/** Attached Kinetic bonus when an eligible Strike successfully hits. */
export const AEGIS_RIPOSTE_BONUS_KINETIC = 16;

/** Authoritative ability tag that marks Riposte-eligible Strikes. */
export const AEGIS_RIPOSTE_STRIKE_TAG: AbilityTag = 'STRIKE';

export type AegisRiposteGrantSource =
  | 'PERFECT_PARRY'
  | 'BOON'
  | 'GRAFT'
  | 'OTHER';

export interface AegisRiposteState {
  ready: boolean;
  /**
   * Balance encounter `playerTurns` value after which Riposte expires
   * (end of that numbered player turn). Null when not ready.
   */
  expiresAfterPlayerTurn: number | null;
  /** Which Perfect Parry / authored content granted the charge. */
  grantedBy: AegisRiposteGrantSource | null;
  /** Deterministic grant id for logs / replay. */
  grantId: string | null;
}

export function createDefaultAegisRiposteState(): AegisRiposteState {
  return {
    ready: false,
    expiresAfterPlayerTurn: null,
    grantedBy: null,
    grantId: null,
  };
}

export function isAegisRiposteReady(state: AegisRiposteState): boolean {
  return state.ready === true;
}

/**
 * Perfect Parry (or authored boon/graft that names Riposte) grants one charge.
 * Refresh expiration when already ready — never stack.
 */
export function grantAegisRiposte(args: {
  state: AegisRiposteState;
  /** Current balanceEncounter.playerTurns at grant time. */
  currentPlayerTurns: number;
  grantedBy: AegisRiposteGrantSource;
  grantId?: string;
  nowMs?: number;
}): { state: AegisRiposteState; refreshed: boolean; granted: boolean } {
  const { state, currentPlayerTurns, grantedBy } = args;
  const expiresAfterPlayerTurn = Math.max(1, currentPlayerTurns + 1);
  const grantId = args.grantId
    ?? `riposte-${grantedBy}-${currentPlayerTurns}-${args.nowMs ?? 0}`;
  const refreshed = state.ready;
  return {
    state: {
      ready: true,
      expiresAfterPlayerTurn,
      grantedBy,
      grantId,
    },
    refreshed,
    granted: true,
  };
}

/** Consume after an attached Riposte result is committed. */
export function consumeAegisRiposte(state: AegisRiposteState): {
  state: AegisRiposteState;
  consumed: boolean;
} {
  if (!state.ready) {
    return { state, consumed: false };
  }
  return {
    state: createDefaultAegisRiposteState(),
    consumed: true,
  };
}

/**
 * Expire at end of the player turn numbered `expiresAfterPlayerTurn`.
 * Call when leaving the player turn (passToEnemy / end turn).
 */
export function expireAegisRiposteAtPlayerTurnEnd(args: {
  state: AegisRiposteState;
  currentPlayerTurns: number;
}): { state: AegisRiposteState; expired: boolean } {
  const { state, currentPlayerTurns } = args;
  if (!state.ready || state.expiresAfterPlayerTurn == null) {
    return { state, expired: false };
  }
  if (currentPlayerTurns < state.expiresAfterPlayerTurn) {
    return { state, expired: false };
  }
  return {
    state: createDefaultAegisRiposteState(),
    expired: true,
  };
}

export function clearAegisRiposte(state: AegisRiposteState): AegisRiposteState {
  if (!state.ready && state.expiresAfterPlayerTurn == null) return state;
  return createDefaultAegisRiposteState();
}

/** True when this ability carries the authoritative STRIKE tag (or is the STRIKE id). */
export function abilityCarriesStrikeTag(
  classId: ClassType,
  abilityId: string,
  opts?: { doomfallReleaseAvailable?: boolean },
): boolean {
  if (abilityId === 'STRIKE') return true;
  if (classId === 'AEGIS') {
    if (abilityId === 'DOOMFALL') {
      // Charge is not a STRIKE; Release is.
      return opts?.doomfallReleaseAvailable === true;
    }
    try {
      const cost = resolveClassAbilityCost(classId, abilityId);
      if (cost.tags.includes(AEGIS_RIPOSTE_STRIKE_TAG) || cost.tags.includes('STRIKE')) {
        return true;
      }
    } catch {
      // Fall through to legacy catalog lookup.
    }
    try {
      const tags = getAbilityTags(abilityId as import('../types/aegisCombat').AegisAbilityId);
      if (tags.includes(AEGIS_RIPOSTE_STRIKE_TAG)) return true;
    } catch {
      return false;
    }
  }
  const cost = resolveClassAbilityCost(classId, abilityId);
  return cost.tags.includes(AEGIS_RIPOSTE_STRIKE_TAG) || cost.tags.includes('STRIKE');
}

export function canCashOutAegisRiposte(args: {
  state: AegisRiposteState;
  operativeClass: ClassType;
  abilityId: string | null | undefined;
  /** Authoritative primary target for this player action. */
  primaryTargetId: string | null | undefined;
  /** Target this hit resolved against. */
  hitTargetId: string | null | undefined;
  /** Outcome must be a successful hit (not miss/evade). */
  successfulHit: boolean;
  /** Already cashed out for this playerActionId. */
  alreadyCashedForAction: boolean;
  nestedPresentation?: boolean;
  indirectDamage?: boolean;
  echoHit?: boolean;
}): boolean {
  const {
    state,
    operativeClass,
    abilityId,
    primaryTargetId,
    hitTargetId,
    successfulHit,
    alreadyCashedForAction,
  } = args;
  if (operativeClass !== 'AEGIS') return false;
  if (!state.ready) return false;
  if (!successfulHit) return false;
  if (alreadyCashedForAction) return false;
  if (args.nestedPresentation || args.indirectDamage || args.echoHit) return false;
  if (!abilityId || !abilityCarriesStrikeTag(operativeClass, abilityId, {
    // Riposte cash-out for Doomfall Release is gated by the caller passing STRIKE tags;
    // Release stage is treated as STRIKE-eligible when abilityId is DOOMFALL and ready.
    doomfallReleaseAvailable: abilityId === 'DOOMFALL' ? true : undefined,
  })) return false;
  if (!hitTargetId) return false;
  // null primary = first successful authored hit (Divergence / Horizon multi-target).
  if (primaryTargetId != null && primaryTargetId !== hitTargetId) return false;
  return true;
}

export function riposteStatusCopy(args: {
  state: AegisRiposteState;
  /** True while it is the player turn that can still cash out. */
  onExpiringPlayerTurn: boolean;
}): { title: string; short: string; tooltip: string } | null {
  if (!args.state.ready) return null;
  return {
    title: 'RIPOSTE READY — 1',
    short: args.onExpiringPlayerTurn
      ? 'Your next successful STRIKE this turn deals +16 Kinetic.'
      : 'Your next successful STRIKE before the end of your next player turn deals +16 Kinetic.',
    tooltip:
      'Your next successful STRIKE before the end of your next player turn deals +16 Kinetic. Misses do not consume it.',
  };
}

export function serializeAegisRiposteState(state: AegisRiposteState): AegisRiposteState {
  return {
    ready: state.ready,
    expiresAfterPlayerTurn: state.expiresAfterPlayerTurn,
    grantedBy: state.grantedBy,
    grantId: state.grantId,
  };
}

export function restoreAegisRiposteState(
  raw: Partial<AegisRiposteState> | null | undefined,
): AegisRiposteState {
  if (!raw || typeof raw !== 'object') return createDefaultAegisRiposteState();
  if (!raw.ready) return createDefaultAegisRiposteState();
  return {
    ready: true,
    expiresAfterPlayerTurn: typeof raw.expiresAfterPlayerTurn === 'number'
      ? raw.expiresAfterPlayerTurn
      : null,
    grantedBy: raw.grantedBy ?? 'OTHER',
    grantId: raw.grantId ?? null,
  };
}
