import type { CombatGridSlotId } from '../types/combatGrid';
import { getDistrictFromDepth, isDistrictGateDepth, localLevelFromDepth } from './districtPacing';
import type { EncounterEnemyKey } from './enemyCombatConfig';
import { ENCOUNTER_KEY_TO_ROSTER, ENEMY_ARCHETYPE_FOR_KEY } from './enemyCombatConfig';
import type { EnemyRosterId } from './enemyRoster';
import {
  createRunSegment,
  generateNodeEncounter,
  type EncounterPoolTier,
  type RunSegmentState,
} from './encounterGenerator';
import type { EncounterUnitSpec } from './synergyEncounterTypes';
import { rosterToSpawnSlots } from './rosterSpawnSlots';
import type { MacroBiomeFamily } from '../types/narrativeProcedural';

export type EncounterLayout = {
  frontLeft: EncounterEnemyKey | null;
  frontRight: EncounterEnemyKey | null;
  backLeft: EncounterEnemyKey | null;
  backRight: EncounterEnemyKey | null;
};

export interface LevelEncounterEntry {
  level: number;
  layout: EncounterLayout;
  /** Solo alpha duel — legacy flag when roster is absent. */
  isAlpha?: boolean;
  roster?: readonly EncounterUnitSpec[];
  poolTier?: EncounterPoolTier;
  encounterId?: string;
  encounterOrigin?: import('./originDeckEngine').EncounterOrigin;
  cabalFaction?: import('../types/game').FactionType;
}

const SLOT_MAP: Record<keyof EncounterLayout, CombatGridSlotId> = {
  frontLeft: 'FL_0',
  frontRight: 'FL_1',
  backLeft: 'BL_0',
  backRight: 'BL_1',
};

export function getSoloEncounter(enemyType: EncounterEnemyKey): EncounterLayout {
  const archetype = ENEMY_ARCHETYPE_FOR_KEY[enemyType];
  const layout: EncounterLayout = {
    frontLeft: null,
    frontRight: null,
    backLeft: null,
    backRight: null,
  };

  const frontKeys: (keyof EncounterLayout)[] = ['frontLeft', 'frontRight'];
  const backKeys: (keyof EncounterLayout)[] = ['backLeft', 'backRight'];

  if (archetype === 'MELEE' || archetype === 'HEAVY') {
    const slot = frontKeys[Math.floor(Math.random() * frontKeys.length)];
    layout[slot] = enemyType;
  } else {
    const slot = backKeys[Math.floor(Math.random() * backKeys.length)];
    layout[slot] = enemyType;
  }

  return layout;
}

function defaultSegmentForDepth(depth: number): RunSegmentState {
  const district = getDistrictFromDepth(depth);
  return createRunSegment(district, `fallback:${depth}`);
}

export function resolveLevelEncounter(
  depth: number,
  segment?: RunSegmentState,
  seed?: string,
  macroBiome?: MacroBiomeFamily | null,
): LevelEncounterEntry {
  const seg = segment ?? defaultSegmentForDepth(depth);
  const generated = generateNodeEncounter(depth, seg, seed ?? `level:${depth}`, { macroBiome });
  return {
    level: depth,
    layout: generated.layout,
    isAlpha: generated.isAlpha,
    roster: generated.roster,
    poolTier: generated.poolTier,
    encounterId: generated.encounterId,
    encounterOrigin: generated.encounterOrigin,
    cabalFaction: generated.cabalFaction,
  };
}

/** Legacy accessor — uses deterministic fallback segment when no run state available. */
export function getLevelEncounter(depth: number): LevelEncounterEntry | null {
  if (depth < 1 || depth > 45) return null;
  return resolveLevelEncounter(depth);
}

export interface SpawnSlotAssignment {
  rosterId: EnemyRosterId;
  slot: CombatGridSlotId;
  isAlpha?: boolean;
  gridWidth?: number;
}

export function layoutToSpawnSlots(
  layout: EncounterLayout,
  isAlpha = false,
): SpawnSlotAssignment[] {
  const slotKeys: (keyof EncounterLayout)[] = ['frontLeft', 'frontRight', 'backLeft', 'backRight'];
  const assignments: SpawnSlotAssignment[] = [];

  for (const layoutKey of slotKeys) {
    const enemyKey = layout[layoutKey];
    if (!enemyKey) continue;
    if (enemyKey === 'AMALGAM' && assignments.some((a) => a.rosterId === 'amalgam')) continue;
    if (enemyKey === 'AMALGAM') {
      assignments.push({
        rosterId: ENCOUNTER_KEY_TO_ROSTER[enemyKey],
        slot: 'FL_0',
        isAlpha,
        gridWidth: 2,
      });
      continue;
    }
    assignments.push({
      rosterId: ENCOUNTER_KEY_TO_ROSTER[enemyKey],
      slot: SLOT_MAP[layoutKey],
      isAlpha,
    });
  }

  return assignments;
}

export function resolveSpawnSlotsForDepth(
  depth: number,
  segment?: RunSegmentState,
  seed?: string,
  macroBiome?: MacroBiomeFamily | null,
): SpawnSlotAssignment[] {
  if (isDistrictGateDepth(depth)) return [];

  const entry = resolveLevelEncounter(depth, segment, seed, macroBiome);
  const hasAnyEnemy = entry.roster?.length
    ? true
    : Object.values(entry.layout).some((v) => v != null);
  if (!hasAnyEnemy) return [];

  if (entry.roster && entry.roster.length > 0) {
    return rosterToSpawnSlots(entry.roster);
  }

  return layoutToSpawnSlots(entry.layout, entry.isAlpha);
}

export function resolveEncounterMetaForDepth(
  depth: number,
  segment?: RunSegmentState,
  seed?: string,
  macroBiome?: MacroBiomeFamily | null,
): Pick<LevelEncounterEntry, 'encounterOrigin' | 'cabalFaction' | 'encounterId'> {
  return resolveLevelEncounter(depth, segment, seed, macroBiome);
}

export function isAlphaDuelDepth(depth: number, segment: RunSegmentState): boolean {
  return localLevelFromDepth(depth) === segment.alphaNodeIndex;
}

export { SLOT_MAP };
