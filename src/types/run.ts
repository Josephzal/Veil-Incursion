import type { EnemyAffinity } from './combatEnvironment';

export type RegionTheme = 'HOSPITAL' | 'HOUSING' | 'FOREST' | 'CITY';

export type ClimateClusterId = 'URBAN' | 'ISOLATED' | 'WILDERNESS';

export type EncounterType = 'COMBAT' | 'SKILL_CHECK' | 'REST';

export type EnemyClass = 'GREMLIN' | 'APPARITION' | 'ABOMINATION';

export type EnemyIntent =
  | 'STRIKE'
  | 'STRIP_STAMINA'
  | 'SIPHON_ABYSSAL'
  | 'EVADE'
  | 'CHARGE'
  | 'WORLD_ENDER'
  | 'FORTIFY'
  | 'OVERDRIVE_DISCHARGE';

/** Reactive combat debuffs derived from resource pools (stamina === 0 → EXHAUSTED). */
export type CombatStatusEffect = 'EXHAUSTED';

/** Enemy-requested abyssal reserve drain before per-action clamp (see clampAbyssalSiphonAmount). */
export const ENEMY_ABYSSAL_SIPHON_REQUEST = 25;

/** Hard cap on abyssal reserve siphoned from the player per enemy action. */
export const MAX_ABYSSAL_SIPHON_PER_ACTION = 15;

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

export interface EnemyCombatProfile {
  class: EnemyClass;
  designation: string;
  maxHp: number;
  currentHp: number;
  baseDamage: number;
  intent: EnemyIntent;
  chargeTurns: number;
  evadeActive: boolean;
  nodeIndex: number;
  scale: number;
  isBoss?: boolean;
  isVeilStalker?: boolean;
  bossPhase?: number;
  bossDepth?: number;
  /** Badge-screen test combat — controls intent rolling in advanceEnemyIntent. */
  testPreset?: 'easy' | 'hard';
  affinity?: EnemyAffinity;
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
  maxStaminaBonus?: number;
  startingAbyssalReservePercent?: number;
  hpRestore?: number;
  staminaRestore?: number;
}

export interface SkillCheckEvent {
  id: string;
  narrative: string;
  attribute: string;
  modifier: number;
}

export interface RunState {
  runActive: boolean;
  currentNode: number;
  totalNodes: number;
  maxStamina: number;
  currentStamina: number;
  maxSoulAnchor: number;
  soulAnchorIntegrity: number;
  climateCluster: ClimateClusterId | null;
  currentSector: SectorDefinition | null;
  activeTrinkets: Trinket[];
  pendingEncounter: EncounterNode | null;
  pendingEnemy: EnemyCombatProfile | null;
  pendingAmbush: boolean;
  parryWindowBonus: number;
  parryMultiplierBonus: number;
  sliceDamagePenalty: number;
  startingAbyssalReservePercent: number;
  combatNodesCleared: number;
  /** Set when launching test fights from the identity badge screen. */
  combatTestPreset: 'easy' | 'hard' | null;
}

export const BASE_MAX_STAMINA = 100;
export const BASE_MAX_SOUL_ANCHOR = 100;
export const TOTAL_RUN_NODES = 10;
export const INCURSION_ENCOUNTER_COUNT = 10;
export const MIN_COMBAT_NODES = 4;
/** Stamina deducted when operative confirms vector engagement from scanner overlay. */
export const SCAN_ENGAGE_STAMINA_COST = 8;

export interface RadarDot {
  id: string;
  sector: SectorDefinition;
  encounterType: EncounterType;
  label: string;
  pingLabel: string;
  pingIndex: number;
  x: number;
  y: number;
  angleDeg: number;
  isPreDiscovered?: boolean;
  encounterIndex: number;
  /** Hostile patrol contact on the Ley-Tracker (not a breach rift). */
  isHostilePatrol?: boolean;
}

export interface RadarScanResult {
  dots: RadarDot[];
  signalCount: number;
}

/** Tactical combat action costs (mirrored in combat UI). */
export const COMBAT_ACTION = {
  ABYSSAL_STRIKE_STAMINA: 20,
  ABYSSAL_STRIKE_DAMAGE: 10,
  ABYSSAL_STRIKE_EXHAUSTED_DAMAGE: 5,
  ABYSSAL_RESERVE_CHARGE: 15,
  ABYSSAL_WARD_STAMINA: 10,
  ABYSSAL_WARD_BLOCK_PCT: 0.5,
  ABYSSAL_WARD_STRIKE_BONUS: 100,
  COUNTER_STAMINA: 40,
  COUNTER_ABYSSAL_MIN: 50,
  COUNTER_DAMAGE: 15,
  BREATHING_TECHNIQUE_RESTORE: 45,
  STAMINA_REGEN: 20,
  EVISCERATE_DAMAGE: 35,
  ABYSSAL_RESERVE_CAP: 100,
} as const;
