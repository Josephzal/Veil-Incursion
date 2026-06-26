import { COMBAT_CHANCE } from '../types/combatChance';
import type { EnemyCombatProfile, EnemyIntent } from '../types/run';

export function isRedundantBuffIntent(intent: EnemyIntent, profile: EnemyCombatProfile): boolean {
  if (intent === 'EVADE') {
    if (profile.evadeActive) return true;
    if ((profile.evadeChance ?? 0) >= COMBAT_CHANCE.EVADE_POSTURE_MISS_BONUS) return true;
  }
  if (intent === 'FORTIFY' && (profile.fortifyTurnsRemaining ?? 0) > 0) return true;
  if (intent === 'VEIL_BARRIER' && (profile.veilBarrierCharges ?? 0) > 0) return true;
  return false;
}

/** When a hostile already has Evade/Fortify active, spend the turn on a strike instead. */
export function resolveEffectiveEnemyIntent(profile: EnemyCombatProfile): EnemyIntent {
  if (isRedundantBuffIntent(profile.intent, profile)) {
    if (profile.intent === 'EVADE' && profile.evadeActive) return 'EVADE';
    return 'STRIKE';
  }
  return profile.intent;
}
