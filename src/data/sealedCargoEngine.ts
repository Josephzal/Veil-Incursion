import type {
  AppraisalValueBand,
  SealedCargoAppraisalConfig,
  SealedCargoStackMeta,
  SealedCargoState,
  SealedContainerResourceId,
} from '../types/sealedCargo';
import {
  APPRAISABLE_SEALED_RESOURCE_IDS,
  BLACKSITE_SPECIMEN_JAR_ID,
  SEALED_CONTAINMENT_CASKET_ID,
} from '../types/sealedCargo';
import type { ResourceItemId, ResourceQuantity } from '../types/resourceItem';
import { hasResourceUsageTag } from './resourceRegistry';
import { resolveSealedSellValue } from './sealedCasketAppraisalEngine';

export const SEALED_CASKET_CONFIG: SealedCargoAppraisalConfig = {
  resourceId: SEALED_CONTAINMENT_CASKET_ID,
  appraisalTableId: 'sealed-containment-casket-v1',
  sealedSellValue: 150,
  appraisalFee: 50,
  openingFee: 100,
  openingFeeWaivedIfAppraised: true,
  canOpenInRun: false,
  canOpenAtHub: true,
  canDeliverSealed: true,
  canSellSealed: true,
};

/** Lower-tier sibling — cheaper fees, softer sell ceiling. */
export const SEALED_SPECIMEN_JAR_CONFIG: SealedCargoAppraisalConfig = {
  resourceId: BLACKSITE_SPECIMEN_JAR_ID,
  appraisalTableId: 'blacksite-specimen-jar-v1',
  sealedSellValue: 80,
  appraisalFee: 30,
  openingFee: 50,
  openingFeeWaivedIfAppraised: true,
  canOpenInRun: false,
  canOpenAtHub: true,
  canDeliverSealed: true,
  canSellSealed: true,
};

export const SEALED_CARGO_CONFIGS: Record<SealedContainerResourceId, SealedCargoAppraisalConfig> = {
  [SEALED_CONTAINMENT_CASKET_ID]: SEALED_CASKET_CONFIG,
  [BLACKSITE_SPECIMEN_JAR_ID]: SEALED_SPECIMEN_JAR_CONFIG,
};

export function getSealedCargoConfig(
  resourceId: ResourceItemId,
): SealedCargoAppraisalConfig | null {
  if (resourceId === SEALED_CONTAINMENT_CASKET_ID || resourceId === BLACKSITE_SPECIMEN_JAR_ID) {
    return SEALED_CARGO_CONFIGS[resourceId];
  }
  return null;
}

export function isAppraisableSealedResource(resourceId: ResourceItemId): boolean {
  return Boolean(getSealedCargoConfig(resourceId))
    || hasResourceUsageTag(resourceId, 'UNIDENTIFIED_CONTAINER');
}

export function buildSealedCargoItemKey(
  resourceId: ResourceItemId,
  source: 'EXTRACTED' | 'BANKED' | 'STASH',
  index = 0,
): string {
  return `${resourceId}:${source}:${index}`;
}

export function createSealedStackMeta(
  resourceId: SealedContainerResourceId = SEALED_CONTAINMENT_CASKET_ID,
): SealedCargoStackMeta {
  return {
    stackId: `sealed-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    resourceId,
    state: 'SEALED',
  };
}

export function syncSealedStackMetaCount(
  meta: SealedCargoStackMeta[],
  quantity: number,
  resourceId: SealedContainerResourceId = SEALED_CONTAINMENT_CASKET_ID,
): SealedCargoStackMeta[] {
  const relevant = meta.filter((entry) => entry.resourceId === resourceId && entry.state !== 'OPENED');
  if (relevant.length === quantity) return meta;
  if (relevant.length > quantity) {
    let remove = relevant.length - quantity;
    return meta.filter((entry) => {
      if (remove > 0 && entry.resourceId === resourceId && entry.state !== 'OPENED') {
        remove -= 1;
        return false;
      }
      return true;
    });
  }
  const additions = Array.from({ length: quantity - relevant.length }, () => createSealedStackMeta(resourceId));
  return [...meta, ...additions];
}

export function consumeSealedStackMeta(
  meta: SealedCargoStackMeta[],
  resourceId: ResourceItemId,
): { meta: SealedCargoStackMeta[]; consumed: SealedCargoStackMeta | null } {
  const index = meta.findIndex((entry) => entry.resourceId === resourceId && entry.state !== 'OPENED');
  if (index < 0) {
    return { meta, consumed: null };
  }
  const consumed = meta[index]!;
  return {
    meta: meta.filter((_, idx) => idx !== index),
    consumed,
  };
}

export function listSealedStashEntries(
  stash: ResourceQuantity,
  meta: SealedCargoStackMeta[],
): Array<{
  stackId: string;
  resourceId: SealedContainerResourceId;
  state: SealedCargoState;
  valueBand?: AppraisalValueBand;
  sellValue: number;
}> {
  let working = meta.filter((entry) => entry.state !== 'OPENED');
  const entries: Array<{
    stackId: string;
    resourceId: SealedContainerResourceId;
    state: SealedCargoState;
    valueBand?: AppraisalValueBand;
    sellValue: number;
  }> = [];

  APPRAISABLE_SEALED_RESOURCE_IDS.forEach((resourceId) => {
    const qty = stash[resourceId] ?? 0;
    working = syncSealedStackMetaCount(working, qty, resourceId);
    working
      .filter((entry) => entry.resourceId === resourceId && entry.state !== 'OPENED')
      .slice(0, qty)
      .forEach((entry) => {
        entries.push({
          stackId: entry.stackId,
          resourceId: entry.resourceId,
          state: entry.state,
          valueBand: entry.valueBand,
          sellValue: resolveSealedSellValue(
            entry.state === 'APPRAISED' ? 'APPRAISED' : 'SEALED',
            entry.valueBand,
            resourceId,
          ),
        });
      });
  });

  return entries;
}

export function formatSealedCargoWarning(isContractTarget: boolean, action: 'OPEN' | 'SELL' | 'APPRAISE'): string | null {
  if (!isContractTarget) {
    switch (action) {
      case 'OPEN':
        return 'Opening this sealed cargo consumes it.';
      case 'SELL':
        return 'Selling sealed cargo forfeits any hidden contents.';
      default:
        return null;
    }
  }
  switch (action) {
    case 'OPEN':
      return 'Opening this will prevent sealed delivery.';
    case 'SELL':
      return 'Selling contract cargo betrays the sponsor contract.';
    case 'APPRAISE':
      return 'Appraised value does not guarantee exact contents.';
    default:
      return null;
  }
}
