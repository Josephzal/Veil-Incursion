import type { DistrictId } from './districtPacing';
import type { EncounterEnemyKey } from './enemyCombatConfig';

export type EncounterGridPos =
  | 'FRONT_LEFT'
  | 'FRONT_RIGHT'
  | 'BACK_LEFT'
  | 'BACK_RIGHT'
  | 'FRONT_CENTER'
  | 'BACK_CENTER';

export interface EncounterUnitSpec {
  type: EncounterEnemyKey;
  pos: EncounterGridPos;
  isAlpha?: boolean;
}

export interface EncounterSquadSpec {
  id: string;
  units: EncounterUnitSpec[];
}

export type EncounterPoolTier = 'INTRO' | 'BASIC_SYNERGY' | 'ADVANCED_SYNERGY' | 'SOLO_ALPHA';

export interface DepthEncounterPools {
  INTRO: EncounterSquadSpec[];
  BASIC_SYNERGY: EncounterSquadSpec[];
  ADVANCED_SYNERGY: EncounterSquadSpec[];
  SOLO_ALPHA: EncounterSquadSpec[];
}

/** Cumulative enemy unlock per district chapter. */
export const DEPTH_ENEMY_GATES: Record<DistrictId, readonly EncounterEnemyKey[]> = {
  1: [
    'ECHOING_BRUTE',
    'MIASMA_SWARM',
    'LEY_SIREN',
    'FRACTURE_HOUND',
    'SPALL',
    'TAR_SPITTER',
  ],
  2: [
    'ECHOING_BRUTE',
    'MIASMA_SWARM',
    'LEY_SIREN',
    'FRACTURE_HOUND',
    'SPALL',
    'TAR_SPITTER',
    'CONCRETE_GARGOYLE',
    'IRON_MAIDEN',
    'ASH_WEEPER',
    'NULL_SHADE',
    'SPATIAL_GLITCH',
    'SCUTTLER',
    'RESONANCE_CASTER',
    'SAPPER',
  ],
  3: [
    'ECHOING_BRUTE',
    'MIASMA_SWARM',
    'LEY_SIREN',
    'FRACTURE_HOUND',
    'SPALL',
    'TAR_SPITTER',
    'CONCRETE_GARGOYLE',
    'IRON_MAIDEN',
    'ASH_WEEPER',
    'NULL_SHADE',
    'SPATIAL_GLITCH',
    'SCUTTLER',
    'RESONANCE_CASTER',
    'SAPPER',
    'GUTTER_GOLIATH',
    'GOLEM',
    'SLAG_BLOOD',
    'HOOK_WEAVER',
    'MEMORY_LEECH',
    'SMOG_CALLER',
    'THRALL',
    'COIL_SPIKE_SNIPER',
    'CHURN',
    'SPLINTER',
  ],
};

export const ENCOUNTER_POOLS: Record<DistrictId, DepthEncounterPools> = {
  1: {
    INTRO: [
      { id: 'd1-intro-hound', units: [{ type: 'FRACTURE_HOUND', pos: 'FRONT_LEFT' }] },
      {
        id: 'd1-intro-swarm',
        units: [
          { type: 'MIASMA_SWARM', pos: 'FRONT_LEFT' },
          { type: 'MIASMA_SWARM', pos: 'FRONT_RIGHT' },
        ],
      },
      { id: 'd1-intro-brute', units: [{ type: 'ECHOING_BRUTE', pos: 'FRONT_CENTER' }] },
    ],
    BASIC_SYNERGY: [
      {
        id: 'd1-basic-executioner',
        units: [
          { type: 'ECHOING_BRUTE', pos: 'FRONT_CENTER' },
          { type: 'LEY_SIREN', pos: 'BACK_CENTER' },
        ],
      },
      {
        id: 'd1-basic-tarpit',
        units: [
          { type: 'FRACTURE_HOUND', pos: 'FRONT_LEFT' },
          { type: 'TAR_SPITTER', pos: 'BACK_RIGHT' },
        ],
      },
      {
        id: 'd1-basic-swarmwall',
        units: [
          { type: 'MIASMA_SWARM', pos: 'FRONT_LEFT' },
          { type: 'MIASMA_SWARM', pos: 'FRONT_RIGHT' },
          { type: 'LEY_SIREN', pos: 'BACK_CENTER' },
        ],
      },
    ],
    ADVANCED_SYNERGY: [
      {
        id: 'd1-adv-meatgrinder',
        units: [
          { type: 'MIASMA_SWARM', pos: 'FRONT_LEFT' },
          { type: 'MIASMA_SWARM', pos: 'FRONT_RIGHT' },
          { type: 'SPALL', pos: 'BACK_LEFT' },
        ],
      },
      {
        id: 'd1-adv-crossfire',
        units: [
          { type: 'ECHOING_BRUTE', pos: 'FRONT_LEFT' },
          { type: 'TAR_SPITTER', pos: 'BACK_RIGHT' },
        ],
      },
    ],
    SOLO_ALPHA: [
      {
        id: 'd1-alpha-brute',
        units: [{ type: 'ECHOING_BRUTE', pos: 'FRONT_CENTER', isAlpha: true }],
      },
      {
        id: 'd1-alpha-hound',
        units: [{ type: 'FRACTURE_HOUND', pos: 'FRONT_CENTER', isAlpha: true }],
      },
    ],
  },
  2: {
    INTRO: [
      { id: 'd2-intro-gargoyle', units: [{ type: 'CONCRETE_GARGOYLE', pos: 'FRONT_CENTER' }] },
      {
        id: 'd2-intro-spall',
        units: [
          { type: 'SPALL', pos: 'FRONT_LEFT' },
          { type: 'SPALL', pos: 'FRONT_RIGHT' },
        ],
      },
    ],
    BASIC_SYNERGY: [
      {
        id: 'd2-basic-catch22',
        units: [
          { type: 'ECHOING_BRUTE', pos: 'FRONT_LEFT' },
          { type: 'NULL_SHADE', pos: 'BACK_RIGHT' },
        ],
      },
      {
        id: 'd2-basic-blindpanic',
        units: [
          { type: 'NULL_SHADE', pos: 'FRONT_CENTER' },
          { type: 'SPATIAL_GLITCH', pos: 'BACK_CENTER' },
        ],
      },
      {
        id: 'd2-basic-glasswall',
        units: [
          { type: 'FRACTURE_HOUND', pos: 'FRONT_LEFT' },
          { type: 'FRACTURE_HOUND', pos: 'FRONT_RIGHT' },
          { type: 'NULL_SHADE', pos: 'BACK_CENTER' },
        ],
      },
    ],
    ADVANCED_SYNERGY: [
      {
        id: 'd2-adv-spikepit',
        units: [
          { type: 'IRON_MAIDEN', pos: 'FRONT_LEFT' },
          { type: 'IRON_MAIDEN', pos: 'FRONT_RIGHT' },
          { type: 'TAR_SPITTER', pos: 'BACK_LEFT' },
          { type: 'LEY_SIREN', pos: 'BACK_RIGHT' },
        ],
      },
      {
        id: 'd2-adv-minefield',
        units: [
          { type: 'RESONANCE_CASTER', pos: 'FRONT_LEFT' },
          { type: 'RESONANCE_CASTER', pos: 'FRONT_RIGHT' },
          { type: 'SPATIAL_GLITCH', pos: 'BACK_CENTER' },
        ],
      },
      {
        id: 'd2-adv-panicclock',
        units: [
          { type: 'SAPPER', pos: 'BACK_LEFT' },
          { type: 'SPATIAL_GLITCH', pos: 'BACK_RIGHT' },
        ],
      },
      {
        id: 'd2-adv-meatgrinder',
        units: [
          { type: 'MIASMA_SWARM', pos: 'FRONT_LEFT' },
          { type: 'MIASMA_SWARM', pos: 'FRONT_RIGHT' },
          { type: 'ASH_WEEPER', pos: 'BACK_LEFT' },
        ],
      },
    ],
    SOLO_ALPHA: [
      {
        id: 'd2-alpha-gargoyle',
        units: [{ type: 'CONCRETE_GARGOYLE', pos: 'FRONT_CENTER', isAlpha: true }],
      },
      {
        id: 'd2-alpha-maiden',
        units: [{ type: 'IRON_MAIDEN', pos: 'FRONT_CENTER', isAlpha: true }],
      },
      {
        id: 'd2-alpha-brute',
        units: [{ type: 'ECHOING_BRUTE', pos: 'FRONT_CENTER', isAlpha: true }],
      },
    ],
  },
  3: {
    INTRO: [
      { id: 'd3-intro-goliath', units: [{ type: 'GUTTER_GOLIATH', pos: 'FRONT_CENTER' }] },
      { id: 'd3-intro-slag', units: [{ type: 'SLAG_BLOOD', pos: 'FRONT_CENTER' }] },
    ],
    BASIC_SYNERGY: [
      {
        id: 'd3-basic-wreckingball',
        units: [
          { type: 'GUTTER_GOLIATH', pos: 'FRONT_LEFT' },
          { type: 'LEY_SIREN', pos: 'BACK_RIGHT' },
        ],
      },
      {
        id: 'd3-basic-branding',
        units: [
          { type: 'GUTTER_GOLIATH', pos: 'FRONT_LEFT' },
          { type: 'SPLINTER', pos: 'BACK_RIGHT' },
        ],
      },
      {
        id: 'd3-basic-boiling',
        units: [
          { type: 'GOLEM', pos: 'FRONT_LEFT' },
          { type: 'HOOK_WEAVER', pos: 'BACK_RIGHT' },
        ],
      },
    ],
    ADVANCED_SYNERGY: [
      {
        id: 'd3-adv-sabotaged',
        units: [
          { type: 'GUTTER_GOLIATH', pos: 'FRONT_LEFT' },
          { type: 'MEMORY_LEECH', pos: 'BACK_LEFT' },
          { type: 'HOOK_WEAVER', pos: 'BACK_RIGHT' },
        ],
      },
      {
        id: 'd3-adv-ammofactory',
        units: [
          { type: 'MIASMA_SWARM', pos: 'FRONT_LEFT' },
          { type: 'MIASMA_SWARM', pos: 'FRONT_RIGHT' },
          { type: 'CHURN', pos: 'BACK_LEFT' },
          { type: 'ASH_WEEPER', pos: 'BACK_RIGHT' },
        ],
      },
      {
        id: 'd3-adv-scorched',
        units: [
          { type: 'SAPPER', pos: 'BACK_RIGHT' },
          { type: 'SPLINTER', pos: 'BACK_LEFT' },
        ],
      },
      {
        id: 'd3-adv-thralls',
        units: [
          { type: 'THRALL', pos: 'FRONT_LEFT' },
          { type: 'THRALL', pos: 'FRONT_RIGHT' },
          { type: 'ASH_WEEPER', pos: 'BACK_LEFT' },
          { type: 'NULL_SHADE', pos: 'BACK_RIGHT' },
        ],
      },
    ],
    SOLO_ALPHA: [
      {
        id: 'd3-alpha-goliath',
        units: [{ type: 'GUTTER_GOLIATH', pos: 'FRONT_CENTER', isAlpha: true }],
      },
      {
        id: 'd3-alpha-golem',
        units: [{ type: 'GOLEM', pos: 'FRONT_CENTER', isAlpha: true }],
      },
      {
        id: 'd3-alpha-slag',
        units: [{ type: 'SLAG_BLOOD', pos: 'FRONT_CENTER', isAlpha: true }],
      },
    ],
  },
};

export function isEnemyAllowedAtDepth(
  district: DistrictId,
  enemyKey: EncounterEnemyKey,
): boolean {
  return DEPTH_ENEMY_GATES[district].includes(enemyKey);
}

export function filterSquadForDepth(
  squad: EncounterSquadSpec,
  district: DistrictId,
): EncounterSquadSpec | null {
  const allowed = DEPTH_ENEMY_GATES[district];
  const units = squad.units.filter((u) => allowed.includes(u.type));
  if (units.length === 0) return null;
  return { ...squad, units };
}
