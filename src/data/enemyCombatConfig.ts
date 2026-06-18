import type { DistrictId } from './districtPacing';
import { getDistrictFromDepth } from './districtPacing';
import type { EnemyRosterId } from './enemyRoster';

/** Spec alias keys — mapped to roster ids via ENCOUNTER_ENEMY_KEYS. */
export type EncounterEnemyKey =
  | 'FRACTURE_HOUND'
  | 'ECHOING_BRUTE'
  | 'LEY_SIREN'
  | 'ASH_WEEPER'
  | 'MIASMA_SWARM'
  | 'NULL_SHADE'
  | 'SPATIAL_GLITCH'
  | 'GUTTER_GOLIATH'
  | 'CONCRETE_GARGOYLE'
  | 'RIOT_VANGUARD';

export type EnemySpawnArchetype = 'MELEE' | 'SUPPORT' | 'RANGED' | 'HEAVY';

export const ENCOUNTER_KEY_TO_ROSTER: Record<EncounterEnemyKey, EnemyRosterId> = {
  FRACTURE_HOUND: 'fracture-hound',
  ECHOING_BRUTE: 'echoing-brute',
  LEY_SIREN: 'ley-siren',
  ASH_WEEPER: 'ash-weeper',
  MIASMA_SWARM: 'miasma-tick-swarm',
  NULL_SHADE: 'null-shade',
  SPATIAL_GLITCH: 'spatial-glitch',
  GUTTER_GOLIATH: 'gutter-goliath',
  CONCRETE_GARGOYLE: 'concrete-gargoyle',
  RIOT_VANGUARD: 'echoing-brute',
};

type StatKey = keyof typeof ENEMY_BASE_STATS;

const ROSTER_STAT_KEY: Record<EnemyRosterId, StatKey | null> = {
  'fracture-hound': 'FRACTURE_HOUND',
  'echoing-brute': 'ECHOING_BRUTE',
  'ley-siren': 'LEY_SIREN',
  'ash-weeper': 'ASH_WEEPER',
  'miasma-tick-swarm': 'MIASMA_SWARM',
  'null-shade': 'NULL_SHADE',
  'spatial-glitch': 'SPATIAL_GLITCH',
  'gutter-goliath': 'GUTTER_GOLIATH',
  'concrete-gargoyle': 'CONCRETE_GARGOYLE',
  'boss-hollowed-precinct': null,
  'boss-choir-of-rust': null,
  'boss-primeval-rift-walker': null,
};

export const ENEMY_BASE_STATS = {
  MIASMA_SWARM: { maxHp: 20, baseDamage: 8, armor: 0 },
  FRACTURE_HOUND: { maxHp: 30, baseDamage: 10, armor: 5 },
  LEY_SIREN: { maxHp: 35, baseDamage: 12, armor: 0 },
  SPATIAL_GLITCH: { maxHp: 35, baseDamage: 10, armor: 0 },
  ASH_WEEPER: { maxHp: 40, baseDamage: 12, armor: 0 },
  NULL_SHADE: { maxHp: 45, baseDamage: 14, armor: 5 },
  ECHOING_BRUTE: { maxHp: 65, baseDamage: 18, armor: 10 },
  CONCRETE_GARGOYLE: { maxHp: 75, baseDamage: 15, armor: 25 },
  GUTTER_GOLIATH: { maxHp: 95, baseDamage: 22, armor: 15 },
} as const;

export const DEPTH_SCALING: Record<DistrictId, { hpMult: number; dmgMult: number }> = {
  1: { hpMult: 1.0, dmgMult: 1.0 },
  2: { hpMult: 1.65, dmgMult: 1.8 },
  3: { hpMult: 2.4, dmgMult: 2.6 },
};

export const ALPHA_MODIFIER = { hpMult: 1.5, dmgMult: 1.25 } as const;

export const ENEMY_ARCHETYPE: Partial<Record<EnemyRosterId, EnemySpawnArchetype>> = {
  'fracture-hound': 'MELEE',
  'echoing-brute': 'MELEE',
  'miasma-tick-swarm': 'MELEE',
  'gutter-goliath': 'HEAVY',
  'concrete-gargoyle': 'HEAVY',
  'ley-siren': 'SUPPORT',
  'ash-weeper': 'SUPPORT',
  'null-shade': 'SUPPORT',
  'spatial-glitch': 'RANGED',
};

export const HEAVY_ROSTER_IDS: readonly EnemyRosterId[] = [
  'gutter-goliath',
  'concrete-gargoyle',
  'echoing-brute',
];

export interface ResolvedEnemyStats {
  maxHp: number;
  baseDamage: number;
  kineticArmor: number;
  occultWards: number;
  archetype?: EnemySpawnArchetype;
}

export function resolveEnemyCombatStats(
  rosterId: EnemyRosterId,
  depth: number,
  options?: { isAlpha?: boolean },
): ResolvedEnemyStats | null {
  const statKey = ROSTER_STAT_KEY[rosterId];
  if (!statKey) return null;

  const base = ENEMY_BASE_STATS[statKey];
  const district = getDistrictFromDepth(depth);
  const scaling = DEPTH_SCALING[district];

  let maxHp = Math.floor(base.maxHp * scaling.hpMult);
  let baseDamage = Math.floor(base.baseDamage * scaling.dmgMult);

  if (options?.isAlpha) {
    maxHp = Math.floor(maxHp * ALPHA_MODIFIER.hpMult);
    baseDamage = Math.floor(baseDamage * ALPHA_MODIFIER.dmgMult);
  }

  return {
    maxHp,
    baseDamage,
    kineticArmor: base.armor,
    occultWards: rosterId === 'ley-siren' ? 2 : rosterId === 'null-shade' ? 0 : 0,
    archetype: ENEMY_ARCHETYPE[rosterId],
  };
}

export function isHeavyArchetype(rosterId?: string): boolean {
  return rosterId != null && (HEAVY_ROSTER_IDS as readonly string[]).includes(rosterId);
}
