import type { IncursionEncounterType, RunNodeType } from './game';
import type { EnemyAffinity } from './combatEnvironment';

export type EnvironmentType = 'SUBWAY_CHASM' | 'BLEEDING_HIGH_RISE' | 'DESECRATED_SANCTUARY';

export type SpectralThreatBand = 'LOW' | 'MODERATE' | 'ELEVATED' | 'CRITICAL' | 'UNKNOWN';

export interface SpectralTelemetry {
  radialFrequency: string;
  visualSpectrum: string;
  occultIndex: string;
  threatProfile: string;
  threatBand: SpectralThreatBand;
}

export interface NodeSectorMeta {
  spectral: SpectralTelemetry;
  resonanceDelta: number;
  isFocused: boolean;
  yieldMultiplier: number;
  creditBonus: number;
  combatTier: 'STANDARD' | 'ELITE';
  probableAffinity?: EnemyAffinity;
}

export interface SectorGraphNode {
  id: string;
  graphDepth: number;
  encounterType: IncursionEncounterType;
  type: RunNodeType;
  environmentType: EnvironmentType;
  childIds: string[];
  parentId: string | null;
  label: string;
  sectorMeta: NodeSectorMeta;
  isExtraction?: boolean;
  isAnomalyNest?: boolean;
  isCompleted?: boolean;
}

export interface SectorGraph {
  entryId: string;
  nodes: Record<string, SectorGraphNode>;
  sectorTier: number;
  maxGraphDepth: number;
}

export interface AttunementState {
  current: number;
  max: number;
}

export interface ResonanceState {
  percent: number;
}

export const STARTING_ATTUNEMENT = 3;
export const MAX_ATTUNEMENT = 3;
export const SANCTUARY_RETUNE_ATTUNEMENT = 2;
export const RESONANCE_DELTA_STANDARD = 10;
export const RESONANCE_DELTA_HIGH = 25;
export const RESONANCE_DELTA_CRITICAL = 50;
export const MAX_SECTOR_NODES = 45;
export const EXTRACTION_AVAILABLE_AFTER_CLEARED = 4;
export const BOSS_SIGNATURE_RESONANCE = 50;
export const BOSS_NEST_SOFT_RESONANCE = 75;
export const BOSS_NEST_HARD_RESONANCE = 90;
export const GREED_ZONE_YIELD_MULTIPLIER = 2;
export const RESONANCE_TIER_VOLATILE = 30;
/** Cargo data-bleed begins when entering Alert zone. */
export const RESONANCE_TIER_DATA_BLEED = 41;
export const RESONANCE_TIER_HOSTILE = 41;
/** Critical zone — terminal blind + veil stalker hunt. */
export const RESONANCE_TIER_CRITICAL = 76;
export const RESONANCE_TIER_VECTOR_SEVERED = 76;
export const TERMINAL_BLIND_NODE_COUNT = 2;
export const VEIL_STALKER_RESONANCE_THRESHOLD = 76;
export const VEIL_STALKER_AMBUSH_CHANCE = 0.4;

export const ENVIRONMENT_DISPLAY_LABEL: Record<EnvironmentType, string> = {
  SUBWAY_CHASM: 'Subway Chasm',
  BLEEDING_HIGH_RISE: 'Bleeding High-Rise',
  DESECRATED_SANCTUARY: 'Desecrated Sanctuary',
};
