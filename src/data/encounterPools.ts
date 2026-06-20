import type { DistrictId } from './districtPacing';
import type { EncounterEnemyKey } from './enemyCombatConfig';
import type { EncounterOrigin } from './originDeckEngine';

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

export interface OriginEncounterPools {
  CABAL: DepthEncounterPools;
  VEIL: DepthEncounterPools;
}

/** Cabal human unlock per district. */
export const CABAL_ENEMY_GATES: Record<DistrictId, readonly EncounterEnemyKey[]> = {
  1: ['BREACHER', 'CUTTER', 'WARDEN', 'FIXER', 'SPOTTER', 'BURNER'],
  2: ['BREACHER', 'CUTTER', 'WARDEN', 'FIXER', 'SPOTTER', 'BURNER'],
  3: ['BREACHER', 'CUTTER', 'WARDEN', 'FIXER', 'SPOTTER', 'BURNER'],
};

/** Veil mutation unlock per district chapter. */
export const VEIL_ENEMY_GATES: Record<DistrictId, readonly EncounterEnemyKey[]> = {
  1: [
    'ECHOING_BRUTE', 'MIASMA_SWARM', 'LEY_SIREN', 'FRACTURE_HOUND', 'SPALL', 'TAR_SPITTER',
  ],
  2: [
    'ECHOING_BRUTE', 'MIASMA_SWARM', 'LEY_SIREN', 'FRACTURE_HOUND', 'SPALL', 'TAR_SPITTER',
    'CONCRETE_GARGOYLE', 'IRON_MAIDEN', 'ASH_WEEPER', 'NULL_SHADE', 'SPATIAL_GLITCH',
    'SCUTTLER', 'RESONANCE_CASTER', 'SAPPER',
    'WIRE_GHOUL', 'AMALGAM', 'GRAVE_ROBBER', 'HOLLOW_LUNG', 'MEMORY_LEECH',
  ],
  3: [
    'ECHOING_BRUTE', 'MIASMA_SWARM', 'LEY_SIREN', 'FRACTURE_HOUND', 'SPALL', 'TAR_SPITTER',
    'CONCRETE_GARGOYLE', 'IRON_MAIDEN', 'ASH_WEEPER', 'NULL_SHADE', 'SPATIAL_GLITCH',
    'SCUTTLER', 'RESONANCE_CASTER', 'SAPPER',
    'GUTTER_GOLIATH', 'GOLEM', 'SLAG_BLOOD', 'HOOK_WEAVER', 'MEMORY_LEECH', 'SMOG_CALLER',
    'THRALL', 'COIL_SPIKE_SNIPER', 'CHURN', 'SPLINTER',
    'WIRE_GHOUL', 'AMALGAM', 'GRAVE_ROBBER', 'HOLLOW_LUNG',
  ],
};

/** @deprecated Use VEIL_ENEMY_GATES — kept for legacy callers. */
export const DEPTH_ENEMY_GATES = VEIL_ENEMY_GATES;

const D1_VEIL: DepthEncounterPools = {
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
    { id: 'd1-alpha-brute', units: [{ type: 'ECHOING_BRUTE', pos: 'FRONT_CENTER', isAlpha: true }] },
    { id: 'd1-alpha-hound', units: [{ type: 'FRACTURE_HOUND', pos: 'FRONT_CENTER', isAlpha: true }] },
  ],
};

const D1_CABAL: DepthEncounterPools = {
  INTRO: [],
  BASIC_SYNERGY: [
    {
      id: 'd1-cabal-shield-wall',
      units: [
        { type: 'WARDEN', pos: 'FRONT_LEFT' },
        { type: 'FIXER', pos: 'BACK_RIGHT' },
      ],
    },
    {
      id: 'd1-cabal-pinned-target',
      units: [
        { type: 'BREACHER', pos: 'FRONT_CENTER' },
        { type: 'SPOTTER', pos: 'BACK_CENTER' },
      ],
    },
    {
      id: 'd1-cabal-breach-clear',
      units: [
        { type: 'BREACHER', pos: 'FRONT_LEFT' },
        { type: 'CUTTER', pos: 'FRONT_RIGHT' },
        { type: 'BURNER', pos: 'BACK_RIGHT' },
      ],
    },
  ],
  ADVANCED_SYNERGY: [
    {
      id: 'd1-cabal-trench-warfare',
      units: [
        { type: 'WARDEN', pos: 'FRONT_LEFT' },
        { type: 'BREACHER', pos: 'FRONT_RIGHT' },
        { type: 'BURNER', pos: 'BACK_CENTER' },
      ],
    },
    {
      id: 'd1-cabal-cut-n-snip',
      units: [
        { type: 'WARDEN', pos: 'FRONT_LEFT' },
        { type: 'CUTTER', pos: 'BACK_LEFT' },
        { type: 'CUTTER', pos: 'BACK_RIGHT' },
      ],
    },
  ],
  SOLO_ALPHA: [
    { id: 'd1-cabal-alpha-warden', units: [{ type: 'WARDEN', pos: 'FRONT_CENTER', isAlpha: true }] },
  ],
};

const D2_VEIL: DepthEncounterPools = {
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
    {
      id: 'd2-veil-system-failure',
      units: [
        { type: 'WIRE_GHOUL', pos: 'FRONT_LEFT' },
        { type: 'MEMORY_LEECH', pos: 'BACK_RIGHT' },
      ],
    },
    {
      id: 'd2-veil-meat-wall',
      units: [
        { type: 'AMALGAM', pos: 'FRONT_CENTER' },
        { type: 'NULL_SHADE', pos: 'BACK_RIGHT' },
      ],
    },
    {
      id: 'd2-veil-nerve-damage',
      units: [
        { type: 'WIRE_GHOUL', pos: 'FRONT_LEFT' },
        { type: 'SPATIAL_GLITCH', pos: 'BACK_RIGHT' },
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
    {
      id: 'd2-veil-flesh-harvest',
      units: [
        { type: 'AMALGAM', pos: 'FRONT_CENTER' },
        { type: 'GRAVE_ROBBER', pos: 'BACK_CENTER' },
      ],
    },
    {
      id: 'd2-veil-feast-flies',
      units: [
        { type: 'SCUTTLER', pos: 'FRONT_LEFT' },
        { type: 'SCUTTLER', pos: 'FRONT_RIGHT' },
        { type: 'GRAVE_ROBBER', pos: 'BACK_CENTER' },
      ],
    },
    {
      id: 'd2-veil-toxic-shock',
      units: [
        { type: 'CONCRETE_GARGOYLE', pos: 'FRONT_CENTER' },
        { type: 'HOLLOW_LUNG', pos: 'BACK_LEFT' },
        { type: 'SAPPER', pos: 'BACK_RIGHT' },
      ],
    },
  ],
  SOLO_ALPHA: [
    { id: 'd2-alpha-gargoyle', units: [{ type: 'CONCRETE_GARGOYLE', pos: 'FRONT_CENTER', isAlpha: true }] },
    { id: 'd2-alpha-maiden', units: [{ type: 'IRON_MAIDEN', pos: 'FRONT_CENTER', isAlpha: true }] },
    { id: 'd2-alpha-brute', units: [{ type: 'ECHOING_BRUTE', pos: 'FRONT_CENTER', isAlpha: true }] },
    { id: 'd2-veil-alpha-amalgam', units: [{ type: 'AMALGAM', pos: 'FRONT_CENTER', isAlpha: true }] },
  ],
};

const D2_CABAL: DepthEncounterPools = {
  INTRO: [],
  BASIC_SYNERGY: [
    {
      id: 'd2-cabal-carousel',
      units: [
        { type: 'CUTTER', pos: 'FRONT_LEFT' },
        { type: 'CUTTER', pos: 'FRONT_RIGHT' },
        { type: 'FIXER', pos: 'BACK_LEFT' },
      ],
    },
    {
      id: 'd2-cabal-killbox',
      units: [
        { type: 'WARDEN', pos: 'FRONT_LEFT' },
        { type: 'WARDEN', pos: 'FRONT_RIGHT' },
        { type: 'SPOTTER', pos: 'BACK_CENTER' },
      ],
    },
  ],
  ADVANCED_SYNERGY: [
    {
      id: 'd2-cabal-tactical-execution',
      units: [
        { type: 'BREACHER', pos: 'FRONT_LEFT' },
        { type: 'BURNER', pos: 'BACK_LEFT' },
        { type: 'SPOTTER', pos: 'BACK_RIGHT' },
      ],
    },
    {
      id: 'd2-cabal-field-hospital',
      units: [
        { type: 'WARDEN', pos: 'FRONT_LEFT' },
        { type: 'BREACHER', pos: 'FRONT_RIGHT' },
        { type: 'FIXER', pos: 'BACK_LEFT' },
        { type: 'FIXER', pos: 'BACK_RIGHT' },
      ],
    },
    {
      id: 'd2-cabal-suppressive-fire',
      units: [
        { type: 'WARDEN', pos: 'FRONT_CENTER' },
        { type: 'SPOTTER', pos: 'BACK_LEFT' },
        { type: 'SPOTTER', pos: 'BACK_RIGHT' },
      ],
    },
  ],
  SOLO_ALPHA: [
    { id: 'd2-cabal-alpha-breacher', units: [{ type: 'BREACHER', pos: 'FRONT_CENTER', isAlpha: true }] },
  ],
};

const D3_VEIL: DepthEncounterPools = {
  INTRO: [
    { id: 'd3-intro-goliath', units: [{ type: 'GUTTER_GOLIATH', pos: 'FRONT_CENTER' }] },
    { id: 'd3-intro-slag', units: [{ type: 'SLAG_BLOOD', pos: 'FRONT_CENTER' }] },
  ],
  BASIC_SYNERGY: [
    {
      id: 'd3-veil-ashen-coffin',
      units: [
        { type: 'AMALGAM', pos: 'FRONT_CENTER' },
        { type: 'HOLLOW_LUNG', pos: 'BACK_LEFT' },
        { type: 'NULL_SHADE', pos: 'BACK_RIGHT' },
      ],
    },
    {
      id: 'd3-veil-bio-bomb',
      units: [
        { type: 'SPALL', pos: 'FRONT_LEFT' },
        { type: 'SPALL', pos: 'FRONT_RIGHT' },
        { type: 'WIRE_GHOUL', pos: 'BACK_CENTER' },
      ],
    },
  ],
  ADVANCED_SYNERGY: [
    {
      id: 'd3-veil-graveyard',
      units: [
        { type: 'THRALL', pos: 'FRONT_LEFT' },
        { type: 'THRALL', pos: 'FRONT_RIGHT' },
        { type: 'GRAVE_ROBBER', pos: 'BACK_LEFT' },
        { type: 'ASH_WEEPER', pos: 'BACK_RIGHT' },
      ],
    },
    {
      id: 'd3-veil-vacuum',
      units: [
        { type: 'WIRE_GHOUL', pos: 'FRONT_LEFT' },
        { type: 'SCUTTLER', pos: 'FRONT_RIGHT' },
        { type: 'SMOG_CALLER', pos: 'BACK_LEFT' },
        { type: 'HOLLOW_LUNG', pos: 'BACK_RIGHT' },
      ],
    },
    {
      id: 'd3-veil-slaughterhouse',
      units: [
        { type: 'MIASMA_SWARM', pos: 'FRONT_LEFT' },
        { type: 'MIASMA_SWARM', pos: 'FRONT_RIGHT' },
        { type: 'CHURN', pos: 'BACK_LEFT' },
        { type: 'GRAVE_ROBBER', pos: 'BACK_RIGHT' },
      ],
    },
    {
      id: 'd3-veil-suffocation',
      units: [
        { type: 'AMALGAM', pos: 'FRONT_CENTER' },
        { type: 'TAR_SPITTER', pos: 'BACK_LEFT' },
        { type: 'HOLLOW_LUNG', pos: 'BACK_RIGHT' },
      ],
    },
    {
      id: 'd3-veil-operating-table',
      units: [
        { type: 'IRON_MAIDEN', pos: 'FRONT_LEFT' },
        { type: 'WIRE_GHOUL', pos: 'FRONT_RIGHT' },
        { type: 'GRAVE_ROBBER', pos: 'BACK_LEFT' },
        { type: 'MEMORY_LEECH', pos: 'BACK_RIGHT' },
      ],
    },
  ],
  SOLO_ALPHA: [
    { id: 'd3-veil-alpha-grave-robber', units: [{ type: 'GRAVE_ROBBER', pos: 'FRONT_CENTER', isAlpha: true }] },
    { id: 'd3-veil-alpha-hollow-lung', units: [{ type: 'HOLLOW_LUNG', pos: 'FRONT_CENTER', isAlpha: true }] },
  ],
};

/** D3 Cabal uses D2 advanced + alpha pools only. */
const D3_CABAL: DepthEncounterPools = {
  INTRO: [],
  BASIC_SYNERGY: D2_CABAL.ADVANCED_SYNERGY,
  ADVANCED_SYNERGY: D2_CABAL.ADVANCED_SYNERGY,
  SOLO_ALPHA: D2_CABAL.SOLO_ALPHA,
};

export const ENCOUNTER_POOLS: Record<DistrictId, OriginEncounterPools> = {
  1: { CABAL: D1_CABAL, VEIL: D1_VEIL },
  2: { CABAL: D2_CABAL, VEIL: D2_VEIL },
  3: { CABAL: D3_CABAL, VEIL: D3_VEIL },
};

export function enemyGatesForOrigin(origin: EncounterOrigin, district: DistrictId): readonly EncounterEnemyKey[] {
  return origin === 'CABAL' ? CABAL_ENEMY_GATES[district] : VEIL_ENEMY_GATES[district];
}

export function isEnemyAllowedAtDepth(
  district: DistrictId,
  enemyKey: EncounterEnemyKey,
  origin: EncounterOrigin = 'VEIL',
): boolean {
  return enemyGatesForOrigin(origin, district).includes(enemyKey);
}

export function filterSquadForDepth(
  squad: EncounterSquadSpec,
  district: DistrictId,
  origin: EncounterOrigin = 'VEIL',
): EncounterSquadSpec | null {
  const allowed = enemyGatesForOrigin(origin, district);
  const units = squad.units.filter((u) => allowed.includes(u.type));
  if (units.length === 0) return null;
  return { ...squad, units };
}

/** Cabal INTRO tier falls back to BASIC when no intro squads exist. */
export function resolvePoolForTier(
  pools: DepthEncounterPools,
  tier: EncounterPoolTier,
  origin: EncounterOrigin,
): EncounterSquadSpec[] {
  const pool = pools[tier];
  if (pool.length > 0) return pool;
  if (origin === 'CABAL' && tier === 'INTRO') return pools.BASIC_SYNERGY;
  if (origin === 'CABAL' && tier === 'BASIC_SYNERGY' && pools.BASIC_SYNERGY.length === 0) {
    return pools.ADVANCED_SYNERGY;
  }
  return pool;
}
