/**
 * Phase C — Runebound Carapace combat state.
 * Reflects once after the first blockable direct melee enemy action that damages the Aegis.
 */
import {
  RUNEBOUND_REFLECT_FRACTURE,
  RUNEBOUND_REFLECT_TRUE,
} from './aegisTechniqueCommitEngine';

export interface RuneboundCarapaceState {
  armed: boolean;
  /** Attacker latched on first eligible damaging hit during the current enemy action. */
  pendingAttackerId: string | null;
  /** True once an eligible hit connected; reflection fires after the action completes. */
  pendingReflect: boolean;
  reflectDamage: number;
}

export function createRuneboundCarapaceState(): RuneboundCarapaceState {
  return {
    armed: false,
    pendingAttackerId: null,
    pendingReflect: false,
    reflectDamage: RUNEBOUND_REFLECT_TRUE,
  };
}

export function armRuneboundCarapace(
  state: RuneboundCarapaceState,
  reflectDamage = RUNEBOUND_REFLECT_TRUE,
): RuneboundCarapaceState {
  return { armed: true, pendingAttackerId: null, pendingReflect: false, reflectDamage };
}

export function clearRuneboundCarapace(state: RuneboundCarapaceState): RuneboundCarapaceState {
  return { ...state, armed: false, pendingAttackerId: null, pendingReflect: false };
}

export interface CarapaceInboundEligibility {
  armed: boolean;
  /** Direct authored enemy action with an attacker unit. */
  hasAttacker: boolean;
  attackerId: string | null;
  /** Damage after mitigation that actually applied to HP. */
  damageApplied: number;
  /** Fully Evaded / fully Parried — do not latch. */
  fullyNegated: boolean;
  unblockable: boolean;
  ranged: boolean;
  environmental: boolean;
  damageOverTime: boolean;
  selfDamage: boolean;
  controlOnly: boolean;
  mitigationBypass: boolean;
}

export function isCarapaceEligibleInbound(args: CarapaceInboundEligibility): boolean {
  if (!args.armed) return false;
  if (!args.hasAttacker || !args.attackerId) return false;
  if (args.damageApplied <= 0) return false;
  if (args.fullyNegated) return false;
  if (args.unblockable) return false;
  if (args.ranged) return false;
  if (args.environmental) return false;
  if (args.damageOverTime) return false;
  if (args.selfDamage) return false;
  if (args.controlOnly) return false;
  if (args.mitigationBypass) return false;
  return true;
}

/** Latch the first eligible hit; later hits in the same action do not change the attacker. */
export function noteCarapaceInboundHit(
  state: RuneboundCarapaceState,
  eligibility: CarapaceInboundEligibility,
): RuneboundCarapaceState {
  if (!isCarapaceEligibleInbound(eligibility)) return state;
  if (state.pendingReflect) return state;
  return {
    ...state,
    pendingAttackerId: eligibility.attackerId,
    pendingReflect: true,
  };
}

export interface CarapaceReflectPlan {
  attackerId: string;
  trueDamage: number;
  fracture: number;
  consume: true;
}

/**
 * After a complete enemy action: emit one reflection plan (or consume without redirect).
 */
export function resolveCarapaceAfterEnemyAction(
  state: RuneboundCarapaceState,
  attackerStillValid: boolean,
): { next: RuneboundCarapaceState; reflect: CarapaceReflectPlan | null; consumed: boolean } {
  if (!state.armed || !state.pendingReflect) {
    return { next: state, reflect: null, consumed: false };
  }
  const attackerId = state.pendingAttackerId;
  const cleared = clearRuneboundCarapace(state);
  if (!attackerId || !attackerStillValid) {
    return { next: cleared, reflect: null, consumed: true };
  }
  return {
    next: cleared,
    reflect: {
      attackerId,
      trueDamage: state.reflectDamage ?? RUNEBOUND_REFLECT_TRUE,
      fracture: RUNEBOUND_REFLECT_FRACTURE,
      consume: true,
    },
    consumed: true,
  };
}
