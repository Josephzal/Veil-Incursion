export type RegionTheme = 'HOSPITAL' | 'HOUSING' | 'FOREST' | 'CITY';

export type ClimateClusterId = 'URBAN' | 'ISOLATED' | 'WILDERNESS';

export type EncounterType = 'COMBAT' | 'SKILL_CHECK' | 'REST';

export type EnemyClass = 'GREMLIN' | 'APPARITION' | 'ABOMINATION';

export type EnemyIntent =
  | 'STRIKE'
  | 'STRIP_STAMINA'
  | 'SIPHON_KINETIC'
  | 'EVADE'
  | 'CHARGE'
  | 'WORLD_ENDER'
  | 'FORTIFY'
  | 'OVERDRIVE_DISCHARGE';

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
  bossPhase?: number;
  bossTier?: number;
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
  startingKineticPercent?: number;
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
  x: number;
  y: number;
  angleDeg: number;
}

export interface RadarScanResult {
  dots: RadarDot[];
  signalCount: number;
}

/** Tactical combat action costs (mirrored in combat UI). */
export const COMBAT_ACTION = {
  KINETIC_STRIKE_STAMINA: 20,
  KINETIC_STRIKE_DAMAGE: 10,
  KINETIC_STRIKE_EXHAUSTED_DAMAGE: 5,
  KINETIC_CHARGE: 15,
  AEGIS_STAMINA: 10,
  AEGIS_BLOCK_PCT: 0.5,
  AEGIS_KINETIC_BONUS: 30,
  COUNTER_STAMINA: 40,
  COUNTER_KINETIC_MIN: 50,
  COUNTER_DAMAGE: 15,
  FLUID_VENT_RESTORE: 45,
  STAMINA_REGEN: 20,
  VECTOR_SLICE_DAMAGE: 35,
  KINETIC_CAP: 100,
} as const;
