import type { PlayerAccount } from '../types/game';
import type { AppraisalValueBand } from '../types/sealedCargo';
import {
  APPRAISABLE_SEALED_RESOURCE_IDS,
} from '../types/sealedCargo';
import {
  JAR_APPRAISED_SELL_VALUES,
  APPRAISED_SELL_VALUES,
  resolveOpeningFee,
  resolveSealedSellValue,
} from './sealedCasketAppraisalEngine';
import {
  listSealedStashEntries,
  SEALED_CARGO_CONFIGS,
  syncSealedStackMetaCount,
} from './sealedCargoEngine';
import { SEALED_CASKET_REWARD_RESOURCE_IDS, validateSealedCasketRewardTable } from './sealedCasketOpenEngine';
import { SPECIMEN_JAR_REWARD_RESOURCE_IDS, validateSpecimenJarRewardTable } from './sealedSpecimenJarOpenEngine';
import { RESOURCE_REGISTRY } from './resourceRegistry';

export interface SealedCargoValidationIssue {
  severity: 'error' | 'warn';
  message: string;
}

export function validateSealedCargoConfig(): SealedCargoValidationIssue[] {
  const issues: SealedCargoValidationIssue[] = [];
  (Object.values(SEALED_CARGO_CONFIGS)).forEach((config) => {
    if (config.sealedSellValue <= 0) {
      issues.push({ severity: 'error', message: `${config.resourceId}: sealed sell value must be positive.` });
    }
    if (config.appraisalFee <= 0) {
      issues.push({ severity: 'error', message: `${config.resourceId}: appraisal fee must be positive.` });
    }
    if (config.openingFee <= 0) {
      issues.push({ severity: 'error', message: `${config.resourceId}: opening fee must be positive.` });
    }
    if (!RESOURCE_REGISTRY[config.resourceId]?.canOpenAtHub) {
      issues.push({ severity: 'error', message: `${config.resourceId}: canOpenAtHub must be true.` });
    }
  });
  (Object.entries(APPRAISED_SELL_VALUES) as Array<[AppraisalValueBand, number]>).forEach(([band, value]) => {
    if (value < SEALED_CARGO_CONFIGS['sealed-containment-casket'].sealedSellValue) {
      issues.push({
        severity: 'warn',
        message: `Casket appraised sell value for ${band} (${value}) is below unappraised baseline.`,
      });
    }
  });
  (Object.entries(JAR_APPRAISED_SELL_VALUES) as Array<[AppraisalValueBand, number]>).forEach(([band, value]) => {
    if (value < SEALED_CARGO_CONFIGS['blacksite-specimen-jar'].sealedSellValue) {
      issues.push({
        severity: 'warn',
        message: `Jar appraised sell value for ${band} (${value}) is below unappraised baseline.`,
      });
    }
  });
  return issues;
}

export function validateSealedCargoAccount(
  account: Pick<PlayerAccount, 'resourceStash' | 'sealedCargoStacks'>,
): SealedCargoValidationIssue[] {
  const issues: SealedCargoValidationIssue[] = [];
  const stacks = account.sealedCargoStacks ?? [];
  APPRAISABLE_SEALED_RESOURCE_IDS.forEach((resourceId) => {
    const qty = account.resourceStash[resourceId] ?? 0;
    const activeStacks = stacks.filter(
      (entry) => entry.resourceId === resourceId && entry.state !== 'OPENED',
    );
    const synced = syncSealedStackMetaCount(activeStacks, qty, resourceId);
    if (synced.length !== activeStacks.length && qty > 0) {
      issues.push({
        severity: 'warn',
        message: `${resourceId}: sealed stack metadata count drifted from stash quantity.`,
      });
    }
    activeStacks.forEach((entry) => {
      if (entry.state === 'APPRAISED' && !entry.valueBand) {
        issues.push({ severity: 'error', message: `${resourceId}: appraised stack missing value band.` });
      }
    });
  });
  return issues;
}

export function validateSealedCasketRewardResources(): SealedCargoValidationIssue[] {
  const issues: SealedCargoValidationIssue[] = [];
  SEALED_CASKET_REWARD_RESOURCE_IDS.forEach((resourceId) => {
    if (!RESOURCE_REGISTRY[resourceId]) {
      issues.push({ severity: 'error', message: `Casket open reward references unknown resource: ${resourceId}` });
    }
  });
  SPECIMEN_JAR_REWARD_RESOURCE_IDS.forEach((resourceId) => {
    if (!RESOURCE_REGISTRY[resourceId]) {
      issues.push({ severity: 'error', message: `Specimen jar open reward references unknown resource: ${resourceId}` });
    }
  });
  validateSealedCasketRewardTable().forEach((message) => {
    issues.push({ severity: 'error', message });
  });
  validateSpecimenJarRewardTable().forEach((message) => {
    issues.push({ severity: 'error', message });
  });
  return issues;
}

export function validateSealedSellValues(): SealedCargoValidationIssue[] {
  const issues: SealedCargoValidationIssue[] = [];
  APPRAISABLE_SEALED_RESOURCE_IDS.forEach((resourceId) => {
    const config = SEALED_CARGO_CONFIGS[resourceId];
    const unappraised = resolveSealedSellValue('SEALED', undefined, resourceId);
    if (unappraised !== config.sealedSellValue) {
      issues.push({ severity: 'error', message: `${resourceId}: unappraised sell value resolver mismatch.` });
    }
    const sellTable = resourceId === 'blacksite-specimen-jar' ? JAR_APPRAISED_SELL_VALUES : APPRAISED_SELL_VALUES;
    (Object.keys(sellTable) as AppraisalValueBand[]).forEach((band) => {
      const value = resolveSealedSellValue('APPRAISED', band, resourceId);
      if (value !== sellTable[band]) {
        issues.push({ severity: 'error', message: `${resourceId}: appraised sell value mismatch for ${band}.` });
      }
    });
    if (resolveOpeningFee(true, resourceId) !== 0) {
      issues.push({ severity: 'error', message: `${resourceId}: opening fee should be waived when appraised.` });
    }
  });
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
        issues.push({ severity: 'error', message: `${entry.resourceId}: sealed stash entry has invalid sell value.` });
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
