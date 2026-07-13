import type { BetrayalActionPreview, BetrayalEvent, BribeOffer } from './betrayal';
import type { ActiveRunContract, ContractExtractionKind, ContractRunProgress } from './contract';
import type { ResourceItemId, ResourceQuantity } from './resourceItem';
import type { CabalEmployerId, OperationObjectiveKind } from './worldState';

export type CargoRoutingAction =
  | 'KEEP_STASH'
  | 'DELIVER_SPONSOR'
  | 'DELIVER_RIVAL_SPONSOR'
  | 'SELL_FENCE'
  | 'CONTRIBUTE_OPERATION'
  | 'OPEN_AT_HUB';

export type RoutableCargoSource = 'EXTRACTED' | 'BANKED';

export interface RoutableCargoItem {
  resourceId: ResourceItemId;
  quantity: number;
  source: RoutableCargoSource;
  isContractTarget: boolean;
  isOperationTarget: boolean;
  canFence: boolean;
  canKeep: boolean;
  canDeliver: boolean;
  canDeliverRival: boolean;
  canContribute: boolean;
  canOpenAtHub: boolean;
  openAtHubEnabled: boolean;
  validActions: CargoRoutingAction[];
  recommendedAction: CargoRoutingAction;
  contractWarning: string | null;
  trackedContractCargo: boolean;
  bribeOffer: BribeOffer | null;
  betrayalPreviewByAction: Partial<Record<CargoRoutingAction, BetrayalActionPreview>>;
}

export interface CargoRoutingContext {
  contract: ActiveRunContract | null;
  operationObjectiveKind: OperationObjectiveKind | null;
  operationTargetResourceNames: string[] | undefined;
  operationAcceptsTargetResources: boolean;
}

export interface PostRunCargoSplit {
  autoStash: ResourceQuantity;
  pendingItems: RoutableCargoItem[];
}

export interface CargoRoutingDecision {
  resourceId: ResourceItemId;
  quantity: number;
  action: CargoRoutingAction;
  rivalSponsorId?: CabalEmployerId;
}

export interface CargoRoutingOutcomeLine {
  resourceId: ResourceItemId;
  quantity: number;
  action: CargoRoutingAction;
  label: string;
  creditsGained?: number;
  operationProgressGained?: number;
  casketRewardLabel?: string;
}

export interface RivalDeliveryReward {
  sponsorId: CabalEmployerId;
  credits: number;
  reputation: number;
  resourceBonusIds: ResourceItemId[];
}

export interface CargoRoutingResult {
  autoStashed: ResourceQuantity;
  delivered: ResourceQuantity;
  deliveredToRival: Partial<Record<CabalEmployerId, ResourceQuantity>>;
  fenced: ResourceQuantity;
  contributed: ResourceQuantity;
  kept: ResourceQuantity;
  opened: ResourceQuantity;
  creditsFromFence: number;
  creditsFromRivalDelivery: number;
  creditsFromCasketOpen: number;
  casketOpenRewards: ResourceQuantity;
  operationProgressFromCargo: number;
  outcomeLines: CargoRoutingOutcomeLine[];
  deliveredResourcesForContract: ResourceQuantity;
  rivalDeliveryRewards: RivalDeliveryReward[];
  betrayalEvents: BetrayalEvent[];
}

export interface PostRunRoutingDebriefState {
  pendingItems: RoutableCargoItem[];
  autoStashed: ResourceQuantity;
  requiresRouting: boolean;
  routingContext: CargoRoutingContext;
  initialContractPendingDelivery: boolean;
  activeContract: ActiveRunContract | null;
  contractProgress: ContractRunProgress;
  extractionKind: ContractExtractionKind;
  operationId: string | null;
  operationContributionPerStack: number;
  bribeOfferSeed: string;
}
