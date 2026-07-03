import { COMBAT_CHANCE } from '../types/combatChance';
import type { EnemyCombatProfile, EnemyIntent } from '../types/run';
import { canRosterUseFortify } from '../data/enemyPostureConfig';

export function isEvadePostureActive(
  profile: Pick<EnemyCombatProfile, 'evadeActive' | 'evadeTurnsRemaining'>,
): boolean {
  return profile.evadeActive || (profile.evadeTurnsRemaining ?? 0) > 0;
}

export function isRedundantBuffIntent(intent: EnemyIntent, profile: EnemyCombatProfile): boolean {
  if (intent === 'EVADE') {
    if (isEvadePostureActive(profile)) return true;
    if ((profile.evadeChance ?? 0) >= COMBAT_CHANCE.EVADE_POSTURE_MISS_BONUS) return true;
  }
  if (intent === 'FORTIFY' && (profile.fortifyTurnsRemaining ?? 0) > 0) return true;
  if (intent === 'VEIL_BARRIER' && (profile.veilBarrierCharges ?? 0) > 0) return true;
  return false;
}

/** When a hostile already has Evade/Fortify active, spend the turn on a strike instead. */
export function resolveEffectiveEnemyIntent(profile: EnemyCombatProfile): EnemyIntent {
  if (profile.intent === 'FORTIFY' && !canRosterUseFortify(profile.rosterId)) {
    return 'STRIKE';
  }
  if (isRedundantBuffIntent(profile.intent, profile)) {
    return 'STRIKE';
  }
  return profile.intent;
}

/** Skip executing a buff intent when the posture is already active. */
export function isRedundantBuffExecution(profile: EnemyCombatProfile): boolean {
  return isRedundantBuffIntent(profile.intent, profile);
}
