import type { CombatGridSlotId, CombatSpawnPattern } from '../types/combatGrid';
import { ALL_GRID_SLOTS } from '../types/combatGrid';
import { laneForSlot } from '../types/combatGrid';
import { initEnemyCombatLayers } from './combatFractureEngine';
import {
  spawnBiomeEnemyProfile,
  spawnEnemyProfile,
  type SpawnEnemyOptions,
} from './enemies';
import type { IncursionBiome } from '../types/game';
import type { EnemyCombatProfile, SectorDefinition } from '../types/run';
import type { DistrictId } from './districtPacing';
import { getDistrictFromDepth, depthFromNodesCleared } from './districtPacing';
import {
  factionForDistrict,
  pickRosterEntry,
  spawnRosterUnit,
  type EnemyRosterEntry,
  type EnemyRosterId,
} from './enemyRoster';

let unitSeq = 0;

function nextUnitId(prefix: string): string {
  unitSeq += 1;
  return `${prefix}-${unitSeq}`;
}

function assignGrid(
  profile: EnemyCombatProfile,
  slot: CombatGridSlotId,
): EnemyCombatProfile {
  return {
    ...initEnemyCombatLayers(profile),
    unitId: profile.unitId ?? nextUnitId('hostile'),
    gridSlot: slot,
    lane: laneForSlot(slot),
    enemyActionPoints: profile.enemyActionPoints ?? 1,
    enemyMaxActionPoints: profile.enemyMaxActionPoints ?? 1,
  };
}

export interface SpawnSquadOptions {
  pattern?: CombatSpawnPattern;
  nodeIndex: number;
  isElite?: boolean;
  isAmbush?: boolean;
  biome?: IncursionBiome;
  sector?: SectorDefinition;
  spawnOptions?: SpawnEnemyOptions;
  unitCount?: number;
  district?: DistrictId;
  useRoster?: boolean;
}

function rollPattern(isElite: boolean, isAmbush: boolean): CombatSpawnPattern {
  if (isAmbush) return 'PATROL_AMBUSH';
  if (isElite) return Math.random() < 0.5 ? 'VOID_TEAR' : 'SUMMONER';
  return Math.random() < 0.35 ? 'STATIC_BREACH' : 'PATROL_AMBUSH';
}

function rollUnitCount(pattern: CombatSpawnPattern, isElite: boolean): number {
  switch (pattern) {
    case 'STATIC_BREACH':
      return isElite ? 2 : 1 + (Math.random() < 0.4 ? 1 : 0);
    case 'VOID_TEAR':
      return 2;
    case 'SUMMONER':
      return isElite ? 3 : 2;
    case 'PATROL_AMBUSH':
      return isElite ? 3 : 2;
    default:
      return 1;
  }
}

function slotLayout(pattern: CombatSpawnPattern, count: number): CombatGridSlotId[] {
  if (count <= 1) return ['FL_0'];
  if (pattern === 'VOID_TEAR') return ['FL_0', 'BL_0'];
  if (count === 2) return ['FL_0', 'FL_1'];
  if (count === 3) return ['FL_0', 'FL_1', 'BL_0'];
  return ['FL_0', 'FL_1', 'BL_0', 'BL_1'];
}

function rosterRolesForPattern(
  pattern: CombatSpawnPattern,
  slots: CombatGridSlotId[],
): Array<'FRONTLINE' | 'BACKLINE'> {
  return slots.map((slot) => (slot.startsWith('BL') ? 'BACKLINE' : 'FRONTLINE'));
}

function pickRosterSquad(
  options: SpawnSquadOptions,
  pattern: CombatSpawnPattern,
  slots: CombatGridSlotId[],
): EnemyRosterEntry[] {
  const depth = depthFromNodesCleared(options.nodeIndex);
  const district = options.district ?? getDistrictFromDepth(depth);
  const faction = factionForDistrict(district);
  const isElite = options.isElite === true || options.isAmbush === true;
  const roles = rosterRolesForPattern(pattern, slots);
  const used = new Set<EnemyRosterId>();
  return roles.map((role) => {
    const entry = pickRosterEntry(faction, role, isElite && role === 'FRONTLINE', used);
    used.add(entry.id);
    return entry;
  });
}

function spawnRawProfile(
  options: SpawnSquadOptions,
  slotIndex: number,
): EnemyCombatProfile {
  const {
    nodeIndex,
    isElite = false,
    isAmbush = false,
    biome = 'CITY_STREETS',
    sector,
    spawnOptions,
  } = options;

  if (sector) {
    return spawnEnemyProfile(sector, nodeIndex, isElite || isAmbush);
  }
  const profile = spawnBiomeEnemyProfile(biome, nodeIndex, isElite || isAmbush, {
    ...spawnOptions,
    district: options.district ?? spawnOptions?.district,
  });
  if (slotIndex > 0 && !isElite) {
    const scale = 0.85 + slotIndex * 0.05;
    return {
      ...profile,
      maxHp: Math.max(20, Math.floor(profile.maxHp * scale)),
      currentHp: Math.max(20, Math.floor(profile.maxHp * scale)),
      baseDamage: Math.max(4, Math.floor(profile.baseDamage * scale)),
      designation: `${profile.designation} // WING ${slotIndex + 1}`,
    };
  }
  return profile;
}

export function spawnCombatSquad(options: SpawnSquadOptions): EnemyCombatProfile[] {
  const pattern = options.pattern ?? rollPattern(options.isElite === true, options.isAmbush === true);
  const count = Math.min(4, options.unitCount ?? rollUnitCount(pattern, options.isElite === true));
  const slots = slotLayout(pattern, count).slice(0, count);
  const useRoster = options.useRoster !== false && !options.sector;

  if (useRoster) {
    const entries = pickRosterSquad(options, pattern, slots);
    return slots.map((slot, index) =>
      assignGrid(
        spawnRosterUnit(entries[index], options.nodeIndex, {
          resonancePercent: options.spawnOptions?.resonancePercent,
          forcedElite: options.isElite === true,
          district: options.district ?? getDistrictFromDepth(depthFromNodesCleared(options.nodeIndex)),
        }),
        slot,
      ),
    );
  }

  return slots.map((slot, index) =>
    assignGrid(spawnRawProfile(options, index), slot),
  );
}

export function squadFromSingleEnemy(enemy: EnemyCombatProfile): EnemyCombatProfile[] {
  const slot = enemy.gridSlot ?? 'FL_0';
  return [assignGrid({ ...enemy, unitId: enemy.unitId ?? nextUnitId('hostile') }, slot as CombatGridSlotId)];
}

export function normalizeSquad(enemies: EnemyCombatProfile[]): EnemyCombatProfile[] {
  if (enemies.length === 0) return [];
  const used = new Set<CombatGridSlotId>();
  return enemies.map((e) => {
    let slot = e.gridSlot as CombatGridSlotId | undefined;
    if (!slot || used.has(slot)) {
      slot = ALL_GRID_SLOTS.find((s) => !used.has(s)) ?? 'FL_0';
    }
    used.add(slot);
    return assignGrid({ ...e, unitId: e.unitId ?? nextUnitId('hostile') }, slot);
  });
}
