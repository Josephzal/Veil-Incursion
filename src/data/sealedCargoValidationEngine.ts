import type { PlayerAccount } from '../types/game';
import type { AppraisalValueBand } from '../types/sealedCargo';
import { SEALED_CONTAINMENT_CASKET_ID } from '../types/sealedCargo';
import { SEALED_CASKET_CONFIG, listSealedStashEntries, syncSealedStackMetaCount } from './sealedCargoEngine';
import { APPRAISED_SELL_VALUES, resolveOpeningFee, resolveSealedSellValue } from './sealedCasketAppraisalEngine';
import { SEALED_CASKET_REWARD_RESOURCE_IDS } from './sealedCasketOpenEngine';
import { RESOURCE_REGISTRY } from './resourceRegistry';

export interface SealedCargoValidationIssue {
  severity: 'error' | 'warn';
  message: string;
}

export function validateSealedCargoConfig(): SealedCargoValidationIssue[] {
  const issues: SealedCargoValidationIssue[] = [];
  if (SEALED_CASKET_CONFIG.sealedSellValue <= 0) {
    issues.push({ severity: 'error', message: 'Sealed sell value must be positive.' });
  }
  if (SEALED_CASKET_CONFIG.appraisalFee <= 0) {
    issues.push({ severity: 'error', message: 'Appraisal fee must be positive.' });
  }
  if (SEALED_CASKET_CONFIG.openingFee <= 0) {
    issues.push({ severity: 'error', message: 'Opening fee must be positive.' });
  }
  (Object.entries(APPRAISED_SELL_VALUES) as Array<[AppraisalValueBand, number]>).forEach(([band, value]) => {
    if (value < SEALED_CASKET_CONFIG.sealedSellValue) {
      issues.push({
        severity: 'warn',
        message: `Appraised sell value for ${band} (${value}) is below unappraised baseline.`,
      });
    }
  });
  return issues;
}

export function validateSealedCargoAccount(
  account: Pick<PlayerAccount, 'resourceStash' | 'sealedCargoStacks'>,
): SealedCargoValidationIssue[] {
  const issues: SealedCargoValidationIssue[] = [];
  const qty = account.resourceStash[SEALED_CONTAINMENT_CASKET_ID] ?? 0;
  const stacks = account.sealedCargoStacks ?? [];
  const activeStacks = stacks.filter(
    (entry) => entry.resourceId === SEALED_CONTAINMENT_CASKET_ID && entry.state !== 'OPENED',
  );
  const synced = syncSealedStackMetaCount(activeStacks, qty);
  if (synced.length !== activeStacks.length && qty > 0) {
    issues.push({
      severity: 'warn',
      message: 'Sealed stack metadata count drifted from stash quantity.',
    });
  }
  activeStacks.forEach((entry) => {
    if (entry.state === 'APPRAISED' && !entry.valueBand) {
      issues.push({ severity: 'error', message: 'Appraised stack missing value band.' });
    }
  });
  return issues;
}

export function validateSealedCasketRewardResources(): SealedCargoValidationIssue[] {
  const issues: SealedCargoValidationIssue[] = [];
  SEALED_CASKET_REWARD_RESOURCE_IDS.forEach((resourceId) => {
    if (!RESOURCE_REGISTRY[resourceId]) {
      issues.push({ severity: 'error', message: `Open reward references unknown resource: ${resourceId}` });
    }
  });
  return issues;
}

export function validateSealedSellValues(): SealedCargoValidationIssue[] {
  const issues: SealedCargoValidationIssue[] = [];
  const unappraised = resolveSealedSellValue('SEALED');
  if (unappraised !== SEALED_CASKET_CONFIG.sealedSellValue) {
    issues.push({ severity: 'error', message: 'Unappraised sell value resolver mismatch.' });
  }
  (Object.keys(APPRAISED_SELL_VALUES) as AppraisalValueBand[]).forEach((band) => {
    const value = resolveSealedSellValue('APPRAISED', band);
    if (value !== APPRAISED_SELL_VALUES[band]) {
      issues.push({ severity: 'error', message: `Appraised sell value mismatch for ${band}.` });
    }
  });
  if (resolveOpeningFee(true) !== 0) {
    issues.push({ severity: 'error', message: 'Opening fee should be waived when appraised.' });
  }
  return issues;
}

export function validateSealedCargoPipeline(
  account?: Pick<PlayerAccount, 'resourceStash' | 'sealedCargoStacks'> | null,
): SealedCargoValidationIssue[] {
  const issues = [
    ...validateSealedCargoConfig(),
    ...validateSealedCasketRewardResources(),
    ...validateSealedSellValues(),
  ];
  if (account) {
    issues.push(...validateSealedCargoAccount(account));
    listSealedStashEntries(account.resourceStash, account.sealedCargoStacks ?? []).forEach((entry) => {
      if (entry.sellValue <= 0) {
        issues.push({ severity: 'error', message: 'Sealed stash entry has invalid sell value.' });
      }
    });
  }
  return issues;
}

export function formatSealedCargoValidationReport(issues: SealedCargoValidationIssue[]): string {
  if (issues.length === 0) return 'SEALED CARGO — no validation issues.';
  return [
    'SEALED CARGO VALIDATION',
    ...issues.map((issue) => `[${issue.severity.toUpperCase()}] ${issue.message}`),
  ].join('\n');
}
