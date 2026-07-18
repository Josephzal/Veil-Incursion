/**
 * Progression Spine Phase 1F — Cabal Reputation reward skeleton (hooks only).
 * Awards rep from sponsored contracts, 5 tiers, sponsor package/contract flags.
 * Low Breach Grades hard-cap reachable tier so farming Grade I cannot max endgame rep.
 */
import type { FactionType } from '../types/game';
import type { BreachGradeId, ProgressionProfile } from '../types/progression';
import { appendProgressionEvent } from './progressionEventLog';
import { breachGradeRank, getBreachGradeTuning } from './breachGradeEngine';
import { sponsorDisplayName } from '../utils/contractUi';

export const CABAL_REP_TIER_MAX = 5;

export type CabalTierHookKind =
  | 'SPONSOR_PACKAGE'
  | 'SPONSOR_REQUISITION'
  | 'SPONSOR_CONTRACTS'
  | 'HIGH_RISK_MANDATE'
  | 'MASTERWORK_MANDATE';

export interface CabalTierRewardHooks {
  tier: number;
  label: string;
  kind: CabalTierHookKind;
  packageHooks?: readonly string[];
  contractHooks?: readonly string[];
  flagHooks?: readonly string[];
}

/** Data-driven cabal tier rewards — hooks only. */
export const CABAL_TIER_REWARD_TABLE: readonly CabalTierRewardHooks[] = [
  {
    tier: 1,
    label: 'Basic sponsor package',
    kind: 'SPONSOR_PACKAGE',
    packageHooks: ['package.basic'],
  },
  {
    tier: 2,
    label: 'Sponsor requisition',
    kind: 'SPONSOR_REQUISITION',
    packageHooks: ['package.requisition'],
  },
  {
    tier: 3,
    label: 'Sponsor contracts + boon pool hook',
    kind: 'SPONSOR_CONTRACTS',
    packageHooks: ['package.boon_pool'],
    contractHooks: ['contracts.sponsor_board'],
  },
  {
    tier: 4,
    label: 'High-risk mandate',
    kind: 'HIGH_RISK_MANDATE',
    contractHooks: ['contracts.high_risk_mandate'],
  },
  {
    tier: 5,
    label: 'Masterwork / black mandate hook',
    kind: 'MASTERWORK_MANDATE',
    contractHooks: ['contracts.masterwork_mandate'],
    flagHooks: ['hook.cabal.black_mandate'],
  },
];

export interface CabalRepXpInput {
  contractSucceeded: boolean;
  /** Reputation points from the contract payout (legacy board number). */
  reputationAwarded: number;
  sponsorId: FactionType;
  breachGrade?: BreachGradeId;
}

export interface CabalRepApplyResult {
  profile: ProgressionProfile;
  cabalId: FactionType;
  repGained: number;
  tiersGained: number;
  previousTier: number;
  newTier: number;
  previousXp: number;
  newXp: number;
  cappedByGrade: boolean;
  maxTierAllowed: number;
  hooksGranted: string[];
  logLines: string[];
  /** Legacy board reputation delta to mirror onto PlayerAccount.sponsorReputation. */
  legacyRepDelta: number;
}

function uniquePush(list: readonly string[], values: readonly string[]): string[] {
  const next = [...list];
  values.forEach((value) => {
    if (!next.includes(value)) next.push(value);
  });
  return next;
}

/** XP to advance from `tier` → `tier + 1` (tier 0 is uninitiated). */
export function xpRequiredForCabalTier(tier: number): number {
  const safe = Math.max(0, Math.min(CABAL_REP_TIER_MAX - 1, Math.floor(tier)));
  switch (safe) {
    case 0:
      return 80;
    case 1:
      return 120;
    case 2:
      return 180;
    case 3:
      return 260;
    default:
      return 360;
  }
}

/**
 * Hard tier cap by Breach Grade used on the run.
 * Grade I cannot push past Tier 2; II→3; III→4; IV/V→5.
 */
export function maxCabalTierForBreachGrade(grade: BreachGradeId | null | undefined): number {
  const rank = breachGradeRank(grade ?? 'I');
  if (rank <= 1) return 2;
  if (rank === 2) return 3;
  if (rank === 3) return 4;
  return CABAL_REP_TIER_MAX;
}

export function cabalRepXpProgress(
  profile: ProgressionProfile,
  cabalId: FactionType,
): { current: number; required: number; percent: number; tier: number } {
  const entry = profile.cabals[cabalId];
  const tier = entry?.repTier ?? 0;
  const current = entry?.repXp ?? 0;
  if (tier >= CABAL_REP_TIER_MAX) {
    return { current, required: 1, percent: 100, tier };
  }
  const required = xpRequiredForCabalTier(tier);
  const percent = required > 0 ? Math.min((current / required) * 100, 100) : 0;
  return { current, required, percent, tier };
}

export function computeCabalRepXpGain(input: CabalRepXpInput): number {
  if (!input.contractSucceeded) return 0;
  const base = Math.max(20, Math.floor(input.reputationAwarded || 0) + 20);
  const gradeMult = 0.85 + getBreachGradeTuning(input.breachGrade ?? 'I').creditBonusPct / 100;
  return Math.max(1, Math.floor(base * gradeMult));
}

function getRewardRowForTier(tier: number): CabalTierRewardHooks | null {
  return CABAL_TIER_REWARD_TABLE.find((row) => row.tier === tier) ?? null;
}

function applyCabalTierHooks(
  profile: ProgressionProfile,
  cabalId: FactionType,
  tier: number,
): { profile: ProgressionProfile; hooksGranted: string[] } {
  const row = getRewardRowForTier(tier);
  if (!row) return { profile, hooksGranted: [] };
  const cabal = profile.cabals[cabalId];
  if (!cabal) return { profile, hooksGranted: [] };

  const packageHooks = row.packageHooks ?? [];
  const contractHooks = row.contractHooks ?? [];
  const flagHooks = row.flagHooks ?? [];
  const hooksGranted: string[] = [];
  packageHooks.forEach((id) => hooksGranted.push(`${cabalId}:${id}`));
  contractHooks.forEach((id) => hooksGranted.push(`${cabalId}:${id}`));
  flagHooks.forEach((id) => hooksGranted.push(`${cabalId}:${id}`));
  if (hooksGranted.length === 0) return { profile, hooksGranted: [] };

  const namespacedFlags = [
    ...packageHooks.map((id) => `cabal.${cabalId}.${id}`),
    ...contractHooks.map((id) => `cabal.${cabalId}.${id}`),
    ...flagHooks,
  ];

  return {
    profile: {
      ...profile,
      cabals: {
        ...profile.cabals,
        [cabalId]: {
          ...cabal,
          unlockedSponsorPackages: uniquePush(cabal.unlockedSponsorPackages, packageHooks),
          unlockedContracts: uniquePush(cabal.unlockedContracts, contractHooks),
        },
      },
      flags: uniquePush(profile.flags, namespacedFlags),
    },
    hooksGranted,
  };
}

export function syncCabalTierHooks(
  profile: ProgressionProfile,
  cabalId: FactionType,
): { profile: ProgressionProfile; hooksGranted: string[] } {
  const entry = profile.cabals[cabalId];
  if (!entry) return { profile, hooksGranted: [] };
  let next = profile;
  const hooksGranted: string[] = [];
  for (let tier = 1; tier <= entry.repTier; tier += 1) {
    const applied = applyCabalTierHooks(next, cabalId, tier);
    next = applied.profile;
    applied.hooksGranted.forEach((id) => {
      if (!hooksGranted.includes(id)) hooksGranted.push(id);
    });
  }
  return { profile: next, hooksGranted };
}

export function applyCabalRepXp(
  profile: ProgressionProfile,
  cabalId: FactionType,
  xpAmount: number,
  breachGrade?: BreachGradeId,
): CabalRepApplyResult {
  const entry = profile.cabals[cabalId];
  const previousTier = entry?.repTier ?? 0;
  const previousXp = entry?.repXp ?? 0;
  const xpGained = Math.max(0, Math.floor(xpAmount));
  const maxTierAllowed = maxCabalTierForBreachGrade(breachGrade);
  const logLines: string[] = [];
  const hooksGranted: string[] = [];

  if (!entry || xpGained <= 0) {
    return {
      profile,
      cabalId,
      repGained: 0,
      tiersGained: 0,
      previousTier,
      newTier: previousTier,
      previousXp,
      newXp: previousXp,
      cappedByGrade: previousTier >= maxTierAllowed,
      maxTierAllowed,
      hooksGranted: [],
      logLines: [],
      legacyRepDelta: 0,
    };
  }

  // At hard tier cap for this grade: drip a little XP for feedback, never promote.
  const atGradeCap = previousTier >= maxTierAllowed;
  const effectiveXp = atGradeCap ? Math.max(1, Math.floor(xpGained * 0.25)) : xpGained;

  let next: ProgressionProfile = {
    ...profile,
    cabals: {
      ...profile.cabals,
      [cabalId]: {
        ...entry,
        repXp: previousXp + effectiveXp,
      },
    },
  };

  next = appendProgressionEvent(next, {
    kind: 'REWARD_APPLIED',
    message: `${cabalId} cabal +${effectiveXp} rep XP`
      + (atGradeCap ? ` (grade-capped at tier ${maxTierAllowed})` : ''),
    meta: { cabalId, repGained: effectiveXp, maxTierAllowed },
  });

  const sponsorLabel = sponsorDisplayName(cabalId).toUpperCase();
  if (atGradeCap) {
    logLines.push(
      `>> CABAL REP — ${sponsorLabel} +${effectiveXp} XP // GRADE CAP TIER ${maxTierAllowed}`,
    );
  } else {
    logLines.push(`>> CABAL REP — ${sponsorLabel} +${effectiveXp} XP`);
  }

  while (
    next.cabals[cabalId]!.repTier < maxTierAllowed
    && next.cabals[cabalId]!.repTier < CABAL_REP_TIER_MAX
    && next.cabals[cabalId]!.repXp >= xpRequiredForCabalTier(next.cabals[cabalId]!.repTier)
  ) {
    const current = next.cabals[cabalId]!;
    const cost = xpRequiredForCabalTier(current.repTier);
    const newTier = current.repTier + 1;
    next = {
      ...next,
      cabals: {
        ...next.cabals,
        [cabalId]: {
          ...current,
          repXp: current.repXp - cost,
          repTier: newTier,
        },
      },
    };
    next = appendProgressionEvent(next, {
      kind: 'UNLOCK_GRANTED',
      message: `${cabalId} reached tier ${newTier}`,
      meta: { cabalId, repTier: newTier },
    });
    logLines.push(`>> CABAL REP — ${sponsorLabel} → TIER ${newTier}`);

    const hooked = applyCabalTierHooks(next, cabalId, newTier);
    next = hooked.profile;
    const row = getRewardRowForTier(newTier);
    hooked.hooksGranted.forEach((id) => {
      if (!hooksGranted.includes(id)) hooksGranted.push(id);
    });
    if (row) {
      logLines.push(`>> CABAL REP — HOOK ${row.label.toUpperCase()}`);
    }
  }

  // If XP would have promoted past grade cap, leave remainder but do not promote.
  if (
    next.cabals[cabalId]!.repTier >= maxTierAllowed
    && next.cabals[cabalId]!.repXp >= xpRequiredForCabalTier(next.cabals[cabalId]!.repTier)
    && next.cabals[cabalId]!.repTier < CABAL_REP_TIER_MAX
  ) {
    // Soft-park excess XP at the threshold - 1 so UI still shows near-full.
    const current = next.cabals[cabalId]!;
    const cost = xpRequiredForCabalTier(current.repTier);
    if (current.repXp >= cost) {
      next = {
        ...next,
        cabals: {
          ...next.cabals,
          [cabalId]: {
            ...current,
            repXp: cost - 1,
          },
        },
      };
      logLines.push(
        `>> CABAL REP — ${sponsorLabel} TIER CAP LOCKED (NEED HIGHER BREACH GRADE)`,
      );
    }
  }

  const synced = syncCabalTierHooks(next, cabalId);
  next = synced.profile;

  return {
    profile: next,
    cabalId,
    repGained: effectiveXp,
    tiersGained: Math.max(0, next.cabals[cabalId]!.repTier - previousTier),
    previousTier,
    newTier: next.cabals[cabalId]!.repTier,
    previousXp,
    newXp: next.cabals[cabalId]!.repXp,
    cappedByGrade: atGradeCap || next.cabals[cabalId]!.repTier >= maxTierAllowed,
    maxTierAllowed,
    hooksGranted,
    logLines,
    legacyRepDelta: effectiveXp,
  };
}

export function applyCabalRepFromDebrief(
  profile: ProgressionProfile,
  input: CabalRepXpInput,
): CabalRepApplyResult {
  const xp = computeCabalRepXpGain(input);
  return applyCabalRepXp(profile, input.sponsorId, xp, input.breachGrade);
}

export function buildCabalRepDebriefLines(
  profile: ProgressionProfile,
  cabalId: FactionType,
  repGain: number,
  breachGrade?: BreachGradeId,
): string[] {
  const progress = cabalRepXpProgress(profile, cabalId);
  const cap = maxCabalTierForBreachGrade(breachGrade);
  const lines = [
    `${sponsorDisplayName(cabalId)} Tier ${progress.tier}`,
    repGain > 0
      ? `+${repGain} Rep XP // ${progress.current}/${progress.required} to next`
      : `No sponsored payout this run`,
    `Grade cap: Tier ${cap}`,
  ];
  const nextReward = getRewardRowForTier(progress.tier + 1);
  if (nextReward && progress.tier < CABAL_REP_TIER_MAX) {
    lines.push(`Next: ${nextReward.label}`);
  }
  return lines;
}

export function formatCabalTierHookCatalog(cabalId: FactionType = 'TERRAN_GRID'): string {
  return CABAL_TIER_REWARD_TABLE
    .map((row) => `T${row.tier} ${cabalId}: ${row.label}`)
    .join('\n');
}
