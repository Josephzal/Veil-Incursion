import type { ClassType } from './game';
import type { ResourceItemId } from './resourceItem';
import type { CabalEmployerId } from './worldState';

export type BetrayalSeverity = 'NONE' | 'FAILURE' | 'SOFT_BETRAYAL' | 'HARD_BETRAYAL';

export type ContractOutcomeKind =
  | 'COMPLETE'
  | 'FAILED'
  | 'PARTIAL'
  | 'ABANDONED'
  | 'BETRAYED_TO_RIVAL'
  | 'FENCED_TO_BLACK_MARKET'
  | 'KEPT_BY_PLAYER'
  | 'CONTRIBUTED_TO_OPERATION';

export type BetrayalDestination = CabalEmployerId | 'BLACK_MARKET' | 'OPERATION' | 'SELF';

export interface BribeOffer {
  rivalSponsorId: CabalEmployerId;
  resourceId: ResourceItemId;
  quantity: number;
  credits: number;
  reputationGain: number;
  resourceBonusIds: ResourceItemId[];
  flavorLine: string;
  severity: BetrayalSeverity;
}

export interface BetrayalActionPreview {
  severity: BetrayalSeverity;
  outcomeKind: ContractOutcomeKind;
  originalSponsorRepDelta: number;
  rivalSponsorRepDelta: number;
  creditsGain: number;
  reputationGain: number;
  warning: string | null;
  countsAsBetrayal: boolean;
}

export interface BetrayalEvent {
  runId: string;
  betrayedSponsorId: CabalEmployerId;
  receivingDestination: BetrayalDestination;
  receivingSponsorId: CabalEmployerId | null;
  cargoId: ResourceItemId;
  quantity: number;
  severity: BetrayalSeverity;
  depthReached: number;
  playerClass: ClassType;
  canGenerateBetrayerEchoLater: boolean;
  timestamp: number;
}

export interface SponsorTrustStats {
  contractsCompleted: number;
  contractsFailed: number;
  contractsBetrayed: number;
  bribesAcceptedFromSponsor: number;
  cargoDelivered: number;
  cargoStolenOrRedirected: number;
}

export function createDefaultSponsorTrustStats(): SponsorTrustStats {
  return {
    contractsCompleted: 0,
    contractsFailed: 0,
    contractsBetrayed: 0,
    bribesAcceptedFromSponsor: 0,
    cargoDelivered: 0,
    cargoStolenOrRedirected: 0,
  };
}
