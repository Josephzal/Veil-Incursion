import type { FactionType } from '../types/game';
import type { CombatGridLane } from '../types/combatGrid';
import type { EnemyClass, EnemyCombatProfile } from '../types/run';
import { getNodeScale } from './enemies';
import { resolveEnemyAffinity } from './combatEnvironmentEngine';
import { applyCorporealHpMultiplier } from './combatEnvironmentEngine';
import { initEnemyCombatLayers } from './combatFractureEngine';
import { rollEnemyIntent } from './enemies';
import type { DistrictId } from './districtPacing';

export type EnemyRosterId =
  | 'grid-enforcer'
  | 'precinct-drone'
  | 'riot-shielder'
  | 'signal-leech'
  | 'checkpoint-warden'
  | 'solaris-vanguard'
  | 'cabal-spark'
  | 'luminant-pike'
  | 'choir-acolyte'
  | 'subgrid-overseer'
  | 'legion-grunt'
  | 'ash-knight'
  | 'veil-lancer'
  | 'remnant-oracle'
  | 'iron-pillar';

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
  elite?: boolean;
}

export const ENEMY_ROSTER: Record<EnemyRosterId, EnemyRosterEntry> = {
  'grid-enforcer': {
    id: 'grid-enforcer',
    designation: 'GRID ENFORCER',
    faction: 'TERRAN_GRID',
    class: 'ABOMINATION',
    role: 'FRONTLINE',
    hp: 72,
    damage: 10,
    kineticArmor: 2,
    occultWards: 0,
  },
  'precinct-drone': {
    id: 'precinct-drone',
    designation: 'PRECINCT DRONE',
    faction: 'TERRAN_GRID',
    class: 'GREMLIN',
    role: 'FRONTLINE',
    hp: 44,
    damage: 8,
    kineticArmor: 1,
    occultWards: 0,
  },
  'riot-shielder': {
    id: 'riot-shielder',
    designation: 'RIOT SHIELDER',
    faction: 'TERRAN_GRID',
    class: 'ABOMINATION',
    role: 'FRONTLINE',
    hp: 88,
    damage: 11,
    kineticArmor: 3,
    occultWards: 0,
  },
  'signal-leech': {
    id: 'signal-leech',
    designation: 'SIGNAL LEECH',
    faction: 'TERRAN_GRID',
    class: 'APPARITION',
    role: 'BACKLINE',
    hp: 52,
    damage: 9,
    kineticArmor: 0,
    occultWards: 1,
  },
  'checkpoint-warden': {
    id: 'checkpoint-warden',
    designation: 'CHECKPOINT WARDEN',
    faction: 'TERRAN_GRID',
    class: 'ABOMINATION',
    role: 'FRONTLINE',
    hp: 95,
    damage: 13,
    kineticArmor: 2,
    occultWards: 1,
    elite: true,
  },
  'solaris-vanguard': {
    id: 'solaris-vanguard',
    designation: 'SOLARIS VANGUARD',
    faction: 'SOLARIS',
    class: 'ABOMINATION',
    role: 'FRONTLINE',
    hp: 78,
    damage: 12,
    kineticArmor: 2,
    occultWards: 1,
  },
  'cabal-spark': {
    id: 'cabal-spark',
    designation: 'CABAL SPARK',
    faction: 'SOLARIS',
    class: 'APPARITION',
    role: 'BACKLINE',
    hp: 48,
    damage: 11,
    kineticArmor: 0,
    occultWards: 2,
  },
  'luminant-pike': {
    id: 'luminant-pike',
    designation: 'LUMINANT PIKE',
    faction: 'SOLARIS',
    class: 'APPARITION',
    role: 'FRONTLINE',
    hp: 58,
    damage: 10,
    kineticArmor: 1,
    occultWards: 1,
  },
  'choir-acolyte': {
    id: 'choir-acolyte',
    designation: 'CHOIR ACOLYTE',
    faction: 'SOLARIS',
    class: 'APPARITION',
    role: 'BACKLINE',
    hp: 50,
    damage: 9,
    kineticArmor: 0,
    occultWards: 2,
  },
  'subgrid-overseer': {
    id: 'subgrid-overseer',
    designation: 'SUB-GRID OVERSEER',
    faction: 'SOLARIS',
    class: 'ABOMINATION',
    role: 'FRONTLINE',
    hp: 102,
    damage: 14,
    kineticArmor: 2,
    occultWards: 2,
    elite: true,
  },
  'legion-grunt': {
    id: 'legion-grunt',
    designation: 'LEGION GRUNT',
    faction: 'LEGION',
    class: 'GREMLIN',
    role: 'FRONTLINE',
    hp: 46,
    damage: 9,
    kineticArmor: 1,
    occultWards: 0,
  },
  'ash-knight': {
    id: 'ash-knight',
    designation: 'ASH KNIGHT',
    faction: 'LEGION',
    class: 'ABOMINATION',
    role: 'FRONTLINE',
    hp: 82,
    damage: 12,
    kineticArmor: 3,
    occultWards: 0,
  },
  'veil-lancer': {
    id: 'veil-lancer',
    designation: 'VEIL LANCER',
    faction: 'LEGION',
    class: 'APPARITION',
    role: 'FRONTLINE',
    hp: 60,
    damage: 11,
    kineticArmor: 1,
    occultWards: 1,
  },
  'remnant-oracle': {
    id: 'remnant-oracle',
    designation: 'REMNANT ORACLE',
    faction: 'LEGION',
    class: 'APPARITION',
    role: 'BACKLINE',
    hp: 54,
    damage: 10,
    kineticArmor: 0,
    occultWards: 2,
  },
  'iron-pillar': {
    id: 'iron-pillar',
    designation: 'IRON PILLAR',
    faction: 'LEGION',
    class: 'ABOMINATION',
    role: 'FRONTLINE',
    hp: 108,
    damage: 15,
    kineticArmor: 3,
    occultWards: 1,
    elite: true,
  },
};

const ROSTER_BY_FACTION: Record<FactionType, EnemyRosterId[]> = {
  TERRAN_GRID: [
    'grid-enforcer',
    'precinct-drone',
    'riot-shielder',
    'signal-leech',
    'checkpoint-warden',
  ],
  SOLARIS: [
    'solaris-vanguard',
    'cabal-spark',
    'luminant-pike',
    'choir-acolyte',
    'subgrid-overseer',
  ],
  LEGION: [
    'legion-grunt',
    'ash-knight',
    'veil-lancer',
    'remnant-oracle',
    'iron-pillar',
  ],
};

export function factionForDistrict(district: 1 | 2 | 3): FactionType {
  if (district === 1) return 'TERRAN_GRID';
  if (district === 2) return 'SOLARIS';
  return 'LEGION';
}

export function rosterPoolForFaction(faction: FactionType, isElite: boolean): EnemyRosterEntry[] {
  return ROSTER_BY_FACTION[faction]
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

export function spawnRosterUnit(
  entry: EnemyRosterEntry,
  nodeIndex: number,
  options?: { resonancePercent?: number; forcedElite?: boolean; district?: DistrictId },
): EnemyCombatProfile {
  const scale = getNodeScale(nodeIndex);
  const elite = entry.elite === true || options?.forcedElite === true;
  const maxHp = Math.floor(entry.hp * scale * (elite ? 1.15 : 1));
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
  };
  const withAffinity = applyCorporealHpMultiplier({ ...base, affinity }, affinity);
  return initEnemyCombatLayers(withAffinity, {
    kineticArmor: entry.kineticArmor,
    occultWards: entry.occultWards,
  });
}
