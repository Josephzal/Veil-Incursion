import type { EnemyRosterId } from './enemyRoster';
import type { EnemyIntent } from '../types/run';

/** Units that must never select or execute FORTIFY (fragile swarm — evade/stamina kit only). */
export const FORTIFY_BLOCKED_ROSTER_IDS: readonly EnemyRosterId[] = [
  'miasma-tick-swarm',
];

export function canRosterUseFortify(rosterId?: string): boolean {
  if (!rosterId) return true;
  return !(FORTIFY_BLOCKED_ROSTER_IDS as readonly string[]).includes(rosterId);
}

/** Units that open with / prefer FORTIFY posture. */
export const FORTIFY_POSTURE_ROSTER: readonly EnemyRosterId[] = [
  'concrete-gargoyle',
  'echoing-brute',
  'warden',
  'breacher',
  'amalgam',
  'spall',
  'golem',
];

/** Units that open with / prefer EVADE posture. */
export const EVADE_POSTURE_ROSTER: readonly EnemyRosterId[] = [
  'fracture-hound',
  'scuttler',
  'null-shade',
  'cutter',
  'spotter',
  'fixer',
  'thrall',
  'wire-ghoul',
  'ley-siren',
  'hook-weaver',
  'miasma-tick-swarm',
];

export function defaultPostureIntentForRoster(rosterId?: string): EnemyIntent | null {
  if (!rosterId) return null;
  if ((FORTIFY_POSTURE_ROSTER as readonly string[]).includes(rosterId) && canRosterUseFortify(rosterId)) {
    return 'FORTIFY';
  }
  if ((EVADE_POSTURE_ROSTER as readonly string[]).includes(rosterId)) return 'EVADE';
  return null;
}

export function usesFortifyPosture(rosterId?: string): boolean {
  return rosterId != null && (FORTIFY_POSTURE_ROSTER as readonly string[]).includes(rosterId);
}

export function usesEvadePosture(rosterId?: string): boolean {
  return rosterId != null && (EVADE_POSTURE_ROSTER as readonly string[]).includes(rosterId);
}
