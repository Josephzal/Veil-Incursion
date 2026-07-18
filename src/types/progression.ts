import type { ClassType, FactionType } from './game';
import type { SectorId } from './worldState';

/** Selectable run difficulty — independent of sector access. */
export type BreachGradeId = 'I' | 'II' | 'III' | 'IV' | 'V';

export const ALL_BREACH_GRADES: readonly BreachGradeId[] = ['I', 'II', 'III', 'IV', 'V'] as const;

export const BREACH_GRADE_LABELS: Record<BreachGradeId, string> = {
  I: 'Edge',
  II: 'Pressurized',
  III: 'Hostile',
  IV: 'Condemned',
  V: 'Black',
};

/** Sector access mandate lifecycle (Phase 1C drives AVAILABLE → ACTIVE → COMPLETED). */
export type SectorAccessMandateState =
  | 'LOCKED'
  | 'AVAILABLE'
  | 'ACTIVE'
  | 'COMPLETED';

export interface SectorProgressionState {
  unlocked: boolean;
  masteryXp: number;
  masteryLevel: number;
  highestGradeCleared: BreachGradeId | null;
  accessMandateState: SectorAccessMandateState;
  /** Failed extract attempts while carrying route intel for this sector. */
  routeIntelFailCount: number;
}

export interface RunnerProgressionState {
  /** Global career track — Runner Clearance. */
  clearanceRank: number;
  clearanceXp: number;
  unlockedBreachGrades: readonly BreachGradeId[];
}

export interface ClassProgressionState {
  rank: number;
  xp: number;
  unlockedAbilities: readonly string[];
  unlockedWeapons: readonly string[];
  unlockedGraftLicenses: readonly string[];
  unlockedBoonPools: readonly string[];
}

export interface CabalProgressionState {
  repXp: number;
  repTier: number;
  unlockedSponsorPackages: readonly string[];
  unlockedContracts: readonly string[];
}

/** Goal stubs for Phase 1E — pin/unpin + progress evaluation live in pinnedGoalEngine. */
export type ProgressionGoalKind =
  | 'SECTOR_ACCESS'
  | 'RECIPE_UNLOCK'
  | 'CLASS_RANK'
  | 'CABAL_REP'
  | 'SECTOR_MASTERY'
  | 'BREACH_GRADE'
  | 'RUNNER_CLEARANCE';

export interface PinnedProgressionGoal {
  id: string;
  kind: ProgressionGoalKind;
  /** Opaque target key (sector id, recipe id, class id, etc.). */
  targetId: string;
  label: string;
  pinnedAtMs: number;
}

export type ProgressionUnlockCategory =
  | 'SECTOR'
  | 'BREACH_GRADE'
  | 'RUNNER_CLEARANCE'
  | 'CLASS'
  | 'CABAL'
  | 'RECIPE'
  | 'HUB_SYSTEM'
  | 'FLAG';

/**
 * Stable unlock identifiers. Phase 1A registers the catalog;
 * later phases grant them through play.
 */
export type ProgressionUnlockId =
  | 'sector.null_zone'
  | 'sector.abyssal_sink'
  | 'sector.ashen_waste'
  | 'sector.slag_works'
  | 'sector.blackline_terminus'
  | 'breach_grade.I'
  | 'breach_grade.II'
  | 'breach_grade.III'
  | 'breach_grade.IV'
  | 'breach_grade.V'
  | 'runner.clearance.2'
  | 'runner.clearance.3'
  | 'runner.clearance.4'
  | 'runner.clearance.5'
  | 'runner.clearance.6'
  | 'flag.sector_access_mandates'
  | 'flag.advanced_forge_visible'
  | 'flag.pinned_goals_slot_3';

export type ProgressionRequirementKind =
  | 'ALWAYS'
  | 'UNLOCK_OWNED'
  | 'SECTOR_UNLOCKED'
  | 'BREACH_GRADE_UNLOCKED'
  | 'RUNNER_CLEARANCE_MIN'
  | 'CLASS_RANK_MIN'
  | 'CABAL_REP_TIER_MIN'
  | 'SECTOR_MASTERY_MIN'
  | 'FLAG';

export interface ProgressionRequirement {
  kind: ProgressionRequirementKind;
  /** Required unlock / sector / class / cabal / flag id depending on kind. */
  targetId?: string;
  /** Numeric threshold for rank / tier / mastery / clearance. */
  minValue?: number;
}

export type ProgressionRewardKind =
  | 'GRANT_UNLOCK'
  | 'SET_SECTOR_UNLOCKED'
  | 'ADD_BREACH_GRADE'
  | 'SET_RUNNER_CLEARANCE'
  | 'ADD_RUNNER_XP'
  | 'ADD_CLASS_XP'
  | 'SET_CLASS_RANK'
  | 'ADD_CABAL_REP'
  | 'SET_CABAL_TIER'
  | 'SET_ACCESS_MANDATE'
  | 'ADD_FLAG';

export interface ProgressionReward {
  kind: ProgressionRewardKind;
  targetId?: string;
  value?: number;
  mandateState?: SectorAccessMandateState;
}

export type ProgressionEventKind =
  | 'UNLOCK_GRANTED'
  | 'REWARD_APPLIED'
  | 'REQUIREMENT_FAILED'
  | 'PROFILE_RESET'
  | 'DEBUG_GRANT';

export interface ProgressionEvent {
  id: string;
  atMs: number;
  kind: ProgressionEventKind;
  message: string;
  unlockId?: ProgressionUnlockId | string;
  meta?: Record<string, string | number | boolean>;
}

export interface ProgressionProfile {
  schemaVersion: 1;
  runner: RunnerProgressionState;
  sectors: Record<SectorId, SectorProgressionState>;
  classes: Record<ClassType, ClassProgressionState>;
  cabals: Record<FactionType, CabalProgressionState>;
  /** Granted unlock ids (string-stable). */
  grantedUnlocks: readonly string[];
  /** Free-form flags for hub systems / UI gates. */
  flags: readonly string[];
  pinnedGoals: readonly PinnedProgressionGoal[];
  eventLog: readonly ProgressionEvent[];
}

/** Optional live run facts for requirement checks (unused in 1A gameplay). */
export interface ProgressionEvaluationContext {
  extractedResourceIds?: readonly string[];
  depthReached?: number;
  breachGrade?: BreachGradeId;
  sectorId?: SectorId;
  bossDefeated?: boolean;
  successfulExtraction?: boolean;
}
