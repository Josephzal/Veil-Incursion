import type { EncounterEnemyKey } from './enemyCombatConfig';
import { ALL_VEIL_BIOMES } from './sectorBiomeBridge';
import {
  DEPTH_3_EXCLUSIVE_ENEMY_KEYS,
  type Depth3ExclusiveEnemyKey,
  type EnemyDefinition,
  type EncounterNodeTier,
  type MechanicTag,
  type SpawnGates,
  type VeilBiome,
} from '../types/encounterSpawn';

const ALL_TIERS: EncounterNodeTier[] = ['NORMAL', 'ELITE', 'BOSS', 'ANCHOR'];

function gates(
  allowedDepths: SpawnGates['allowedDepths'],
  overrides: Partial<Omit<SpawnGates, 'allowedDepths' | 'allowedNodeTiers'>> & {
    allowedNodeTiers?: EncounterNodeTier[];
  } = {},
): SpawnGates {
  return {
    allowedDepths,
    allowedNodeTiers: overrides.allowedNodeTiers ?? ALL_TIERS,
    ...overrides,
  };
}

function d3Gates(minNodeIndexInDepth?: number): SpawnGates {
  return gates([3], { minNodeIndexInDepth });
}

function rival(
  id: EncounterEnemyKey,
  role: EnemyDefinition['role'],
  threatCost: number,
  baseStatsByDepth: EnemyDefinition['baseStatsByDepth'],
  mechanicTags: readonly MechanicTag[] = [],
): EnemyDefinition {
  return {
    id,
    origin: 'RIVAL_MERC',
    biomeTags: ALL_VEIL_BIOMES,
    role,
    threatCost,
    mechanicTags,
    baseStatsByDepth,
    spawnGates: gates([1, 2, 3]),
  };
}

function veil(
  id: EncounterEnemyKey,
  biomeTags: readonly VeilBiome[],
  role: EnemyDefinition['role'],
  threatCost: number,
  spawnGates: SpawnGates,
  baseStatsByDepth: EnemyDefinition['baseStatsByDepth'],
  mechanicTags: readonly MechanicTag[] = [],
): EnemyDefinition {
  return {
    id,
    origin: 'VEIL',
    biomeTags,
    role,
    threatCost,
    mechanicTags,
    baseStatsByDepth,
    spawnGates,
  };
}

const BZ: readonly VeilBiome[] = ['NULL_ZONE', 'BLACKLINE_TERMINUS'];
const SW: readonly VeilBiome[] = ['ABYSSAL_SINK', 'ASHEN_WASTE'];
const IND: readonly VeilBiome[] = ['SLAG_WORKS', 'BLACKLINE_TERMINUS', 'ASHEN_WASTE'];
const WIDE: readonly VeilBiome[] = ['NULL_ZONE', 'ABYSSAL_SINK', 'ASHEN_WASTE', 'SLAG_WORKS', 'BLACKLINE_TERMINUS'];

export const ENEMY_DEFINITIONS: Record<EncounterEnemyKey, EnemyDefinition> = {
  // —— Rival merc contractors (all biomes) ——
  BREACHER: rival('BREACHER', 'FRONTLINE', 2, {
    1: { maxHp: 55, baseDamage: 6, fractureThreshold: 40 },
    2: { maxHp: 75, baseDamage: 8, fractureThreshold: 55 },
    3: { maxHp: 90, baseDamage: 10, fractureThreshold: 65 },
  }, ['STAMINA_DRAIN']),
  CUTTER: rival('CUTTER', 'FRONTLINE', 1, {
    1: { maxHp: 40, baseDamage: 10, fractureThreshold: 35 },
    2: { maxHp: 60, baseDamage: 15, fractureThreshold: 50 },
    3: { maxHp: 75, baseDamage: 20, fractureThreshold: 60 },
  }),
  WARDEN: rival('WARDEN', 'FRONTLINE', 3, {
    1: { maxHp: 80, baseDamage: 8, kineticArmor: 1, fractureThreshold: 70 },
    2: { maxHp: 110, baseDamage: 12, kineticArmor: 2, fractureThreshold: 95 },
    3: { maxHp: 130, baseDamage: 16, kineticArmor: 2, fractureThreshold: 110 },
  }, ['MUST_DEFEND']),
  FIXER: rival('FIXER', 'SUPPORT', 2, {
    1: { maxHp: 60, baseDamage: 8, fractureThreshold: 45 },
    2: { maxHp: 85, baseDamage: 10, fractureThreshold: 60 },
    3: { maxHp: 100, baseDamage: 12, fractureThreshold: 72 },
  }),
  SPOTTER: rival('SPOTTER', 'BACKLINE', 2, {
    1: { maxHp: 50, baseDamage: 10, fractureThreshold: 40 },
    2: { maxHp: 70, baseDamage: 14, fractureThreshold: 55 },
    3: { maxHp: 85, baseDamage: 18, fractureThreshold: 65 },
  }, ['UNREACHABLE_BACKLINE']),
  BURNER: rival('BURNER', 'BACKLINE', 2, {
    1: { maxHp: 55, baseDamage: 9, fractureThreshold: 42 },
    2: { maxHp: 80, baseDamage: 12, fractureThreshold: 58 },
    3: { maxHp: 95, baseDamage: 15, fractureThreshold: 70 },
  }),
  RIVAL_HEXER: rival('RIVAL_HEXER', 'DISRUPTOR', 2, {
    1: { maxHp: 58, baseDamage: 7, fractureThreshold: 44 },
    2: { maxHp: 82, baseDamage: 9, fractureThreshold: 60 },
    3: { maxHp: 98, baseDamage: 11, fractureThreshold: 72 },
  }, ['HARD_DENIAL']),
  RIVAL_VEILBINDER: rival('RIVAL_VEILBINDER', 'SUPPORT', 2, {
    1: { maxHp: 62, baseDamage: 6, occultArmor: 1, fractureThreshold: 46 },
    2: { maxHp: 88, baseDamage: 8, occultArmor: 1, fractureThreshold: 62 },
    3: { maxHp: 105, baseDamage: 10, occultArmor: 2, fractureThreshold: 75 },
  }),
  RIVAL_REAVER: rival('RIVAL_REAVER', 'FRONTLINE', 3, {
    1: { maxHp: 95, baseDamage: 12, fractureThreshold: 80 },
    2: { maxHp: 120, baseDamage: 16, fractureThreshold: 100 },
    3: { maxHp: 140, baseDamage: 20, fractureThreshold: 120 },
  }, ['CANNOT_DEFEND']),

  // —— Veil entities ——
  MIASMA_SWARM: veil('MIASMA_SWARM', [...SW, 'SLAG_WORKS'], 'FRONTLINE', 1, gates([1, 2, 3]), {
    1: { maxHp: 75, baseDamage: 8, fractureThreshold: 50 },
    2: { maxHp: 124, baseDamage: 14, fractureThreshold: 82 },
    3: { maxHp: 180, baseDamage: 21, fractureThreshold: 120 },
  }),
  SCUTTLER: veil('SCUTTLER', WIDE, 'FRONTLINE', 1, gates([1, 2, 3]), {
    1: { maxHp: 70, baseDamage: 9, fractureThreshold: 48 },
    2: { maxHp: 116, baseDamage: 16, fractureThreshold: 78 },
    3: { maxHp: 168, baseDamage: 23, fractureThreshold: 115 },
  }),
  FRACTURE_HOUND: veil('FRACTURE_HOUND', SW, 'FRONTLINE', 2, gates([1, 2, 3]), {
    1: { maxHp: 80, baseDamage: 10, kineticArmor: 5, fractureThreshold: 55 },
    2: { maxHp: 132, baseDamage: 18, kineticArmor: 5, fractureThreshold: 90 },
    3: { maxHp: 192, baseDamage: 26, kineticArmor: 5, fractureThreshold: 130 },
  }),
  SPALL: veil('SPALL', [...SW, 'SLAG_WORKS'], 'FRONTLINE', 1, gates([1, 2, 3]), {
    1: { maxHp: 72, baseDamage: 10, fractureThreshold: 50 },
    2: { maxHp: 119, baseDamage: 18, fractureThreshold: 82 },
    3: { maxHp: 173, baseDamage: 26, fractureThreshold: 118 },
  }),
  THRALL: veil('THRALL', WIDE, 'FRONTLINE', 2, gates([1, 2, 3]), {
    1: { maxHp: 85, baseDamage: 11, kineticArmor: 3, fractureThreshold: 58 },
    2: { maxHp: 140, baseDamage: 20, kineticArmor: 3, fractureThreshold: 95 },
    3: { maxHp: 204, baseDamage: 29, fractureThreshold: 135 },
  }),
  LEY_SIREN: veil('LEY_SIREN', [...SW, 'NULL_ZONE', 'BLACKLINE_TERMINUS'], 'BACKLINE', 2, gates([1, 2, 3]), {
    1: { maxHp: 90, baseDamage: 12, occultArmor: 2, fractureThreshold: 60 },
    2: { maxHp: 149, baseDamage: 22, occultArmor: 2, fractureThreshold: 98 },
    3: { maxHp: 216, baseDamage: 31, occultArmor: 2, fractureThreshold: 140 },
  }, ['UNREACHABLE_BACKLINE']),
  ASH_WEEPER: veil('ASH_WEEPER', WIDE, 'BACKLINE', 2, gates([1, 2, 3]), {
    1: { maxHp: 95, baseDamage: 12, fractureThreshold: 62 },
    2: { maxHp: 157, baseDamage: 22, fractureThreshold: 102 },
    3: { maxHp: 228, baseDamage: 31, fractureThreshold: 145 },
  }),
  HOOK_WEAVER: veil('HOOK_WEAVER', [...SW, 'SLAG_WORKS', 'BLACKLINE_TERMINUS'], 'DISRUPTOR', 2, gates([1, 2, 3]), {
    1: { maxHp: 92, baseDamage: 11, fractureThreshold: 60 },
    2: { maxHp: 152, baseDamage: 20, fractureThreshold: 98 },
    3: { maxHp: 221, baseDamage: 29, fractureThreshold: 140 },
  }, ['STAMINA_DRAIN']),
  ECHOING_BRUTE: veil('ECHOING_BRUTE', [...BZ, 'SLAG_WORKS'], 'FRONTLINE', 3, gates([1, 2, 3]), {
    1: { maxHp: 130, baseDamage: 18, kineticArmor: 10, fractureThreshold: 90 },
    2: { maxHp: 215, baseDamage: 32, kineticArmor: 10, fractureThreshold: 145 },
    3: { maxHp: 312, baseDamage: 47, kineticArmor: 10, fractureThreshold: 210 },
  }),
  CONCRETE_GARGOYLE: veil('CONCRETE_GARGOYLE', ['NULL_ZONE'], 'FRONTLINE', 3, gates([1, 2, 3], {
    normalOnlyAfterNode: 10,
  }), {
    1: { maxHp: 140, baseDamage: 15, kineticArmor: 25, fractureThreshold: 200 },
    2: { maxHp: 231, baseDamage: 27, kineticArmor: 25, fractureThreshold: 200 },
    3: { maxHp: 336, baseDamage: 39, kineticArmor: 25, fractureThreshold: 200 },
  }, ['MUST_DEFEND', 'SCALING_TIMER']),
  GUTTER_GOLIATH: veil('GUTTER_GOLIATH', [...BZ, 'ASHEN_WASTE', 'SLAG_WORKS'], 'FRONTLINE', 3, gates([1, 2, 3], {
    depth1NormalBlocked: true,
    minNodeIndexInDepth: 1,
  }), {
    1: { maxHp: 150, baseDamage: 22, kineticArmor: 15, fractureThreshold: 100 },
    2: { maxHp: 248, baseDamage: 40, kineticArmor: 15, fractureThreshold: 165 },
    3: { maxHp: 360, baseDamage: 57, kineticArmor: 15, fractureThreshold: 240 },
  }),
  IRON_MAIDEN: veil('IRON_MAIDEN', [...BZ, 'SLAG_WORKS'], 'FRONTLINE', 3, d3Gates(), {
    3: { maxHp: 324, baseDamage: 42, kineticArmor: 20, fractureThreshold: 180 },
  }, ['MUST_DEFEND']),
  GOLEM: veil('GOLEM', [...BZ, 'SLAG_WORKS'], 'FRONTLINE', 3, gates([2, 3], { minNodeIndexInDepth: 6 }), {
    2: { maxHp: 239, baseDamage: 25, kineticArmor: 18, fractureThreshold: 160 },
    3: { maxHp: 348, baseDamage: 36, kineticArmor: 18, fractureThreshold: 230 },
  }),
  SLAG_BLOOD: veil('SLAG_BLOOD', IND, 'FRONTLINE', 3, gates([1, 2, 3]), {
    1: { maxHp: 110, baseDamage: 14, kineticArmor: 8, fractureThreshold: 75 },
    2: { maxHp: 198, baseDamage: 36, kineticArmor: 12, fractureThreshold: 130 },
    3: { maxHp: 288, baseDamage: 52, kineticArmor: 12, fractureThreshold: 190 },
  }),
  SAPPER: veil('SAPPER', ['ASHEN_WASTE', 'SLAG_WORKS', 'NULL_ZONE', 'BLACKLINE_TERMINUS'], 'BACKLINE', 2, gates([1, 2, 3], { minNodeIndexInDepth: 8 }), {
    1: { maxHp: 82, baseDamage: 22, fractureThreshold: 55 },
    2: { maxHp: 135, baseDamage: 40, fractureThreshold: 90 },
    3: { maxHp: 197, baseDamage: 57, fractureThreshold: 130 },
  }, ['BACKLINE_TIMER']),
  WIRE_GHOUL: veil('WIRE_GHOUL', ['NULL_ZONE', 'SLAG_WORKS', 'BLACKLINE_TERMINUS'], 'FRONTLINE', 1, gates([2, 3]), {
    2: { maxHp: 119, baseDamage: 18, fractureThreshold: 80 },
    3: { maxHp: 173, baseDamage: 26, fractureThreshold: 115 },
  }),
  SPATIAL_GLITCH: veil('SPATIAL_GLITCH', ['NULL_ZONE', 'BLACKLINE_TERMINUS'], 'DISRUPTOR', 3, gates([2, 3]), {
    2: { maxHp: 140, baseDamage: 27, kineticArmor: 3, fractureThreshold: 95 },
    3: { maxHp: 204, baseDamage: 39, kineticArmor: 3, fractureThreshold: 135 },
  }, ['HARD_DENIAL']),
  NULL_SHADE: veil('NULL_SHADE', WIDE, 'BACKLINE', 3, d3Gates(), {
    3: { maxHp: 211, baseDamage: 36, kineticArmor: 5, occultArmor: 2, fractureThreshold: 140 },
  }, ['UNREACHABLE_BACKLINE']),
  MEMORY_LEECH: veil('MEMORY_LEECH', WIDE, 'DISRUPTOR', 2, d3Gates(4), {
    3: { maxHp: 204, baseDamage: 26, fractureThreshold: 135 },
  }, ['STAMINA_DRAIN']),
  SMOG_CALLER: veil('SMOG_CALLER', ['NULL_ZONE', 'ASHEN_WASTE', 'SLAG_WORKS'], 'BACKLINE', 2, gates([1, 2, 3], {
    depth1NormalBlocked: true,
  }), {
    1: { maxHp: 100, baseDamage: 12, fractureThreshold: 68 },
    2: { maxHp: 165, baseDamage: 22, fractureThreshold: 110 },
    3: { maxHp: 240, baseDamage: 31, fractureThreshold: 160 },
  }),
  COIL_SPIKE_SNIPER: veil('COIL_SPIKE_SNIPER', WIDE, 'BACKLINE', 2, d3Gates(6), {
    3: { maxHp: 192, baseDamage: 47, fractureThreshold: 125 },
  }, ['UNREACHABLE_BACKLINE']),
  RESONANCE_CASTER: veil('RESONANCE_CASTER', ['ASHEN_WASTE', 'SLAG_WORKS', 'BLACKLINE_TERMINUS'], 'BACKLINE', 2, d3Gates(4), {
    3: { maxHp: 211, baseDamage: 36, fractureThreshold: 140 },
  }, ['BACKLINE_TIMER']),
  TAR_SPITTER: veil('TAR_SPITTER', ['ASHEN_WASTE', 'SLAG_WORKS'], 'BACKLINE', 2, gates([1, 2, 3]), {
    1: { maxHp: 86, baseDamage: 12, fractureThreshold: 58 },
    2: { maxHp: 142, baseDamage: 22, fractureThreshold: 95 },
    3: { maxHp: 206, baseDamage: 31, fractureThreshold: 135 },
  }),
  CHURN: veil('CHURN', IND, 'BACKLINE', 2, d3Gates(6), {
    3: { maxHp: 216, baseDamage: 52, fractureThreshold: 145 },
  }, ['SCALING_TIMER']),
  SPLINTER: veil('SPLINTER', ['ASHEN_WASTE', 'SLAG_WORKS', 'BLACKLINE_TERMINUS', 'NULL_ZONE'], 'BACKLINE', 1, gates([1, 2, 3]), {
    1: { maxHp: 84, baseDamage: 13, fractureThreshold: 56 },
    2: { maxHp: 139, baseDamage: 23, fractureThreshold: 92 },
    3: { maxHp: 202, baseDamage: 34, fractureThreshold: 132 },
  }),
  AMALGAM: veil('AMALGAM', WIDE, 'FRONTLINE', 4, d3Gates(8), {
    3: { maxHp: 384, baseDamage: 44, kineticArmor: 12, fractureThreshold: 220 },
  }, ['MUST_DEFEND', 'TRUE_DAMAGE']),
  HOLLOW_LUNG: veil('HOLLOW_LUNG', WIDE, 'BACKLINE', 2, d3Gates(4), {
    3: { maxHp: 221, baseDamage: 26, occultArmor: 1, fractureThreshold: 145 },
  }, ['STAMINA_DRAIN', 'SCALING_TIMER']),
  GRAVE_ROBBER: veil('GRAVE_ROBBER', WIDE, 'SUPPORT', 2, d3Gates(6), {
    3: { maxHp: 216, baseDamage: 29, fractureThreshold: 140 },
  }),

  /** Legacy alias — maps to echoing-brute roster. */
  RIOT_VANGUARD: veil('RIOT_VANGUARD', BZ, 'FRONTLINE', 3, gates([1, 2, 3]), {
    1: { maxHp: 130, baseDamage: 18, kineticArmor: 10, fractureThreshold: 90 },
    2: { maxHp: 215, baseDamage: 32, kineticArmor: 10, fractureThreshold: 145 },
    3: { maxHp: 312, baseDamage: 47, kineticArmor: 10, fractureThreshold: 210 },
  }),
};

export function getEnemyDefinition(
  key: EncounterEnemyKey,
): EnemyDefinition | undefined {
  return ENEMY_DEFINITIONS[key];
}

export function getEnemyOrigin(key: EncounterEnemyKey): EnemyDefinition['origin'] | undefined {
  return ENEMY_DEFINITIONS[key]?.origin;
}

export function isDepth3ExclusiveEnemy(key: EncounterEnemyKey): key is Depth3ExclusiveEnemyKey {
  return (DEPTH_3_EXCLUSIVE_ENEMY_KEYS as readonly string[]).includes(key);
}

export function resolveDefinitionStats(
  key: EncounterEnemyKey,
  depth: 1 | 2 | 3,
): EnemyDefinition['baseStatsByDepth'][1 | 2 | 3] | undefined {
  return ENEMY_DEFINITIONS[key]?.baseStatsByDepth[depth];
}

export function allDefinedEnemyKeys(): EncounterEnemyKey[] {
  return Object.keys(ENEMY_DEFINITIONS) as EncounterEnemyKey[];
}
