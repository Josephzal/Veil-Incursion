import type { ContractExtractionKind } from '../types/contract';
import type { ProgressionProfile, ProgressionUnlockId } from '../types/progression';
import { appendProgressionEvent } from './progressionEventLog';
import { grantProgressionUnlock } from './rewardGrantService';
import { getProgressionUnlockDefinition } from './unlockRegistry';
import { refreshSectorMandateAvailability } from './sectorAccessMandateEngine';
import { getBreachGradeTuning } from './breachGradeEngine';

export type RunnerClearanceRunOutcome = 'EXTRACTED' | 'FAILED';

export interface RunnerClearanceXpInput {
  runOutcome: RunnerClearanceRunOutcome;
  extractionKind?: ContractExtractionKind;
  /** Highest depth reached this run (1–3). */
  depthReached: number;
  contractSucceeded?: boolean;
  /** Phase 1D — scales XP on successful extract. */
  breachGrade?: import('../types/progression').BreachGradeId;
}

export interface RunnerClearanceApplyResult {
  profile: ProgressionProfile;
  xpGained: number;
  ranksGained: number;
  previousRank: number;
  newRank: number;
  previousXp: number;
  newXp: number;
  unlocksGranted: string[];
  logLines: string[];
}

/**
 * XP cost to advance from `rank` → `rank + 1`.
 * Tuned so Clearance 2 lands ~2 extracts, Clearance 3 (Grade II) ~3–4,
 * Clearance 5 (Grade III) mid-campaign, Clearance 6 late.
 */
export function xpRequiredForClearanceRank(rank: number): number {
  const safeRank = Math.max(1, Math.floor(rank));
  switch (safeRank) {
    case 1:
      return 180;
    case 2:
      return 170;
    case 3:
      return 250;
    case 4:
      return 400;
    case 5:
      return 550;
    default:
      return 200 + (safeRank - 1) * 100;
  }
}

export function clearanceXpProgress(profile: ProgressionProfile): {
  current: number;
  required: number;
  percent: number;
  rank: number;
} {
  const rank = profile.runner.clearanceRank;
  const current = profile.runner.clearanceXp;
  const required = xpRequiredForClearanceRank(rank);
  const percent = required > 0 ? Math.min((current / required) * 100, 100) : 0;
  return { current, required, percent, rank };
}

/** Compute Runner Clearance XP from a finished run (pure). */
export function computeRunnerClearanceXpGain(input: RunnerClearanceXpInput): number {
  const depth = Math.max(1, Math.min(3, Math.floor(input.depthReached || 1)));
  const contractBonus = input.contractSucceeded ? 20 : 0;
  const gradeMult = getBreachGradeTuning(input.breachGrade ?? 'I').clearanceXpMultiplier;

  if (input.runOutcome !== 'EXTRACTED') {
    return 20;
  }

  const base = 90 + depth * 25 + contractBonus;
  const recalled = input.extractionKind === 'EMERGENCY_RECALL'
    ? Math.max(25, Math.floor(base * 0.6))
    : base;
  return Math.max(1, Math.floor(recalled * gradeMult));
}

/**
 * When clearance / flags unlock mandate availability, promote LOCKED → AVAILABLE
 * for eligible locked sectors. Does not unlock sectors.
 */
export function syncSectorMandateAvailability(
  profile: ProgressionProfile,
): ProgressionProfile {
  let next = refreshSectorMandateAvailability(profile);

  // Safety: never leave Null Zone locked if somehow migrated wrong.
  const nullZone = next.sectors.THE_NULL_ZONE;
  if (nullZone && (nullZone.accessMandateState === 'LOCKED' || !nullZone.unlocked)) {
    next = {
      ...next,
      sectors: {
        ...next.sectors,
        THE_NULL_ZONE: {
          ...nullZone,
          unlocked: true,
          accessMandateState: 'COMPLETED',
        },
      },
    };
  }

  return next;
}

function clearanceUnlockIdForRank(rank: number): ProgressionUnlockId | null {
  if (rank < 2 || rank > 6) return null;
  return `runner.clearance.${rank}` as ProgressionUnlockId;
}

/**
 * Grant any missing `runner.clearance.N` unlocks for the current rank,
 * then sync mandate availability. Used after XP rank-ups and debug rank sets.
 */
export function syncRunnerClearanceUnlocks(
  profile: ProgressionProfile,
): { profile: ProgressionProfile; unlocksGranted: string[] } {
  let next = profile;
  const unlocksGranted: string[] = [];

  for (let rank = 2; rank <= next.runner.clearanceRank; rank += 1) {
    const unlockId = clearanceUnlockIdForRank(rank);
    if (!unlockId) continue;
    if (next.grantedUnlocks.includes(unlockId)) continue;
    if (!getProgressionUnlockDefinition(unlockId)) continue;
    const result = grantProgressionUnlock(next, unlockId);
    next = result.profile;
    if (result.applied.length > 0) {
      unlocksGranted.push(unlockId);
    }
  }

  next = syncSectorMandateAvailability(next);
  return { profile: next, unlocksGranted };
}

/** Apply clearance XP, process rank-ups, grant clearance unlock rewards. */
export function applyRunnerClearanceXp(
  profile: ProgressionProfile,
  xpAmount: number,
): RunnerClearanceApplyResult {
  const xpGained = Math.max(0, Math.floor(xpAmount));
  const previousRank = profile.runner.clearanceRank;
  const previousXp = profile.runner.clearanceXp;
  const logLines: string[] = [];
  const unlocksGranted: string[] = [];

  if (xpGained <= 0) {
    return {
      profile,
      xpGained: 0,
      ranksGained: 0,
      previousRank,
      newRank: previousRank,
      previousXp,
      newXp: previousXp,
      unlocksGranted: [],
      logLines: [],
    };
  }

  let next: ProgressionProfile = {
    ...profile,
    runner: {
      ...profile.runner,
      clearanceXp: previousXp + xpGained,
    },
  };

  next = appendProgressionEvent(next, {
    kind: 'REWARD_APPLIED',
    message: `Runner Clearance +${xpGained} XP`,
    meta: { xpGained, clearanceRank: next.runner.clearanceRank },
  });

  logLines.push(`>> RUNNER CLEARANCE — +${xpGained} XP`);

  while (next.runner.clearanceXp >= xpRequiredForClearanceRank(next.runner.clearanceRank)) {
    const cost = xpRequiredForClearanceRank(next.runner.clearanceRank);
    const newRank = next.runner.clearanceRank + 1;
    next = {
      ...next,
      runner: {
        ...next.runner,
        clearanceXp: next.runner.clearanceXp - cost,
        clearanceRank: newRank,
      },
    };
    next = appendProgressionEvent(next, {
      kind: 'UNLOCK_GRANTED',
      message: `Runner Clearance advanced to ${newRank}`,
      unlockId: clearanceUnlockIdForRank(newRank) ?? undefined,
      meta: { clearanceRank: newRank },
    });
    logLines.push(`>> RUNNER CLEARANCE — RANK UP → ${newRank}`);

    const unlockId = clearanceUnlockIdForRank(newRank);
    if (unlockId && getProgressionUnlockDefinition(unlockId)) {
      const grant = grantProgressionUnlock(next, unlockId);
      next = grant.profile;
      if (grant.applied.length > 0) {
        unlocksGranted.push(unlockId);
        logLines.push(`>> RUNNER CLEARANCE — UNLOCK ${unlockId.toUpperCase()}`);
      }
    }
  }

  const synced = syncRunnerClearanceUnlocks(next);
  next = synced.profile;
  synced.unlocksGranted.forEach((id) => {
    if (!unlocksGranted.includes(id)) {
      unlocksGranted.push(id);
      logLines.push(`>> RUNNER CLEARANCE — UNLOCK ${id.toUpperCase()}`);
    }
  });

  return {
    profile: next,
    xpGained,
    ranksGained: Math.max(0, next.runner.clearanceRank - previousRank),
    previousRank,
    newRank: next.runner.clearanceRank,
    previousXp,
    newXp: next.runner.clearanceXp,
    unlocksGranted,
    logLines,
  };
}

/** Convenience: compute XP from debrief facts and apply. */
export function applyRunnerClearanceFromDebrief(
  profile: ProgressionProfile,
  input: RunnerClearanceXpInput,
): RunnerClearanceApplyResult {
  const xpGained = computeRunnerClearanceXpGain(input);
  return applyRunnerClearanceXp(profile, xpGained);
}
