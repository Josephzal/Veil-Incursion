import type { FactionType } from '../types/game';
import type { CombatGridLane } from '../types/combatGrid';
import type { EnemyClass, EnemyCombatProfile } from '../types/run';
import { getNodeScale } from './enemies';
import { resolveEnemyAffinity } from './combatEnvironmentEngine';
import { applyCorporealHpMultiplier } from './combatEnvironmentEngine';
import { initEnemyCombatLayers } from './combatFractureEngine';
import { initRosterLifecycleDefaults } from './combatLifecycleEngine';
import { CONCRETE_GARGOYLE_FRACTURE_MAX } from './combatRosterActions';
import { rollEnemyIntent } from './enemies';
import type { DistrictId } from './districtPacing';
import { depthFromNodesCleared, localLevelFromDepth } from './districtPacing';
import type { ThreatTier } from './combatEncounterBudget';

export type EnemyRosterId =
  | 'concrete-gargoyle'
  | 'gutter-goliath'
  | 'echoing-brute'
  | 'ley-siren'
  | 'ash-weeper'
  | 'miasma-tick-swarm'
  | 'fracture-hound'
  | 'null-shade'
  | 'spatial-glitch'
  | 'boss-hollowed-precinct'
  | 'boss-choir-of-rust'
  | 'boss-primeval-rift-walker';

export interface EnemyRosterEntry {
  id: EnemyRosterId;
  designation: string;
  faction: FactionType;
  class: EnemyClass;
  role: CombatGridLane;
  hp: number;
  damage: number;
  kineticArmor: number;
  occultWards: number;
  threatTier: ThreatTier;
  isDisruptor?: boolean;
  elite?: boolean;
  evadeChance: number;
  critChance: number;
}

export const ENEMY_ROSTER: Record<EnemyRosterId, EnemyRosterEntry> = {
  'concrete-gargoyle': {
    id: 'concrete-gargoyle',
    designation: 'CONCRETE GARGOYLE',
    faction: 'TERRAN_GRID',
    class: 'ABOMINATION',
    role: 'FRONTLINE',
    hp: 72,
    damage: 10,
    kineticArmor: 2,
    occultWards: 0,
    threatTier: 3,
    evadeChance: 0,
    critChance: 0.05,
  },
  'gutter-goliath': {
    id: 'gutter-goliath',
    designation: 'GUTTER GOLIATH',
    faction: 'TERRAN_GRID',
    class: 'ABOMINATION',
    role: 'FRONTLINE',
    hp: 88,
    damage: 11,
    kineticArmor: 3,
    occultWards: 0,
    threatTier: 3,
    evadeChance: 0,
    critChance: 0.05,
  },
  'echoing-brute': {
    id: 'echoing-brute',
    designation: 'ECHOING BRUTE',
    faction: 'TERRAN_GRID',
    class: 'ABOMINATION',
    role: 'FRONTLINE',
    hp: 95,
    damage: 13,
    kineticArmor: 2,
    occultWards: 1,
    threatTier: 2,
    elite: true,
    evadeChance: 0,
    critChance: 0.05,
  },
  'ley-siren': {
    id: 'ley-siren',
    designation: 'LEY-SIREN',
    faction: 'SOLARIS',
    class: 'APPARITION',
    role: 'BACKLINE',
    hp: 48,
    damage: 11,
    kineticArmor: 0,
    occultWards: 2,
    threatTier: 2,
    isDisruptor: true,
    evadeChance: 0.10,
    critChance: 0,
  },
  'ash-weeper': {
    id: 'ash-weeper',
    designation: 'ASH WEEPER',
    faction: 'SOLARIS',
    class: 'APPARITION',
    role: 'BACKLINE',
    hp: 102,
    damage: 14,
    kineticArmor: 2,
    occultWards: 2,
    threatTier: 1,
    isDisruptor: true,
    evadeChance: 0.10,
    critChance: 0,
  },
  'miasma-tick-swarm': {
    id: 'miasma-tick-swarm',
    designation: 'MIASMA TICK SWARM',
    faction: 'SOLARIS',
    class: 'GREMLIN',
    role: 'FRONTLINE',
    hp: 44,
    damage: 8,
    kineticArmor: 1,
    occultWards: 0,
    threatTier: 1,
    evadeChance: 0.15,
    critChance: 0,
  },
  'fracture-hound': {
    id: 'fracture-hound',
    designation: 'FRACTURE HOUND',
    faction: 'LEGION',
    class: 'APPARITION',
    role: 'FRONTLINE',
    hp: 60,
    damage: 11,
    kineticArmor: 1,
    occultWards: 1,
    threatTier: 2,
    evadeChance: 0.15,
    critChance: 0.10,
  },
  'null-shade': {
    id: 'null-shade',
    designation: 'NULL SHADE',
    faction: 'LEGION',
    class: 'APPARITION',
    role: 'BACKLINE',
    hp: 54,
    damage: 10,
    kineticArmor: 0,
    occultWards: 2,
    threatTier: 3,
    evadeChance: 0.15,
    critChance: 0.10,
  },
  'spatial-glitch': {
    id: 'spatial-glitch',
    designation: 'SPATIAL GLITCH',
    faction: 'LEGION',
    class: 'ABOMINATION',
    role: 'FRONTLINE',
    hp: 108,
    damage: 15,
    kineticArmor: 3,
    occultWards: 1,
    threatTier: 3,
    elite: true,
    evadeChance: 0.15,
    critChance: 0.15,
  },
  'boss-hollowed-precinct': {
    id: 'boss-hollowed-precinct',
    designation: 'HOLLOWED PRECINCT',
    faction: 'TERRAN_GRID',
    class: 'ABOMINATION',
    role: 'FRONTLINE',
    hp: 220,
    damage: 11,
    kineticArmor: 3,
    occultWards: 1,
    threatTier: 3,
    evadeChance: 0,
    critChance: 0,
  },
  'boss-choir-of-rust': {
    id: 'boss-choir-of-rust',
    designation: 'CHOIR OF RUST',
    faction: 'SOLARIS',
    class: 'APPARITION',
    role: 'BACKLINE',
    hp: 280,
    damage: 10,
    kineticArmor: 1,
    occultWards: 2,
    threatTier: 3,
    evadeChance: 0,
    critChance: 0,
  },
  'boss-primeval-rift-walker': {
    id: 'boss-primeval-rift-walker',
    designation: 'PRIMEVAL RIFT-WALKER',
    faction: 'LEGION',
    class: 'ABOMINATION',
    role: 'FRONTLINE',
    hp: 360,
    damage: 16,
    kineticArmor: 2,
    occultWards: 3,
    threatTier: 3,
    evadeChance: 0,
    critChance: 0,
  },
};

/** Grunts eligible for threat-budget encounter drafting. */
export const GRUNT_ROSTER_BY_FACTION: Record<FactionType, EnemyRosterId[]> = {
  TERRAN_GRID: ['concrete-gargoyle', 'gutter-goliath', 'echoing-brute'],
  SOLARIS: ['ley-siren', 'ash-weeper', 'miasma-tick-swarm'],
  LEGION: ['fracture-hound', 'null-shade', 'spatial-glitch'],
};

export const ALLOWED_GRUNT_ROSTER_IDS: readonly EnemyRosterId[] = [
  'concrete-gargoyle',
  'gutter-goliath',
  'echoing-brute',
  'ley-siren',
  'ash-weeper',
  'miasma-tick-swarm',
  'fracture-hound',
  'null-shade',
  'spatial-glitch',
];

export const ALLOWED_BOSS_ROSTER_IDS: readonly EnemyRosterId[] = [
  'boss-hollowed-precinct',
  'boss-choir-of-rust',
  'boss-primeval-rift-walker',
];

export function factionForDistrict(district: 1 | 2 | 3): FactionType {
  if (district === 1) return 'TERRAN_GRID';
  if (district === 2) return 'SOLARIS';
  return 'LEGION';
}

export function rosterPoolForFaction(faction: FactionType, isElite: boolean): EnemyRosterEntry[] {
  return GRUNT_ROSTER_BY_FACTION[faction]
    .map((id) => ENEMY_ROSTER[id])
    .filter((entry) => (isElite ? entry.elite === true : !entry.elite));
}

export function pickRosterEntry(
  faction: FactionType,
  role: CombatGridLane,
  isElite: boolean,
  exclude: Set<EnemyRosterId> = new Set(),
): EnemyRosterEntry {
  const pool = rosterPoolForFaction(faction, isElite);
  const roleMatches = pool.filter((e) => e.role === role && !exclude.has(e.id));
  const candidates = roleMatches.length > 0 ? roleMatches : pool.filter((e) => !exclude.has(e.id));
  if (candidates.length === 0) return pool[0];
  return candidates[Math.floor(Math.random() * candidates.length)];
}

export function districtBossRosterId(gateDepth: number): EnemyRosterId {
  if (gateDepth >= 45) return 'boss-primeval-rift-walker';
  if (gateDepth === 30) return 'boss-choir-of-rust';
  return 'boss-hollowed-precinct';
}

export function spawnRosterUnit(
  entry: EnemyRosterEntry,
  nodeIndex: number,
  options?: {
    resonancePercent?: number;
    forcedElite?: boolean;
    district?: DistrictId;
    isApex?: boolean;
    apexBudget?: number;
  },
): EnemyCombatProfile {
  const scale = getNodeScale(nodeIndex);
  const elite = entry.elite === true || options?.forcedElite === true || options?.isApex === true;
  const apexScale = options?.isApex && options.apexBudget
    ? 1 + Math.max(0, options.apexBudget - entry.threatTier) * 0.18
    : 1;
  const maxHp = Math.floor(entry.hp * scale * (elite ? 1.15 : 1) * apexScale);
  const baseDamage = Math.floor(entry.damage * scale);
  const affinity = resolveEnemyAffinity(entry.class, elite, options?.resonancePercent ?? 0);
  const intent = rollEnemyIntent(entry.class, 0, options?.district ?? 1);
  const base: EnemyCombatProfile = {
    class: entry.class,
    designation: entry.designation,
    maxHp,
    currentHp: maxHp,
    baseDamage,
    intent,
    chargeTurns: 0,
    evadeActive: intent === 'EVADE',
    nodeIndex,
    scale,
    rosterId: entry.id,
    faction: entry.faction,
    evadeChance: entry.evadeChance,
    critChance: entry.critChance,
  };
  const withAffinity = applyCorporealHpMultiplier({ ...base, affinity }, affinity);
  const depth = depthFromNodesCleared(nodeIndex);
  const localLevel = localLevelFromDepth(depth);
  const resonancePct = options?.resonancePercent ?? 0;
  let kineticArmor = entry.kineticArmor;
  let occultWards = entry.occultWards;
  if (localLevel >= 12 && resonancePct >= 75) {
    kineticArmor += 1;
    occultWards += 1;
  }
  const layered = initEnemyCombatLayers(withAffinity, {
    kineticArmor,
    occultWards,
    fractureMax: entry.id === 'concrete-gargoyle' ? CONCRETE_GARGOYLE_FRACTURE_MAX : undefined,
  });
  const withLifecycle = initRosterLifecycleDefaults(layered, entry.id);
  if (options?.isApex) {
    return {
      ...withLifecycle,
      isApex: true,
      enemyActionPoints: 2,
      enemyMaxActionPoints: 2,
      designation: `APEX ${entry.designation}`,
    };
  }
  return withLifecycle;
}

export function resolveEnemyThreatTier(profile: {
  isBoss?: boolean;
  isApex?: boolean;
  rosterId?: string;
}): 'STANDARD' | 'ELITE' | 'APEX' | 'BOSS' {
  if (profile.isBoss) return 'BOSS';
  if (profile.isApex) return 'APEX';
  if (profile.rosterId && ENEMY_ROSTER[profile.rosterId as EnemyRosterId]?.elite) return 'ELITE';
  return 'STANDARD';
}
