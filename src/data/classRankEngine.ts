/**
 * Progression Spine — Class Rank XP / mastery history (ranks 1–20).
 * Reward table hooks are flavor/history only. Stage II-B: Class Rank does not
 * grant graft capacity, socket quality, ultimates, Apex access, or combat power.
 */
import type { ClassType } from '../types/game';
import type { BreachGradeId, ProgressionProfile } from '../types/progression';
import { appendProgressionEvent } from './progressionEventLog';
import { getBreachGradeTuning } from './breachGradeEngine';

export const CLASS_RANK_MAX = 20;

export type ClassRankHookKind =
  | 'ABILITY_RECIPE'
  | 'GRAFT_LICENSE'
  | 'BOON_POOL'
  | 'WEAPON_FRAME'
  | 'TRINKET_REQUISITION'
  | 'ALTERNATE_ULTIMATE';

export interface ClassRankRewardHooks {
  /** Rank this row grants when reaching it (2–10). Rank 1 is starter. */
  rank: number;
  label: string;
  kind: ClassRankHookKind;
  /** Hook ids pushed into class progression arrays / flags. */
  abilityHooks?: readonly string[];
  graftHooks?: readonly string[];
  boonPoolHooks?: readonly string[];
  weaponHooks?: readonly string[];
  flagHooks?: readonly string[];
}

/** Data-driven class rank rewards — hooks only, no live combat unlocks yet. */
export const CLASS_RANK_REWARD_TABLE: readonly ClassRankRewardHooks[] = [
  {
    rank: 2,
    label: 'Ability recipe unlock',
    kind: 'ABILITY_RECIPE',
    abilityHooks: ['hook.ability_recipe.basic'],
  },
  {
    rank: 3,
    label: 'Basic graft license',
    kind: 'GRAFT_LICENSE',
    graftHooks: ['hook.graft.basic'],
  },
  {
    rank: 4,
    label: 'Class boon pool expansion',
    kind: 'BOON_POOL',
    boonPoolHooks: ['hook.boon_pool.basic'],
  },
  {
    rank: 5,
    label: 'Second weapon frame recipe',
    kind: 'WEAPON_FRAME',
    weaponHooks: ['hook.weapon_frame.second'],
  },
  {
    rank: 6,
    label: 'Advanced ability recipe',
    kind: 'ABILITY_RECIPE',
    abilityHooks: ['hook.ability_recipe.advanced'],
  },
  {
    rank: 7,
    label: 'Advanced graft license',
    kind: 'GRAFT_LICENSE',
    graftHooks: ['hook.graft.advanced'],
  },
  {
    rank: 8,
    label: 'Class trinket / requisition unlock',
    kind: 'TRINKET_REQUISITION',
    flagHooks: ['hook.class.trinket_requisition'],
  },
  {
    rank: 9,
    label: 'Rare boon pool expansion',
    kind: 'BOON_POOL',
    boonPoolHooks: ['hook.boon_pool.rare'],
  },
  {
    rank: 10,
    label: 'Alternate ultimate mandate',
    kind: 'ALTERNATE_ULTIMATE',
    flagHooks: ['hook.class.alternate_ultimate'],
  },
  // Ranks 11–20: graft-capacity axis extension. Non-graft rewards deferred (report gaps).
  {
    rank: 12,
    label: 'Third graft capacity',
    kind: 'GRAFT_LICENSE',
    graftHooks: ['hook.graft.capacity_3'],
  },
  {
    rank: 15,
    label: 'Ultimate graft socket',
    kind: 'GRAFT_LICENSE',
    graftHooks: ['hook.graft.ultimate'],
  },
  {
    rank: 17,
    label: 'Fourth graft capacity',
    kind: 'GRAFT_LICENSE',
    graftHooks: ['hook.graft.capacity_4'],
  },
  {
    rank: 20,
    label: 'Apex / Masterwork graft access',
    kind: 'GRAFT_LICENSE',
    graftHooks: ['hook.graft.apex_masterwork'],
  },
];

export interface ClassRankXpInput {
  runOutcome: 'EXTRACTED' | 'FAILED';
  depthReached: number;
  contractSucceeded?: boolean;
  breachGrade?: BreachGradeId;
}

export interface ClassRankApplyResult {
  profile: ProgressionProfile;
  classId: ClassType;
  xpGained: number;
  ranksGained: number;
  previousRank: number;
  newRank: number;
  previousXp: number;
  newXp: number;
  hooksGranted: string[];
  logLines: string[];
}

function uniquePush(list: readonly string[], values: readonly string[]): string[] {
  const next = [...list];
  values.forEach((value) => {
    if (!next.includes(value)) next.push(value);
  });
  return next;
}

/** XP cost to advance from `rank` → `rank + 1`. */
export function xpRequiredForClassRank(rank: number): number {
  const safe = Math.max(1, Math.min(CLASS_RANK_MAX, Math.floor(rank)));
  return 80 + safe * 40;
}

export function classRankXpProgress(
  profile: ProgressionProfile,
  classId: ClassType,
): { current: number; required: number; percent: number; rank: number } {
  const entry = profile.classes[classId];
  const rank = entry?.rank ?? 1;
  const current = entry?.xp ?? 0;
  if (rank >= CLASS_RANK_MAX) {
    return { current, required: 1, percent: 100, rank };
  }
  const required = xpRequiredForClassRank(rank);
  const percent = required > 0 ? Math.min((current / required) * 100, 100) : 0;
  return { current, required, percent, rank };
}

export function computeClassRankXpGain(input: ClassRankXpInput): number {
  const depth = Math.max(1, Math.min(3, Math.floor(input.depthReached || 1)));
  const gradeMult = 1 + (getBreachGradeTuning(input.breachGrade ?? 'I').clearanceXpMultiplier - 1) * 0.5;
  if (input.runOutcome !== 'EXTRACTED') {
    return 12;
  }
  const base = 35 + depth * 15 + (input.contractSucceeded ? 15 : 0);
  return Math.max(1, Math.floor(base * gradeMult));
}

function getRewardRowForRank(rank: number): ClassRankRewardHooks | null {
  return CLASS_RANK_REWARD_TABLE.find((row) => row.rank === rank) ?? null;
}

function applyClassRankHooks(
  profile: ProgressionProfile,
  classId: ClassType,
  rank: number,
): { profile: ProgressionProfile; hooksGranted: string[] } {
  const row = getRewardRowForRank(rank);
  if (!row) return { profile, hooksGranted: [] };

  const classState = profile.classes[classId];
  if (!classState) return { profile, hooksGranted: [] };

  const hooksGranted: string[] = [];
  const abilityHooks = row.abilityHooks ?? [];
  const graftHooks = row.graftHooks ?? [];
  const boonPoolHooks = row.boonPoolHooks ?? [];
  const weaponHooks = row.weaponHooks ?? [];
  const flagHooks = row.flagHooks ?? [];

  abilityHooks.forEach((id) => hooksGranted.push(`${classId}:${id}`));
  graftHooks.forEach((id) => hooksGranted.push(`${classId}:${id}`));
  boonPoolHooks.forEach((id) => hooksGranted.push(`${classId}:${id}`));
  weaponHooks.forEach((id) => hooksGranted.push(`${classId}:${id}`));
  flagHooks.forEach((id) => hooksGranted.push(`${classId}:${id}`));

  if (hooksGranted.length === 0) return { profile, hooksGranted: [] };

  const namespacedFlags = flagHooks.map((id) => `class.${classId}.${id.replace(/^hook\./, '')}`);

  return {
    profile: {
      ...profile,
      classes: {
        ...profile.classes,
        [classId]: {
          ...classState,
          unlockedAbilities: uniquePush(classState.unlockedAbilities, abilityHooks),
          unlockedGraftLicenses: uniquePush(classState.unlockedGraftLicenses, graftHooks),
          unlockedBoonPools: uniquePush(classState.unlockedBoonPools, boonPoolHooks),
          unlockedWeapons: uniquePush(classState.unlockedWeapons, weaponHooks),
        },
      },
      flags: uniquePush(profile.flags, [...flagHooks, ...namespacedFlags]),
    },
    hooksGranted,
  };
}

/** Grant any missing hooks for ranks already reached (migrate / debug). */
export function syncClassRankHooks(
  profile: ProgressionProfile,
  classId: ClassType,
): { profile: ProgressionProfile; hooksGranted: string[] } {
  const entry = profile.classes[classId];
  if (!entry) return { profile, hooksGranted: [] };
  let next = profile;
  const hooksGranted: string[] = [];
  for (let rank = 2; rank <= entry.rank; rank += 1) {
    const applied = applyClassRankHooks(next, classId, rank);
    next = applied.profile;
    applied.hooksGranted.forEach((id) => {
      if (!hooksGranted.includes(id)) hooksGranted.push(id);
    });
  }
  return { profile: next, hooksGranted };
}

export function applyClassRankXp(
  profile: ProgressionProfile,
  classId: ClassType,
  xpAmount: number,
): ClassRankApplyResult {
  const entry = profile.classes[classId];
  const previousRank = entry?.rank ?? 1;
  const previousXp = entry?.xp ?? 0;
  const xpGained = Math.max(0, Math.floor(xpAmount));
  const logLines: string[] = [];
  const hooksGranted: string[] = [];

  if (!entry || xpGained <= 0) {
    return {
      profile,
      classId,
      xpGained: 0,
      ranksGained: 0,
      previousRank,
      newRank: previousRank,
      previousXp,
      newXp: previousXp,
      hooksGranted: [],
      logLines: [],
    };
  }

  let next: ProgressionProfile = {
    ...profile,
    classes: {
      ...profile.classes,
      [classId]: {
        ...entry,
        xp: previousXp + xpGained,
      },
    },
  };

  next = appendProgressionEvent(next, {
    kind: 'REWARD_APPLIED',
    message: `${classId} class +${xpGained} XP`,
    meta: { classId, xpGained },
  });
  logLines.push(`>> CLASS RANK — ${classId.replace(/_/g, ' ')} +${xpGained} XP`);

  while (
    next.classes[classId]!.rank < CLASS_RANK_MAX
    && next.classes[classId]!.xp >= xpRequiredForClassRank(next.classes[classId]!.rank)
  ) {
    const current = next.classes[classId]!;
    const cost = xpRequiredForClassRank(current.rank);
    const newRank = current.rank + 1;
    next = {
      ...next,
      classes: {
        ...next.classes,
        [classId]: {
          ...current,
          xp: current.xp - cost,
          rank: newRank,
        },
      },
    };
    next = appendProgressionEvent(next, {
      kind: 'UNLOCK_GRANTED',
      message: `${classId} advanced to rank ${newRank}`,
      meta: { classId, classRank: newRank },
    });
    logLines.push(`>> CLASS RANK — ${classId.replace(/_/g, ' ')} → RANK ${newRank}`);

    const hooked = applyClassRankHooks(next, classId, newRank);
    next = hooked.profile;
    const row = getRewardRowForRank(newRank);
    hooked.hooksGranted.forEach((id) => {
      if (!hooksGranted.includes(id)) hooksGranted.push(id);
    });
    if (row) {
      logLines.push(`>> CLASS RANK — HOOK ${row.label.toUpperCase()}`);
    }
  }

  const synced = syncClassRankHooks(next, classId);
  next = synced.profile;

  return {
    profile: next,
    classId,
    xpGained,
    ranksGained: Math.max(0, next.classes[classId]!.rank - previousRank),
    previousRank,
    newRank: next.classes[classId]!.rank,
    previousXp,
    newXp: next.classes[classId]!.xp,
    hooksGranted,
    logLines,
  };
}

export function applyClassRankFromDebrief(
  profile: ProgressionProfile,
  classId: ClassType,
  input: ClassRankXpInput,
): ClassRankApplyResult {
  return applyClassRankXp(profile, classId, computeClassRankXpGain(input));
}

export function buildClassRankDebriefLines(
  profile: ProgressionProfile,
  classId: ClassType,
  xpGain: number,
): string[] {
  const progress = classRankXpProgress(profile, classId);
  const lines = [
    `${classId.replace(/_/g, ' ')} Rank ${progress.rank}`,
    `+${xpGain} Class XP // ${progress.current}/${progress.required} to next`,
  ];
  const nextReward = getRewardRowForRank(progress.rank + 1);
  if (nextReward && progress.rank < CLASS_RANK_MAX) {
    lines.push(`Next: ${nextReward.label}`);
  }
  return lines;
}

export function formatClassRankHookCatalog(classId: ClassType = 'AEGIS'): string {
  return CLASS_RANK_REWARD_TABLE
    .map((row) => `R${row.rank} ${classId}: ${row.label}`)
    .join('\n');
}
