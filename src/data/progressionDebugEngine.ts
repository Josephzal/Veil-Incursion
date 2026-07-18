import type { ClassType, FactionType, PlayerAccount } from '../types/game';
import type { SectorId } from '../types/worldState';
import type { BreachGradeId, ProgressionProfile } from '../types/progression';
import { BREACH_GRADE_LABELS } from '../types/progression';
import { ALL_SECTOR_IDS, veilBiomeDisplayName, sectorIdToVeilBiome } from './sectorBiomeBridge';
import {
  createDefaultProgressionProfile,
  hasProgressionFlag,
  normalizeProgressionProfile,
} from './progressionProfileEngine';
import { appendProgressionEvent, formatProgressionEventLog } from './progressionEventLog';
import { grantProgressionUnlock, applyProgressionRewards } from './rewardGrantService';
import { ALL_PROGRESSION_UNLOCK_IDS, getProgressionUnlockDefinition } from './unlockRegistry';
import { evaluateProgressionRequirements } from './requirementEvaluator';
import {
  applyRunnerClearanceXp,
  clearanceXpProgress,
  syncRunnerClearanceUnlocks,
} from './runnerClearanceEngine';
import {
  activateSectorAccessMandate,
  getMandateForRouteIntel,
} from './sectorAccessMandateEngine';
import { getResourceDisplayName } from './resourceRegistry';
import type { ResourceItemId } from '../types/resourceItem';

export function getAccountProgressionProfile(account: PlayerAccount): ProgressionProfile {
  return normalizeProgressionProfile(account.progressionProfile);
}

export function withProgressionProfile(
  account: PlayerAccount,
  profile: ProgressionProfile,
): PlayerAccount {
  return {
    ...account,
    progressionProfile: normalizeProgressionProfile(profile),
  };
}

export function formatProgressionProfileReport(profile: ProgressionProfile): string {
  const lines: string[] = [];
  const xp = clearanceXpProgress(profile);
  lines.push('=== PROGRESSION PROFILE (PHASE 1F) ===');
  lines.push(
    `Runner Clearance ${xp.rank} // XP ${xp.current}/${xp.required} (${Math.floor(xp.percent)}%)`,
  );
  lines.push(
    `Breach Grades: ${profile.runner.unlockedBreachGrades
      .map((g) => `${g}(${BREACH_GRADE_LABELS[g]})`)
      .join(', ')}`,
  );
  lines.push('');
  lines.push('--- SECTORS ---');
  ALL_SECTOR_IDS.forEach((sectorId) => {
    const sector = profile.sectors[sectorId];
    const name = veilBiomeDisplayName(sectorIdToVeilBiome(sectorId));
    lines.push(
      `${name}: ${sector.unlocked ? 'UNLOCKED' : 'LOCKED'}`
      + ` // mandate ${sector.accessMandateState}`
      + ` // mastery ${sector.masteryLevel} (${sector.masteryXp} XP)`
      + ` // high grade ${sector.highestGradeCleared ?? '—'}`,
    );
  });
  lines.push('');
  lines.push('--- CLASSES ---');
  (Object.keys(profile.classes) as ClassType[]).forEach((classId) => {
    const entry = profile.classes[classId];
    lines.push(`${classId}: Rank ${entry.rank} // XP ${entry.xp}`);
  });
  lines.push('');
  lines.push('--- CABALS ---');
  (Object.keys(profile.cabals) as FactionType[]).forEach((cabalId) => {
    const entry = profile.cabals[cabalId];
    lines.push(`${cabalId}: Tier ${entry.repTier} // Rep XP ${entry.repXp}`);
  });
  lines.push('');
  lines.push(`Granted unlocks (${profile.grantedUnlocks.length}):`);
  profile.grantedUnlocks.forEach((id) => lines.push(`  - ${id}`));
  lines.push(`Flags (${profile.flags.length}):`);
  if (profile.flags.length === 0) {
    lines.push('  (none)');
  } else {
    profile.flags.forEach((id) => lines.push(`  - ${id}`));
  }
  lines.push(`Pinned goals: ${profile.pinnedGoals.length}/${hasProgressionFlag(profile, 'flag.pinned_goals_slot_3') ? 3 : 2}`);
  profile.pinnedGoals.forEach((goal) => {
    lines.push(`  - ${goal.label} (${goal.id})`);
  });
  lines.push('');
  lines.push('--- RECENT EVENTS ---');
  const events = formatProgressionEventLog(profile, 12);
  if (events.length === 0) {
    lines.push('(no events)');
  } else {
    events.forEach((line) => lines.push(line));
  }
  lines.push('=== END PROGRESSION PROFILE ===');
  return lines.join('\n');
}

export function formatProgressionUnlockCatalogReport(profile: ProgressionProfile): string {
  const lines: string[] = ['=== UNLOCK REGISTRY STATUS ==='];
  ALL_PROGRESSION_UNLOCK_IDS.forEach((unlockId) => {
    const def = getProgressionUnlockDefinition(unlockId);
    if (!def) return;
    const owned = profile.grantedUnlocks.includes(unlockId);
    const evalResult = evaluateProgressionRequirements(profile, def.requirements);
    lines.push(
      `${owned ? '[OWNED]' : '[----]'} ${def.id} — ${def.label}`
      + ` // req ${evalResult.ok ? 'MET' : 'UNMET'}`,
    );
  });
  lines.push('=== END UNLOCK REGISTRY ===');
  return lines.join('\n');
}

/** Debug: grant an unlock, bypassing requirements. */
export function debugGrantProgressionUnlock(
  account: PlayerAccount,
  unlockId: string,
): { account: PlayerAccount; logLine: string } {
  const profile = getAccountProgressionProfile(account);
  const result = grantProgressionUnlock(profile, unlockId, { force: true });
  return {
    account: withProgressionProfile(account, result.profile),
    logLine: result.applied.length > 0
      ? `>> DEBUG PROGRESSION — granted ${unlockId} (${result.applied.length} reward ops).`
      : `>> DEBUG PROGRESSION — ${unlockId} unchanged (${result.skipped[0]?.reason ?? 'no-op'}).`,
  };
}

/** Debug: set runner clearance rank and sync unlock rewards. */
export function debugSetRunnerClearance(
  account: PlayerAccount,
  rank: number,
): { account: PlayerAccount; logLine: string } {
  const profile = getAccountProgressionProfile(account);
  const targetRank = Math.max(1, Math.floor(rank));
  const setResult = applyProgressionRewards(profile, [
    { kind: 'SET_RUNNER_CLEARANCE', value: targetRank },
  ], {
    logMessage: `Debug set runner clearance to ${targetRank}`,
    eventKind: 'DEBUG_GRANT',
  });
  // If target is below current, force-write rank (SET_RUNNER_CLEARANCE only goes up).
  let next = setResult.profile;
  if (next.runner.clearanceRank !== targetRank) {
    next = {
      ...next,
      runner: {
        ...next.runner,
        clearanceRank: targetRank,
        clearanceXp: targetRank < profile.runner.clearanceRank ? 0 : next.runner.clearanceXp,
      },
    };
    next = appendProgressionEvent(next, {
      kind: 'DEBUG_GRANT',
      message: `Debug force runner clearance to ${targetRank}`,
      meta: { clearanceRank: targetRank },
    });
  }
  const synced = syncRunnerClearanceUnlocks(next);
  return {
    account: withProgressionProfile(account, synced.profile),
    logLine: `>> DEBUG PROGRESSION — runner clearance → ${targetRank}`
      + (synced.unlocksGranted.length > 0
        ? ` // unlocked ${synced.unlocksGranted.join(', ')}`
        : ''),
  };
}

/** Debug: unlock a sector by id. */
export function debugUnlockSector(
  account: PlayerAccount,
  sectorId: SectorId,
): { account: PlayerAccount; logLine: string } {
  const profile = getAccountProgressionProfile(account);
  const result = applyProgressionRewards(profile, [
    { kind: 'SET_SECTOR_UNLOCKED', targetId: sectorId, value: 1 },
    { kind: 'SET_ACCESS_MANDATE', targetId: sectorId, mandateState: 'COMPLETED' },
  ], {
    logMessage: `Debug unlock sector ${sectorId}`,
    eventKind: 'DEBUG_GRANT',
  });
  return {
    account: withProgressionProfile(account, result.profile),
    logLine: `>> DEBUG PROGRESSION — sector unlocked ${sectorId}.`,
  };
}

/** Debug: add a breach grade. */
export function debugUnlockBreachGrade(
  account: PlayerAccount,
  grade: BreachGradeId,
): { account: PlayerAccount; logLine: string } {
  const profile = getAccountProgressionProfile(account);
  const result = applyProgressionRewards(profile, [
    { kind: 'ADD_BREACH_GRADE', targetId: grade },
    { kind: 'GRANT_UNLOCK', targetId: `breach_grade.${grade}` },
  ], {
    logMessage: `Debug unlock breach grade ${grade}`,
    eventKind: 'DEBUG_GRANT',
  });
  return {
    account: withProgressionProfile(account, result.profile),
    logLine: `>> DEBUG PROGRESSION — breach grade ${grade} unlocked.`,
  };
}

export function debugGrantRunnerClearanceXp(
  account: PlayerAccount,
  xpAmount: number,
): { account: PlayerAccount; logLine: string; report: string } {
  const profile = getAccountProgressionProfile(account);
  const result = applyRunnerClearanceXp(profile, xpAmount);
  const report = formatProgressionProfileReport(result.profile);
  return {
    account: withProgressionProfile(account, result.profile),
    logLine: result.logLines[0]
      ?? `>> DEBUG PROGRESSION — clearance XP +${Math.max(0, Math.floor(xpAmount))} (no-op).`,
    report,
  };
}

/** Debug: activate a sector access mandate. */
export function debugActivateSectorMandate(
  account: PlayerAccount,
  sectorId: SectorId,
): { account: PlayerAccount; logLine: string } {
  const profile = getAccountProgressionProfile(account);
  const result = activateSectorAccessMandate(profile, sectorId);
  return {
    account: withProgressionProfile(account, result.profile),
    logLine: result.logLine,
  };
}

/** Debug: grant route intel into hub stash (for extract testing). */
export function debugGrantRouteIntel(
  account: PlayerAccount,
  resourceId: ResourceItemId,
  quantity = 1,
): { account: PlayerAccount; logLine: string } {
  const mandate = getMandateForRouteIntel(resourceId);
  if (!mandate) {
    return {
      account,
      logLine: `>> DEBUG — ${resourceId} is not route intel.`,
    };
  }
  const nextStash = { ...account.resourceStash };
  nextStash[resourceId] = (nextStash[resourceId] ?? 0) + Math.max(1, quantity);
  return {
    account: { ...account, resourceStash: nextStash },
    logLine: `>> DEBUG — granted ${getResourceDisplayName(resourceId)} x${Math.max(1, quantity)} to stash.`,
  };
}

/** Debug: reset progression profile to fresh defaults. */
export function debugResetProgressionProfile(
  account: PlayerAccount,
): { account: PlayerAccount; logLine: string } {
  let profile = createDefaultProgressionProfile();
  profile = appendProgressionEvent(profile, {
    kind: 'PROFILE_RESET',
    message: 'Progression profile reset to defaults.',
  });
  return {
    account: withProgressionProfile(account, profile),
    logLine: '>> DEBUG PROGRESSION — profile reset (Null Zone + Grade I only).',
  };
}
