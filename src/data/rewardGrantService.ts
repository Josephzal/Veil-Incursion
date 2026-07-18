import type { ClassType, FactionType } from '../types/game';
import type { SectorId } from '../types/worldState';
import type {
  BreachGradeId,
  ProgressionEvent,
  ProgressionProfile,
  ProgressionReward,
  SectorAccessMandateState,
} from '../types/progression';
import { PROGRESSION_EVENT_LOG_CAP } from './progressionProfileEngine';
import { getProgressionUnlockDefinition } from './unlockRegistry';
import { evaluateProgressionRequirements } from './requirementEvaluator';
import { appendProgressionEvent } from './progressionEventLog';

export interface RewardGrantResult {
  profile: ProgressionProfile;
  applied: ProgressionReward[];
  skipped: Array<{ reward: ProgressionReward; reason: string }>;
  alreadyOwned: boolean;
}

function uniquePush(list: readonly string[], value: string): string[] {
  return list.includes(value) ? [...list] : [...list, value];
}

function applyOneReward(
  profile: ProgressionProfile,
  reward: ProgressionReward,
): { profile: ProgressionProfile; applied: boolean; reason?: string } {
  switch (reward.kind) {
    case 'GRANT_UNLOCK': {
      if (!reward.targetId) return { profile, applied: false, reason: 'missing unlock id' };
      if (profile.grantedUnlocks.includes(reward.targetId)) {
        return { profile, applied: false, reason: 'already granted' };
      }
      return {
        profile: {
          ...profile,
          grantedUnlocks: uniquePush(profile.grantedUnlocks, reward.targetId),
        },
        applied: true,
      };
    }
    case 'ADD_FLAG': {
      if (!reward.targetId) return { profile, applied: false, reason: 'missing flag id' };
      if (profile.flags.includes(reward.targetId)) {
        return { profile, applied: false, reason: 'flag already set' };
      }
      return {
        profile: {
          ...profile,
          flags: uniquePush(profile.flags, reward.targetId),
          grantedUnlocks: uniquePush(profile.grantedUnlocks, reward.targetId),
        },
        applied: true,
      };
    }
    case 'SET_SECTOR_UNLOCKED': {
      if (!reward.targetId) return { profile, applied: false, reason: 'missing sector id' };
      const sectorId = reward.targetId as SectorId;
      const sector = profile.sectors[sectorId];
      if (!sector) return { profile, applied: false, reason: 'unknown sector' };
      if (sector.unlocked && reward.value !== 0) {
        return { profile, applied: false, reason: 'sector already unlocked' };
      }
      return {
        profile: {
          ...profile,
          sectors: {
            ...profile.sectors,
            [sectorId]: {
              ...sector,
              unlocked: (reward.value ?? 1) > 0,
            },
          },
        },
        applied: true,
      };
    }
    case 'ADD_BREACH_GRADE': {
      if (!reward.targetId) return { profile, applied: false, reason: 'missing grade' };
      const grade = reward.targetId as BreachGradeId;
      if (profile.runner.unlockedBreachGrades.includes(grade)) {
        return { profile, applied: false, reason: 'grade already unlocked' };
      }
      return {
        profile: {
          ...profile,
          runner: {
            ...profile.runner,
            unlockedBreachGrades: [...profile.runner.unlockedBreachGrades, grade],
          },
        },
        applied: true,
      };
    }
    case 'SET_RUNNER_CLEARANCE': {
      const rank = Math.max(1, Math.floor(reward.value ?? profile.runner.clearanceRank));
      if (rank <= profile.runner.clearanceRank) {
        return { profile, applied: false, reason: 'clearance already at or above target' };
      }
      return {
        profile: {
          ...profile,
          runner: {
            ...profile.runner,
            clearanceRank: rank,
          },
        },
        applied: true,
      };
    }
    case 'ADD_RUNNER_XP': {
      const xp = Math.max(0, Math.floor(reward.value ?? 0));
      if (xp <= 0) return { profile, applied: false, reason: 'no xp' };
      return {
        profile: {
          ...profile,
          runner: {
            ...profile.runner,
            clearanceXp: profile.runner.clearanceXp + xp,
          },
        },
        applied: true,
      };
    }
    case 'ADD_CLASS_XP': {
      if (!reward.targetId) return { profile, applied: false, reason: 'missing class id' };
      const classId = reward.targetId as ClassType;
      const classState = profile.classes[classId];
      if (!classState) return { profile, applied: false, reason: 'unknown class' };
      const xp = Math.max(0, Math.floor(reward.value ?? 0));
      if (xp <= 0) return { profile, applied: false, reason: 'no xp' };
      return {
        profile: {
          ...profile,
          classes: {
            ...profile.classes,
            [classId]: {
              ...classState,
              xp: classState.xp + xp,
            },
          },
        },
        applied: true,
      };
    }
    case 'SET_CLASS_RANK': {
      if (!reward.targetId) return { profile, applied: false, reason: 'missing class id' };
      const classId = reward.targetId as ClassType;
      const classState = profile.classes[classId];
      if (!classState) return { profile, applied: false, reason: 'unknown class' };
      const rank = Math.max(1, Math.floor(reward.value ?? classState.rank));
      if (rank <= classState.rank) {
        return { profile, applied: false, reason: 'rank already at or above target' };
      }
      return {
        profile: {
          ...profile,
          classes: {
            ...profile.classes,
            [classId]: { ...classState, rank },
          },
        },
        applied: true,
      };
    }
    case 'ADD_CABAL_REP': {
      if (!reward.targetId) return { profile, applied: false, reason: 'missing cabal id' };
      const cabalId = reward.targetId as FactionType;
      const cabal = profile.cabals[cabalId];
      if (!cabal) return { profile, applied: false, reason: 'unknown cabal' };
      const xp = Math.max(0, Math.floor(reward.value ?? 0));
      if (xp <= 0) return { profile, applied: false, reason: 'no rep' };
      return {
        profile: {
          ...profile,
          cabals: {
            ...profile.cabals,
            [cabalId]: {
              ...cabal,
              repXp: cabal.repXp + xp,
            },
          },
        },
        applied: true,
      };
    }
    case 'SET_CABAL_TIER': {
      if (!reward.targetId) return { profile, applied: false, reason: 'missing cabal id' };
      const cabalId = reward.targetId as FactionType;
      const cabal = profile.cabals[cabalId];
      if (!cabal) return { profile, applied: false, reason: 'unknown cabal' };
      const tier = Math.max(0, Math.min(5, Math.floor(reward.value ?? cabal.repTier)));
      if (tier <= cabal.repTier) {
        return { profile, applied: false, reason: 'tier already at or above target' };
      }
      return {
        profile: {
          ...profile,
          cabals: {
            ...profile.cabals,
            [cabalId]: { ...cabal, repTier: tier },
          },
        },
        applied: true,
      };
    }
    case 'SET_ACCESS_MANDATE': {
      if (!reward.targetId) return { profile, applied: false, reason: 'missing sector id' };
      const sectorId = reward.targetId as SectorId;
      const sector = profile.sectors[sectorId];
      if (!sector) return { profile, applied: false, reason: 'unknown sector' };
      const mandateState = (reward.mandateState ?? 'COMPLETED') as SectorAccessMandateState;
      if (sector.accessMandateState === mandateState) {
        return { profile, applied: false, reason: 'mandate already in state' };
      }
      return {
        profile: {
          ...profile,
          sectors: {
            ...profile.sectors,
            [sectorId]: {
              ...sector,
              accessMandateState: mandateState,
            },
          },
        },
        applied: true,
      };
    }
    default:
      return { profile, applied: false, reason: 'unknown reward kind' };
  }
}

/** Apply a list of progression rewards to a profile (pure). */
export function applyProgressionRewards(
  profile: ProgressionProfile,
  rewards: readonly ProgressionReward[],
  options?: { logMessage?: string; eventKind?: ProgressionEvent['kind'] },
): RewardGrantResult {
  let next = profile;
  const applied: ProgressionReward[] = [];
  const skipped: Array<{ reward: ProgressionReward; reason: string }> = [];

  rewards.forEach((reward) => {
    const result = applyOneReward(next, reward);
    next = result.profile;
    if (result.applied) {
      applied.push(reward);
    } else {
      skipped.push({ reward, reason: result.reason ?? 'skipped' });
    }
  });

  if (applied.length > 0) {
    next = appendProgressionEvent(next, {
      kind: options?.eventKind ?? 'REWARD_APPLIED',
      message: options?.logMessage
        ?? `Applied ${applied.length} progression reward(s).`,
      meta: { applied: applied.length, skipped: skipped.length },
    });
  }

  return {
    profile: next,
    applied,
    skipped,
    alreadyOwned: applied.length === 0 && skipped.every((s) => s.reason.includes('already')),
  };
}

/**
 * Grant a catalog unlock if requirements pass.
 * Pass `force: true` to skip requirement checks (debug).
 */
export function grantProgressionUnlock(
  profile: ProgressionProfile,
  unlockId: string,
  options?: { force?: boolean },
): RewardGrantResult {
  const def = getProgressionUnlockDefinition(unlockId);
  if (!def) {
    const withLog = appendProgressionEvent(profile, {
      kind: 'REQUIREMENT_FAILED',
      message: `Unknown unlock id: ${unlockId}`,
      unlockId,
    });
    return {
      profile: withLog,
      applied: [],
      skipped: [{ reward: { kind: 'GRANT_UNLOCK', targetId: unlockId }, reason: 'unknown unlock' }],
      alreadyOwned: false,
    };
  }

  if (profile.grantedUnlocks.includes(def.id) && !options?.force) {
    return {
      profile,
      applied: [],
      skipped: [{ reward: { kind: 'GRANT_UNLOCK', targetId: def.id }, reason: 'already granted' }],
      alreadyOwned: true,
    };
  }

  if (!options?.force) {
    const evalResult = evaluateProgressionRequirements(profile, def.requirements);
    if (!evalResult.ok) {
      const withLog = appendProgressionEvent(profile, {
        kind: 'REQUIREMENT_FAILED',
        message: `Requirements failed for ${def.label}`,
        unlockId: def.id,
        meta: { failed: evalResult.failed.length },
      });
      return {
        profile: withLog,
        applied: [],
        skipped: def.rewards.map((reward) => ({
          reward,
          reason: evalResult.details.filter((d) => d.startsWith('FAIL')).join('; ') || 'requirements failed',
        })),
        alreadyOwned: false,
      };
    }
  }

  return applyProgressionRewards(profile, def.rewards, {
    logMessage: `Unlock granted: ${def.label}`,
    eventKind: options?.force ? 'DEBUG_GRANT' : 'UNLOCK_GRANTED',
  });
}

/** Cap helper re-export for callers that truncate logs manually. */
export { PROGRESSION_EVENT_LOG_CAP };
