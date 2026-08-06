/**
 * E.4 — Envoy-owned Catalyst cast-resolution authority.
 * Shared by flex abilities and weapon actions. Hub may orchestrate presentation only.
 */
import type { ClassCombatEncounterState } from '../types/classCombatAbility';
import type { EnvoyAbilityId } from '../types/operativeClass';
import type { EnvoyWeaponActionId } from '../types/envoyWeaponAction';
import type { EnemyCombatProfile } from '../types/run';
import {
  applyEnvoyCatalystPayoffToTarget,
  catalystForEnvoyAbility,
  type EnvoyCatalystPayoff,
  type EnvoyCatalystType,
  primeEnvoyCatalyst,
  resolveEnvoyCatalystSequence,
} from './envoyCatalystEngine';
import { getEnvoyWeaponActionDefinition } from './envoyWeaponActionCatalog';
import { isEnvoyWeaponActionId } from './envoyWeaponActionRegistry';

export interface EnvoyCatalystCastResult {
  primed: boolean;
  previous: EnvoyCatalystType | null;
  current: EnvoyCatalystType | null;
  payoff: EnvoyCatalystPayoff | null;
  /** Once-per-action — never re-resolve for multi-hit/multi-target. */
  sequenceResolvedOnce: boolean;
  originActionId: string;
  historicalSourceId: string | null;
}

export function catalystForEnvoyWeaponAction(
  actionId: EnvoyWeaponActionId,
): EnvoyCatalystType | null {
  return getEnvoyWeaponActionDefinition(actionId)?.catalystPrime ?? null;
}

/** Resolve prime type for flex ID or weapon-action ID. */
export function catalystPrimeForEnvoyCast(actionId: string): EnvoyCatalystType | null {
  if (isEnvoyWeaponActionId(actionId)) {
    return catalystForEnvoyWeaponAction(actionId);
  }
  return catalystForEnvoyAbility(actionId as EnvoyAbilityId);
}

/**
 * Preview-only: compute sequence payoff without mutating classState.
 * Does not consume RNG.
 */
export function previewEnvoyCatalystCast(args: {
  classState: Pick<ClassCombatEncounterState, 'currentCatalyst'>;
  prime: EnvoyCatalystType | null;
  target?: EnemyCombatProfile | null;
}): {
  previous: EnvoyCatalystType | null;
  current: EnvoyCatalystType | null;
  payoff: EnvoyCatalystPayoff | null;
} {
  if (!args.prime) {
    return { previous: null, current: null, payoff: null };
  }
  const previous = args.classState.currentCatalyst;
  const payoff = resolveEnvoyCatalystSequence(previous, args.prime, args.target);
  return { previous, current: args.prime, payoff };
}

/**
 * Canonical once-per-cast Catalyst resolution after authored action packets.
 * Mutates classState.current/previous exactly once.
 */
export function resolveEnvoyCatalystCast(args: {
  classState: ClassCombatEncounterState;
  /** Catalyst to prime; null = no prime (no mutation). */
  prime: EnvoyCatalystType | null;
  target?: EnemyCombatProfile | null;
  originActionId: string;
  historicalSourceId?: string | null;
  /**
   * When true, apply ward-break / fracture payoff to target via returned patched enemy.
   * Caller applies heal/shield from payoff.
   */
  applyTargetPayoff?: boolean;
}): EnvoyCatalystCastResult & { patchedTarget: EnemyCombatProfile | null } {
  const historicalSourceId = args.historicalSourceId ?? null;
  if (!args.prime) {
    return {
      primed: false,
      previous: null,
      current: null,
      payoff: null,
      sequenceResolvedOnce: false,
      originActionId: args.originActionId,
      historicalSourceId,
      patchedTarget: null,
    };
  }

  const { previous, current } = primeEnvoyCatalyst(args.classState, args.prime);
  const payoff = resolveEnvoyCatalystSequence(previous, current, args.target);
  let patchedTarget: EnemyCombatProfile | null = null;
  if (
    args.applyTargetPayoff !== false
    && args.target?.unitId
    && (payoff.extraWardBreak || payoff.fractureTarget)
  ) {
    patchedTarget = applyEnvoyCatalystPayoffToTarget(args.target, payoff);
  }

  return {
    primed: true,
    previous,
    current,
    payoff,
    sequenceResolvedOnce: true,
    originActionId: args.originActionId,
    historicalSourceId,
    patchedTarget,
  };
}

export {
  applyEnvoyCatalystPayoffToTarget,
  catalystForEnvoyAbility,
  type EnvoyCatalystPayoff,
  type EnvoyCatalystType,
};
