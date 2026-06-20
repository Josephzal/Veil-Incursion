import type { EnemyAffinity } from './combatEnvironment';
import type { CombatUnitTag } from './aegisCombat';
import type { CombatGridLane, CombatGridSlotId } from './combatGrid';
import type { FactionType, RunNodeType } from './game';

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
  | 'OVERDRIVE_DISCHARGE'
  | 'PAVEMENT_CRUSHER_CHARGE'
  | 'PAVEMENT_CRUSHER'
  | 'OCCULT_TETHER'
  | 'SWARM_BITE'
  | 'STAMINA_DRAIN_LEAP'
  | 'DOUBLE_STRIKE'
  | 'VEIL_STATIC'
  | 'PREMATURE_IGNITION'
  | 'RESONANCE_OVERLOAD'
  | 'SINKING_INTO_GRID'
  | 'VOID_AMBUSH'
  | 'KINETIC_AFTERSHOCK'
  | 'SCAVENGE'
  | 'SENSORY_JAM'
  | 'VEIL_BARRIER'
  | 'TARGET_LOCK'
  | 'ASHEN_ROT'
  | 'ARTILLERY_CHARGE'
  | 'ARTILLERY_FIRE'
  | 'TAR_BIND'
  | 'LASER_SIGHT'
  | 'STAMINA_TETHER'
  | 'JAM_AUGMENT'
  | 'MEMORY_LEECH'
  | 'FIELD_REPAIR';

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
  /** Stable id for multi-enemy targeting (Phase B). */
  unitId?: string;
  gridSlot?: CombatGridSlotId;
  lane?: CombatGridLane;
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
  isGridHound?: boolean;
  isApex?: boolean;
  bossPhase?: number;
  bossDepth?: number;
  /** Badge-screen test combat — controls intent rolling in advanceEnemyIntent. */
  testPreset?: 'easy' | 'hard';
  affinity?: EnemyAffinity;
  kineticArmor?: number;
  occultWards?: number;
  baseKineticArmor?: number;
  baseOccultWards?: number;
  fractureGauge?: number;
  fractureMax?: number;
  combatTags?: CombatUnitTag[];
  /** Void Contagion — Doomed applications stack up to 3. */
  doomedStacks?: number;
  enemyActionPoints?: number;
  enemyMaxActionPoints?: number;
  fracturedThisRound?: boolean;
  rosterId?: string;
  faction?: FactionType;
  /** Player-turn windows remaining where incoming damage is reduced after FORTIFY resolves. */
  fortifyTurnsRemaining?: number;
  /** Passive stat evade — full miss on connect (EVADE posture uses EVADE_POSTURE_EVADE_CHANCE). */
  evadeChance?: number;
  /** Passive crit chance on attacks. Bosses should remain 0. */
  critChance?: number;
  /** Choir of Rust — damage syncs to boss HP pool across all bodies. */
  sharedBossPool?: boolean;
  /** Ley-Siren tether — fracture gauge cannot build while true. */
  fractureImmune?: boolean;
  /** Null-Shade — occult channel hits deal 0. */
  occultImmune?: boolean;
  /** Echoing Brute — stores last kinetic adaptation for bonus strike damage. */
  adaptedElement?: 'Kinetic' | 'Occult' | null;
  /** Concrete Gargoyle — pavement crusher wind-up. */
  isCharging?: boolean;
  /** Spatial Glitch — next qualifying hit triggers position swap. */
  teleportReady?: boolean;
  /** Persistent enrage latch — drives deep-red overlay when true. */
  isEnraged?: boolean;
  /** Telegraphed follow-up action key (e.g. SLAM, VOID_AMBUSH). */
  queuedAction?: string | null;
  /** Null-Shade phasing — kinetic/physical targeting blocked while true. */
  isUntargetable?: boolean;
  /** Roster telegraph cooldown — turns until Sinking/Void sequence can restart. */
  rosterAbilityCooldown?: number;
  /** Hit-based shield — absorbs one full strike per charge. */
  veilBarrierCharges?: number;
  /** Spawn archetype for target-lock / placement rules. */
  spawnArchetype?: 'MELEE' | 'SUPPORT' | 'RANGED' | 'HEAVY' | 'ARTILLERY';
  /** Thrall — fleshy resilience slump state. */
  isSlumped?: boolean;
  slumpTurnsRemaining?: number;
  /** Golem venting core heat accumulator. */
  heatCharge?: number;
  /** Resonance Caster stacking damage buff count. */
  resonanceStack?: number;
  /** Hook Weaver tether target unit id. */
  tetheredAllyUnitId?: string | null;
  /** Cabal human operative — receives faction trait at spawn. */
  isCabalHuman?: boolean;
  /** Advanced Veil anomaly — no Cabal faction traits. */
  isVeilEntity?: boolean;
  /** Controlling Cabal faction for this depth (Cabal humans only). */
  cabalFaction?: FactionType;
  factionTrait?: 'ENTRENCHED' | 'COLD_VACUUM' | 'VOLATILE_CORE';
  /** Faction trait loot dropped on true death. */
  factionLootId?: string;
  /** Wide frontline unit (e.g. Amalgam occupies FL_0 + FL_1). */
  gridWidth?: number;
  /** Secondary occupied slot for wide units. */
  occupiedSlots?: CombatGridSlotId[];
  /** Grave Robber — permanent buff stacks from corpse feed. */
  graveRobberFeeds?: number;
  /** Spotter — turn-1 lock telegraph before artillery burst. */
  spotterLockedOn?: boolean;
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
  /** Multi-enemy squad for combat encounters (max 4). */
  pendingEnemies: EnemyCombatProfile[];
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
  /** Incursion node type — drives reveal color when locked + selected. */
  nodeType?: RunNodeType;
}

export interface RadarScanResult {
  dots: RadarDot[];
  signalCount: number;
}

/** Tactical combat action costs (mirrored in combat UI). */
export const COMBAT_ACTION = {
  ABYSSAL_STRIKE_STAMINA: 20,
  ABYSSAL_STRIKE_DAMAGE: 15,
  ABYSSAL_STRIKE_EXHAUSTED_DAMAGE: 8,
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
