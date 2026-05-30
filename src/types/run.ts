export type RegionTheme = 'HOSPITAL' | 'HOUSING' | 'FOREST' | 'CITY';

export type EncounterType = 'COMBAT' | 'SKILL_CHECK' | 'REST';

export interface SectorDefinition {
  id: string;
  name: string;
  subsector: string;
  theme: RegionTheme;
  description: string;
}

export interface PathChoice {
  id: string;
  sector: SectorDefinition;
  encounterType: EncounterType;
  label: string;
}

export interface EncounterNode {
  index: number;
  type: EncounterType;
  label: string;
  sector: SectorDefinition;
}

export interface Trinket {
  id: string;
  name: string;
  description: string;
  effect: string;
  parryWindowBonus?: number;
  parryMultiplierBonus?: number;
  sliceDamagePenalty?: number;
  maxHpBonus?: number;
  startingKineticPercent?: number;
  hpRestore?: number;
  staminaRestore?: number;
}

export interface SkillCheckEvent {
  id: string;
  narrative: string;
  attribute: string;
  modifier: number;
  dc: number;
  successTrinketPool?: string[];
  successReward: { hp?: number; stamina?: number; log: string };
  failurePenalty: { hp?: number; stamina?: number; ambush?: boolean; log: string };
}

export interface RunState {
  runActive: boolean;
  currentNode: number;
  totalNodes: number;
  maxStamina: number;
  currentStamina: number;
  maxSoulAnchor: number;
  soulAnchorIntegrity: number;
  homeRegion: RegionTheme | null;
  currentSector: SectorDefinition | null;
  activeTrinkets: Trinket[];
  pendingEncounter: EncounterNode | null;
  pendingAmbush: boolean;
  parryWindowBonus: number;
  parryMultiplierBonus: number;
  sliceDamagePenalty: number;
  startingKineticPercent: number;
  combatNodesCleared: number;
}

export const BASE_MAX_STAMINA = 100;
export const BASE_MAX_SOUL_ANCHOR = 100;
export const TOTAL_RUN_NODES = 7;
export const MIN_COMBAT_NODES = 4;

export interface RadarDot {
  id: string;
  sector: SectorDefinition;
  encounterType: EncounterType;
  label: string;
  pingLabel: string;
  pingIndex: number;
  /** Pixel position within the radar core (top-left origin). */
  x: number;
  /** Pixel position within the radar core (top-left origin). */
  y: number;
  /** Bearing from core center in degrees (0 = east, counter-clockwise). */
  angleDeg: number;
}
