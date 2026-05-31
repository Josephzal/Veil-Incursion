import type { RegionalPresenceState } from './regional';

export type FactionType = 'TERRAN_GRID' | 'LEGION' | 'SOLARIS';
export type ClassType = 'AEGIS' | 'RIFTSHOT' | 'ENVOY';
export type EncounterType = 'COMBAT' | 'SKILL_CHECK' | 'SANCTUARY';
export type BiomeType = 'HOSPITAL' | 'ALLEYWAYS' | 'SEWERS' | 'CHURCH' | 'FOREST' | 'CANYON';
export type ItemRarity = 'STANDARD' | 'STABILIZED' | 'COBALT' | 'ABYSSAL';
export type CheckStatus = 'NOT_TESTED' | 'SUCCESS' | 'FAILURE';
export type RunNodeType = 'NARRATIVE_EVENT' | 'STANDARD_COMBAT' | 'ELITE_COMBAT' | 'BOSS_COMBAT' | 'SANCTUARY';
export type IncursionMapMode = 'SCANNING_HUB' | 'NODE_ENGAGED' | 'PROGRESS_CHECKPOINT';

export interface FactionModifiers {
  maxStaminaBonus: number;
  critChanceBonus: number;
  staminaRegenBonus: number;
  calibrationBonus: number;
  maxHpBonus: number;
  damageMitigation: number;
}

export interface PlayerAccount {
  id: string;
  username: string;
  operativeRank: number;
  experiencePoints: number;
  cabalCredits: number;
  alignedFaction: FactionType | null;
  factionPerks: FactionModifiers;
  activeClass: ClassType;
  unlockedClasses: ClassType[];
  unlockedBiomes: BiomeType[];
  progressionMatrix: {
    maxTierUnlocked: number;
    activeCampaignCluster: 'URBAN' | 'ISOLATED' | 'WILDERNESS' | null;
  };
  regionalPresence: RegionalPresenceState;
  equipment: {
    weaponId: string | null;
    armorId: string | null;
    trinketId: string | null;
  };
  inventory: PlayerInventoryState;
}

export interface CombatNodeState {
  currentTurn: number;
  enemyName: string;
  enemyClass: 'GREMLIN' | 'APPARITION' | 'ABOMINATION';
  enemyHp: number;
  enemyMaxHp: number;
  currentEnemyIntent: string;
  kineticReservoir: number;
  vectorSliceStored: boolean;
  /** Derived from stamina === 0; EXHAUSTED purged when stamina rises above 0. */
  statusEffects: import('./run').CombatStatusEffect[];
}

export interface WeaponModifiers {
  baseDamageOverride: number;
  staminaCostModifier: number;
  kineticGainModifier: number;
  parryWindowModifier: number;
}

export interface InventoryItem {
  id: string;
  name: string;
  description: string;
  rarity: ItemRarity;
  type: 'WEAPON' | 'SHROUD' | 'TRINKET';
  modifiers: Partial<WeaponModifiers>;
  isEquipped: boolean;
}

export interface PlayerInventoryState {
  items: InventoryItem[];
  materials: {
    riftIron: number;
    voidFilament: number;
  };
  unopenedCaches: {
    tier1Caches: number;
    tier2Caches: number;
  };
}

export interface NarrativeEventNode {
  id: string;
  title: string;
  scenarioText: string;
  choiceA: {
    label: string;
    requirement: string;
    successText: string;
    failureText: string;
  };
  choiceB: {
    label: string;
    requirement: string;
    successText: string;
    failureText: string;
  };
}

export interface EnvironmentalModifiers {
  isEnemyPhaseShrouded: boolean;
  isPlayerBlinded: boolean;
  hasTetanusGlitch: boolean;
  startingStaminaPenalty: number;
}

export interface IncursionNode {
  id: string;
  index: number;
  type: RunNodeType;
  label: string;
  isCompleted: boolean;
}

export interface BossPhaseConfiguration {
  phaseNumber: number;
  phaseName: string;
  triggerHpThreshold: number;
  intentModifier: string;
}

export interface BossRuntimeProfile {
  name: string;
  maxHp: number;
  currentHp: number;
  currentPhase: number;
  phases: BossPhaseConfiguration[];
  tier: number;
}

export interface ActiveIncursionState {
  environmentalModifiers: EnvironmentalModifiers;
  currentNarrativeId: string | null;
  lastCheckStatus: CheckStatus;
  activeChoice: 'A' | 'B' | null;
  currentTier: number;
  currentNodeIndex: number;
  /** Resolved path — one chosen node per scan depth (7 steps). */
  tierNodes: IncursionNode[];
  /** Pre-generated selectable vector clusters indexed by scan depth 0–6. */
  activeTierVectors: IncursionNode[][];
  earlySanctuarySpawned: boolean;
  selectedVectorId: string | null;
  isRunActive: boolean;
  bossProfile: BossRuntimeProfile | null;
  mapMode: IncursionMapMode;
  lastCheckpointMessage: string | null;
}

export function createDefaultEnvironmentalModifiers(): EnvironmentalModifiers {
  return {
    isEnemyPhaseShrouded: false,
    isPlayerBlinded: false,
    hasTetanusGlitch: false,
    startingStaminaPenalty: 0,
  };
}

export function createDefaultActiveIncursionState(): ActiveIncursionState {
  return {
    environmentalModifiers: createDefaultEnvironmentalModifiers(),
    currentNarrativeId: null,
    lastCheckStatus: 'NOT_TESTED',
    activeChoice: null,
    currentTier: 1,
    currentNodeIndex: 0,
    tierNodes: [],
    activeTierVectors: [],
    earlySanctuarySpawned: false,
    selectedVectorId: null,
    isRunActive: false,
    bossProfile: null,
    mapMode: 'SCANNING_HUB',
    lastCheckpointMessage: null,
  };
}
