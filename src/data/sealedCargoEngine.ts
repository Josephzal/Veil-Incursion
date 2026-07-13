import type {
  AppraisalValueBand,
  SealedCargoAppraisalConfig,
  SealedCargoStackMeta,
  SealedCargoState,
} from '../types/sealedCargo';
import { SEALED_CONTAINMENT_CASKET_ID } from '../types/sealedCargo';
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

export function isAppraisableSealedResource(resourceId: ResourceItemId): boolean {
  return resourceId === SEALED_CONTAINMENT_CASKET_ID
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
  resourceId: typeof SEALED_CONTAINMENT_CASKET_ID = SEALED_CONTAINMENT_CASKET_ID,
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
  resourceId: typeof SEALED_CONTAINMENT_CASKET_ID = SEALED_CONTAINMENT_CASKET_ID,
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
  resourceId: typeof SEALED_CONTAINMENT_CASKET_ID;
  state: SealedCargoState;
  valueBand?: AppraisalValueBand;
  sellValue: number;
}> {
  const qty = stash[SEALED_CONTAINMENT_CASKET_ID] ?? 0;
  const stacks = meta.filter((entry) => entry.resourceId === SEALED_CONTAINMENT_CASKET_ID && entry.state !== 'OPENED');
  const normalized = syncSealedStackMetaCount(stacks, qty);
  return normalized.slice(0, qty).map((entry) => ({
    stackId: entry.stackId,
    resourceId: entry.resourceId,
    state: entry.state,
    valueBand: entry.valueBand,
    sellValue: resolveSealedSellValue(
      entry.state === 'APPRAISED' ? 'APPRAISED' : 'SEALED',
      entry.valueBand,
    ),
  }));
}

export function formatSealedCargoWarning(isContractTarget: boolean, action: 'OPEN' | 'SELL' | 'APPRAISE'): string | null {
  if (!isContractTarget) {
    switch (action) {
      case 'OPEN':
        return 'Opening this casket consumes it.';
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
