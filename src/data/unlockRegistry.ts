import type { SectorId } from '../types/worldState';
import type {
  BreachGradeId,
  ProgressionReward,
  ProgressionRequirement,
  ProgressionUnlockCategory,
  ProgressionUnlockId,
} from '../types/progression';

export interface ProgressionUnlockDefinition {
  id: ProgressionUnlockId;
  category: ProgressionUnlockCategory;
  label: string;
  description: string;
  /** All must pass before the unlock can be granted. */
  requirements: readonly ProgressionRequirement[];
  /** Applied when the unlock is granted. */
  rewards: readonly ProgressionReward[];
}

const SECTOR_UNLOCK_TO_SECTOR_ID: Record<string, SectorId> = {
  'sector.null_zone': 'THE_NULL_ZONE',
  'sector.abyssal_sink': 'THE_ABYSSAL_SINK',
  'sector.ashen_waste': 'THE_ASHEN_WASTES',
  'sector.slag_works': 'THE_SLAG_WORKS',
  'sector.blackline_terminus': 'THE_BLACKLINE_TERMINUS',
};

const BREACH_GRADE_UNLOCK_TO_GRADE: Record<string, BreachGradeId> = {
  'breach_grade.I': 'I',
  'breach_grade.II': 'II',
  'breach_grade.III': 'III',
  'breach_grade.IV': 'IV',
  'breach_grade.V': 'V',
};

function sectorUnlock(
  id: ProgressionUnlockId,
  label: string,
  description: string,
  requirements: readonly ProgressionRequirement[],
): ProgressionUnlockDefinition {
  const sectorId = SECTOR_UNLOCK_TO_SECTOR_ID[id];
  return {
    id,
    category: 'SECTOR',
    label,
    description,
    requirements,
    rewards: [
      { kind: 'GRANT_UNLOCK', targetId: id },
      { kind: 'SET_SECTOR_UNLOCKED', targetId: sectorId, value: 1 },
      { kind: 'SET_ACCESS_MANDATE', targetId: sectorId, mandateState: 'COMPLETED' },
    ],
  };
}

function breachGradeUnlock(
  id: ProgressionUnlockId,
  grade: BreachGradeId,
  label: string,
  description: string,
  requirements: readonly ProgressionRequirement[],
): ProgressionUnlockDefinition {
  return {
    id,
    category: 'BREACH_GRADE',
    label,
    description,
    requirements,
    rewards: [
      { kind: 'GRANT_UNLOCK', targetId: id },
      { kind: 'ADD_BREACH_GRADE', targetId: grade },
    ],
  };
}

/**
 * Static unlock catalog.
 * Runner Clearance grants are applied live by `runnerClearanceEngine` (Phase 1B).
 * Sector mandate / route-intel gameplay is live in Phase 1C.
 * Breach Grade selector / scaling is live in Phase 1D (I–III playable).
 * Pinned goals (1–3) are live in Phase 1E.
 * Class rank / Cabal rep reward hooks are live in Phase 1F.
 * Recipe visibility (Known / Rumored / Unknown) is live in Phase 1G.
 * Debrief progression theater (celebrate / pin-from-debrief / always-exit) is live in Phase 1H.
 * Failure recovery (pity boost@2 / guarantee@3) is live in Phase 1I.
 * Progression economy simulation / pacing audits are live in Phase 1J.
 */
export const PROGRESSION_UNLOCK_REGISTRY: Record<ProgressionUnlockId, ProgressionUnlockDefinition> = {
  'sector.null_zone': sectorUnlock(
    'sector.null_zone',
    'Null Zone Access',
    'Starter breach — urban fundamentals.',
    [{ kind: 'ALWAYS' }],
  ),
  'sector.abyssal_sink': sectorUnlock(
    'sector.abyssal_sink',
    'Abyssal Sink Access',
    'Unlock via Overgrowth Coordinate extraction.',
    [
      { kind: 'SECTOR_UNLOCKED', targetId: 'THE_NULL_ZONE' },
      { kind: 'FLAG', targetId: 'flag.sector_access_mandates' },
    ],
  ),
  'sector.ashen_waste': sectorUnlock(
    'sector.ashen_waste',
    'Ashen Wastes Access',
    'Unlock via False-Road Signal extraction.',
    [
      { kind: 'SECTOR_UNLOCKED', targetId: 'THE_NULL_ZONE' },
      { kind: 'RUNNER_CLEARANCE_MIN', minValue: 2 },
    ],
  ),
  'sector.slag_works': sectorUnlock(
    'sector.slag_works',
    'Slag Works Access',
    'Unlock via Transit Cipher extraction.',
    [
      { kind: 'SECTOR_UNLOCKED', targetId: 'THE_ASHEN_WASTES' },
      { kind: 'BREACH_GRADE_UNLOCKED', targetId: 'II' },
    ],
  ),
  'sector.blackline_terminus': sectorUnlock(
    'sector.blackline_terminus',
    'Blackline Terminus Access',
    'Unlock via Blackline Credentials extraction.',
    [
      { kind: 'RUNNER_CLEARANCE_MIN', minValue: 6 },
      { kind: 'BREACH_GRADE_UNLOCKED', targetId: 'III' },
    ],
  ),
  'breach_grade.I': breachGradeUnlock(
    'breach_grade.I',
    'I',
    'Breach Grade I — Edge',
    'Starter difficulty.',
    [{ kind: 'ALWAYS' }],
  ),
  'breach_grade.II': breachGradeUnlock(
    'breach_grade.II',
    'II',
    'Breach Grade II — Pressurized',
    'Unlocks at Runner Clearance 3 — selectable on Veil Front.',
    [{ kind: 'RUNNER_CLEARANCE_MIN', minValue: 3 }],
  ),
  'breach_grade.III': breachGradeUnlock(
    'breach_grade.III',
    'III',
    'Breach Grade III — Hostile',
    'Unlocks at Runner Clearance 5 — selectable on Veil Front.',
    [{ kind: 'RUNNER_CLEARANCE_MIN', minValue: 5 }],
  ),
  'breach_grade.IV': breachGradeUnlock(
    'breach_grade.IV',
    'IV',
    'Breach Grade IV — Condemned',
    'Late-game grade (catalog only — not selectable yet).',
    [{ kind: 'RUNNER_CLEARANCE_MIN', minValue: 7 }],
  ),
  'breach_grade.V': breachGradeUnlock(
    'breach_grade.V',
    'V',
    'Breach Grade V — Black',
    'Optional endgame challenge grade.',
    [{ kind: 'RUNNER_CLEARANCE_MIN', minValue: 9 }],
  ),
  'runner.clearance.2': {
    id: 'runner.clearance.2',
    category: 'RUNNER_CLEARANCE',
    label: 'Runner Clearance 2',
    description: 'Sector access mandates begin (Abyssal / Ashen).',
    requirements: [{ kind: 'RUNNER_CLEARANCE_MIN', minValue: 2 }],
    rewards: [
      { kind: 'GRANT_UNLOCK', targetId: 'runner.clearance.2' },
      { kind: 'SET_RUNNER_CLEARANCE', value: 2 },
      { kind: 'ADD_FLAG', targetId: 'flag.sector_access_mandates' },
    ],
  },
  'runner.clearance.3': {
    id: 'runner.clearance.3',
    category: 'RUNNER_CLEARANCE',
    label: 'Runner Clearance 3',
    description: 'Breach Grade II eligibility + third pinned goal slot.',
    requirements: [{ kind: 'RUNNER_CLEARANCE_MIN', minValue: 3 }],
    rewards: [
      { kind: 'GRANT_UNLOCK', targetId: 'runner.clearance.3' },
      { kind: 'SET_RUNNER_CLEARANCE', value: 3 },
      { kind: 'ADD_BREACH_GRADE', targetId: 'II' },
      { kind: 'GRANT_UNLOCK', targetId: 'breach_grade.II' },
      { kind: 'ADD_FLAG', targetId: 'flag.pinned_goals_slot_3' },
    ],
  },
  'runner.clearance.4': {
    id: 'runner.clearance.4',
    category: 'RUNNER_CLEARANCE',
    label: 'Runner Clearance 4',
    description: 'Advanced forge recipes visible.',
    requirements: [{ kind: 'RUNNER_CLEARANCE_MIN', minValue: 4 }],
    rewards: [
      { kind: 'GRANT_UNLOCK', targetId: 'runner.clearance.4' },
      { kind: 'SET_RUNNER_CLEARANCE', value: 4 },
      { kind: 'ADD_FLAG', targetId: 'flag.advanced_forge_visible' },
    ],
  },
  'runner.clearance.5': {
    id: 'runner.clearance.5',
    category: 'RUNNER_CLEARANCE',
    label: 'Runner Clearance 5',
    description: 'Breach Grade III eligibility.',
    requirements: [{ kind: 'RUNNER_CLEARANCE_MIN', minValue: 5 }],
    rewards: [
      { kind: 'GRANT_UNLOCK', targetId: 'runner.clearance.5' },
      { kind: 'SET_RUNNER_CLEARANCE', value: 5 },
      { kind: 'ADD_BREACH_GRADE', targetId: 'III' },
      { kind: 'GRANT_UNLOCK', targetId: 'breach_grade.III' },
    ],
  },
  'runner.clearance.6': {
    id: 'runner.clearance.6',
    category: 'RUNNER_CLEARANCE',
    label: 'Runner Clearance 6',
    description: 'Slag / Blackline access mandates available.',
    requirements: [{ kind: 'RUNNER_CLEARANCE_MIN', minValue: 6 }],
    rewards: [
      { kind: 'GRANT_UNLOCK', targetId: 'runner.clearance.6' },
      { kind: 'SET_RUNNER_CLEARANCE', value: 6 },
    ],
  },
  'flag.sector_access_mandates': {
    id: 'flag.sector_access_mandates',
    category: 'FLAG',
    label: 'Sector Access Mandates',
    description: 'Enables route-intel mandate tracking on Veil Front.',
    requirements: [{ kind: 'ALWAYS' }],
    rewards: [
      { kind: 'GRANT_UNLOCK', targetId: 'flag.sector_access_mandates' },
      { kind: 'ADD_FLAG', targetId: 'flag.sector_access_mandates' },
    ],
  },
  'flag.advanced_forge_visible': {
    id: 'flag.advanced_forge_visible',
    category: 'HUB_SYSTEM',
    label: 'Advanced Forge Visible',
    description: 'Shows rumored / advanced fabrication recipes.',
    requirements: [{ kind: 'RUNNER_CLEARANCE_MIN', minValue: 4 }],
    rewards: [
      { kind: 'GRANT_UNLOCK', targetId: 'flag.advanced_forge_visible' },
      { kind: 'ADD_FLAG', targetId: 'flag.advanced_forge_visible' },
    ],
  },
  'flag.pinned_goals_slot_3': {
    id: 'flag.pinned_goals_slot_3',
    category: 'HUB_SYSTEM',
    label: 'Third Pinned Goal Slot',
    description: 'Raises pinned goal capacity to 3.',
    requirements: [{ kind: 'RUNNER_CLEARANCE_MIN', minValue: 3 }],
    rewards: [
      { kind: 'GRANT_UNLOCK', targetId: 'flag.pinned_goals_slot_3' },
      { kind: 'ADD_FLAG', targetId: 'flag.pinned_goals_slot_3' },
    ],
  },
};

export const ALL_PROGRESSION_UNLOCK_IDS = Object.keys(
  PROGRESSION_UNLOCK_REGISTRY,
) as ProgressionUnlockId[];

export function getProgressionUnlockDefinition(
  unlockId: string,
): ProgressionUnlockDefinition | null {
  return PROGRESSION_UNLOCK_REGISTRY[unlockId as ProgressionUnlockId] ?? null;
}

export function sectorIdToUnlockId(sectorId: SectorId): ProgressionUnlockId | null {
  const entry = Object.entries(SECTOR_UNLOCK_TO_SECTOR_ID)
    .find(([, id]) => id === sectorId);
  return (entry?.[0] as ProgressionUnlockId | undefined) ?? null;
}

export function unlockIdToSectorId(unlockId: string): SectorId | null {
  return SECTOR_UNLOCK_TO_SECTOR_ID[unlockId] ?? null;
}

export function unlockIdToBreachGrade(unlockId: string): BreachGradeId | null {
  return BREACH_GRADE_UNLOCK_TO_GRADE[unlockId] ?? null;
}
