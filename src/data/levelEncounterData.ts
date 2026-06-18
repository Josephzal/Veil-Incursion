import type { CombatGridSlotId } from '../types/combatGrid';
import { isDistrictGateDepth } from './districtPacing';
import { getDistrictFromDepth } from './districtPacing';
import type { EncounterEnemyKey } from './enemyCombatConfig';
import { ENCOUNTER_KEY_TO_ROSTER } from './enemyCombatConfig';
import type { EnemyRosterId } from './enemyRoster';

export type EncounterLayout = {
  frontLeft: EncounterEnemyKey | null;
  frontRight: EncounterEnemyKey | null;
  backLeft: EncounterEnemyKey | null;
  backRight: EncounterEnemyKey | null;
};

export interface LevelEncounterEntry {
  level: number;
  layout: EncounterLayout;
  /** Solo heavy duel — applies Alpha stat modifier. */
  isAlpha?: boolean;
}

export type SynergySquadId =
  | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L' | 'M';

const SLOT_MAP: Record<keyof EncounterLayout, CombatGridSlotId> = {
  frontLeft: 'FL_0',
  frontRight: 'FL_1',
  backLeft: 'BL_0',
  backRight: 'BL_1',
};

export function getSynergySquad(squadName: SynergySquadId): EncounterLayout {
  const squads: Record<SynergySquadId, EncounterLayout> = {
    A: { frontLeft: 'ECHOING_BRUTE', frontRight: null, backLeft: null, backRight: 'LEY_SIREN' },
    B: { frontLeft: 'FRACTURE_HOUND', frontRight: 'FRACTURE_HOUND', backLeft: 'ASH_WEEPER', backRight: null },
    C: { frontLeft: 'ECHOING_BRUTE', frontRight: null, backLeft: 'SPATIAL_GLITCH', backRight: 'NULL_SHADE' },
    D: { frontLeft: 'ECHOING_BRUTE', frontRight: 'FRACTURE_HOUND', backLeft: 'NULL_SHADE', backRight: 'NULL_SHADE' },
    E: { frontLeft: 'ECHOING_BRUTE', frontRight: 'MIASMA_SWARM', backLeft: 'SPATIAL_GLITCH', backRight: 'LEY_SIREN' },
    F: { frontLeft: 'MIASMA_SWARM', frontRight: 'MIASMA_SWARM', backLeft: 'ASH_WEEPER', backRight: 'ASH_WEEPER' },
    G: { frontLeft: 'ECHOING_BRUTE', frontRight: null, backLeft: null, backRight: 'NULL_SHADE' },
    H: { frontLeft: 'FRACTURE_HOUND', frontRight: 'FRACTURE_HOUND', backLeft: 'NULL_SHADE', backRight: null },
    I: { frontLeft: 'GUTTER_GOLIATH', frontRight: null, backLeft: null, backRight: 'LEY_SIREN' },
    J: { frontLeft: 'CONCRETE_GARGOYLE', frontRight: 'CONCRETE_GARGOYLE', backLeft: 'NULL_SHADE', backRight: null },
    K: { frontLeft: 'GUTTER_GOLIATH', frontRight: 'MIASMA_SWARM', backLeft: 'ASH_WEEPER', backRight: 'ASH_WEEPER' },
    L: { frontLeft: 'FRACTURE_HOUND', frontRight: 'CONCRETE_GARGOYLE', backLeft: 'SPATIAL_GLITCH', backRight: 'LEY_SIREN' },
    M: { frontLeft: 'GUTTER_GOLIATH', frontRight: 'ECHOING_BRUTE', backLeft: null, backRight: 'NULL_SHADE' },
  };
  return squads[squadName];
}

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

const ENEMY_ARCHETYPE_FOR_KEY: Record<EncounterEnemyKey, 'MELEE' | 'SUPPORT' | 'RANGED' | 'HEAVY'> = {
  FRACTURE_HOUND: 'MELEE',
  ECHOING_BRUTE: 'MELEE',
  MIASMA_SWARM: 'MELEE',
  GUTTER_GOLIATH: 'HEAVY',
  CONCRETE_GARGOYLE: 'HEAVY',
  LEY_SIREN: 'SUPPORT',
  ASH_WEEPER: 'SUPPORT',
  NULL_SHADE: 'SUPPORT',
  SPATIAL_GLITCH: 'RANGED',
  RIOT_VANGUARD: 'MELEE',
};

function hashPick<T>(seed: number, options: readonly T[]): T {
  return options[Math.abs(seed) % options.length];
}

function buildLevelEntry(level: number): LevelEncounterEntry {
  if (isDistrictGateDepth(level)) {
    return { level, layout: { frontLeft: null, frontRight: null, backLeft: null, backRight: null } };
  }

  if (level === 1) {
    return { level, layout: { frontLeft: 'FRACTURE_HOUND', frontRight: null, backLeft: null, backRight: null } };
  }
  if (level === 2) {
    return { level, layout: { frontLeft: 'MIASMA_SWARM', frontRight: null, backLeft: null, backRight: null } };
  }
  if (level === 3) {
    return { level, layout: { frontLeft: 'FRACTURE_HOUND', frontRight: null, backLeft: null, backRight: null } };
  }

  if (level === 22) {
    return {
      level,
      layout: { frontLeft: 'GUTTER_GOLIATH', frontRight: null, backLeft: null, backRight: null },
      isAlpha: true,
    };
  }
  if (level === 38) {
    return {
      level,
      layout: { frontLeft: 'CONCRETE_GARGOYLE', frontRight: null, backLeft: null, backRight: null },
      isAlpha: true,
    };
  }

  const district = getDistrictFromDepth(level);

  if (district === 1) {
    if (level % 5 === 0) {
      return { level, layout: getSoloEncounter(hashPick(level, ['FRACTURE_HOUND', 'MIASMA_SWARM'] as const)) };
    }
    const d1Squads: SynergySquadId[] = ['A', 'B', 'C'];
    return { level, layout: getSynergySquad(hashPick(level, d1Squads)) };
  }

  if (district === 2) {
    const d2Squads: SynergySquadId[] = ['D', 'G', 'H', 'D', 'G', 'H', 'A', 'B'];
    if (level % 4 === 0) {
      return { level, layout: getSoloEncounter(hashPick(level, ['ECHOING_BRUTE', 'NULL_SHADE'] as const)) };
    }
    return { level, layout: getSynergySquad(hashPick(level, d2Squads)) };
  }

  const d3HighThreat: SynergySquadId[] = ['E', 'F', 'I', 'K', 'L', 'M', 'E', 'F', 'I', 'K'];
  if (level % 3 !== 0) {
    return { level, layout: getSynergySquad(hashPick(level, d3HighThreat)) };
  }
  return { level, layout: getSoloEncounter(hashPick(level, ['GUTTER_GOLIATH', 'CONCRETE_GARGOYLE'] as const)) };
}

/** Precomputed encounter layouts for levels 1–45. Boss gates (15/30/45) use empty layouts — bosses spawn separately. */
export const LEVEL_DATA: LevelEncounterEntry[] = Array.from({ length: 45 }, (_, i) =>
  buildLevelEntry(i + 1),
);

export function getLevelEncounter(depth: number): LevelEncounterEntry | null {
  if (depth < 1 || depth > 45) return null;
  return LEVEL_DATA[depth - 1] ?? null;
}

export interface SpawnSlotAssignment {
  rosterId: EnemyRosterId;
  slot: CombatGridSlotId;
  isAlpha?: boolean;
}

/** Enforce MELEE/HEAVY front-only; SUPPORT/RANGED prefer back row. */
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

export function resolveSpawnSlotsForDepth(depth: number): SpawnSlotAssignment[] {
  const entry = getLevelEncounter(depth);
  if (!entry || isDistrictGateDepth(depth)) return [];

  const hasAnyEnemy = Object.values(entry.layout).some((v) => v != null);
  if (!hasAnyEnemy) return [];

  return layoutToSpawnSlots(entry.layout, entry.isAlpha);
}
