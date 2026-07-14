import type { PlayerAccount } from '../types/game';
import type { AppraisalValueBand } from '../types/sealedCargo';
import {
  BLACKSITE_SPECIMEN_JAR_ID,
  SEALED_CONTAINMENT_CASKET_ID,
  type SealedContainerResourceId,
} from '../types/sealedCargo';
import { listSealedStashEntries } from './sealedCargoEngine';
import {
  appraiseSealedCargoInStash,
  normalizeSealedCargoStacks,
  openSealedCargoInStash,
  sellSealedCargoInStash,
} from './sealedCargoHubEngine';
import { setDebugForcedAppraisalBand } from './sealedCasketAppraisalEngine';
import { setDebugForcedCasketTier, simulateSealedCasketOpenRolls, type CasketRewardTierId } from './sealedCasketOpenEngine';
import {
  setDebugForcedSpecimenJarTier,
  simulateSpecimenJarOpenRolls,
  type SpecimenJarRewardTierId,
} from './sealedSpecimenJarOpenEngine';
import { formatSealedCargoValidationReport, validateSealedCargoPipeline } from './sealedCargoValidationEngine';
import { addToResourceStash } from './resourceStashEngine';
import { formatResourceEconomyReport } from './resourceEconomyReportEngine';
import { EXPANSION_RESOURCE_ITEM_IDS } from './resourceRegistry';
import type { ResourceItemId } from '../types/resourceItem';

export function debugForceAppraisalBand(band: AppraisalValueBand | null): void {
  setDebugForcedAppraisalBand(band);
}

export function debugForceOpenTier(tierId: CasketRewardTierId | null): void {
  setDebugForcedCasketTier(tierId);
}

export function debugForceSpecimenJarTier(tierId: SpecimenJarRewardTierId | null): void {
  setDebugForcedSpecimenJarTier(tierId);
}

function grantSealedContainer(
  account: PlayerAccount,
  resourceId: SealedContainerResourceId,
  quantity: number,
): PlayerAccount {
  const nextStash = addToResourceStash(account.resourceStash, resourceId, quantity);
  const stacks = normalizeSealedCargoStacks({
    resourceStash: nextStash,
    sealedCargoStacks: account.sealedCargoStacks ?? [],
  });
  return {
    ...account,
    resourceStash: nextStash,
    sealedCargoStacks: stacks,
  };
}

export function debugGrantSealedCasket(account: PlayerAccount, quantity = 1): PlayerAccount {
  return grantSealedContainer(account, SEALED_CONTAINMENT_CASKET_ID, quantity);
}

export function debugGrantSpecimenJar(account: PlayerAccount, quantity = 1): PlayerAccount {
  return grantSealedContainer(account, BLACKSITE_SPECIMEN_JAR_ID, quantity);
}

export function debugGrantExpansionResources(account: PlayerAccount): PlayerAccount {
  let stash = { ...account.resourceStash };
  const grants: Partial<Record<ResourceItemId, number>> = {
    'nullcrete-shard': 6,
    'mycelial-ichor': 4,
    'cinder-wire': 6,
    'rail-capacitor': 6,
    'containment-seal': 4,
    'resonant-filament': 8,
    'anchor-marrow': 3,
    'breach-thread': 3,
  };
  (Object.entries(grants) as Array<[ResourceItemId, number]>).forEach(([id, qty]) => {
    stash = addToResourceStash(stash, id, qty);
  });
  let next: PlayerAccount = { ...account, resourceStash: stash };
  next = debugGrantSpecimenJar(next, 1);
  return next;
}

export function debugPreviewSealedStash(account: PlayerAccount): string {
  const entries = listSealedStashEntries(account.resourceStash, account.sealedCargoStacks ?? []);
  const lines = [
    'SEALED STASH PREVIEW',
    `caskets: ${account.resourceStash[SEALED_CONTAINMENT_CASKET_ID] ?? 0}`,
    `specimen jars: ${account.resourceStash[BLACKSITE_SPECIMEN_JAR_ID] ?? 0}`,
    `tracked stacks: ${entries.length}`,
  ];
  entries.forEach((entry) => {
    lines.push(
      `- ${entry.resourceId} // ${entry.stackId.slice(-8)} state=${entry.state} band=${entry.valueBand ?? 'none'} sell=${entry.sellValue} CR`,
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
  const lines = [`CASKET OPEN SIM — ${count} rolls`];
  rolls.forEach((entry, index) => {
    lines.push(`${index + 1}. ${entry.tierId} — ${entry.summaryLabel}`);
  });
  return lines.join('\n');
}

export function debugSimulateSpecimenJarOpenRolls(count = 20): string {
  const rolls = simulateSpecimenJarOpenRolls(count);
  const lines = [`SPECIMEN JAR OPEN SIM — ${count} rolls`];
  rolls.forEach((entry, index) => {
    lines.push(`${index + 1}. ${entry.tierId} — ${entry.summaryLabel}`);
  });
  return lines.join('\n');
}

export function debugValidateSealedCargo(account: PlayerAccount): string {
  return formatSealedCargoValidationReport(validateSealedCargoPipeline(account));
}

export function debugResourceEconomyReport(): string {
  return formatResourceEconomyReport();
}

export { EXPANSION_RESOURCE_ITEM_IDS };
