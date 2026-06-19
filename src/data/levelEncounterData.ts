import type { CombatGridSlotId } from '../types/combatGrid';
import { getDistrictFromDepth, isDistrictGateDepth, localLevelFromDepth } from './districtPacing';
import type { EncounterEnemyKey } from './enemyCombatConfig';
import { ENCOUNTER_KEY_TO_ROSTER, ENEMY_ARCHETYPE_FOR_KEY } from './enemyCombatConfig';
import type { EnemyRosterId } from './enemyRoster';
import {
  createRunSegment,
  generateNodeEncounter,
  type RunSegmentState,
} from './encounterGenerator';

export type EncounterLayout = {
  frontLeft: EncounterEnemyKey | null;
  frontRight: EncounterEnemyKey | null;
  backLeft: EncounterEnemyKey | null;
  backRight: EncounterEnemyKey | null;
};

export interface LevelEncounterEntry {
  level: number;
  layout: EncounterLayout;
  /** Solo alpha duel — applies Alpha stat modifier. */
  isAlpha?: boolean;
  encounterId?: string;
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
): LevelEncounterEntry {
  const district = getDistrictFromDepth(depth);
  const seg = segment ?? defaultSegmentForDepth(depth);
  const generated = generateNodeEncounter(depth, seg, seed ?? `level:${depth}`);
  return {
    level: depth,
    layout: generated.layout,
    isAlpha: generated.isAlpha,
    encounterId: generated.encounterId,
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
): SpawnSlotAssignment[] {
  if (isDistrictGateDepth(depth)) return [];

  const entry = resolveLevelEncounter(depth, segment, seed);
  const hasAnyEnemy = Object.values(entry.layout).some((v) => v != null);
  if (!hasAnyEnemy) return [];

  return layoutToSpawnSlots(entry.layout, entry.isAlpha);
}

export function isAlphaDuelDepth(depth: number, segment: RunSegmentState): boolean {
  return localLevelFromDepth(depth) === segment.alphaNodeIndex;
}

export { SLOT_MAP };
