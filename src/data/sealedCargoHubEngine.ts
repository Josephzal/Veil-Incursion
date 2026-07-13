import type { ActiveRunContract } from '../types/contract';
import type { PlayerAccount } from '../types/game';
import type {
  AppraisalValueBand,
  CasketAppraisalResult,
  CasketOpenResult,
  SealedCargoStackMeta,
  SealedCargoState,
} from '../types/sealedCargo';
import type { ResourceQuantity } from '../types/resourceItem';
import type { CargoRoutingResult, RoutableCargoItem } from '../types/postRunCargoRouting';
import { SEALED_CONTAINMENT_CASKET_ID } from '../types/sealedCargo';
import {
  getAppraisalBandLabel,
  resolveOpeningFee,
  resolveSealedSellValue,
  rollAppraisalValueBand,
} from './sealedCasketAppraisalEngine';
import {
  createSealedStackMeta,
  SEALED_CASKET_CONFIG,
  syncSealedStackMetaCount,
} from './sealedCargoEngine';
import { rollSealedCasketOpenReward } from './sealedCasketOpenEngine';
import { addToResourceStash } from './resourceStashEngine';

export interface SealedCargoHubActionResult {
  ok: boolean;
  error?: string;
  accountPatch?: Partial<PlayerAccount>;
  appraisal?: CasketAppraisalResult;
  open?: CasketOpenResult;
  creditsDelta?: number;
  logLine?: string;
}

export function normalizeSealedCargoStacks(
  account: Pick<PlayerAccount, 'resourceStash' | 'sealedCargoStacks'>,
): SealedCargoStackMeta[] {
  const qty = account.resourceStash[SEALED_CONTAINMENT_CASKET_ID] ?? 0;
  return syncSealedStackMetaCount(account.sealedCargoStacks ?? [], qty);
}

export function appraiseSealedCargoInStash(
  account: PlayerAccount,
  stackId: string,
): SealedCargoHubActionResult {
  const stacks = normalizeSealedCargoStacks(account);
  const index = stacks.findIndex((entry) => entry.stackId === stackId);
  if (index < 0) {
    return { ok: false, error: 'Sealed cargo stack not found.' };
  }
  const stack = stacks[index]!;
  if (stack.state === 'APPRAISED') {
    return { ok: false, error: 'Already appraised.' };
  }
  const fee = SEALED_CASKET_CONFIG.appraisalFee;
  if (account.cabalCredits < fee) {
    return { ok: false, error: `Appraisal requires ${fee} credits.` };
  }
  const valueBand = rollAppraisalValueBand();
  const nextStacks = [...stacks];
  nextStacks[index] = {
    ...stack,
    state: 'APPRAISED',
    valueBand,
    appraisedAt: Date.now(),
  };
  return {
    ok: true,
    creditsDelta: -fee,
    appraisal: {
      resourceId: SEALED_CONTAINMENT_CASKET_ID,
      quantity: 1,
      valueBand,
      displayLabel: getAppraisalBandLabel(valueBand),
      feePaid: fee,
    },
    accountPatch: {
      cabalCredits: account.cabalCredits - fee,
      sealedCargoStacks: nextStacks,
      careerSealedCargo: {
        ...(account.careerSealedCargo ?? { appraised: 0, opened: 0, soldSealed: 0, deliveredSealed: 0 }),
        appraised: (account.careerSealedCargo?.appraised ?? 0) + 1,
      },
    },
    logLine: `>> APPRAISED — ${getAppraisalBandLabel(valueBand).toUpperCase()} (−${fee} CR)`,
  };
}

export function openSealedCargoInStash(
  account: PlayerAccount,
  stackId: string,
): SealedCargoHubActionResult {
  const stacks = normalizeSealedCargoStacks(account);
  const index = stacks.findIndex((entry) => entry.stackId === stackId);
  if (index < 0) {
    return { ok: false, error: 'Sealed cargo stack not found.' };
  }
  const consumed = stacks[index]!;
  const openingFee = resolveOpeningFee(consumed.state === 'APPRAISED');
  if (account.cabalCredits < openingFee) {
    return { ok: false, error: `Opening requires ${openingFee} credits.` };
  }

  const reward = rollSealedCasketOpenReward({ valueBand: consumed.valueBand });
  let nextStash = { ...account.resourceStash };
  nextStash[SEALED_CONTAINMENT_CASKET_ID] = Math.max(0, (nextStash[SEALED_CONTAINMENT_CASKET_ID] ?? 1) - 1);
  if ((nextStash[SEALED_CONTAINMENT_CASKET_ID] ?? 0) <= 0) {
    delete nextStash[SEALED_CONTAINMENT_CASKET_ID];
  }

  (Object.entries(reward.resources) as Array<[import('../types/resourceItem').ResourceItemId, number | undefined]>).forEach(
    ([resourceId, quantity]) => {
      if (!quantity || quantity <= 0) return;
      nextStash = addToResourceStash(nextStash, resourceId, quantity);
    },
  );

  const nextStacks = stacks.filter((entry) => entry.stackId !== stackId);
  const normalizedStacks = syncSealedStackMetaCount(nextStacks, nextStash[SEALED_CONTAINMENT_CASKET_ID] ?? 0);
  const netCredits = account.cabalCredits - openingFee + reward.credits;

  return {
    ok: true,
    creditsDelta: -openingFee + reward.credits,
    open: {
      resourceId: SEALED_CONTAINMENT_CASKET_ID,
      quantity: 1,
      tierId: reward.tierId,
      tierLabel: reward.summaryLabel,
      summaryLabel: reward.summaryLabel,
      dudFlavor: reward.dudFlavor,
      resources: reward.resources,
      credits: reward.credits,
      openingFeePaid: openingFee,
      valueBand: consumed.valueBand,
    },
    accountPatch: {
      cabalCredits: netCredits,
      resourceStash: nextStash,
      sealedCargoStacks: normalizedStacks,
      careerSealedCargo: {
        ...(account.careerSealedCargo ?? { appraised: 0, opened: 0, soldSealed: 0, deliveredSealed: 0 }),
        opened: (account.careerSealedCargo?.opened ?? 0) + 1,
      },
    },
    logLine: `>> CASKET OPENED — ${reward.summaryLabel.toUpperCase()} (+${reward.credits} CR${reward.dudFlavor ? ` // ${reward.dudFlavor}` : ''})`,
  };
}

export function sellSealedCargoInStash(
  account: PlayerAccount,
  stackId: string,
): SealedCargoHubActionResult {
  const stacks = normalizeSealedCargoStacks(account);
  const index = stacks.findIndex((entry) => entry.stackId === stackId);
  if (index < 0) {
    return { ok: false, error: 'Sealed cargo stack not found.' };
  }
  const stack = stacks[index]!;
  const sellValue = resolveSealedSellValue(
    stack.state === 'APPRAISED' ? 'APPRAISED' : 'SEALED',
    stack.valueBand as AppraisalValueBand | undefined,
  );
  let nextStash = { ...account.resourceStash };
  nextStash[SEALED_CONTAINMENT_CASKET_ID] = Math.max(0, (nextStash[SEALED_CONTAINMENT_CASKET_ID] ?? 1) - 1);
  if ((nextStash[SEALED_CONTAINMENT_CASKET_ID] ?? 0) <= 0) {
    delete nextStash[SEALED_CONTAINMENT_CASKET_ID];
  }
  const nextStacks = stacks.filter((entry) => entry.stackId !== stackId);
  const normalizedStacks = syncSealedStackMetaCount(nextStacks, nextStash[SEALED_CONTAINMENT_CASKET_ID] ?? 0);

  return {
    ok: true,
    creditsDelta: sellValue,
    accountPatch: {
      cabalCredits: account.cabalCredits + sellValue,
      resourceStash: nextStash,
      sealedCargoStacks: normalizedStacks,
      careerSealedCargo: {
        ...(account.careerSealedCargo ?? { appraised: 0, opened: 0, soldSealed: 0, deliveredSealed: 0 }),
        soldSealed: (account.careerSealedCargo?.soldSealed ?? 0) + 1,
      },
    },
    logLine: `>> SOLD SEALED — +${sellValue} CR (contents forfeited)`,
  };
}

export function appendSealedStacksForStashedCaskets(
  stacks: SealedCargoStackMeta[],
  quantityAdded: number,
): SealedCargoStackMeta[] {
  let next = [...stacks];
  for (let index = 0; index < quantityAdded; index += 1) {
    next.push(createSealedStackMeta());
  }
  return next;
}

export function syncSealedStacksAfterRouting(
  prev: Pick<PlayerAccount, 'resourceStash' | 'sealedCargoStacks'>,
  nextStash: ResourceQuantity,
  items: RoutableCargoItem[],
  result: CargoRoutingResult,
  sealedAppraisalByItemKey: Record<string, { state: SealedCargoState; valueBand?: AppraisalValueBand }>,
): SealedCargoStackMeta[] {
  const nextQty = nextStash[SEALED_CONTAINMENT_CASKET_ID] ?? 0;
  let stacks = syncSealedStackMetaCount(
    (prev.sealedCargoStacks ?? []).filter((entry) => entry.state !== 'OPENED'),
    nextQty,
  );

  const keptQty = result.kept[SEALED_CONTAINMENT_CASKET_ID] ?? 0;
  if (keptQty <= 0) return stacks;

  items
    .filter((item) => item.resourceId === SEALED_CONTAINMENT_CASKET_ID)
    .forEach((item) => {
      const key = item.sealedItemKey;
      const meta = key ? sealedAppraisalByItemKey[key] : undefined;
      if (!meta || meta.state !== 'APPRAISED') return;
      let remaining = keptQty;
      stacks = stacks.map((entry) => {
        if (remaining <= 0 || entry.state !== 'SEALED') return entry;
        remaining -= 1;
        return {
          ...entry,
          state: 'APPRAISED' as const,
          valueBand: meta.valueBand,
          appraisedAt: Date.now(),
        };
      });
    });

  return stacks;
}

export function incrementCareerSealedFromRouting(
  stats: import('../types/sealedCargo').CareerSealedCargoStats,
  result: CargoRoutingResult,
  routingAppraisalCount: number,
): import('../types/sealedCargo').CareerSealedCargoStats {
  const opened = result.opened[SEALED_CONTAINMENT_CASKET_ID] ?? 0;
  const sold = result.fenced[SEALED_CONTAINMENT_CASKET_ID] ?? 0;
  const delivered = result.delivered[SEALED_CONTAINMENT_CASKET_ID] ?? 0;
  return {
    ...stats,
    appraised: stats.appraised + routingAppraisalCount,
    opened: stats.opened + opened,
    soldSealed: stats.soldSealed + sold,
    deliveredSealed: stats.deliveredSealed + delivered,
  };
}
