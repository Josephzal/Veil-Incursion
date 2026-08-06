/**
 * Hex Slipshot Elusive — Decision 3A.
 * Forced evade vs next eligible enemy direct attack; max one charge; no stack.
 */

export interface HexElusiveState {
  charges: number;
}

export function createDefaultHexElusiveState(): HexElusiveState {
  return { charges: 0 };
}

/** Grant / refresh to exactly one charge after a valid Slipshot cast. */
export function grantHexElusiveCharge(state: HexElusiveState): HexElusiveState {
  return { charges: 1 };
}

export function clearHexElusive(state: HexElusiveState): HexElusiveState {
  return { charges: 0 };
}

export function hasHexElusiveCharge(state: HexElusiveState): boolean {
  return state.charges > 0;
}

/**
 * Whether this incoming hurtPlayer path may trigger/consume Elusive.
 * Environmental, DoT, indirect/no-attacker, unblockable, and evade-ineligible do not.
 */
export function isHexElusiveEligibleIncoming(args: {
  rawDamage: number;
  hasAttacker: boolean;
  unblockable?: boolean;
  rollEvade?: boolean;
  environmental?: boolean;
  damageOverTime?: boolean;
  indirectDamage?: boolean;
}): boolean {
  if (args.rawDamage <= 0) return false;
  if (!args.hasAttacker) return false;
  if (args.unblockable) return false;
  if (args.rollEvade === false) return false;
  if (args.environmental) return false;
  if (args.damageOverTime) return false;
  if (args.indirectDamage) return false;
  return true;
}

/** Consume one charge; returns whether a forced evade should apply. */
export function tryConsumeHexElusive(state: HexElusiveState): {
  next: HexElusiveState;
  forcedEvade: boolean;
} {
  if (state.charges <= 0) return { next: state, forcedEvade: false };
  return { next: { charges: 0 }, forcedEvade: true };
}
