import type { RunItemUseBehavior } from '../types/runItem';

export interface SupplyCombatTargetSafety {
  isBoss: boolean;
  isObjectiveCritical: boolean;
  revealedIntent: boolean;
}

export interface SupplyCombatTranslation {
  cancelRevealedIntent: boolean;
  applyFractureFallback: boolean;
  maxControlTurns: number;
  maxRootTargets: number;
  allowExecution: boolean;
  allowForcedTargeting: boolean;
  translation: 'FULL' | 'BOUNDED_BOSS' | 'BOUNDED_OBJECTIVE';
}

/**
 * Central policy for Supply control. Protected targets retain phases and
 * objective behavior; the Supply translates to one-turn control or Fracture.
 */
export function resolveSupplyCombatTranslation(
  behavior: RunItemUseBehavior,
  target: SupplyCombatTargetSafety,
): SupplyCombatTranslation {
  const protectedTarget = target.isBoss || target.isObjectiveCritical;
  return {
    cancelRevealedIntent:
      behavior === 'black_iron_wedge' &&
      target.revealedIntent &&
      !protectedTarget,
    applyFractureFallback: behavior === 'black_iron_wedge',
    maxControlTurns: protectedTarget ? 1 : 2,
    maxRootTargets: protectedTarget ? 1 : 2,
    allowExecution: !protectedTarget,
    allowForcedTargeting: !protectedTarget,
    translation: target.isBoss
      ? 'BOUNDED_BOSS'
      : target.isObjectiveCritical
        ? 'BOUNDED_OBJECTIVE'
        : 'FULL',
  };
}
