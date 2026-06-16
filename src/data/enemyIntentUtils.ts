import type { EnemyCombatProfile, EnemyIntent } from '../types/run';

export function isRedundantBuffIntent(intent: EnemyIntent, profile: EnemyCombatProfile): boolean {
  if (intent === 'EVADE' && profile.evadeActive) return true;
  if (intent === 'FORTIFY' && (profile.fortifyTurnsRemaining ?? 0) > 0) return true;
  return false;
}

/** When a hostile already has Evade/Fortify active, spend the turn on a strike instead. */
export function resolveEffectiveEnemyIntent(profile: EnemyCombatProfile): EnemyIntent {
  if (isRedundantBuffIntent(profile.intent, profile)) return 'STRIKE';
  return profile.intent;
}
