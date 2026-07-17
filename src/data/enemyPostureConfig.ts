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

/**
 * Spawn openers — teach archetype personality on turn 1.
 * Fortify/Evade are responses to danger, not default openings (except true disruptors/supports).
 */
export const ROSTER_OPENER_INTENTS: Partial<Record<EnemyRosterId, EnemyIntent>> = {
  // Bruisers — open with pressure
  'gutter-goliath': 'STRIKE',
  'iron-maiden': 'STRIKE',
  'golem': 'STRIKE',
  'blood-rusted-golem': 'STRIKE',
  'warden': 'STRIKE',
  'breacher': 'STRIKE',
  'rival-reaver': 'STRIKE',
  'amalgam': 'STRIKE',
  'core-sick-amalgam': 'STRIKE',
  'echoing-brute': 'STRIKE',
  'anchor-husk': 'STRIKE',
  'slag-blood': 'STRIKE',
  'concrete-gargoyle': 'PAVEMENT_CRUSHER_CHARGE',
  'weeping-gargoyle': 'PAVEMENT_CRUSHER_CHARGE',

  // Assassins — open with threat, evade after attacking
  'scuttler': 'STRIKE',
  'phase-scuttler': 'STRIKE',
  'cutter': 'STRIKE',
  'fracture-hound': 'STRIKE',
  'wire-ghoul': 'STRIKE',
  'rival-hexer': 'HEX_MARK',

  // Supports — squad-aware openers (repair gated at decide time)
  'fixer': 'STRIKE',
  'rival-veilbinder': 'BINDING_WARD',
  'ley-siren': 'OCCULT_TETHER',
  'ash-weeper': 'STRIKE',
  'rootbound-weeper': 'STRIKE',
  'hollow-lung': 'STRIKE',
  'grave-robber': 'STRIKE',

  // Artillery — telegraph first
  'sapper': 'ARTILLERY_CHARGE',
  'coil-spike-sniper': 'LASER_SIGHT',
  'rift-spike-sniper': 'LASER_SIGHT',
  'resonance-caster': 'ARTILLERY_CHARGE',
  'choir-bound-resonance-caster': 'ARTILLERY_CHARGE',
  'tar-spitter': 'ARTILLERY_CHARGE',
  'tar-choir': 'ARTILLERY_CHARGE',
  'splinter': 'ARTILLERY_CHARGE',
  'spotter': 'TARGET_LOCK',
  'churn': 'STRIKE',
  'grave-engine-churn': 'STRIKE',

  // Disruptors / occult — change the rules
  'null-shade': 'SINKING_INTO_GRID',
  'null-crown-shade': 'SINKING_INTO_GRID',
  'spatial-glitch': 'SENSORY_JAM',
  'memory-leech': 'JAM_AUGMENT',
  'void-lock-memory-leech': 'JAM_AUGMENT',
  'hook-weaver': 'STAMINA_TETHER',
  'smog-caller': 'SIPHON_ABYSSAL',
  'static-caller': 'SIPHON_ABYSSAL',
  'miasma-tick-swarm': 'SWARM_BITE',
};

/** @deprecated Prefer ROSTER_OPENER_INTENTS — kept for posture preference queries. */
export const FORTIFY_POSTURE_ROSTER: readonly EnemyRosterId[] = [
  'warden',
];

/** @deprecated Prefer ROSTER_OPENER_INTENTS — assassins no longer open with Evade. */
export const EVADE_POSTURE_ROSTER: readonly EnemyRosterId[] = [
  'fixer',
];

export function defaultPostureIntentForRoster(rosterId?: string): EnemyIntent | null {
  if (!rosterId) return null;
  const opener = ROSTER_OPENER_INTENTS[rosterId as EnemyRosterId];
  if (opener) {
    if (opener === 'FORTIFY' && !canRosterUseFortify(rosterId)) return 'STRIKE';
    return opener;
  }
  return null;
}

export function usesFortifyPosture(rosterId?: string): boolean {
  return rosterId != null && (FORTIFY_POSTURE_ROSTER as readonly string[]).includes(rosterId);
}

export function usesEvadePosture(rosterId?: string): boolean {
  return rosterId != null && (EVADE_POSTURE_ROSTER as readonly string[]).includes(rosterId);
}
