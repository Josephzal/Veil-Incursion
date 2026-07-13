import type { BetrayalEvent, SponsorTrustStats } from '../types/betrayal';
import type { ContractResult } from '../types/contract';
import type { FactionType, PlayerAccount } from '../types/game';
import type { CargoRoutingResult } from '../types/postRunCargoRouting';
import { createDefaultSponsorTrustStats } from '../types/betrayal';

const MAX_BETRAYAL_HISTORY = 50;

export function mergeSponsorTrustStats(
  existing: Partial<Record<FactionType, SponsorTrustStats>>,
  sponsorId: FactionType,
  patch: Partial<SponsorTrustStats>,
): Partial<Record<FactionType, SponsorTrustStats>> {
  const current = existing[sponsorId] ?? createDefaultSponsorTrustStats();
  return {
    ...existing,
    [sponsorId]: { ...current, ...patch },
  };
}

export function applyBetrayalConsequencesToAccount(
  account: PlayerAccount,
  contractResult: ContractResult,
  routingResult: CargoRoutingResult,
  betrayalEvents: BetrayalEvent[],
): PlayerAccount {
  let next = { ...account };
  let sponsorReputation = { ...next.sponsorReputation };
  let sponsorTrustStats = { ...next.sponsorTrustStats };

  if (contractResult.sponsorId) {
    const sponsorId = contractResult.sponsorId;
    const trust = sponsorTrustStats[sponsorId] ?? createDefaultSponsorTrustStats();

    if (contractResult.status === 'SUCCESS') {
      sponsorTrustStats = mergeSponsorTrustStats(sponsorTrustStats, sponsorId, {
        contractsCompleted: trust.contractsCompleted + 1,
        cargoDelivered: trust.cargoDelivered + 1,
      });
    } else if (contractResult.betrayalSeverity === 'HARD_BETRAYAL') {
      sponsorTrustStats = mergeSponsorTrustStats(sponsorTrustStats, sponsorId, {
        contractsBetrayed: trust.contractsBetrayed + 1,
        cargoStolenOrRedirected: trust.cargoStolenOrRedirected + 1,
      });
    } else if (contractResult.betrayalSeverity === 'SOFT_BETRAYAL') {
      sponsorTrustStats = mergeSponsorTrustStats(sponsorTrustStats, sponsorId, {
        cargoStolenOrRedirected: trust.cargoStolenOrRedirected + 1,
      });
    } else if (contractResult.status === 'FAILED') {
      sponsorTrustStats = mergeSponsorTrustStats(sponsorTrustStats, sponsorId, {
        contractsFailed: trust.contractsFailed + 1,
      });
    }

    const originalDelta = contractResult.originalSponsorRepDelta ?? 0;
    if (originalDelta < 0) {
      sponsorReputation = {
        ...sponsorReputation,
        [sponsorId]: Math.max(0, (sponsorReputation[sponsorId] ?? 0) + originalDelta),
      };
    }
  }

  routingResult.rivalDeliveryRewards.forEach((reward) => {
    const rivalTrust = sponsorTrustStats[reward.sponsorId] ?? createDefaultSponsorTrustStats();
    sponsorTrustStats = mergeSponsorTrustStats(sponsorTrustStats, reward.sponsorId, {
      bribesAcceptedFromSponsor: rivalTrust.bribesAcceptedFromSponsor + 1,
      cargoDelivered: rivalTrust.cargoDelivered + 1,
    });
    sponsorReputation = {
      ...sponsorReputation,
      [reward.sponsorId]: (sponsorReputation[reward.sponsorId] ?? 0) + reward.reputation,
    };
  });

  if (contractResult.rivalSponsorId && contractResult.rivalSponsorRepDelta) {
    const rivalId = contractResult.rivalSponsorId;
    if (!routingResult.rivalDeliveryRewards.some((entry) => entry.sponsorId === rivalId)) {
      sponsorReputation = {
        ...sponsorReputation,
        [rivalId]: (sponsorReputation[rivalId] ?? 0) + contractResult.rivalSponsorRepDelta,
      };
    }
  }

  const betrayalHistory = [
    ...betrayalEvents,
    ...(next.betrayalHistory ?? []),
  ].slice(0, MAX_BETRAYAL_HISTORY);

  return {
    ...next,
    sponsorReputation,
    sponsorTrustStats,
    betrayalHistory,
  };
}

export function formatBetrayalHistorySnapshot(events: BetrayalEvent[] | undefined): string {
  if (!events?.length) return 'BETRAYAL HISTORY — none recorded.';
  return [
    'BETRAYAL HISTORY',
    ...events.slice(0, 10).map((event) => (
      `${event.betrayedSponsorId} → ${event.receivingDestination} // ${event.cargoId} x${event.quantity} // ${event.severity}`
    )),
  ].join('\n');
}
