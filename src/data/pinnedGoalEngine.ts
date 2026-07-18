/**
 * Progression Spine Phase 1E — Pinned Goals.
 * Readable career targets on Veil Front + debrief progress cards.
 */
import type { ClassType, FactionType } from '../types/game';
import type {
  BreachGradeId,
  PinnedProgressionGoal,
  ProgressionGoalKind,
  ProgressionProfile,
} from '../types/progression';
import type { SectorId } from '../types/worldState';
import { BREACH_GRADE_LABELS } from '../types/progression';
import {
  hasProgressionFlag,
  hasProgressionUnlock,
  isBreachGradeUnlockedInProfile,
  isSectorUnlockedInProfile,
} from './progressionProfileEngine';
import { appendProgressionEvent } from './progressionEventLog';
import { clearanceXpProgress, xpRequiredForClearanceRank } from './runnerClearanceEngine';
import {
  getMandateForRouteIntel,
  getSectorAccessMandate,
  SECTOR_ACCESS_MANDATES,
} from './sectorAccessMandateEngine';
import { veilBiomeDisplayName, sectorIdToVeilBiome } from './sectorBiomeBridge';
import { getResourceDisplayName } from './resourceRegistry';
import { getCraftingRecipe } from './craftingRegistry';
import { formatBreachGradeLabel, breachGradeRank } from './breachGradeEngine';
import { sponsorDisplayName } from '../utils/contractUi';

export const DEFAULT_PINNED_GOAL_SLOTS = 2;
export const MAX_PINNED_GOAL_SLOTS = 3;

export interface ProgressionGoalDefinition {
  id: string;
  kind: ProgressionGoalKind;
  targetId: string;
  label: string;
  summary: string;
  recommendedSectorId: SectorId | null;
  recommendedGrade: BreachGradeId | null;
  recommendedSponsorId: FactionType | null;
}

export interface PinnedGoalStatus {
  pinned: PinnedProgressionGoal;
  definition: ProgressionGoalDefinition;
  completed: boolean;
  progressCurrent: number;
  progressRequired: number;
  progressPercent: number;
  progressLabel: string;
  missingRequirements: string[];
  recommendedSectorId: SectorId | null;
  recommendedGrade: BreachGradeId | null;
  recommendedSponsorId: FactionType | null;
  lines: string[];
}

export interface PinGoalResult {
  profile: ProgressionProfile;
  ok: boolean;
  logLine: string;
}

export interface UnpinGoalResult {
  profile: ProgressionProfile;
  ok: boolean;
  logLine: string;
}

export interface SyncPinnedGoalsResult {
  profile: ProgressionProfile;
  statuses: PinnedGoalStatus[];
  completed: PinnedGoalStatus[];
  logLines: string[];
}

function goalId(
  kind: ProgressionGoalKind,
  targetId: string,
): string {
  return `${kind}:${targetId}`;
}

function sectorName(sectorId: SectorId): string {
  return veilBiomeDisplayName(sectorIdToVeilBiome(sectorId));
}

/** Static catalog of pin-able goals for Phase 1E. */
export const PROGRESSION_GOAL_CATALOG: readonly ProgressionGoalDefinition[] = [
  ...SECTOR_ACCESS_MANDATES.map((mandate) => ({
    id: goalId('SECTOR_ACCESS', mandate.targetSectorId),
    kind: 'SECTOR_ACCESS' as const,
    targetId: mandate.targetSectorId,
    label: `Unlock ${sectorName(mandate.targetSectorId)}`,
    summary: mandate.summary,
    recommendedSectorId: mandate.sourceSectorIds[0] ?? 'THE_NULL_ZONE',
    recommendedGrade: 'I' as BreachGradeId,
    recommendedSponsorId: null,
  })),
  {
    id: goalId('BREACH_GRADE', 'II'),
    kind: 'BREACH_GRADE',
    targetId: 'II',
    label: 'Unlock Breach Grade II',
    summary: 'Reach Runner Clearance 3 to unlock Pressurized breaches.',
    recommendedSectorId: 'THE_NULL_ZONE',
    recommendedGrade: 'I',
    recommendedSponsorId: null,
  },
  {
    id: goalId('BREACH_GRADE', 'III'),
    kind: 'BREACH_GRADE',
    targetId: 'III',
    label: 'Unlock Breach Grade III',
    summary: 'Reach Runner Clearance 5 to unlock Hostile breaches.',
    recommendedSectorId: 'THE_NULL_ZONE',
    recommendedGrade: 'II',
    recommendedSponsorId: null,
  },
  {
    id: goalId('RUNNER_CLEARANCE', '3'),
    kind: 'RUNNER_CLEARANCE',
    targetId: '3',
    label: 'Reach Runner Clearance 3',
    summary: 'Extract successfully to earn Clearance XP.',
    recommendedSectorId: 'THE_NULL_ZONE',
    recommendedGrade: 'I',
    recommendedSponsorId: null,
  },
  {
    id: goalId('RUNNER_CLEARANCE', '5'),
    kind: 'RUNNER_CLEARANCE',
    targetId: '5',
    label: 'Reach Runner Clearance 5',
    summary: 'Mid-campaign Clearance — unlocks Grade III.',
    recommendedSectorId: 'THE_NULL_ZONE',
    recommendedGrade: 'II',
    recommendedSponsorId: null,
  },
  {
    id: goalId('SECTOR_MASTERY', 'THE_NULL_ZONE'),
    kind: 'SECTOR_MASTERY',
    targetId: 'THE_NULL_ZONE',
    label: 'Null Zone Mastery I',
    summary: 'Clear higher Breach Grades in Null Zone to build mastery.',
    recommendedSectorId: 'THE_NULL_ZONE',
    recommendedGrade: 'II',
    recommendedSponsorId: null,
  },
  {
    id: goalId('CLASS_RANK', 'AEGIS:2'),
    kind: 'CLASS_RANK',
    targetId: 'AEGIS:2',
    label: 'Aegis Rank 2',
    summary: 'Earn class XP on Aegis runs to raise class rank.',
    recommendedSectorId: 'THE_NULL_ZONE',
    recommendedGrade: 'I',
    recommendedSponsorId: null,
  },
  {
    id: goalId('CLASS_RANK', 'HEX_SHOT:2'),
    kind: 'CLASS_RANK',
    targetId: 'HEX_SHOT:2',
    label: 'Hex Shot Rank 2',
    summary: 'Earn class XP on Hex Shot runs to raise class rank.',
    recommendedSectorId: 'THE_NULL_ZONE',
    recommendedGrade: 'I',
    recommendedSponsorId: null,
  },
  {
    id: goalId('CLASS_RANK', 'ENVOY:2'),
    kind: 'CLASS_RANK',
    targetId: 'ENVOY:2',
    label: 'Envoy Rank 2',
    summary: 'Earn class XP on Envoy runs to raise class rank.',
    recommendedSectorId: 'THE_NULL_ZONE',
    recommendedGrade: 'I',
    recommendedSponsorId: null,
  },
  {
    id: goalId('CABAL_REP', 'TERRAN_GRID:1'),
    kind: 'CABAL_REP',
    targetId: 'TERRAN_GRID:1',
    label: 'Terran Grid Tier 1',
    summary: 'Complete Terran Grid contracts to raise cabal standing.',
    recommendedSectorId: 'THE_NULL_ZONE',
    recommendedGrade: 'I',
    recommendedSponsorId: 'TERRAN_GRID',
  },
  {
    id: goalId('CABAL_REP', 'LEGION:1'),
    kind: 'CABAL_REP',
    targetId: 'LEGION:1',
    label: 'Legion Tier 1',
    summary: 'Complete Legion contracts to raise cabal standing.',
    recommendedSectorId: 'THE_NULL_ZONE',
    recommendedGrade: 'I',
    recommendedSponsorId: 'LEGION',
  },
  {
    id: goalId('CABAL_REP', 'SOLARIS:1'),
    kind: 'CABAL_REP',
    targetId: 'SOLARIS:1',
    label: 'Solaris Tier 1',
    summary: 'Complete Solaris contracts to raise cabal standing.',
    recommendedSectorId: 'THE_NULL_ZONE',
    recommendedGrade: 'I',
    recommendedSponsorId: 'SOLARIS',
  },
  {
    id: goalId('RECIPE_UNLOCK', 'trauma-patch'),
    kind: 'RECIPE_UNLOCK',
    targetId: 'trauma-patch',
    label: 'Learn Trauma Patch Recipe',
    summary: 'Secure Mycelial Ichor and unlock basic field medicine crafting.',
    recommendedSectorId: 'THE_ABYSSAL_SINK',
    recommendedGrade: 'I',
    recommendedSponsorId: null,
  },
  {
    id: goalId('RECIPE_UNLOCK', 'spall-weave-vest'),
    kind: 'RECIPE_UNLOCK',
    targetId: 'spall-weave-vest',
    label: 'Learn Spall-Weave Recipe',
    summary: 'Gather Nullcrete from urban sectors for defensive craft.',
    recommendedSectorId: 'THE_NULL_ZONE',
    recommendedGrade: 'I',
    recommendedSponsorId: null,
  },
];

export function getProgressionGoalDefinition(
  goalDefId: string,
): ProgressionGoalDefinition | null {
  return PROGRESSION_GOAL_CATALOG.find((g) => g.id === goalDefId) ?? null;
}

export function maxPinnedGoalSlots(profile: ProgressionProfile): number {
  return hasProgressionFlag(profile, 'flag.pinned_goals_slot_3')
    || hasProgressionUnlock(profile, 'flag.pinned_goals_slot_3')
    ? MAX_PINNED_GOAL_SLOTS
    : DEFAULT_PINNED_GOAL_SLOTS;
}

function evaluateSectorAccess(
  profile: ProgressionProfile,
  def: ProgressionGoalDefinition,
): Omit<PinnedGoalStatus, 'pinned' | 'definition' | 'lines'> {
  const sectorId = def.targetId as SectorId;
  const unlocked = isSectorUnlockedInProfile(profile, sectorId);
  const sector = profile.sectors[sectorId];
  const mandate = getSectorAccessMandate(sectorId);
  const missing: string[] = [];
  if (!unlocked) {
    if (mandate) {
      missing.push(`Extract ${getResourceDisplayName(mandate.routeIntelId)}`);
      if (sector?.accessMandateState === 'LOCKED') {
        missing.push(`Clearance ${mandate.minClearance}+ to unlock mandate`);
      } else if (sector?.accessMandateState === 'AVAILABLE') {
        missing.push('Accept the Access Mandate on Veil Front');
      } else if (sector?.accessMandateState === 'ACTIVE') {
        missing.push('Survive extraction with route intel in cargo');
      }
    } else {
      missing.push('Sector unlock path unknown');
    }
  }
  return {
    completed: unlocked,
    progressCurrent: unlocked ? 1 : 0,
    progressRequired: 1,
    progressPercent: unlocked ? 100 : 0,
    progressLabel: unlocked ? 'UNLOCKED' : (sector?.accessMandateState ?? 'LOCKED'),
    missingRequirements: missing,
    recommendedSectorId: def.recommendedSectorId,
    recommendedGrade: def.recommendedGrade,
    recommendedSponsorId: def.recommendedSponsorId,
  };
}

function evaluateBreachGrade(
  profile: ProgressionProfile,
  def: ProgressionGoalDefinition,
): Omit<PinnedGoalStatus, 'pinned' | 'definition' | 'lines'> {
  const grade = def.targetId as BreachGradeId;
  const unlocked = isBreachGradeUnlockedInProfile(profile, grade);
  const clearanceNeeded = grade === 'III' ? 5 : grade === 'II' ? 3 : 1;
  const missing: string[] = [];
  if (!unlocked) {
    missing.push(`Reach Runner Clearance ${clearanceNeeded}`);
    if (profile.runner.clearanceRank < clearanceNeeded) {
      const xp = clearanceXpProgress(profile);
      missing.push(`Clearance XP ${xp.current}/${xp.required} toward next rank`);
    }
  }
  return {
    completed: unlocked,
    progressCurrent: unlocked ? 1 : 0,
    progressRequired: 1,
    progressPercent: unlocked ? 100 : Math.min(99, Math.floor((profile.runner.clearanceRank / clearanceNeeded) * 100)),
    progressLabel: unlocked
      ? `GRADE ${grade} UNLOCKED`
      : `CLR ${profile.runner.clearanceRank}/${clearanceNeeded}`,
    missingRequirements: missing,
    recommendedSectorId: def.recommendedSectorId,
    recommendedGrade: def.recommendedGrade,
    recommendedSponsorId: def.recommendedSponsorId,
  };
}

function evaluateRunnerClearance(
  profile: ProgressionProfile,
  def: ProgressionGoalDefinition,
): Omit<PinnedGoalStatus, 'pinned' | 'definition' | 'lines'> {
  const targetRank = Math.max(1, Math.floor(Number(def.targetId) || 1));
  const currentRank = profile.runner.clearanceRank;
  const completed = currentRank >= targetRank;
  const xp = clearanceXpProgress(profile);
  // Approximate progress across ranks as fractional.
  let progressCurrent = 0;
  for (let r = 1; r < targetRank; r += 1) {
    if (currentRank > r) {
      progressCurrent += xpRequiredForClearanceRank(r);
    } else if (currentRank === r) {
      progressCurrent += xp.current;
    }
  }
  let progressRequired = 0;
  for (let r = 1; r < targetRank; r += 1) {
    progressRequired += xpRequiredForClearanceRank(r);
  }
  if (progressRequired <= 0) progressRequired = 1;
  const missing: string[] = [];
  if (!completed) {
    missing.push(`Need Clearance ${targetRank} (currently ${currentRank})`);
    missing.push(`Extract runs for Clearance XP (${xp.current}/${xp.required} this rank)`);
  }
  return {
    completed,
    progressCurrent: completed ? progressRequired : progressCurrent,
    progressRequired,
    progressPercent: completed
      ? 100
      : Math.min(99, Math.floor((progressCurrent / progressRequired) * 100)),
    progressLabel: completed
      ? `CLEARANCE ${targetRank}`
      : `CLR ${currentRank} → ${targetRank}`,
    missingRequirements: missing,
    recommendedSectorId: def.recommendedSectorId,
    recommendedGrade: def.recommendedGrade,
    recommendedSponsorId: def.recommendedSponsorId,
  };
}

function evaluateSectorMastery(
  profile: ProgressionProfile,
  def: ProgressionGoalDefinition,
): Omit<PinnedGoalStatus, 'pinned' | 'definition' | 'lines'> {
  const sectorId = def.targetId as SectorId;
  const sector = profile.sectors[sectorId];
  const targetLevel = 1;
  const level = sector?.masteryLevel ?? 0;
  const xp = sector?.masteryXp ?? 0;
  const completed = level >= targetLevel;
  const missing: string[] = [];
  if (!completed) {
    missing.push(`Raise ${sectorName(sectorId)} mastery to ${targetLevel}`);
    if (sector?.highestGradeCleared) {
      missing.push(`Highest cleared: Grade ${sector.highestGradeCleared}`);
    } else {
      missing.push('Clear a Breach Grade extract in this sector');
    }
  }
  // Treat grade clear as interim progress until mastery XP pipeline (later).
  const gradeProgress = sector?.highestGradeCleared
    ? breachGradeRank(sector.highestGradeCleared)
    : 0;
  return {
    completed,
    progressCurrent: completed ? targetLevel : Math.min(targetLevel - 0.01, level + gradeProgress * 0.25),
    progressRequired: targetLevel,
    progressPercent: completed ? 100 : Math.min(90, Math.floor(gradeProgress * 30 + xp)),
    progressLabel: completed
      ? `MASTERY ${level}`
      : `MASTERY ${level}/${targetLevel} // XP ${xp}`,
    missingRequirements: missing,
    recommendedSectorId: def.recommendedSectorId ?? sectorId,
    recommendedGrade: def.recommendedGrade,
    recommendedSponsorId: def.recommendedSponsorId,
  };
}

function evaluateClassRank(
  profile: ProgressionProfile,
  def: ProgressionGoalDefinition,
): Omit<PinnedGoalStatus, 'pinned' | 'definition' | 'lines'> {
  const [classIdRaw, rankRaw] = def.targetId.split(':');
  const classId = (classIdRaw ?? 'AEGIS') as ClassType;
  const targetRank = Math.max(2, Math.floor(Number(rankRaw) || 2));
  const entry = profile.classes[classId];
  const current = entry?.rank ?? 1;
  const completed = current >= targetRank;
  const missing: string[] = [];
  if (!completed) {
    missing.push(`${classId.replace(/_/g, ' ')} Rank ${current} → ${targetRank}`);
    missing.push('Deploy as this class and extract for Class XP');
  }
  return {
    completed,
    progressCurrent: Math.min(current, targetRank),
    progressRequired: targetRank,
    progressPercent: Math.min(100, Math.floor((current / targetRank) * 100)),
    progressLabel: `RANK ${current}/${targetRank}`,
    missingRequirements: missing,
    recommendedSectorId: def.recommendedSectorId,
    recommendedGrade: def.recommendedGrade,
    recommendedSponsorId: def.recommendedSponsorId,
  };
}

function evaluateCabalRep(
  profile: ProgressionProfile,
  def: ProgressionGoalDefinition,
): Omit<PinnedGoalStatus, 'pinned' | 'definition' | 'lines'> {
  const [cabalRaw, tierRaw] = def.targetId.split(':');
  const cabalId = (cabalRaw ?? 'TERRAN_GRID') as FactionType;
  const targetTier = Math.max(1, Math.floor(Number(tierRaw) || 1));
  const entry = profile.cabals[cabalId];
  const current = entry?.repTier ?? 0;
  const completed = current >= targetTier;
  const missing: string[] = [];
  if (!completed) {
    missing.push(`${sponsorDisplayName(cabalId)} Tier ${current} → ${targetTier}`);
    missing.push('Complete sponsored contracts for Cabal Rep');
  }
  return {
    completed,
    progressCurrent: Math.min(current, targetTier),
    progressRequired: targetTier,
    progressPercent: Math.min(100, Math.floor((current / targetTier) * 100)),
    progressLabel: `TIER ${current}/${targetTier}`,
    missingRequirements: missing,
    recommendedSectorId: def.recommendedSectorId,
    recommendedGrade: def.recommendedGrade,
    recommendedSponsorId: (def.recommendedSponsorId ?? cabalId) as FactionType,
  };
}

function evaluateRecipeUnlock(
  profile: ProgressionProfile,
  def: ProgressionGoalDefinition,
): Omit<PinnedGoalStatus, 'pinned' | 'definition' | 'lines'> {
  const recipeId = def.targetId;
  const unlockId = `recipe.${recipeId}`;
  const unlocked = hasProgressionUnlock(profile, unlockId)
    || hasProgressionFlag(profile, unlockId);
  const recipe = getCraftingRecipe(`craft_${recipeId.replace(/-/g, '_')}`)
    ?? getCraftingRecipe(recipeId);
  const missing: string[] = [];
  if (!unlocked) {
    missing.push(`Reveal schematic for ${recipe?.label ?? recipeId}`);
    missing.push('Collect all ingredient types in stash to learn costs');
    if (
      def.recommendedSectorId
      && !isSectorUnlockedInProfile(profile, def.recommendedSectorId)
      && def.recommendedSectorId !== 'THE_NULL_ZONE'
    ) {
      missing.push(`First unlock ${sectorName(def.recommendedSectorId)}`);
    }
  }
  const recommendSector = def.recommendedSectorId
    && isSectorUnlockedInProfile(profile, def.recommendedSectorId)
    ? def.recommendedSectorId
    : 'THE_NULL_ZONE';
  return {
    completed: unlocked,
    progressCurrent: unlocked ? 1 : 0,
    progressRequired: 1,
    progressPercent: unlocked ? 100 : 0,
    progressLabel: unlocked ? 'RECIPE KNOWN' : 'RUMORED / UNKNOWN',
    missingRequirements: missing,
    recommendedSectorId: recommendSector,
    recommendedGrade: def.recommendedGrade,
    recommendedSponsorId: def.recommendedSponsorId,
  };
}

function evaluateGoalCore(
  profile: ProgressionProfile,
  def: ProgressionGoalDefinition,
): Omit<PinnedGoalStatus, 'pinned' | 'definition' | 'lines'> {
  switch (def.kind) {
    case 'SECTOR_ACCESS':
      return evaluateSectorAccess(profile, def);
    case 'BREACH_GRADE':
      return evaluateBreachGrade(profile, def);
    case 'RUNNER_CLEARANCE':
      return evaluateRunnerClearance(profile, def);
    case 'SECTOR_MASTERY':
      return evaluateSectorMastery(profile, def);
    case 'CLASS_RANK':
      return evaluateClassRank(profile, def);
    case 'CABAL_REP':
      return evaluateCabalRep(profile, def);
    case 'RECIPE_UNLOCK':
      return evaluateRecipeUnlock(profile, def);
    default:
      return {
        completed: false,
        progressCurrent: 0,
        progressRequired: 1,
        progressPercent: 0,
        progressLabel: 'UNKNOWN',
        missingRequirements: ['Goal kind not implemented'],
        recommendedSectorId: def.recommendedSectorId,
        recommendedGrade: def.recommendedGrade,
        recommendedSponsorId: def.recommendedSponsorId,
      };
  }
}

function buildStatusLines(
  def: ProgressionGoalDefinition,
  core: Omit<PinnedGoalStatus, 'pinned' | 'definition' | 'lines'>,
): string[] {
  const lines = [
    def.label,
    core.progressLabel,
  ];
  if (core.missingRequirements[0]) {
    lines.push(core.missingRequirements[0]);
  }
  if (core.recommendedSectorId) {
    lines.push(`Recommend: ${sectorName(core.recommendedSectorId)}`);
  }
  if (core.recommendedGrade) {
    lines.push(`Grade: ${formatBreachGradeLabel(core.recommendedGrade, true)}`);
  }
  if (core.recommendedSponsorId) {
    lines.push(`Sponsor: ${sponsorDisplayName(core.recommendedSponsorId)}`);
  }
  return lines;
}

export function evaluatePinnedGoal(
  profile: ProgressionProfile,
  pinned: PinnedProgressionGoal,
): PinnedGoalStatus | null {
  const definition = getProgressionGoalDefinition(pinned.id)
    ?? {
      id: pinned.id,
      kind: pinned.kind,
      targetId: pinned.targetId,
      label: pinned.label,
      summary: pinned.label,
      recommendedSectorId: null,
      recommendedGrade: null,
      recommendedSponsorId: null,
    };
  const core = evaluateGoalCore(profile, definition);
  return {
    pinned,
    definition,
    ...core,
    lines: buildStatusLines(definition, core),
  };
}

export function evaluateAllPinnedGoals(
  profile: ProgressionProfile,
): PinnedGoalStatus[] {
  return profile.pinnedGoals
    .map((pinned) => evaluatePinnedGoal(profile, pinned))
    .filter((s): s is PinnedGoalStatus => s != null);
}

export function listAvailableGoalsToPin(
  profile: ProgressionProfile,
): ProgressionGoalDefinition[] {
  const pinnedIds = new Set(profile.pinnedGoals.map((g) => g.id));
  return PROGRESSION_GOAL_CATALOG.filter((def) => {
    if (pinnedIds.has(def.id)) return false;
    const core = evaluateGoalCore(profile, def);
    return !core.completed;
  });
}

export function pinProgressionGoal(
  profile: ProgressionProfile,
  goalDefId: string,
  nowMs = Date.now(),
): PinGoalResult {
  const def = getProgressionGoalDefinition(goalDefId);
  if (!def) {
    return { profile, ok: false, logLine: `>> PINNED GOAL — unknown goal ${goalDefId}` };
  }
  if (profile.pinnedGoals.some((g) => g.id === def.id)) {
    return { profile, ok: false, logLine: `>> PINNED GOAL — already pinned: ${def.label}` };
  }
  const slots = maxPinnedGoalSlots(profile);
  if (profile.pinnedGoals.length >= slots) {
    return {
      profile,
      ok: false,
      logLine: `>> PINNED GOAL — slots full (${profile.pinnedGoals.length}/${slots})`,
    };
  }
  const core = evaluateGoalCore(profile, def);
  if (core.completed) {
    return { profile, ok: false, logLine: `>> PINNED GOAL — already complete: ${def.label}` };
  }

  const pinned: PinnedProgressionGoal = {
    id: def.id,
    kind: def.kind,
    targetId: def.targetId,
    label: def.label,
    pinnedAtMs: nowMs,
  };
  let next: ProgressionProfile = {
    ...profile,
    pinnedGoals: [...profile.pinnedGoals, pinned],
  };
  next = appendProgressionEvent(next, {
    kind: 'REWARD_APPLIED',
    message: `Pinned goal: ${def.label}`,
    meta: { goalId: def.id },
  });
  return {
    profile: next,
    ok: true,
    logLine: `>> PINNED GOAL — ${def.label.toUpperCase()} (${next.pinnedGoals.length}/${slots})`,
  };
}

export function unpinProgressionGoal(
  profile: ProgressionProfile,
  goalDefId: string,
): UnpinGoalResult {
  if (!profile.pinnedGoals.some((g) => g.id === goalDefId)) {
    return { profile, ok: false, logLine: `>> PINNED GOAL — not pinned: ${goalDefId}` };
  }
  const removed = profile.pinnedGoals.find((g) => g.id === goalDefId);
  let next: ProgressionProfile = {
    ...profile,
    pinnedGoals: profile.pinnedGoals.filter((g) => g.id !== goalDefId),
  };
  next = appendProgressionEvent(next, {
    kind: 'REWARD_APPLIED',
    message: `Unpinned goal: ${removed?.label ?? goalDefId}`,
    meta: { goalId: goalDefId },
  });
  return {
    profile: next,
    ok: true,
    logLine: `>> PINNED GOAL — REMOVED ${ (removed?.label ?? goalDefId).toUpperCase() }`,
  };
}

/** After a run — refresh statuses and auto-clear completed pins. */
export function syncPinnedGoalsAfterRun(
  profile: ProgressionProfile,
): SyncPinnedGoalsResult {
  const statuses = evaluateAllPinnedGoals(profile);
  const completed = statuses.filter((s) => s.completed);
  if (completed.length === 0) {
    return { profile, statuses, completed: [], logLines: [] };
  }

  const completedIds = new Set(completed.map((s) => s.pinned.id));
  let next: ProgressionProfile = {
    ...profile,
    pinnedGoals: profile.pinnedGoals.filter((g) => !completedIds.has(g.id)),
  };
  const logLines: string[] = [];
  completed.forEach((status) => {
    next = appendProgressionEvent(next, {
      kind: 'UNLOCK_GRANTED',
      message: `Pinned goal completed: ${status.definition.label}`,
      meta: { goalId: status.definition.id },
    });
    logLines.push(
      `>> GOAL COMPLETE — ${status.definition.label.toUpperCase()}`,
    );
  });
  return {
    profile: next,
    statuses: evaluateAllPinnedGoals(next),
    completed,
    logLines,
  };
}

export function formatPinnedGoalBriefingLines(
  status: PinnedGoalStatus,
): string[] {
  const lines = [
    status.definition.label,
    `${status.progressPercent}% // ${status.progressLabel}`,
  ];
  if (status.missingRequirements[0]) {
    lines.push(status.missingRequirements[0]);
  }
  const rec: string[] = [];
  if (status.recommendedSectorId) {
    rec.push(sectorName(status.recommendedSectorId));
  }
  if (status.recommendedGrade) {
    rec.push(`Grade ${status.recommendedGrade} (${BREACH_GRADE_LABELS[status.recommendedGrade]})`);
  }
  if (status.recommendedSponsorId) {
    rec.push(sponsorDisplayName(status.recommendedSponsorId));
  }
  if (rec.length > 0) {
    lines.push(`→ ${rec.join(' // ')}`);
  }
  return lines;
}

export function formatPinnedGoalDebriefCard(
  status: PinnedGoalStatus,
): { title: string; lines: string[]; completed: boolean } {
  return {
    title: status.completed
      ? `GOAL COMPLETE — ${status.definition.label}`
      : status.definition.label,
    lines: [
      status.progressLabel,
      ...status.missingRequirements.slice(0, 2),
      status.definition.summary,
    ].filter(Boolean),
    completed: status.completed,
  };
}

/** Normalize pinned goal entries from persistence. */
export function normalizePinnedGoals(
  raw: unknown,
): PinnedProgressionGoal[] {
  if (!Array.isArray(raw)) return [];
  const out: PinnedProgressionGoal[] = [];
  raw.forEach((entry) => {
    if (!entry || typeof entry !== 'object') return;
    const e = entry as Partial<PinnedProgressionGoal>;
    if (typeof e.id !== 'string' || typeof e.kind !== 'string' || typeof e.targetId !== 'string') {
      return;
    }
    out.push({
      id: e.id,
      kind: e.kind as ProgressionGoalKind,
      targetId: e.targetId,
      label: typeof e.label === 'string' ? e.label : e.id,
      pinnedAtMs: typeof e.pinnedAtMs === 'number' ? e.pinnedAtMs : 0,
    });
  });
  return out.slice(0, MAX_PINNED_GOAL_SLOTS);
}

/** Dev helper — grant a recipe unlock so RECIPE goals can complete. */
export function debugGrantRecipeUnlock(
  profile: ProgressionProfile,
  recipeId: string,
): ProgressionProfile {
  const unlockId = `recipe.${recipeId}`;
  if (hasProgressionUnlock(profile, unlockId)) return profile;
  let next: ProgressionProfile = {
    ...profile,
    grantedUnlocks: [...profile.grantedUnlocks, unlockId],
    flags: profile.flags.includes(unlockId) ? profile.flags : [...profile.flags, unlockId],
  };
  next = appendProgressionEvent(next, {
    kind: 'DEBUG_GRANT',
    message: `Debug granted recipe unlock ${unlockId}`,
    unlockId,
  });
  return next;
}

/** Resolve mandate route intel → related sector access goal id. */
export function sectorAccessGoalIdForRouteIntel(
  resourceId: string,
): string | null {
  const mandate = getMandateForRouteIntel(resourceId as import('../types/resourceItem').ResourceItemId);
  if (!mandate) return null;
  return goalId('SECTOR_ACCESS', mandate.targetSectorId);
}
