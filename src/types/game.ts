import type { IncursionInventoryState } from './incursionInventory';
import type { MacroStoryRunConfiguration } from './macroStory';
import type { OutcomeModifierMetric } from './macroStory';
import type { RegionalPresenceState } from './regional';

export type FactionType = 'TERRAN_GRID' | 'LEGION' | 'SOLARIS';
export type ClassType = 'AEGIS' | 'RIFTSHOT' | 'ENVOY';
export type EncounterType = 'COMBAT' | 'SKILL_CHECK' | 'SANCTUARY';
export type BiomeType = 'HOSPITAL' | 'ALLEYWAYS' | 'SEWERS' | 'CHURCH' | 'FOREST' | 'CANYON';
export type ItemRarity = 'STANDARD' | 'STABILIZED' | 'COBALT' | 'ABYSSAL';
export type CheckStatus = 'NOT_TESTED' | 'SUCCESS' | 'FAILURE';
export type RunNodeType = 'NARRATIVE_EVENT' | 'STANDARD_COMBAT' | 'ELITE_COMBAT' | 'BOSS_COMBAT' | 'SANCTUARY';
export type IncursionEncounterType = 'COMBAT' | 'NARRATIVE_EVENT' | 'SANCTUARY';
export type IncursionBiome = 'CITY_STREETS' | 'HOSPITAL' | 'LABORATORY' | 'SECTOR_CORE';
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
  abyssalReserve: number;
  eviscerateStored: boolean;
  /** Derived from stamina === 0; EXHAUSTED purged when stamina rises above 0. */
  statusEffects: import('./run').CombatStatusEffect[];
}

export interface WeaponModifiers {
  baseDamageOverride: number;
  staminaCostModifier: number;
  abyssalGainModifier: number;
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

export interface NarrativeRunModifiers {
  nextCombatEnemyHpBonusPct: number;
  nextCombatDamageBonusPct: number;
  bossArmorPiercePct: number;
  nodeNineCalibrationBonusPct: number;
  bossShieldBypassPct: number;
}

export interface IncursionProgressState {
  collectedFlags: string[];
  usedNarrativeEventIds: string[];
  narrativeModifiers: NarrativeRunModifiers;
  outcomeModifiers: OutcomeModifierMetric[];
  pendingCombatAmbush: boolean;
  forceNextSanctuary: boolean;
  macroStory: MacroStoryRunConfiguration;
}

export function createDefaultNarrativeRunModifiers(): NarrativeRunModifiers {
  return {
    nextCombatEnemyHpBonusPct: 0,
    nextCombatDamageBonusPct: 0,
    bossArmorPiercePct: 0,
    nodeNineCalibrationBonusPct: 0,
    bossShieldBypassPct: 0,
  };
}

export function createDefaultIncursionProgressState(): IncursionProgressState {
  return {
    collectedFlags: [],
    usedNarrativeEventIds: [],
    narrativeModifiers: createDefaultNarrativeRunModifiers(),
    outcomeModifiers: [],
    pendingCombatAmbush: false,
    forceNextSanctuary: false,
    macroStory: { runMode: 'STANDALONE', macroStoryId: null },
  };
}

export interface NarrativeChoiceEffectPreview {
  onSuccess?: string;
  onFailure?: string;
  guaranteed?: string;
}

export interface NarrativeEventNode {
  id: string;
  matrixEventId?: string;
  interactionMode?: 'standard' | 'conditional';
  title: string;
  scenarioText: string;
  choiceA: {
    label: string;
    requirement: string;
    successText: string;
    failureText: string;
    effectPreview?: NarrativeChoiceEffectPreview;
  };
  choiceB: {
    label: string;
    requirement: string;
    successText: string;
    failureText: string;
    effectPreview?: NarrativeChoiceEffectPreview;
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
  depthIndex: number;
  /** Legacy alias — always equals depthIndex. */
  index: number;
  encounterType: IncursionEncounterType;
  biome: IncursionBiome;
  /** Resolved routing type for encounter screens. */
  type: RunNodeType;
  label: string;
  isCompleted: boolean;
  /** Boss terminal node — bypasses manual sweep mechanics. */
  isPreDiscovered?: boolean;
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
  /** Run-scoped consumables — separate from hub inventory manifest. */
  inventory: IncursionInventoryState;
  progress: IncursionProgressState;
  currentNarrativeId: string | null;
  lastCheckStatus: CheckStatus;
  activeChoice: 'A' | 'B' | null;
  currentTier: number;
  currentNodeIndex: number;
  /** Resolved path — one chosen node per depth step (10 steps). */
  tierNodes: IncursionNode[];
  /** Pre-generated selectable vector clusters indexed by depth 0–9. */
  activeTierVectors: IncursionNode[][];
  earlySanctuarySpawned: boolean;
  selectedVectorId: string | null;
  /** Node staged for scan confirmation overlay preview. */
  previewNodeId: string | null;
  scanConfirmOverlayVisible: boolean;
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
    inventory: { items: [] },
    progress: createDefaultIncursionProgressState(),
    currentNarrativeId: null,
    lastCheckStatus: 'NOT_TESTED',
    activeChoice: null,
    currentTier: 1,
    currentNodeIndex: 0,
    tierNodes: [],
    activeTierVectors: [],
    earlySanctuarySpawned: false,
    selectedVectorId: null,
    previewNodeId: null,
    scanConfirmOverlayVisible: false,
    isRunActive: false,
    bossProfile: null,
    mapMode: 'SCANNING_HUB',
    lastCheckpointMessage: null,
  };
}
