import type { CombatGridSlotId } from '../types/combatGrid';
import { ALL_GRID_SLOTS } from '../types/combatGrid';
import { laneForSlot } from '../types/combatGrid';
import { draftEncounterForDepth } from './combatEncounterBudget';
import { initEnemyCombatLayers } from './combatFractureEngine';
import type { IncursionBiome } from '../types/game';
import type { EnemyCombatProfile, SectorDefinition } from '../types/run';
import type { DistrictId } from './districtPacing';
import { getDistrictFromDepth, depthFromNodesCleared } from './districtPacing';
import { spawnRosterUnit } from './enemyRoster';
import type { SpawnEnemyOptions } from './enemies';

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
  nodeIndex: number;
  isElite?: boolean;
  isAmbush?: boolean;
  biome?: IncursionBiome;
  /** Legacy field — combat enemies always use the established roster. */
  sector?: SectorDefinition;
  spawnOptions?: SpawnEnemyOptions;
  unitCount?: number;
  district?: DistrictId;
}

/** Always drafts from the established enemy roster + threat budget. */
export function spawnCombatSquad(options: SpawnSquadOptions): EnemyCombatProfile[] {
  const depth = depthFromNodesCleared(options.nodeIndex);
  const district = options.district ?? getDistrictFromDepth(depth);
  const drafted = draftEncounterForDepth(depth, {
    isElite: options.isElite,
    isAmbush: options.isAmbush,
    district,
  });
  const slots = options.unitCount != null
    ? drafted.slots.slice(0, Math.min(4, options.unitCount))
    : drafted.slots;
  const entries = drafted.entries.slice(0, slots.length);

  return slots.map((slot, index) =>
    assignGrid(
      spawnRosterUnit(entries[index], options.nodeIndex, {
        resonancePercent: options.spawnOptions?.resonancePercent,
        forcedElite: options.isElite === true,
        district,
      }),
      slot,
    ),
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
