import type { CargoItemId } from './cargoGrid';
import type { FactionType } from './game';
import type { Biome, NarrativePenalty, TensionMechanic } from './narrativeAssembly';

/** Macro biome families — locked per district after first combat vector choice. */
export type MacroBiomeFamily =
  | 'CITY_STREETS'
  | 'CITY_BUILDINGS'
  | 'FORESTS'
  | 'UNDERGROUND'
  | 'BACKROADS'
  | 'SUNKEN_TRANSIT'
  | 'BLACK_SITE_SECTOR'
  | 'DEEP_VEIL'
  | 'FRACTAL_ABYSS'
  | 'SANGUINE_ATRIUM';

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

export type NarrativeEngineVersion = 'legacy-catalog' | 'assembly-v1' | 'assembly-v2';

export interface ProceduralNarrativeAssembly {
  assemblyId: string;
  macroFamily: MacroBiomeFamily;
  depth: RunDepth;
  contextId: string;
  complicationId: string;
  /** When `assembly-v1`, resolver data comes from JSON resolver sets. */
  engineVersion?: NarrativeEngineVersion;
  resolverSetId?: string;
  /** Dynamic v2 — cabal/class + item template ids for reassembly. */
  resolverTemplateIds?: { cabalTemplateId: string; itemTemplateId: string };
  biome?: Biome;
  tensionMechanic?: TensionMechanic;
  defaultPenalty?: NarrativePenalty;
  resolverIds: {
    brute: string;
    cabal: string;
    item: string;
    retreat: 'static-retreat';
  };
  /** Shared bonus loot for options A/B/C — hidden until success. */
  bonusReward?: import('./narrativeBonusReward').NarrativeBonusReward;
}

/** Buffs, debuffs, and boons with optional expiry — powers status popup (Phase 3). */
export interface RunStatusEffect {
  id: string;
  label: string;
  description: string;
  source: 'NARRATIVE' | 'BOON' | 'HAZARD' | 'ENVIRONMENT';
  expiresAtNodesCleared?: number;
  expiresAtSafehouse?: boolean;
  /** Explicit Sanctuary cleanse contract; omitted effects are never inferred removable. */
  sanctuaryAilment?: {
    severity: 'MINOR' | 'ORDINARY' | 'MAJOR';
    priority: number;
    removable: boolean;
  };
}
