import type { PlayerAccount } from '../types/game';
import type {
  AppraisalValueBand,
  CasketAppraisalResult,
  CasketOpenResult,
  SealedCargoStackMeta,
  SealedCargoState,
  SealedContainerResourceId,
} from '../types/sealedCargo';
import type { ResourceQuantity } from '../types/resourceItem';
import type { CargoRoutingResult, RoutableCargoItem } from '../types/postRunCargoRouting';
import {
  APPRAISABLE_SEALED_RESOURCE_IDS,
  SEALED_CONTAINMENT_CASKET_ID,
} from '../types/sealedCargo';
import {
  getAppraisalBandLabel,
  resolveOpeningFee,
  resolveSealedSellValue,
  rollAppraisalValueBand,
} from './sealedCasketAppraisalEngine';
import {
  createSealedStackMeta,
  getSealedCargoConfig,
  SEALED_CASKET_CONFIG,
  syncSealedStackMetaCount,
} from './sealedCargoEngine';
import { rollSealedContainerOpenReward } from './sealedContainerOpenEngine';
import { addToResourceStash } from './resourceStashEngine';
import { getResourceShortName } from './resourceRegistry';

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
  let stacks = (account.sealedCargoStacks ?? []).filter((entry) => entry.state !== 'OPENED');
  APPRAISABLE_SEALED_RESOURCE_IDS.forEach((resourceId) => {
    const qty = account.resourceStash[resourceId] ?? 0;
    stacks = syncSealedStackMetaCount(stacks, qty, resourceId);
  });
  return stacks;
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
  const config = getSealedCargoConfig(stack.resourceId) ?? SEALED_CASKET_CONFIG;
  const fee = config.appraisalFee;
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
      resourceId: stack.resourceId,
      quantity: 1,
      valueBand,
      displayLabel: getAppraisalBandLabel(valueBand, stack.resourceId),
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
    logLine: `>> APPRAISED — ${getResourceShortName(stack.resourceId).toUpperCase()} // ${getAppraisalBandLabel(valueBand, stack.resourceId).toUpperCase()} (−${fee} CR)`,
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
  const openingFee = resolveOpeningFee(consumed.state === 'APPRAISED', consumed.resourceId);
  if (account.cabalCredits < openingFee) {
    return { ok: false, error: `Opening requires ${openingFee} credits.` };
  }

  const reward = rollSealedContainerOpenReward(consumed.resourceId, { valueBand: consumed.valueBand });
  let nextStash = { ...account.resourceStash };
  nextStash[consumed.resourceId] = Math.max(0, (nextStash[consumed.resourceId] ?? 1) - 1);
  if ((nextStash[consumed.resourceId] ?? 0) <= 0) {
    delete nextStash[consumed.resourceId];
  }

  (Object.entries(reward.resources) as Array<[import('../types/resourceItem').ResourceItemId, number | undefined]>).forEach(
    ([resourceId, quantity]) => {
      if (!quantity || quantity <= 0) return;
      nextStash = addToResourceStash(nextStash, resourceId, quantity);
    },
  );

  const nextStacks = stacks.filter((entry) => entry.stackId !== stackId);
  const normalizedStacks = normalizeSealedCargoStacks({
    resourceStash: nextStash,
    sealedCargoStacks: nextStacks,
  });
  const netCredits = account.cabalCredits - openingFee + reward.credits;

  return {
    ok: true,
    creditsDelta: -openingFee + reward.credits,
    open: {
      resourceId: consumed.resourceId,
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
    logLine: `>> ${getResourceShortName(consumed.resourceId).toUpperCase()} OPENED — ${reward.summaryLabel.toUpperCase()} (+${reward.credits} CR${reward.dudFlavor ? ` // ${reward.dudFlavor}` : ''})`,
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
    stack.resourceId,
  );
  let nextStash = { ...account.resourceStash };
  nextStash[stack.resourceId] = Math.max(0, (nextStash[stack.resourceId] ?? 1) - 1);
  if ((nextStash[stack.resourceId] ?? 0) <= 0) {
    delete nextStash[stack.resourceId];
  }
  const nextStacks = stacks.filter((entry) => entry.stackId !== stackId);
  const normalizedStacks = normalizeSealedCargoStacks({
    resourceStash: nextStash,
    sealedCargoStacks: nextStacks,
  });

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
    logLine: `>> SOLD SEALED ${getResourceShortName(stack.resourceId).toUpperCase()} — +${sellValue} CR (contents forfeited)`,
  };
}

export function appendSealedStacksForStashedCaskets(
  stacks: SealedCargoStackMeta[],
  quantityAdded: number,
  resourceId: SealedContainerResourceId = SEALED_CONTAINMENT_CASKET_ID,
): SealedCargoStackMeta[] {
  let next = [...stacks];
  for (let index = 0; index < quantityAdded; index += 1) {
    next.push(createSealedStackMeta(resourceId));
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
  let stacks = (prev.sealedCargoStacks ?? []).filter((entry) => entry.state !== 'OPENED');
  APPRAISABLE_SEALED_RESOURCE_IDS.forEach((resourceId) => {
    const nextQty = nextStash[resourceId] ?? 0;
    stacks = syncSealedStackMetaCount(stacks, nextQty, resourceId);

    const keptQty = result.kept[resourceId] ?? 0;
    if (keptQty <= 0) return;

    items
      .filter((item) => item.resourceId === resourceId)
      .forEach((item) => {
        const key = item.sealedItemKey;
        const meta = key ? sealedAppraisalByItemKey[key] : undefined;
        if (!meta || meta.state !== 'APPRAISED') return;
        let remaining = keptQty;
        stacks = stacks.map((entry) => {
          if (remaining <= 0 || entry.resourceId !== resourceId || entry.state !== 'SEALED') return entry;
          remaining -= 1;
          return {
            ...entry,
            state: 'APPRAISED' as const,
            valueBand: meta.valueBand,
            appraisedAt: Date.now(),
          };
        });
      });
  });

  return stacks;
}

export function incrementCareerSealedFromRouting(
  stats: import('../types/sealedCargo').CareerSealedCargoStats,
  result: CargoRoutingResult,
  routingAppraisalCount: number,
): import('../types/sealedCargo').CareerSealedCargoStats {
  let opened = 0;
  let sold = 0;
  let delivered = 0;
  APPRAISABLE_SEALED_RESOURCE_IDS.forEach((resourceId) => {
    opened += result.opened[resourceId] ?? 0;
    sold += result.fenced[resourceId] ?? 0;
    delivered += result.delivered[resourceId] ?? 0;
  });
  return {
    ...stats,
    appraised: stats.appraised + routingAppraisalCount,
    opened: stats.opened + opened,
    soldSealed: stats.soldSealed + sold,
    deliveredSealed: stats.deliveredSealed + delivered,
  };
}
