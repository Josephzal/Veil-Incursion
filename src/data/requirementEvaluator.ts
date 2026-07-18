import type {
  BreachGradeId,
  ProgressionEvaluationContext,
  ProgressionProfile,
  ProgressionRequirement,
} from '../types/progression';
import type { ClassType, FactionType } from '../types/game';
import type { SectorId } from '../types/worldState';
import {
  hasProgressionFlag,
  hasProgressionUnlock,
  isBreachGradeUnlockedInProfile,
  isSectorUnlockedInProfile,
} from './progressionProfileEngine';

export interface RequirementEvaluationResult {
  ok: boolean;
  failed: ProgressionRequirement[];
  details: string[];
}

function describeRequirement(req: ProgressionRequirement): string {
  switch (req.kind) {
    case 'ALWAYS':
      return 'always';
    case 'UNLOCK_OWNED':
      return `owns unlock ${req.targetId ?? '?'}`;
    case 'SECTOR_UNLOCKED':
      return `sector unlocked ${req.targetId ?? '?'}`;
    case 'BREACH_GRADE_UNLOCKED':
      return `breach grade ${req.targetId ?? '?'}`;
    case 'RUNNER_CLEARANCE_MIN':
      return `runner clearance >= ${req.minValue ?? 0}`;
    case 'CLASS_RANK_MIN':
      return `class ${req.targetId ?? '?'} rank >= ${req.minValue ?? 0}`;
    case 'CABAL_REP_TIER_MIN':
      return `cabal ${req.targetId ?? '?'} tier >= ${req.minValue ?? 0}`;
    case 'SECTOR_MASTERY_MIN':
      return `sector ${req.targetId ?? '?'} mastery >= ${req.minValue ?? 0}`;
    case 'FLAG':
      return `flag ${req.targetId ?? '?'}`;
    default:
      return 'unknown requirement';
  }
}

function evaluateOne(
  profile: ProgressionProfile,
  req: ProgressionRequirement,
  _ctx: ProgressionEvaluationContext | undefined,
): boolean {
  switch (req.kind) {
    case 'ALWAYS':
      return true;
    case 'UNLOCK_OWNED':
      return req.targetId != null && hasProgressionUnlock(profile, req.targetId);
    case 'SECTOR_UNLOCKED':
      return req.targetId != null
        && isSectorUnlockedInProfile(profile, req.targetId as SectorId);
    case 'BREACH_GRADE_UNLOCKED':
      return req.targetId != null
        && isBreachGradeUnlockedInProfile(profile, req.targetId as BreachGradeId);
    case 'RUNNER_CLEARANCE_MIN':
      return profile.runner.clearanceRank >= (req.minValue ?? 0);
    case 'CLASS_RANK_MIN': {
      if (!req.targetId) return false;
      const classState = profile.classes[req.targetId as ClassType];
      return (classState?.rank ?? 0) >= (req.minValue ?? 0);
    }
    case 'CABAL_REP_TIER_MIN': {
      if (!req.targetId) return false;
      const cabalState = profile.cabals[req.targetId as FactionType];
      return (cabalState?.repTier ?? 0) >= (req.minValue ?? 0);
    }
    case 'SECTOR_MASTERY_MIN': {
      if (!req.targetId) return false;
      const sectorState = profile.sectors[req.targetId as SectorId];
      return (sectorState?.masteryLevel ?? 0) >= (req.minValue ?? 0);
    }
    case 'FLAG':
      return req.targetId != null && hasProgressionFlag(profile, req.targetId);
    default:
      return false;
  }
}

/** Generically evaluate a requirement list against the progression profile. */
export function evaluateProgressionRequirements(
  profile: ProgressionProfile,
  requirements: readonly ProgressionRequirement[],
  context?: ProgressionEvaluationContext,
): RequirementEvaluationResult {
  const failed: ProgressionRequirement[] = [];
  const details: string[] = [];

  requirements.forEach((req) => {
    const ok = evaluateOne(profile, req, context);
    const line = `${ok ? 'PASS' : 'FAIL'} — ${describeRequirement(req)}`;
    details.push(line);
    if (!ok) failed.push(req);
  });

  return {
    ok: failed.length === 0,
    failed,
    details,
  };
}
