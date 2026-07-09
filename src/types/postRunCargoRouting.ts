import type { ActiveRunContract, ContractExtractionKind, ContractRunProgress } from './contract';
import type { ResourceItemId, ResourceQuantity } from './resourceItem';
import type { OperationObjectiveKind } from './worldState';

export type CargoRoutingAction =
  | 'KEEP_STASH'
  | 'DELIVER_SPONSOR'
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
  canContribute: boolean;
  canOpenAtHub: boolean;
  openAtHubEnabled: boolean;
  validActions: CargoRoutingAction[];
  recommendedAction: CargoRoutingAction;
  contractWarning: string | null;
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

export interface CargoRoutingResult {
  autoStashed: ResourceQuantity;
  delivered: ResourceQuantity;
  fenced: ResourceQuantity;
  contributed: ResourceQuantity;
  kept: ResourceQuantity;
  opened: ResourceQuantity;
  creditsFromFence: number;
  creditsFromCasketOpen: number;
  casketOpenRewards: ResourceQuantity;
  operationProgressFromCargo: number;
  outcomeLines: CargoRoutingOutcomeLine[];
  deliveredResourcesForContract: ResourceQuantity;
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
}
