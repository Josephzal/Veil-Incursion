import type { PlayerAccount } from '../types/game';
import type { AppraisalValueBand } from '../types/sealedCargo';
import { SEALED_CONTAINMENT_CASKET_ID } from '../types/sealedCargo';
import { createSealedStackMeta, listSealedStashEntries } from './sealedCargoEngine';
import {
  appraiseSealedCargoInStash,
  normalizeSealedCargoStacks,
  openSealedCargoInStash,
  sellSealedCargoInStash,
} from './sealedCargoHubEngine';
import { setDebugForcedAppraisalBand } from './sealedCasketAppraisalEngine';
import { setDebugForcedCasketTier, simulateSealedCasketOpenRolls, type CasketRewardTierId } from './sealedCasketOpenEngine';
import { formatSealedCargoValidationReport, validateSealedCargoPipeline } from './sealedCargoValidationEngine';
import { addToResourceStash } from './resourceStashEngine';

export function debugForceAppraisalBand(band: AppraisalValueBand | null): void {
  setDebugForcedAppraisalBand(band);
}

export function debugForceOpenTier(tierId: CasketRewardTierId | null): void {
  setDebugForcedCasketTier(tierId);
}

export function debugGrantSealedCasket(account: PlayerAccount, quantity = 1): PlayerAccount {
  const nextStash = addToResourceStash(account.resourceStash, SEALED_CONTAINMENT_CASKET_ID, quantity);
  let stacks = normalizeSealedCargoStacks(account);
  for (let index = 0; index < quantity; index += 1) {
    stacks = [...stacks, createSealedStackMeta()];
  }
  return {
    ...account,
    resourceStash: nextStash,
    sealedCargoStacks: stacks,
  };
}

export function debugPreviewSealedStash(account: PlayerAccount): string {
  const entries = listSealedStashEntries(account.resourceStash, account.sealedCargoStacks ?? []);
  const lines = [
    'SEALED STASH PREVIEW',
    `caskets in stash: ${account.resourceStash[SEALED_CONTAINMENT_CASKET_ID] ?? 0}`,
    `tracked stacks: ${entries.length}`,
  ];
  entries.forEach((entry) => {
    lines.push(
      `- ${entry.stackId.slice(-8)} state=${entry.state} band=${entry.valueBand ?? 'none'} sell=${entry.sellValue} CR`,
    );
  });
  return lines.join('\n');
}

export function debugSimulateHubAppraisal(account: PlayerAccount, stackId: string): string {
  const result = appraiseSealedCargoInStash(account, stackId);
  if (!result.ok) return `APPRAISE FAILED — ${result.error ?? 'unknown error'}`;
  return result.logLine ?? 'APPRAISED';
}

export function debugSimulateHubOpen(account: PlayerAccount, stackId: string): string {
  const result = openSealedCargoInStash(account, stackId);
  if (!result.ok) return `OPEN FAILED — ${result.error ?? 'unknown error'}`;
  return result.logLine ?? 'OPENED';
}

export function debugSimulateHubSell(account: PlayerAccount, stackId: string): string {
  const result = sellSealedCargoInStash(account, stackId);
  if (!result.ok) return `SELL FAILED — ${result.error ?? 'unknown error'}`;
  return result.logLine ?? 'SOLD';
}

export function debugSimulateOpenRolls(count = 20): string {
  const rolls = simulateSealedCasketOpenRolls(count);
  const lines = [`SEALED OPEN SIM — ${count} rolls`];
  rolls.forEach((entry, index) => {
    lines.push(`${index + 1}. ${entry.tierId} — ${entry.summaryLabel}`);
  });
  return lines.join('\n');
}

export function debugValidateSealedCargo(account: PlayerAccount): string {
  return formatSealedCargoValidationReport(validateSealedCargoPipeline(account));
}
