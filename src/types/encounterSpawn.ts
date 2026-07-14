import type { EncounterEnemyKey } from '../data/enemyCombatConfig';
import type { EncounterGridPos } from '../data/synergyEncounterTypes';

/** Procedural combat origin roll — Echo is a node override, not a rolled origin. */
export type EncounterOrigin = 'RIVAL_MERC' | 'VEIL';

/** Node-level spawn override — bypasses origin roll and squad-deck pipeline. */
export type EncounterSpawnOverride = 'ECHO';

/** Sector-aligned encounter biome (Veil Front breach locks one biome per run). */
export type VeilBiome =
  | 'ABYSSAL_SINK'
  | 'NULL_ZONE'
  | 'ASHEN_WASTE'
  | 'SLAG_WORKS'
  | 'BLACKLINE_TERMINUS';

export type EncounterNodeTier = 'NORMAL' | 'ELITE' | 'BOSS' | 'ANCHOR';

export type EncounterSquadTier = 'NORMAL' | 'ELITE';

export type EncounterRole =
  | 'FRONTLINE'
  | 'BACKLINE'
  | 'SUPPORT'
  | 'DISRUPTOR'
  | 'ALPHA';

/** Tags used by hard-counter validation during squad selection. */
export type MechanicTag =
  | 'MUST_DEFEND'
  | 'CANNOT_DEFEND'
  | 'TRUE_DAMAGE'
  | 'STAMINA_DRAIN'
  | 'SCALING_TIMER'
  | 'BACKLINE_TIMER'
  | 'UNREACHABLE_BACKLINE'
  | 'HARD_DENIAL';

export interface SpawnGates {
  allowedDepths: Array<1 | 2 | 3>;
  minNodeIndexInDepth?: number;
  /** Depth-1 NORMAL encounters require node index >= this value. Elites bypass. */
  normalOnlyAfterNode?: number;
  /** When true, NORMAL tier cannot spawn this enemy on depth 1 (elite-only). */
  depth1NormalBlocked?: boolean;
  allowedNodeTiers: EncounterNodeTier[];
}

export interface EnemyDepthStats {
  maxHp: number;
  baseDamage?: number;
  fractureThreshold?: number;
  kineticArmor?: number;
  occultArmor?: number;
}

export interface EnemyDefinition {
  id: EncounterEnemyKey;
  origin: EncounterOrigin;
  /** RIVAL_MERC units use all biomes; Veil units are biome-scoped. */
  biomeTags: readonly VeilBiome[];
  role: EncounterRole;
  threatCost: number;
  mechanicTags: readonly MechanicTag[];
  baseStatsByDepth: Partial<Record<1 | 2 | 3, EnemyDepthStats>>;
  spawnGates: SpawnGates;
}

export interface EncounterUnitPlacement {
  type: EncounterEnemyKey;
  pos: EncounterGridPos;
  isAlpha?: boolean;
}

export interface EncounterSquadDefinition {
  id: string;
  displayName: string;
  biome: VeilBiome;
  depth: 1 | 2 | 3;
  origin: EncounterOrigin;
  tier: EncounterSquadTier;
  threatCost: number;
  mechanicTags: readonly MechanicTag[];
  units: readonly EncounterUnitPlacement[];
  /** Reusable deck template kind (10 archetypes per biome/depth). */
  templateKind?: string;
}

/** Never spawn in Depth 1 or 2 — including elite encounters. */
export const DEPTH_3_EXCLUSIVE_ENEMY_KEYS = [
  'IRON_MAIDEN',
  'AMALGAM',
  'NULL_SHADE',
  'MEMORY_LEECH',
  'COIL_SPIKE_SNIPER',
  'CHURN',
  'RESONANCE_CASTER',
  'HOLLOW_LUNG',
  'GRAVE_ROBBER',
  'CORE_SICK_AMALGAM',
  'VOID_LOCK_MEMORY_LEECH',
  'GRAVE_ENGINE_CHURN',
  'NULL_CROWN_SHADE',
  'CHOIR_BOUND_RESONANCE_CASTER',
  'RIFT_SPIKE_SNIPER',
] as const;

export type Depth3ExclusiveEnemyKey = (typeof DEPTH_3_EXCLUSIVE_ENEMY_KEYS)[number];

export interface EncounterSpawnContext {
  veilBiome: VeilBiome;
  depth: 1 | 2 | 3;
  nodeIndexInDepth: number;
  tier: EncounterSquadTier;
  seed: string;
}

/** Origin weights for procedural combat nodes (Echo excluded). */
export const ORIGIN_WEIGHTS: Record<
  1 | 2 | 3,
  Record<EncounterSquadTier, Record<EncounterOrigin, number>>
> = {
  1: {
    NORMAL: { RIVAL_MERC: 0.32, VEIL: 0.68 },
    ELITE: { RIVAL_MERC: 0.34, VEIL: 0.66 },
  },
  2: {
    NORMAL: { RIVAL_MERC: 0.18, VEIL: 0.82 },
    ELITE: { RIVAL_MERC: 0.16, VEIL: 0.84 },
  },
  3: {
    NORMAL: { RIVAL_MERC: 0.08, VEIL: 0.92 },
    ELITE: { RIVAL_MERC: 0.06, VEIL: 0.94 },
  },
};

/** Threat budget ranges by depth and node tier. */
export const THREAT_BUDGET_RANGES: Record<
  1 | 2 | 3,
  Record<EncounterSquadTier, { min: number; max: number }>
> = {
  1: { NORMAL: { min: 3, max: 5 }, ELITE: { min: 6, max: 7 } },
  2: { NORMAL: { min: 5, max: 7 }, ELITE: { min: 8, max: 10 } },
  3: { NORMAL: { min: 7, max: 9 }, ELITE: { min: 10, max: 12 } },
};
