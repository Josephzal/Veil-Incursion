import type { CargoItemId } from './cargoGrid';
import type { FactionType } from './game';

/** Macro biome families — depth 3 always DEEP_VEIL (Phase 2 rotation). */
export type MacroBiomeFamily =
  | 'CITY_STREETS'
  | 'CITY_BUILDINGS'
  | 'FORESTS'
  | 'UNDERGROUND'
  | 'BACKROADS'
  | 'DEEP_VEIL';

export type SubBiomeId =
  | 'ALLEYS'
  | 'PARKS'
  | 'GRAVEYARD'
  | 'SCHOOL'
  | 'THEATRE'
  | 'HOSPITAL'
  | 'CHURCH'
  | 'CABIN'
  | 'LAKE'
  | 'FOREST'
  | 'SEWERS'
  | 'UNDERGROUND_CITY'
  | 'TRANSIT_LINES'
  | 'HOTEL'
  | 'PIT_STOP'
  | 'FARM'
  | 'VOID_RIFT'
  | 'NULL_CHASM'
  | 'PRIMEVAL_BREACH';

/** Run depth (district): 1 = levels 1–15, 2 = 16–30, 3 = 31–45. */
export type RunDepth = 1 | 2 | 3;

export type { NarrativeChoiceKey } from './game';

export type NarrativeResolverKind = 'BRUTE' | 'CABAL' | 'ITEM' | 'RETREAT' | 'MACRO';

export interface NarrativeContextSeed {
  id: string;
  macroFamily: MacroBiomeFamily;
  tags: readonly string[];
  title: string;
  proseLead: string;
}

export interface NarrativeComplicationSeed {
  id: string;
  requiresTags: readonly string[];
  proseClause: string;
  hazardPreview: string;
  bruteLabel: string;
  bruteRequirement: string;
  bruteCostPreview: string;
  bruteRewardPreview: string;
  hpCostPct: number;
  resonanceSpike: number;
  rewardCredits: number;
  rewardFlag?: string;
  ambushOnBrute?: boolean;
  /** Faction vault brute-force — spawns Grid-Hound on overworld. */
  spawnGridHoundOnBrute?: boolean;
}

export interface NarrativeResolverSeed {
  id: string;
  kind: Exclude<NarrativeResolverKind, 'BRUTE' | 'RETREAT'>;
  compatibleTags: readonly string[];
  label: string;
  requirement: string;
  costPreview: string;
  rewardPreview: string;
  requiresCabal?: FactionType;
  requiresItem?: CargoItemId;
  consumesItem?: boolean;
  hpCostPct?: number;
  resonanceSpike?: number;
  rewardCredits?: number;
  shieldRestorePct?: number;
  rewardFlag?: string;
  macroThreatReduction?: number;
  macroResonanceSpike?: number;
  resourceCacheId?: import('../types/resourceItem').ResourceCacheId;
}

export interface ProceduralNarrativeAssembly {
  assemblyId: string;
  macroFamily: MacroBiomeFamily;
  depth: RunDepth;
  contextId: string;
  complicationId: string;
  resolverIds: {
    brute: string;
    cabal: string;
    item: string;
    retreat: 'static-retreat';
  };
}

/** Buffs, debuffs, and boons with optional expiry — powers status popup (Phase 3). */
export interface RunStatusEffect {
  id: string;
  label: string;
  description: string;
  source: 'NARRATIVE' | 'BOON' | 'HAZARD' | 'ENVIRONMENT';
  expiresAtNodesCleared?: number;
  expiresAtSafehouse?: boolean;
}
