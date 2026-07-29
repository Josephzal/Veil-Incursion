import type { ClassType, FactionType } from '../types/game';
import type { SectorId } from '../types/worldState';
import { ALL_SECTOR_IDS } from './sectorBiomeBridge';
import type {
  BreachGradeId,
  CabalProgressionState,
  ClassProgressionState,
  ProgressionEvent,
  ProgressionProfile,
  RunnerProgressionState,
  SectorAccessMandateState,
  SectorProgressionState,
} from '../types/progression';
import { CLASS_RANK_MAX } from './classRankEngine';

export const PROGRESSION_SCHEMA_VERSION = 1 as const;
export const PROGRESSION_EVENT_LOG_CAP = 80;

const CLASS_IDS: readonly ClassType[] = ['AEGIS', 'HEX_SHOT', 'ENVOY'];
const CABAL_IDS: readonly FactionType[] = ['TERRAN_GRID', 'LEGION', 'SOLARIS'];

export function createDefaultSectorProgression(
  sectorId: SectorId,
): SectorProgressionState {
  const isNullZone = sectorId === 'THE_NULL_ZONE';
  return {
    unlocked: isNullZone,
    masteryXp: 0,
    masteryLevel: 0,
    highestGradeCleared: isNullZone ? 'I' : null,
    accessMandateState: isNullZone ? 'COMPLETED' : 'LOCKED',
    routeIntelFailCount: 0,
  };
}

export function createDefaultClassProgression(): ClassProgressionState {
  return {
    rank: 1,
    xp: 0,
    unlockedAbilities: [],
    unlockedWeapons: [],
    unlockedGraftLicenses: [],
    unlockedBoonPools: [],
  };
}

export function createDefaultCabalProgression(): CabalProgressionState {
  return {
    repXp: 0,
    repTier: 0,
    unlockedSponsorPackages: [],
    unlockedContracts: [],
  };
}

export function createDefaultRunnerProgression(): RunnerProgressionState {
  return {
    clearanceRank: 1,
    clearanceXp: 0,
    unlockedBreachGrades: ['I'],
  };
}

export function createDefaultProgressionProfile(): ProgressionProfile {
  const sectors = {} as Record<SectorId, SectorProgressionState>;
  ALL_SECTOR_IDS.forEach((sectorId) => {
    sectors[sectorId] = createDefaultSectorProgression(sectorId);
  });

  const classes = {} as Record<ClassType, ClassProgressionState>;
  CLASS_IDS.forEach((classId) => {
    classes[classId] = createDefaultClassProgression();
  });

  const cabals = {} as Record<FactionType, CabalProgressionState>;
  CABAL_IDS.forEach((cabalId) => {
    cabals[cabalId] = createDefaultCabalProgression();
  });

  return {
    schemaVersion: PROGRESSION_SCHEMA_VERSION,
    runner: createDefaultRunnerProgression(),
    sectors,
    classes,
    cabals,
    grantedUnlocks: [
      'sector.null_zone',
      'breach_grade.I',
    ],
    flags: [],
    pinnedGoals: [],
    eventLog: [],
  };
}

function normalizeBreachGrades(raw: unknown): BreachGradeId[] {
  const allowed = new Set(['I', 'II', 'III', 'IV', 'V']);
  if (!Array.isArray(raw)) return ['I'];
  const next = raw.filter((g): g is BreachGradeId => typeof g === 'string' && allowed.has(g));
  return next.includes('I') ? [...new Set(next)] : ['I', ...new Set(next)];
}

function normalizeMandateState(raw: unknown): SectorAccessMandateState {
  if (
    raw === 'LOCKED'
    || raw === 'AVAILABLE'
    || raw === 'ACTIVE'
    || raw === 'COMPLETED'
  ) {
    return raw;
  }
  return 'LOCKED';
}

function normalizeSectorState(
  sectorId: SectorId,
  raw: Partial<SectorProgressionState> | undefined,
): SectorProgressionState {
  const defaults = createDefaultSectorProgression(sectorId);
  if (!raw) return defaults;
  return {
    unlocked: raw.unlocked ?? defaults.unlocked,
    masteryXp: Math.max(0, Math.floor(raw.masteryXp ?? defaults.masteryXp)),
    masteryLevel: Math.max(0, Math.min(5, Math.floor(raw.masteryLevel ?? defaults.masteryLevel))),
    highestGradeCleared: raw.highestGradeCleared ?? defaults.highestGradeCleared,
    accessMandateState: normalizeMandateState(raw.accessMandateState ?? defaults.accessMandateState),
    routeIntelFailCount: Math.max(0, Math.floor(raw.routeIntelFailCount ?? 0)),
  };
}

function normalizeClassState(
  raw: Partial<ClassProgressionState> | undefined,
): ClassProgressionState {
  const defaults = createDefaultClassProgression();
  if (!raw) return defaults;
  return {
    rank: Math.max(1, Math.min(CLASS_RANK_MAX, Math.floor(raw.rank ?? defaults.rank))),
    xp: Math.max(0, Math.floor(raw.xp ?? defaults.xp)),
    unlockedAbilities: [...(raw.unlockedAbilities ?? [])],
    unlockedWeapons: [...(raw.unlockedWeapons ?? [])],
    unlockedGraftLicenses: [...(raw.unlockedGraftLicenses ?? [])],
    unlockedBoonPools: [...(raw.unlockedBoonPools ?? [])],
  };
}

function normalizeCabalState(
  raw: Partial<CabalProgressionState> | undefined,
): CabalProgressionState {
  const defaults = createDefaultCabalProgression();
  if (!raw) return defaults;
  return {
    repXp: Math.max(0, Math.floor(raw.repXp ?? defaults.repXp)),
    repTier: Math.max(0, Math.min(5, Math.floor(raw.repTier ?? defaults.repTier))),
    unlockedSponsorPackages: [...(raw.unlockedSponsorPackages ?? [])],
    unlockedContracts: [...(raw.unlockedContracts ?? [])],
  };
}

function normalizeEventLog(raw: unknown): ProgressionEvent[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((entry): entry is ProgressionEvent => (
      entry != null
      && typeof entry === 'object'
      && typeof (entry as ProgressionEvent).id === 'string'
      && typeof (entry as ProgressionEvent).message === 'string'
    ))
    .slice(-PROGRESSION_EVENT_LOG_CAP);
}

/** Merge persisted / partial profile into a complete ProgressionProfile. */
export function normalizeProgressionProfile(
  raw: Partial<ProgressionProfile> | null | undefined,
): ProgressionProfile {
  const defaults = createDefaultProgressionProfile();
  if (!raw || typeof raw !== 'object') return defaults;

  const sectors = {} as Record<SectorId, SectorProgressionState>;
  ALL_SECTOR_IDS.forEach((sectorId) => {
    sectors[sectorId] = normalizeSectorState(sectorId, raw.sectors?.[sectorId]);
  });

  const classes = {} as Record<ClassType, ClassProgressionState>;
  CLASS_IDS.forEach((classId) => {
    classes[classId] = normalizeClassState(raw.classes?.[classId]);
  });

  const cabals = {} as Record<FactionType, CabalProgressionState>;
  CABAL_IDS.forEach((cabalId) => {
    cabals[cabalId] = normalizeCabalState(raw.cabals?.[cabalId]);
  });

  const grantedUnlocks = Array.isArray(raw.grantedUnlocks)
    ? [...new Set(raw.grantedUnlocks.filter((id): id is string => typeof id === 'string'))]
    : [...defaults.grantedUnlocks];

  // Ensure starter unlocks always present after migrate.
  if (!grantedUnlocks.includes('sector.null_zone')) grantedUnlocks.push('sector.null_zone');
  if (!grantedUnlocks.includes('breach_grade.I')) grantedUnlocks.push('breach_grade.I');

  return {
    schemaVersion: PROGRESSION_SCHEMA_VERSION,
    runner: {
      clearanceRank: Math.max(1, Math.floor(raw.runner?.clearanceRank ?? defaults.runner.clearanceRank)),
      clearanceXp: Math.max(0, Math.floor(raw.runner?.clearanceXp ?? defaults.runner.clearanceXp)),
      unlockedBreachGrades: normalizeBreachGrades(raw.runner?.unlockedBreachGrades),
    },
    sectors,
    classes,
    cabals,
    grantedUnlocks,
    flags: Array.isArray(raw.flags)
      ? [...new Set(raw.flags.filter((id): id is string => typeof id === 'string'))]
      : [],
    pinnedGoals: Array.isArray(raw.pinnedGoals)
      ? raw.pinnedGoals
        .filter((entry): entry is import('../types/progression').PinnedProgressionGoal => (
          entry != null
          && typeof entry === 'object'
          && typeof (entry as { id?: unknown }).id === 'string'
          && typeof (entry as { kind?: unknown }).kind === 'string'
          && typeof (entry as { targetId?: unknown }).targetId === 'string'
        ))
        .map((entry) => ({
          id: entry.id,
          kind: entry.kind,
          targetId: entry.targetId,
          label: typeof entry.label === 'string' ? entry.label : entry.id,
          pinnedAtMs: typeof entry.pinnedAtMs === 'number' ? entry.pinnedAtMs : 0,
        }))
        .slice(0, 3)
      : [],
    eventLog: normalizeEventLog(raw.eventLog),
  };
}

export function hasProgressionUnlock(
  profile: ProgressionProfile,
  unlockId: string,
): boolean {
  return profile.grantedUnlocks.includes(unlockId);
}

export function hasProgressionFlag(
  profile: ProgressionProfile,
  flagId: string,
): boolean {
  return profile.flags.includes(flagId);
}

export function isSectorUnlockedInProfile(
  profile: ProgressionProfile,
  sectorId: SectorId,
): boolean {
  return profile.sectors[sectorId]?.unlocked === true;
}

export function isBreachGradeUnlockedInProfile(
  profile: ProgressionProfile,
  grade: BreachGradeId,
): boolean {
  return profile.runner.unlockedBreachGrades.includes(grade);
}
