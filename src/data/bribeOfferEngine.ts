import type {
  BetrayalActionPreview,
  BetrayalSeverity,
  BribeOffer,
  ContractOutcomeKind,
} from '../types/betrayal';
import type { ActiveRunContract } from '../types/contract';
import type { CargoRoutingAction } from '../types/postRunCargoRouting';
import type { ResourceItemId } from '../types/resourceItem';
import type { CabalEmployerId } from '../types/worldState';
import {
  getResourceCategory,
  getResourceSellValue,
  hasResourceUsageTag,
} from './resourceRegistry';
import { isContractTargetResource } from './postRunCargoRoutingEngine';
import { sponsorDisplayName } from '../utils/contractUi';

const ALL_SPONSORS: CabalEmployerId[] = ['TERRAN_GRID', 'LEGION', 'SOLARIS'];

const SPONSOR_PREFERRED_RESOURCES: Record<CabalEmployerId, ResourceItemId[]> = {
  TERRAN_GRID: [
    'encrypted-grid-drive',
    'sealed-containment-casket',
    'blacksite-specimen-jar',
    'smugglers-ledger',
    'tarnished-dog-tags',
    'anomalous-core',
  ],
  LEGION: [
    'legion-blood-iron',
    'sealed-containment-casket',
    'blacksite-specimen-jar',
    'anomalous-core',
    'tarnished-dog-tags',
  ],
  SOLARIS: [
    'sanguine-ampoule',
    'ossified-ley-knot',
    'veil-ash-canister',
    'blacksite-specimen-jar',
    'anomalous-core',
  ],
};

const SPONSOR_BRIBE_FLAVOR: Record<CabalEmployerId, string> = {
  TERRAN_GRID: 'Containment, evidence, logistics — clean payout if you reroute.',
  LEGION: 'Bring us the weapon. Do not ask what it becomes.',
  SOLARIS: 'Do not cage it. Let it evolve.',
};

const SPONSOR_BONUS_RESOURCES: Record<CabalEmployerId, ResourceItemId[]> = {
  TERRAN_GRID: ['encrypted-grid-drive', 'echo-glass-shard'],
  LEGION: ['legion-blood-iron', 'combustion-cylinder'],
  SOLARIS: ['veil-ash-canister', 'sanguine-ampoule'],
};

let debugForceBribeOffer = false;
let debugForceRivalSponsor: CabalEmployerId | null = null;

export function setDebugForceBribeOffer(force: boolean): void {
  debugForceBribeOffer = force;
}

export function setDebugForceRivalSponsor(sponsorId: CabalEmployerId | null): void {
  debugForceRivalSponsor = sponsorId;
}

export function isDebugForceBribeOffer(): boolean {
  return debugForceBribeOffer;
}

function hashSeed(...parts: string[]): number {
  let hash = 0;
  parts.forEach((part) => {
    for (let index = 0; index < part.length; index += 1) {
      hash = ((hash << 5) - hash + part.charCodeAt(index)) | 0;
    }
  });
  return Math.abs(hash);
}

function seededRoll(seed: string, thresholdPct: number): boolean {
  if (debugForceBribeOffer) return true;
  const roll = hashSeed(seed) % 100;
  return roll < thresholdPct;
}

export function isBribeEligibleResource(resourceId: ResourceItemId): boolean {
  if (resourceId === 'tarnished-dog-tags') return false;
  const category = getResourceCategory(resourceId);
  if (category === 'UNSTABLE' || category === 'INTEL' || category === 'CONTRABAND') {
    return true;
  }
  if (hasResourceUsageTag(resourceId, 'APEX_CARGO')) return true;
  if (hasResourceUsageTag(resourceId, 'CONTRACT_TARGET')) return true;
  return false;
}

export function resolveBribeGenerationChance(resourceId: ResourceItemId): number {
  const category = getResourceCategory(resourceId);
  if (hasResourceUsageTag(resourceId, 'APEX_CARGO') || category === 'CONTRABAND') {
    return 70;
  }
  if (category === 'UNSTABLE' || category === 'INTEL') {
    return 40;
  }
  return 25;
}

export function isTrackedContractCargo(
  resourceId: ResourceItemId,
  contract: ActiveRunContract | null,
): boolean {
  if (hasResourceUsageTag(resourceId, 'APEX_CARGO')) return true;
  if (hasResourceUsageTag(resourceId, 'CONTRACT_TARGET')) return true;
  if (getResourceCategory(resourceId) === 'CONTRABAND') return true;
  if (contract?.sponsorId && contract.targetResourceId === resourceId) return true;
  if (contract?.targetResourceOptions?.includes(resourceId)) return true;
  return false;
}

function sponsorInterestScore(sponsorId: CabalEmployerId, resourceId: ResourceItemId): number {
  const preferred = SPONSOR_PREFERRED_RESOURCES[sponsorId];
  const index = preferred.indexOf(resourceId);
  if (index >= 0) return 100 - index * 5;
  const category = getResourceCategory(resourceId);
  switch (sponsorId) {
    case 'TERRAN_GRID':
      return category === 'INTEL' ? 30 : category === 'STABLE' ? 20 : 10;
    case 'LEGION':
      return hasResourceUsageTag(resourceId, 'LEGION_MATERIAL') ? 40 : 10;
    case 'SOLARIS':
      return category === 'UNSTABLE' ? 40 : 10;
    default:
      return 0;
  }
}

function pickRivalSponsor(
  resourceId: ResourceItemId,
  originalSponsorId: CabalEmployerId,
  seed: string,
): CabalEmployerId | null {
  if (debugForceRivalSponsor && debugForceRivalSponsor !== originalSponsorId) {
    return debugForceRivalSponsor;
  }

  const candidates = ALL_SPONSORS
    .filter((id) => id !== originalSponsorId)
    .map((id) => ({ id, score: sponsorInterestScore(id, resourceId) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  if (candidates.length === 0) return null;

  const topScore = candidates[0].score;
  const topCandidates = candidates.filter((entry) => entry.score === topScore);
  const pickIndex = hashSeed(seed, 'rival') % topCandidates.length;
  return topCandidates[pickIndex]?.id ?? null;
}

function buildRivalReward(
  contract: ActiveRunContract,
  rivalSponsorId: CabalEmployerId,
  quantity: number,
): Pick<BribeOffer, 'credits' | 'reputationGain' | 'resourceBonusIds'> {
  const baseCredits = contract.reward?.credits ?? 150;
  const baseRep = contract.reward?.reputation ?? 2;
  const credits = Math.round(baseCredits * 1.35 * quantity);
  const reputationGain = Math.max(1, Math.round(baseRep * 1.75 * quantity));
  const bonusPool = SPONSOR_BONUS_RESOURCES[rivalSponsorId];
  const resourceBonusIds = bonusPool.slice(0, Math.min(quantity, 2));
  return { credits, reputationGain, resourceBonusIds };
}

export function maybeGenerateBribeOffer({
  resourceId,
  quantity,
  contract,
  seed,
}: {
  resourceId: ResourceItemId;
  quantity: number;
  contract: ActiveRunContract | null;
  seed: string;
}): BribeOffer | null {
  if (!contract?.sponsorId || !contract.contractId) return null;
  if (!isContractTargetResource(resourceId, contract)) return null;
  if (!isBribeEligibleResource(resourceId)) return null;

  const chance = resolveBribeGenerationChance(resourceId);
  const offerSeed = `${seed}:${resourceId}:${quantity}`;
  if (!seededRoll(offerSeed, chance)) return null;

  const rivalSponsorId = pickRivalSponsor(resourceId, contract.sponsorId, offerSeed);
  if (!rivalSponsorId) return null;

  const rewards = buildRivalReward(contract, rivalSponsorId, quantity);
  return {
    rivalSponsorId,
    resourceId,
    quantity,
    credits: rewards.credits,
    reputationGain: rewards.reputationGain,
    resourceBonusIds: rewards.resourceBonusIds,
    flavorLine: SPONSOR_BRIBE_FLAVOR[rivalSponsorId],
    severity: 'HARD_BETRAYAL',
  };
}

export function resolveActionBetrayalPreview({
  action,
  resourceId,
  contract,
  bribeOffer,
  routedQuantity,
}: {
  action: CargoRoutingAction;
  resourceId: ResourceItemId;
  contract: ActiveRunContract | null;
  bribeOffer: BribeOffer | null;
  routedQuantity: number;
}): BetrayalActionPreview {
  const tracked = isTrackedContractCargo(resourceId, contract);
  const originalRep = contract?.reward?.reputation ?? 0;

  switch (action) {
    case 'DELIVER_SPONSOR':
      return {
        severity: 'NONE',
        outcomeKind: 'COMPLETE',
        originalSponsorRepDelta: 0,
        rivalSponsorRepDelta: 0,
        creditsGain: contract?.reward?.credits ?? 0,
        reputationGain: contract?.reward?.reputation ?? 0,
        warning: null,
        countsAsBetrayal: false,
      };
    case 'DELIVER_RIVAL_SPONSOR': {
      const offer = bribeOffer;
      return {
        severity: 'HARD_BETRAYAL',
        outcomeKind: 'BETRAYED_TO_RIVAL',
        originalSponsorRepDelta: -2,
        rivalSponsorRepDelta: offer?.reputationGain ?? Math.max(1, Math.round(originalRep * 1.75)),
        creditsGain: offer?.credits ?? Math.round((contract?.reward?.credits ?? 150) * 1.35 * routedQuantity),
        reputationGain: offer?.reputationGain ?? 0,
        warning: offer
          ? `Betray ${sponsorDisplayName(contract?.sponsorId ?? '')} contract — deliver to ${sponsorDisplayName(offer.rivalSponsorId)}.`
          : 'Rival sponsor delivery will fail the original contract.',
        countsAsBetrayal: true,
      };
    }
    case 'SELL_FENCE': {
      const fenceValue = getResourceSellValue(resourceId) * routedQuantity;
      return {
        severity: 'SOFT_BETRAYAL',
        outcomeKind: 'FENCED_TO_BLACK_MARKET',
        originalSponsorRepDelta: -1,
        rivalSponsorRepDelta: 0,
        creditsGain: fenceValue,
        reputationGain: 0,
        warning: 'Selling contract cargo betrays the sponsor contract.',
        countsAsBetrayal: true,
      };
    }
    case 'CONTRIBUTE_OPERATION':
      return {
        severity: tracked ? 'SOFT_BETRAYAL' : 'FAILURE',
        outcomeKind: 'CONTRIBUTED_TO_OPERATION',
        originalSponsorRepDelta: tracked ? -1 : 0,
        rivalSponsorRepDelta: 0,
        creditsGain: 0,
        reputationGain: 0,
        warning: tracked
          ? 'Contributing tracked contract cargo redirects delivery from your sponsor.'
          : 'Contract will not complete if cargo is contributed.',
        countsAsBetrayal: tracked,
      };
    case 'OPEN_SEALED':
    case 'OPEN_AT_HUB':
      return resolveOpenSealedBetrayalPreview(resourceId, contract);
    case 'KEEP_STASH':
    default:
      return {
        severity: tracked ? 'SOFT_BETRAYAL' : 'FAILURE',
        outcomeKind: 'KEPT_BY_PLAYER',
        originalSponsorRepDelta: tracked ? -1 : 0,
        rivalSponsorRepDelta: 0,
        creditsGain: 0,
        reputationGain: 0,
        warning: tracked
          ? 'Tracked contract cargo retained — sponsor will notice.'
          : 'Contract will not complete if cargo is kept.',
        countsAsBetrayal: tracked,
      };
  }
}

function resolveOpenSealedBetrayalPreview(
  resourceId: ResourceItemId,
  contract: ActiveRunContract | null,
): BetrayalActionPreview {
  const tracked = isTrackedContractCargo(resourceId, contract);
  return {
    severity: tracked ? 'SOFT_BETRAYAL' : 'FAILURE',
    outcomeKind: 'FAILED' as ContractOutcomeKind,
    originalSponsorRepDelta: tracked ? -1 : 0,
    rivalSponsorRepDelta: 0,
    creditsGain: 0,
    reputationGain: 0,
    warning: resourceId === 'sealed-containment-casket' || resourceId === 'blacksite-specimen-jar'
      ? 'Opening this will prevent sealed delivery.'
      : 'Opening consumes contract cargo before delivery.',
    countsAsBetrayal: tracked,
  };
}

export function severityRank(severity: BetrayalSeverity): number {
  switch (severity) {
    case 'HARD_BETRAYAL':
      return 3;
    case 'SOFT_BETRAYAL':
      return 2;
    case 'FAILURE':
      return 1;
    default:
      return 0;
  }
}

export function outcomeKindLabel(outcomeKind: ContractOutcomeKind): string {
  switch (outcomeKind) {
    case 'COMPLETE':
      return 'Contract honored';
    case 'BETRAYED_TO_RIVAL':
      return 'Contract betrayed — rival delivery';
    case 'FENCED_TO_BLACK_MARKET':
      return 'Contract betrayed — Black Market sale';
    case 'KEPT_BY_PLAYER':
      return 'Contract failed — cargo retained';
    case 'CONTRIBUTED_TO_OPERATION':
      return 'Contract redirected — operation contribution';
    case 'PARTIAL':
      return 'Contract partially failed';
    case 'ABANDONED':
      return 'Contract abandoned';
    default:
      return 'Contract failed';
  }
}

export function formatMidRunBribeFlavorMessage(resourceId: ResourceItemId): string | null {
  if (!isBribeEligibleResource(resourceId)) return null;
  const category = getResourceCategory(resourceId);
  if (hasResourceUsageTag(resourceId, 'FENCE_VALUE')) {
    return 'Black Market interest registered.';
  }
  if (category === 'INTEL') {
    return 'Encrypted buyer signal detected.';
  }
  if (category === 'UNSTABLE' || hasResourceUsageTag(resourceId, 'APEX_CARGO')) {
    return 'Rival sponsor offer pending extraction.';
  }
  return 'Unauthorized buyer signal detected.';
}
