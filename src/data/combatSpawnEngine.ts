import type { CombatGridSlotId } from '../types/combatGrid';
import { ALL_GRID_SLOTS } from '../types/combatGrid';
import { laneForSlot } from '../types/combatGrid';
import { applyDiagonalStaggerToProfiles } from './combatGridPlacement';
import { initEnemyCombatLayers } from './combatFractureEngine';
import {
  isDistrictGateDepth,
  depthFromNodesCleared,
  getDistrictFromDepth,
  localLevelFromDepth,
} from './districtPacing';
import {
  resolveSpawnSlotsForDepth,
  resolveEncounterMetaForDepth,
  isAlphaDuelDepth,
} from './levelEncounterData';
import { seededRandom } from './encounterGenerator';
import type { RunSegmentState } from './encounterGenerator';
import type { MacroBiomeFamily } from '../types/narrativeProcedural';
import { apexResonanceAmbushComposition, entriesFromComposition } from './encounterCompositionEngine';
import type { EnemyCombatProfile, SectorDefinition } from '../types/run';
import type { DistrictId } from './districtPacing';
import { ENEMY_ROSTER, spawnRosterUnit } from './enemyRoster';
import type { SpawnEnemyOptions } from './enemies';
import { loadAlphaDuelElite, loadEliteEncounter } from './eliteSpawnEngine';
import { macroFamilyToSynergyBiome } from './synergySpawnEngine';
import { rosterToSpawnSlots } from './rosterSpawnSlots';
import type { SpawnSlotAssignment } from './levelEncounterData';

let unitSeq = 0;

function nextUnitId(prefix: string): string {
  unitSeq += 1;
  return `${prefix}-${unitSeq}`;
}

function assignGrid(
  profile: EnemyCombatProfile,
  slot: CombatGridSlotId,
  gridWidth = 1,
): EnemyCombatProfile {
  const occupiedSlots: CombatGridSlotId[] | undefined = gridWidth >= 2
    ? [slot, slot === 'FL_0' ? 'FL_1' : 'FL_0']
    : undefined;
  return {
    ...initEnemyCombatLayers(profile),
    unitId: profile.unitId ?? nextUnitId('hostile'),
    gridSlot: slot,
    lane: laneForSlot(slot),
    gridWidth: gridWidth > 1 ? gridWidth : profile.gridWidth,
    occupiedSlots: occupiedSlots ?? profile.occupiedSlots,
    enemyActionPoints: profile.enemyActionPoints ?? 1,
    enemyMaxActionPoints: profile.enemyMaxActionPoints ?? 1,
  };
}

function resolveEliteSlotAssignments(
  depth: number,
  district: DistrictId,
  runSegment: RunSegmentState | null | undefined,
  encounterSeed: string | undefined,
  macroBiome: MacroBiomeFamily | null | undefined,
): { slots: SpawnSlotAssignment[]; encounterId: string } | null {
  const synergyBiome = macroFamilyToSynergyBiome(macroBiome);
  const localLevel = localLevelFromDepth(depth);
  const isAlphaDuel = runSegment != null && isAlphaDuelDepth(depth, runSegment);
  const rand = seededRandom(
    `${encounterSeed ?? 'elite'}:spawn:${depth}:${localLevel}:${runSegment?.alphaNodeIndex ?? 0}`,
  );

  const loader = isAlphaDuel ? loadAlphaDuelElite : loadEliteEncounter;
  let squad = loader(district, synergyBiome, rand, {
    lastEncounterId: runSegment?.lastEncounterId,
  });
  if (!squad) {
    squad = loader(district, synergyBiome, rand, {
      lastEncounterId: null,
      interloper: true,
    });
  }
  if (!squad) return null;

  return {
    slots: rosterToSpawnSlots(squad.roster),
    encounterId: squad.id,
  };
}

export interface SpawnSquadOptions {
  nodeIndex: number;
  isElite?: boolean;
  isAmbush?: boolean;
  /** Legacy field — combat enemies always use the established roster. */
  sector?: SectorDefinition;
  spawnOptions?: SpawnEnemyOptions;
  unitCount?: number;
  district?: DistrictId;
  runSegment?: RunSegmentState | null;
  encounterSeed?: string;
  macroBiome?: MacroBiomeFamily | null;
}

/** Spawns from LEVEL_DATA encounter layouts (levels 1–45). Boss gates return empty — bosses use district boss flow. */
export function spawnCombatSquad(options: SpawnSquadOptions): EnemyCombatProfile[] {
  const depth = depthFromNodesCleared(options.nodeIndex);
  const district = options.district ?? getDistrictFromDepth(depth);

  if (isDistrictGateDepth(depth)) {
    return [];
  }

  let slotAssignments: SpawnSlotAssignment[];
  let encounterMeta = resolveEncounterMetaForDepth(
    depth,
    options.runSegment ?? undefined,
    options.encounterSeed,
    options.macroBiome,
  );

  if (options.isElite === true) {
    const elite = resolveEliteSlotAssignments(
      depth,
      district,
      options.runSegment,
      options.encounterSeed,
      options.macroBiome,
    );
    if (elite) {
      slotAssignments = elite.slots;
      encounterMeta = { ...encounterMeta, encounterId: elite.encounterId };
    } else {
      slotAssignments = resolveSpawnSlotsForDepth(
        depth,
        options.runSegment ?? undefined,
        options.encounterSeed,
        options.macroBiome,
      );
    }
  } else {
    slotAssignments = resolveSpawnSlotsForDepth(
      depth,
      options.runSegment ?? undefined,
      options.encounterSeed,
      options.macroBiome,
    );
  }

  const cabalFaction = encounterMeta.cabalFaction;

  if (slotAssignments.length === 0 && options.isAmbush) {
    const ambush = entriesFromComposition(apexResonanceAmbushComposition());
    slotAssignments = ambush.entries.map((entry, index) => ({
      rosterId: entry.id,
      slot: ambush.slots[index] ?? 'FL_0',
      isAlpha: ambush.isApex,
    }));
  }

  if (slotAssignments.length === 0) {
    return [];
  }

  const limited = options.unitCount != null
    ? slotAssignments.slice(0, Math.min(4, options.unitCount))
    : slotAssignments;

  const squad = limited.map(({ rosterId, slot, isAlpha, gridWidth }) =>
    assignGrid(
      spawnRosterUnit(ENEMY_ROSTER[rosterId], options.nodeIndex, {
        resonancePercent: options.spawnOptions?.resonancePercent,
        forcedElite: options.isElite === true,
        district,
        isAlpha,
        cabalFaction: cabalFaction ?? undefined,
      }),
      slot,
      gridWidth,
    ),
  );
  return applyDiagonalStaggerToProfiles(squad);
}

export function squadFromSingleEnemy(enemy: EnemyCombatProfile): EnemyCombatProfile[] {
  const slot = enemy.gridSlot ?? 'FL_0';
  return [assignGrid({ ...enemy, unitId: enemy.unitId ?? nextUnitId('hostile') }, slot as CombatGridSlotId)];
}

export function normalizeSquad(enemies: EnemyCombatProfile[]): EnemyCombatProfile[] {
  if (enemies.length === 0) return [];
  const used = new Set<CombatGridSlotId>();
  const placed = enemies.map((e) => {
    let slot = e.gridSlot as CombatGridSlotId | undefined;
    if (!slot || used.has(slot)) {
      slot = ALL_GRID_SLOTS.find((s) => !used.has(s)) ?? 'FL_0';
    }
    used.add(slot);
    return assignGrid({ ...e, unitId: e.unitId ?? nextUnitId('hostile') }, slot);
  });
  return applyDiagonalStaggerToProfiles(placed);
}
