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

/** @deprecated Alias — synergy squads use the same unit layout shape. */
export type EncounterSquadSpec = SynergySquadSpec;

/** Biomes referenced in SYNERGY_DATABASE (matches MacroBiomeFamily minus SUNKEN_TRANSIT). */
export type SynergyBiome =
  | 'CITY_STREETS'
  | 'CITY_BUILDINGS'
  | 'BACKROADS'
  | 'BLACK_SITE_SECTOR'
  | 'UNDERGROUND'
  | 'FORESTS'
  | 'DEEP_VEIL'
  | 'FRACTAL_ABYSS'
  | 'SANGUINE_ATRIUM';

export type EncounterSquadOriginTag = 'RIVAL_MERC' | 'VEIL' | 'ANY';

export interface SynergySquadSpec {
  id: string;
  allowedDepths: readonly (1 | 2 | 3)[];
  allowedBiomes: readonly SynergyBiome[];
  roster: readonly EncounterUnitSpec[];
  /** Sector-aligned biome when squad is biome-specific. */
  veilBiome?: import('../types/encounterSpawn').VeilBiome;
  /** Reusable deck template archetype (Phase 6). */
  templateKind?: string;
  /** When set, gates squad eligibility for RIVAL_MERC vs VEIL origin rolls. */
  encounterSquadOrigin?: EncounterSquadOriginTag;
}
